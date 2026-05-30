"""Stripe Checkout integration for IFEELINCOLOR subscriptions.
Three checkout flows:
  - Patient → Portal plan
  - Clinician → Clinician plan (their own tier)
  - Patient → Clinician (paid doctor subscription)

Security: amount is ALWAYS pulled from the server-side `subscription_plans` / clinician plans
collection — frontend only sends `plan_id` + `kind` + `origin_url`.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import stripe
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from stripe_adapter import (
    StripeCheckout, CheckoutSessionRequest,
)

stripe_router = APIRouter()
db = None  # injected from server.py


def set_stripe_db(_db):
    global db
    db = _db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _current_user(request: Request) -> dict:
    """Resolve current user from session_token cookie. Raises 401 if absent/expired."""
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


class CheckoutPayload(BaseModel):
    kind: str           # "portal" | "clinician_plan" | "patient_doctor" | "organization" | "organization_portal"
    plan_id: str
    origin_url: str
    doctor_id: Optional[str] = None  # required when kind="patient_doctor"


async def _resolve_plan(kind: str, plan_id: str) -> dict:
    """Server-side price lookup — never trust frontend amount.

    The `kind` arg maps 1:1 to the audience model:
        portal              → patient_portal
        organization        → patient_organization
        clinician_plan      → clinician_portal
        patient_doctor      → patient_clinician
        organization_portal → organization_portal
    Legacy plan_type queries are kept as a fallback so old plans without
    `audience` still resolve.
    """
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
    # Primary: try the new audience field.
    plan = await db.subscription_plans.find_one({"plan_id": plan_id, "audience": audience}, {"_id": 0})
    if not plan:
        # Fallback to legacy plan_type for un-migrated documents.
        legacy_filter = {
            "patient_portal":        {"$or": [{"plan_type": "patient"}, {"plan_type": "portal"}, {"plan_type": {"$exists": False}}]},
            "patient_clinician":     {"plan_type": "clinician"},
            "patient_organization":  {"plan_type": "organization"},
            "clinician_portal":      {"plan_type": "clinician"},   # historically collided
            "organization_portal":   {"plan_type": "organization_portal"},
        }[audience]
        plan = await db.subscription_plans.find_one({"plan_id": plan_id, **legacy_filter}, {"_id": 0})
    if not plan:
        raise HTTPException(404, f"Plan {plan_id} not found")
    amount = float(plan.get("price_usd") or plan.get("price") or 0)
    if amount <= 0:
        raise HTTPException(400, "Plan amount must be > 0 for Stripe checkout")
    return {
        "plan_id": plan["plan_id"],
        "name": plan.get("name"),
        "amount": amount,
        "duration_days": int(plan.get("duration_days") or 30),
        "audience": audience,
        "plan_type": plan.get("plan_type", "patient"),
        "clinician_id": plan.get("clinician_id"),
        "org_id": plan.get("org_id"),
    }


@stripe_router.post("/payments/checkout/session")
async def create_checkout_session(payload: CheckoutPayload, request: Request):
    user = await _current_user(request)
    plan = await _resolve_plan(payload.kind, payload.plan_id)

    # If kind = patient_doctor, the doctor_id is needed
    if payload.kind == "patient_doctor" and not payload.doctor_id:
        raise HTTPException(400, "doctor_id required for clinician subscription")

    api_key = os.environ.get("STRIPE_API_KEY", "").strip()
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip() or None
    if not api_key:
        raise HTTPException(500, "Stripe not configured")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    checkout = StripeCheckout(api_key=api_key, webhook_secret=webhook_secret, webhook_url=webhook_url)

    origin = payload.origin_url.rstrip("/")
    return_path = {
        "portal":              "/app/subscribe",
        "clinician_plan":      "/clinician/subscribe",
        "patient_doctor":      "/app/home",
        "organization":        "/app/subscribe",
        "organization_portal": "/org/subscribe",
    }.get(payload.kind, "/app/home")
    success_url = f"{origin}{return_path}?session_id={{CHECKOUT_SESSION_ID}}&status=success"
    cancel_url  = f"{origin}{return_path}?status=cancelled"

    metadata = {
        "user_id": user["user_id"],
        "user_email": user.get("email", ""),
        "kind": payload.kind,
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"] or "",
        "doctor_id": payload.doctor_id or "",
        "org_id": plan.get("org_id") or "",
        "audience": plan.get("audience") or "",
    }

    req = CheckoutSessionRequest(
        amount=plan["amount"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await checkout.create_checkout_session(req)

    # Persist payment_transactions entry
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "user_email": user.get("email"),
        "kind": payload.kind,
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "doctor_id": payload.doctor_id,
        "amount": plan["amount"],
        "currency": "usd",
        "metadata": metadata,
        "status": "initiated",
        "payment_status": "pending",
        "duration_days": plan["duration_days"],
        "fulfilled": False,
        "created_at": _now(),
        "updated_at": _now(),
    })

    return {"url": session.url, "session_id": session.session_id, "amount": plan["amount"], "plan_name": plan["name"]}


async def _fulfill_if_paid(txn: dict) -> dict:
    """Idempotently turn a paid transaction into an active subscription / doctor link."""
    if txn.get("fulfilled"):
        return {"fulfilled": True, "already": True}
    kind = txn.get("kind")
    user_id = txn.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return {"fulfilled": False, "reason": "user missing"}
    starts = datetime.now(timezone.utc)
    ends = starts + timedelta(days=txn.get("duration_days") or 30)

    if kind in ("portal", "organization"):
        # Activate or extend the patient portal subscription
        sub = {
            "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "plan_id": txn.get("plan_id"),
            "plan_name": txn.get("plan_name"),
            "amount_paid": txn.get("amount"),
            "status": "active",
            "payment_status": "stripe_paid",
            "stripe_session_id": txn.get("session_id"),
            "start_date": starts.isoformat(),
            "end_date": ends.isoformat(),
            "created_at": _now(),
        }
        await db.patient_subscriptions.update_one(
            {"user_id": user_id, "status": "active"},
            {"$set": sub}, upsert=True,
        )
    elif kind == "clinician_plan":
        # Clinician subscribes to their own platform plan
        sub = {
            "subscription_id": f"clinsub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "plan_id": txn.get("plan_id"),
            "plan_name": txn.get("plan_name"),
            "amount_paid_usd": txn.get("amount"),
            "status": "active",
            "payment_status": "stripe_paid",
            "stripe_session_id": txn.get("session_id"),
            "start_date": starts.isoformat(),
            "end_date": ends.isoformat(),
            "created_at": _now(),
        }
        await db.clinician_subscriptions.update_one(
            {"user_id": user_id, "status": "active"},
            {"$set": sub}, upsert=True,
        )
    elif kind == "patient_doctor":
        # Patient pays to subscribe to a clinician
        doctor_id = txn.get("doctor_id")
        # Reuse doctor enrichment
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
            doc_info = {"doctor_id": doctor_id, "name": (txn.get("metadata") or {}).get("doctor_name", "Doctor")}
        rec = {
            "subscription_id": f"docsub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            **doc_info,
            "plan_id": txn.get("plan_id"),
            "plan_name": txn.get("plan_name"),
            "amount_paid_usd": txn.get("amount"),
            "payment_status": "stripe_paid",
            "stripe_session_id": txn.get("session_id"),
            "start_date": starts.isoformat(),
            "end_date": ends.isoformat(),
            "subscribed_at": _now(),
        }
        await db.patient_doctor_subscriptions.update_one(
            {"user_id": user_id, "doctor_id": doctor_id},
            {"$set": rec}, upsert=True,
        )
        # Activity log
        await db.patient_activity.insert_one({
            "activity_id": f"act_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "doctor_subscribed",
            "title": f"Subscribed to {doc_info.get('name', 'doctor')}",
            "detail": f"{txn.get('plan_name')} · ${txn.get('amount')}",
            "created_at": _now(),
        })
    await db.payment_transactions.update_one(
        {"session_id": txn["session_id"]},
        {"$set": {"fulfilled": True, "updated_at": _now()}},
    )
    return {"fulfilled": True}


@stripe_router.get("/payments/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request, confirm: int = 0):
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Transaction not found")

    api_key = os.environ.get("STRIPE_API_KEY", "").strip()
    stripe.api_key = api_key
    # Use the official stripe lib directly for retrieve — keeps adapter surface small
    try:
        sess = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(502, f"Stripe error: {str(e)[:120]}")
    payment_status = getattr(sess, "payment_status", None)
    status_val = getattr(sess, "status", None)
    amount_total = getattr(sess, "amount_total", None)
    currency = getattr(sess, "currency", None)
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": status_val, "payment_status": payment_status, "updated_at": _now()}},
    )
    if payment_status == "paid" and not txn.get("fulfilled"):
        await _fulfill_if_paid({**txn, "status": status_val, "payment_status": payment_status})
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0}) or txn
    return {
        "session_id": session_id,
        "status": status_val,
        "payment_status": payment_status,
        "amount_total": amount_total,
        "currency": currency,
        "kind": txn.get("kind"),
        "plan_name": txn.get("plan_name"),
        "fulfilled": txn.get("fulfilled", False),
    }


@stripe_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    api_key = os.environ.get("STRIPE_API_KEY", "").strip()
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip() or None
    stripe.api_key = api_key

    try:
        if webhook_secret:
            evt = stripe.Webhook.construct_event(body, sig, webhook_secret)
        else:
            import json as _json
            evt = _json.loads(body.decode("utf-8"))
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}

    evt_type = evt.get("type") if isinstance(evt, dict) else evt["type"]
    data_obj = (evt.get("data") or {}).get("object", {}) if isinstance(evt, dict) else evt["data"]["object"]
    def _g(o, k):
        return o.get(k) if isinstance(o, dict) else getattr(o, k, None)
    if evt_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded") and _g(data_obj, "payment_status") == "paid":
        session_id = _g(data_obj, "id")
        if session_id:
            txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            if txn and not txn.get("fulfilled"):
                await _fulfill_if_paid(txn)
    return {"ok": True}
