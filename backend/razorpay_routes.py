"""Razorpay payment integration for IFEELINCOLOR subscriptions.

Supports the 5 audience-based subscription flows:
  - patient_portal           (Patient → IFEELINCOLOR Portal)
  - patient_clinician        (Patient → Clinician)
  - patient_organization     (Patient → Organization)
  - clinician_portal         (Clinician → IFEELINCOLOR Portal)
  - organization_portal      (Organization → IFEELINCOLOR Portal)

Keys are DYNAMICALLY loaded from `db.payment_settings` so the admin can
configure them via the UI POST-DEPLOY without restarting the backend.

Endpoints:
  POST /api/razorpay/order              Create Razorpay order for a plan
  POST /api/razorpay/verify             Verify signature + fulfil subscription
  POST /api/webhook/razorpay            Webhook handler
  GET  /api/razorpay/config             Public: returns key_id + mode (for Checkout JS)
  GET  /api/admin/payment-settings      Admin: read current settings (key_id masked)
  PUT  /api/admin/payment-settings      Admin: write Razorpay keys
"""
import os
import uuid
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

import razorpay
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

razorpay_router = APIRouter()
db = None


def set_razorpay_db(_db):
    global db
    db = _db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


SETTINGS_DOC_ID = "razorpay_default"


async def _load_settings() -> dict:
    """Returns the current Razorpay settings doc (creates a blank one if missing).
    Shape: {key_id, key_secret, webhook_secret, mode: 'test'|'live', currency, enabled}
    """
    s = await db.payment_settings.find_one({"_id_str": SETTINGS_DOC_ID}, {"_id": 0})
    if not s:
        s = {
            "_id_str": SETTINGS_DOC_ID,
            "key_id": "",
            "key_secret": "",
            "webhook_secret": "",
            "mode": "test",
            "currency": "INR",
            "enabled": False,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.payment_settings.insert_one(s)
        s.pop("_id", None)
    return s


async def _razorpay_client() -> razorpay.Client:
    s = await _load_settings()
    if not (s.get("key_id") and s.get("key_secret")):
        raise HTTPException(503, "Razorpay not configured. Admin must add keys at /admin/payment-setup")
    return razorpay.Client(auth=(s["key_id"], s["key_secret"]))


async def _current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        # Fallback: some flows store session on user doc directly
        user = await db.users.find_one({"session_tokens": token}, {"_id": 0})
        if not user:
            raise HTTPException(401, "Session expired")
        return user
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def _resolve_plan(kind: str, plan_id: str) -> dict:
    """Server-side price lookup — never trust frontend amount."""
    audience_map = {
        "portal":              "patient_portal",
        "organization":        "patient_organization",
        "clinician_plan":      "clinician_portal",
        "patient_doctor":      "patient_clinician",
        "organization_portal": "organization_portal",
    }
    audience = audience_map.get(kind)
    if not audience:
        raise HTTPException(400, "Invalid kind")
    plan = await db.subscription_plans.find_one({"plan_id": plan_id, "audience": audience}, {"_id": 0})
    if not plan:
        legacy_filter = {
            "patient_portal":        {"$or": [{"plan_type": "patient"}, {"plan_type": "portal"}, {"plan_type": {"$exists": False}}]},
            "patient_clinician":     {"plan_type": "clinician"},
            "patient_organization":  {"plan_type": "organization"},
            "clinician_portal":      {"plan_type": "clinician"},
            "organization_portal":   {"plan_type": "organization_portal"},
        }[audience]
        plan = await db.subscription_plans.find_one({"plan_id": plan_id, **legacy_filter}, {"_id": 0})
    if not plan:
        raise HTTPException(404, f"Plan {plan_id} not found")
    amount = float(plan.get("price_usd") or plan.get("price") or 0)
    if amount <= 0:
        raise HTTPException(400, "Plan amount must be > 0")
    return {
        "plan_id": plan["plan_id"],
        "name": plan.get("name"),
        "amount": amount,
        "duration_days": int(plan.get("duration_days") or 30),
        "audience": audience,
        "clinician_id": plan.get("clinician_id"),
        "org_id": plan.get("org_id"),
    }


# ─── Public config (read-only) ─────────────────────────────────
@razorpay_router.get("/razorpay/config")
async def get_public_config():
    """Returns the public Razorpay key_id (safe to expose) for the Checkout JS."""
    s = await _load_settings()
    return {
        "key_id": s.get("key_id") or "",
        "mode": s.get("mode") or "test",
        "currency": s.get("currency") or "INR",
        "enabled": bool(s.get("enabled")) and bool(s.get("key_id")),
    }


# ─── Admin: payment settings ───────────────────────────────────
class PaymentSettingsUpdate(BaseModel):
    key_id: Optional[str] = None
    key_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    mode: Optional[Literal["test", "live"]] = None
    currency: Optional[str] = None
    enabled: Optional[bool] = None


async def _require_admin(request: Request):
    """Verify caller has an active admin session (admin_token cookie)."""
    try:
        from admin_auth import get_current_admin
        return await get_current_admin(request, db)
    except Exception:
        raise HTTPException(403, "Admin authentication required")


@razorpay_router.get("/admin/payment-settings")
async def admin_get_payment_settings(request: Request):
    await _require_admin(request)
    s = await _load_settings()
    return {
        "key_id": s.get("key_id") or "",
        "key_id_masked": _mask(s.get("key_id") or ""),
        "key_secret_set": bool(s.get("key_secret")),
        "webhook_secret_set": bool(s.get("webhook_secret")),
        "mode": s.get("mode") or "test",
        "currency": s.get("currency") or "INR",
        "enabled": bool(s.get("enabled")),
        "updated_at": s.get("updated_at"),
    }


def _mask(v: str) -> str:
    if not v:
        return ""
    if len(v) <= 8:
        return v[:2] + "***"
    return v[:6] + "***" + v[-2:]


@razorpay_router.put("/admin/payment-settings")
async def admin_update_payment_settings(payload: PaymentSettingsUpdate, request: Request):
    await _require_admin(request)
    s = await _load_settings()
    raw = payload.model_dump(exclude_none=True)
    if raw:
        await db.payment_settings.update_one(
            {"_id_str": SETTINGS_DOC_ID},
            {"$set": {**raw, "updated_at": _now()}},
            upsert=True,
        )
    s = await _load_settings()
    return {
        "ok": True,
        "key_id_masked": _mask(s.get("key_id") or ""),
        "mode": s.get("mode"),
        "enabled": bool(s.get("enabled")) and bool(s.get("key_id")),
    }


# ─── Create order ──────────────────────────────────────────────
class OrderRequest(BaseModel):
    kind: str              # portal | clinician_plan | patient_doctor | organization | organization_portal
    plan_id: str
    doctor_id: Optional[str] = None  # required when kind=patient_doctor


@razorpay_router.post("/razorpay/order")
async def create_razorpay_order(payload: OrderRequest, request: Request):
    user = await _current_user(request)
    plan = await _resolve_plan(payload.kind, payload.plan_id)
    if payload.kind == "patient_doctor" and not payload.doctor_id:
        raise HTTPException(400, "doctor_id required for clinician subscription")

    s = await _load_settings()
    currency = s.get("currency") or "INR"
    # Razorpay expects amount in smallest currency unit (paise for INR, cents for USD).
    amount_subunits = int(round(plan["amount"] * 100))

    cli = await _razorpay_client()
    receipt = f"ifc_{uuid.uuid4().hex[:16]}"
    try:
        order = cli.order.create({
            "amount": amount_subunits,
            "currency": currency,
            "receipt": receipt[:40],
            "payment_capture": 1,
            "notes": {
                "user_id": user["user_id"],
                "kind": payload.kind,
                "plan_id": plan["plan_id"],
                "doctor_id": payload.doctor_id or "",
                "audience": plan.get("audience") or "",
            },
        })
    except Exception as e:
        raise HTTPException(502, f"Razorpay order error: {str(e)[:160]}")

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "provider": "razorpay",
        "order_id": order["id"],
        "user_id": user["user_id"],
        "user_email": user.get("email"),
        "kind": payload.kind,
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "doctor_id": payload.doctor_id,
        "amount": plan["amount"],
        "amount_subunits": amount_subunits,
        "currency": currency,
        "status": "created",
        "payment_status": "pending",
        "duration_days": plan["duration_days"],
        "fulfilled": False,
        "audience": plan.get("audience"),
        "org_id": plan.get("org_id"),
        "clinician_id": plan.get("clinician_id"),
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.payment_transactions.insert_one(txn)

    return {
        "order_id": order["id"],
        "amount": amount_subunits,
        "currency": currency,
        "key_id": s.get("key_id"),
        "plan_name": plan["name"],
        "user": {"name": user.get("name"), "email": user.get("email"), "contact": user.get("mobile") or ""},
    }


# ─── Verify signature + fulfil ─────────────────────────────────
class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@razorpay_router.post("/razorpay/verify")
async def verify_razorpay_payment(payload: VerifyRequest, request: Request):
    user = await _current_user(request)
    txn = await db.payment_transactions.find_one(
        {"order_id": payload.razorpay_order_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(404, "Transaction not found")

    s = await _load_settings()
    secret = (s.get("key_secret") or "").encode()
    payload_str = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode()
    expected = hmac.new(secret, payload_str, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        await db.payment_transactions.update_one(
            {"order_id": payload.razorpay_order_id},
            {"$set": {"status": "signature_failed", "updated_at": _now()}},
        )
        raise HTTPException(400, "Invalid signature")

    await db.payment_transactions.update_one(
        {"order_id": payload.razorpay_order_id},
        {"$set": {
            "status": "paid",
            "payment_status": "paid",
            "payment_id": payload.razorpay_payment_id,
            "signature": payload.razorpay_signature,
            "updated_at": _now(),
        }},
    )
    fresh = await db.payment_transactions.find_one({"order_id": payload.razorpay_order_id}, {"_id": 0})
    result = await _fulfill(fresh)
    return {"ok": True, "fulfilled": result.get("fulfilled"), "kind": fresh.get("kind"), "plan_name": fresh.get("plan_name")}


async def _fulfill(txn: dict) -> dict:
    """Activate the corresponding subscription record. Idempotent."""
    if txn.get("fulfilled"):
        return {"fulfilled": True, "already": True}
    kind = txn.get("kind")
    user_id = txn.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return {"fulfilled": False, "reason": "user missing"}
    starts = datetime.now(timezone.utc)
    ends = starts + timedelta(days=txn.get("duration_days") or 30)
    audience = txn.get("audience")

    if kind in ("portal", "organization"):
        sub = {
            "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "plan_id": txn.get("plan_id"),
            "plan_name": txn.get("plan_name"),
            "amount_paid": txn.get("amount"),
            "currency": txn.get("currency"),
            "audience": audience,
            "org_id": txn.get("org_id"),
            "status": "active",
            "payment_status": "razorpay_paid",
            "razorpay_order_id": txn.get("order_id"),
            "razorpay_payment_id": txn.get("payment_id"),
            "start_date": starts.isoformat(),
            "end_date": ends.isoformat(),
            "created_at": _now(),
        }
        await db.patient_subscriptions.update_one(
            {"user_id": user_id, "status": "active"},
            {"$set": sub}, upsert=True,
        )
    elif kind == "clinician_plan":
        sub = {
            "subscription_id": f"clinsub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "plan_id": txn.get("plan_id"),
            "plan_name": txn.get("plan_name"),
            "amount_paid_usd": txn.get("amount"),
            "currency": txn.get("currency"),
            "status": "active",
            "payment_status": "razorpay_paid",
            "razorpay_order_id": txn.get("order_id"),
            "razorpay_payment_id": txn.get("payment_id"),
            "start_date": starts.isoformat(),
            "end_date": ends.isoformat(),
            "created_at": _now(),
        }
        await db.clinician_subscriptions.update_one(
            {"user_id": user_id, "status": "active"},
            {"$set": sub}, upsert=True,
        )
    elif kind == "organization_portal":
        sub = {
            "subscription_id": f"orgsub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "plan_id": txn.get("plan_id"),
            "plan_name": txn.get("plan_name"),
            "amount_paid": txn.get("amount"),
            "currency": txn.get("currency"),
            "audience": "organization_portal",
            "status": "active",
            "payment_status": "razorpay_paid",
            "razorpay_order_id": txn.get("order_id"),
            "razorpay_payment_id": txn.get("payment_id"),
            "start_date": starts.isoformat(),
            "end_date": ends.isoformat(),
            "created_at": _now(),
        }
        await db.organization_subscriptions.update_one(
            {"user_id": user_id, "status": "active"},
            {"$set": sub}, upsert=True,
        )
    elif kind == "patient_doctor":
        doctor_id = txn.get("doctor_id")
        real_clin = await db.users.find_one(
            {"user_id": doctor_id, "role": "clinician"}, {"_id": 0, "password_hash": 0}
        )
        if real_clin:
            info = real_clin.get("clinician_info") or {}
            doc_info = {
                "doctor_id": real_clin["user_id"],
                "clinician_id": real_clin["user_id"],
                "name": real_clin.get("name"),
                "specialty": info.get("specialization") or "Mental Health Specialist",
                "avatar_color": "#5BC0BE",
            }
        else:
            doc_info = {"doctor_id": doctor_id, "name": "Doctor"}
        rec = {
            "subscription_id": f"docsub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            **doc_info,
            "plan_id": txn.get("plan_id"),
            "plan_name": txn.get("plan_name"),
            "amount_paid_usd": txn.get("amount"),
            "currency": txn.get("currency"),
            "payment_status": "razorpay_paid",
            "razorpay_order_id": txn.get("order_id"),
            "razorpay_payment_id": txn.get("payment_id"),
            "start_date": starts.isoformat(),
            "end_date": ends.isoformat(),
            "subscribed_at": _now(),
        }
        await db.patient_doctor_subscriptions.update_one(
            {"user_id": user_id, "doctor_id": doctor_id},
            {"$set": rec}, upsert=True,
        )
        await db.patient_activity.insert_one({
            "activity_id": f"act_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "doctor_subscribed",
            "title": f"Subscribed to {doc_info.get('name', 'doctor')}",
            "detail": f"{txn.get('plan_name')} · {txn.get('currency')} {txn.get('amount')}",
            "created_at": _now(),
        })

    await db.payment_transactions.update_one(
        {"order_id": txn["order_id"]},
        {"$set": {"fulfilled": True, "updated_at": _now()}},
    )
    return {"fulfilled": True}


# ─── Webhook ───────────────────────────────────────────────────
@razorpay_router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("X-Razorpay-Signature", "")
    s = await _load_settings()
    webhook_secret = (s.get("webhook_secret") or "").encode()
    if webhook_secret:
        expected = hmac.new(webhook_secret, body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return {"ok": False, "error": "invalid signature"}
    import json as _json
    try:
        evt = _json.loads(body.decode("utf-8"))
    except Exception:
        return {"ok": False, "error": "invalid body"}
    evt_type = evt.get("event")
    if evt_type == "payment.captured":
        pay = (evt.get("payload") or {}).get("payment", {}).get("entity", {})
        order_id = pay.get("order_id")
        if order_id:
            txn = await db.payment_transactions.find_one({"order_id": order_id}, {"_id": 0})
            if txn and not txn.get("fulfilled"):
                await db.payment_transactions.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "paid", "payment_status": "paid", "payment_id": pay.get("id"), "updated_at": _now()}},
                )
                fresh = await db.payment_transactions.find_one({"order_id": order_id}, {"_id": 0})
                await _fulfill(fresh)
    return {"ok": True}
