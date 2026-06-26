"""Public + admin routes for the 5-flow subscription model.

These extend (do not replace) the existing /api/plans, /api/admin/plans, and
/api/clinician-plans endpoints. The old endpoints keep working for any legacy
client; new clients should call these audience-aware endpoints.
"""
from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

from subscription_audiences import (
    AUDIENCES,
    normalize_plan,
    resolve_plans_for_clinician,
    resolve_plans_for_org,
    resolve_plans_by_audience,
    patient_has_active_org_sub_for_clinician,
    now_iso,
)

# These routers will be mounted in server.py
audience_router = APIRouter(tags=["subscriptions-v2"])
admin_audience_router = APIRouter(prefix="/api/admin", tags=["subscriptions-admin-v2"])


# ─── Shared helpers (db injected at mount-time) ───
_db: AsyncIOMotorDatabase | None = None


def init_audience_routes(db: AsyncIOMotorDatabase):
    """Inject the db dependency once at server startup."""
    global _db
    _db = db


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Audience routes not initialised")
    return _db


# ─── Auth helpers ───────────────────────────────────────────────────────────

async def _current_user(request: Request) -> dict:
    """Resolve the logged-in user from the JWT cookie or Authorization header."""
    from server import _get_current_user  # type: ignore  # avoid circular at import time
    return await _get_current_user(request)


async def _current_admin(request: Request) -> dict:
    from admin_auth import get_current_admin  # type: ignore
    return await get_current_admin(request, get_db())


# ─── Patient-facing plan listings ───────────────────────────────────────────

@audience_router.get("/api/plans/patient-portal")
async def get_patient_portal_plans():
    return {"plans": await resolve_plans_by_audience(get_db(), "patient_portal")}


@audience_router.get("/api/plans/patient-clinician")
async def get_patient_clinician_plans(clinician_id: Optional[str] = None):
    db = get_db()
    if clinician_id:
        return {"plans": await resolve_plans_for_clinician(db, clinician_id), "clinician_id": clinician_id}
    return {"plans": await resolve_plans_by_audience(db, "patient_clinician")}


@audience_router.get("/api/plans/patient-organization")
async def get_patient_organization_plans(org_id: Optional[str] = None):
    db = get_db()
    if org_id:
        return {"plans": await resolve_plans_for_org(db, org_id), "org_id": org_id}
    return {"plans": await resolve_plans_by_audience(db, "patient_organization")}


@audience_router.get("/api/plans/clinician-portal")
async def get_clinician_portal_plans():
    return {"plans": await resolve_plans_by_audience(get_db(), "clinician_portal")}


@audience_router.get("/api/plans/organization-portal")
async def get_organization_portal_plans():
    return {"plans": await resolve_plans_by_audience(get_db(), "organization_portal")}


# ─── Patient-facing organization directory ─────────────────────────────────

@audience_router.get("/api/organizations/listing")
async def list_organizations_for_patients():
    """Public-facing org directory the patient browses before paying.

    Each entry includes the count of clinicians inside the org so the patient
    can see how many providers they'll unlock.
    """
    db = get_db()
    orgs = await db.users.find(
        {"role": "organization", "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "org_info": 1, "picture": 1},
    ).to_list(200)
    out = []
    for o in orgs:
        clinician_count = await db.users.count_documents({"role": "clinician", "org_id": o["user_id"]})
        out.append({
            "org_id": o["user_id"],
            "name": o.get("name", "Organization"),
            "email": o.get("email"),
            "logo": o.get("picture") or (o.get("org_info") or {}).get("logo_url"),
            "description": (o.get("org_info") or {}).get("description", ""),
            "clinician_count": clinician_count,
        })
    return {"organizations": out}


@audience_router.get("/api/organizations/{org_id}/clinicians")
async def list_clinicians_in_org(org_id: str):
    """Public-facing list of clinicians inside an org (patient picker UI)."""
    db = get_db()
    clinicians = await db.users.find(
        {"role": "clinician", "org_id": org_id, "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
        {"_id": 0, "password_hash": 0},
    ).to_list(200)
    out = []
    for c in clinicians:
        info = c.get("clinician_info") or {}
        out.append({
            "doctor_id": c["user_id"],
            "clinician_id": c["user_id"],
            "name": c.get("name"),
            "specialty": info.get("specialization") or "Mental Health Specialist",
            "avatar_color": info.get("avatar_color") or "#5BC0BE",
            "picture": c.get("picture"),
            "org_id": org_id,
        })
    return {"clinicians": out}


# ─── "Am I covered for free?" check (used by SubscribeModal before showing plans) ───

@audience_router.get("/api/patient/clinician-coverage")
async def clinician_coverage(clinician_id: str, request: Request):
    """Returns whether the current patient gets FREE access to this clinician via
    an active organization subscription.

    Frontend uses this BEFORE rendering the per-clinician plan picker so it can
    show 'Included with your Sunshine Care Center subscription' and skip Stripe.
    """
    user = await _current_user(request)
    if user.get("role") != "patient":
        raise HTTPException(403, "Patient only")
    cov = await patient_has_active_org_sub_for_clinician(
        get_db(), patient_user_id=user["user_id"], clinician_user_id=clinician_id,
    )
    if cov:
        return {"covered": True, **cov}
    return {"covered": False}


# ─── Patient links clinician via org subscription (free path) ───────────────

class OrgFreeLinkPayload(BaseModel):
    doctor_id: str


@audience_router.post("/api/patient/doctors/subscribe-via-org")
async def subscribe_via_org(payload: OrgFreeLinkPayload, request: Request):
    """Idempotently link the patient → clinician for free because the patient
    already pays the org that clinician belongs to.
    """
    db = get_db()
    user = await _current_user(request)
    if user.get("role") != "patient":
        raise HTTPException(403, "Patient only")
    cov = await patient_has_active_org_sub_for_clinician(
        db, patient_user_id=user["user_id"], clinician_user_id=payload.doctor_id,
    )
    if not cov:
        raise HTTPException(403, "Clinician not included in your organization plan")
    existing = await db.patient_doctor_subscriptions.find_one(
        {"user_id": user["user_id"], "doctor_id": payload.doctor_id}, {"_id": 0},
    )
    if existing:
        return {"ok": True, "already": True}
    clin = await db.users.find_one(
        {"user_id": payload.doctor_id, "role": "clinician"},
        {"_id": 0, "password_hash": 0},
    )
    info = (clin or {}).get("clinician_info") or {}
    starts = datetime.now(timezone.utc)
    rec = {
        "subscription_id": f"docsub_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "doctor_id": payload.doctor_id,
        "clinician_id": payload.doctor_id,
        "name": (clin or {}).get("name", "Doctor"),
        "specialty": info.get("specialization") or "Mental Health Specialist",
        "avatar_color": info.get("avatar_color") or "#5BC0BE",
        "plan_id": "org_included",
        "plan_name": f"Included via {cov['org_name']}",
        "amount_paid_usd": 0,
        "payment_status": "org_included",
        "via_org_id": cov["org_id"],
        "via_org_name": cov["org_name"],
        "via_org_subscription_id": cov["org_subscription_id"],
        "start_date": starts.isoformat(),
        "end_date": (starts + timedelta(days=365)).isoformat(),
        "subscribed_at": now_iso(),
    }
    await db.patient_doctor_subscriptions.insert_one(rec)
    rec.pop("_id", None)
    await db.patient_activity.insert_one({
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "type": "doctor_subscribed_via_org",
        "title": f"Linked with {rec['name']} (via {cov['org_name']})",
        "detail": "Included free with your organization subscription",
        "created_at": now_iso(),
    })
    return {"ok": True, "subscription": rec}


# ─── Admin: plan CRUD with audience awareness ───────────────────────────────

class PlanCreateV2(BaseModel):
    name: str
    description: str = ""
    price: float = 0.0
    duration_days: int = 30
    audience: str  # one of AUDIENCES
    is_trial: bool = False
    trial_days: int = 0
    features: List[str] = []
    color: Optional[str] = "#7C5BFF"
    order: Optional[int] = 99
    clinician_id: Optional[str] = None   # only valid when audience=patient_clinician
    org_id: Optional[str] = None         # only valid when audience=patient_organization


class PlanUpdateV2(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_days: Optional[int] = None
    audience: Optional[str] = None
    is_trial: Optional[bool] = None
    trial_days: Optional[int] = None
    features: Optional[List[str]] = None
    color: Optional[str] = None
    order: Optional[int] = None
    clinician_id: Optional[str] = None
    org_id: Optional[str] = None
    active: Optional[bool] = None
    status: Optional[str] = None


def _legacy_plan_type_for(audience: str) -> str:
    """Best-effort legacy plan_type so old endpoints/clients keep working."""
    return {
        "patient_portal":        "patient",
        "patient_clinician":     "clinician",
        "patient_organization":  "organization",
        "clinician_portal":      "clinician_portal",
        "organization_portal":   "organization_portal",
    }.get(audience, "patient")


@admin_audience_router.get("/plans-v2")
async def admin_list_plans_v2(
    request: Request,
    audience: Optional[str] = None,
    clinician_id: Optional[str] = None,
    org_id: Optional[str] = None,
):
    """Admin-side plan listing. Supports filtering by audience + optional parent."""
    await _current_admin(request)
    db = get_db()
    q: dict = {}
    if audience:
        if audience not in AUDIENCES:
            raise HTTPException(400, f"Unknown audience: {audience}")
        q["audience"] = audience
    if clinician_id is not None:
        q["clinician_id"] = clinician_id if clinician_id else None
    if org_id is not None:
        q["org_id"] = org_id if org_id else None
    plans = await db.subscription_plans.find(q, {"_id": 0}).sort(
        [("audience", 1), ("order", 1), ("price", 1)]
    ).to_list(500)
    return {"plans": [normalize_plan(p) for p in plans]}


@admin_audience_router.post("/plans-v2")
async def admin_create_plan_v2(payload: PlanCreateV2, request: Request):
    from admin_auth import require_super_admin  # type: ignore
    await require_super_admin(request, get_db())
    if payload.audience not in AUDIENCES:
        raise HTTPException(400, f"Unknown audience: {payload.audience}")
    db = get_db()
    plan_id = f"plan_{uuid.uuid4().hex[:12]}"
    doc = {
        "plan_id": plan_id,
        "name": payload.name,
        "description": payload.description,
        "purpose": payload.description,
        "price": payload.price,
        "price_usd": payload.price,
        "duration_days": payload.duration_days,
        "audience": payload.audience,
        "plan_type": _legacy_plan_type_for(payload.audience),  # backwards compat
        "is_trial": payload.is_trial,
        "trial_days": payload.trial_days,
        "features": payload.features,
        "color": payload.color or "#7C5BFF",
        "order": payload.order if payload.order is not None else 99,
        "clinician_id": payload.clinician_id if payload.audience == "patient_clinician" else None,
        "org_id": payload.org_id if payload.audience == "patient_organization" else None,
        "active": True,
        "status": "active",
        "created_at": now_iso(),
    }
    await db.subscription_plans.insert_one(doc)
    doc.pop("_id", None)
    return normalize_plan(doc)


@admin_audience_router.put("/plans-v2/{plan_id}")
async def admin_update_plan_v2(plan_id: str, payload: PlanUpdateV2, request: Request):
    from admin_auth import require_super_admin  # type: ignore
    await require_super_admin(request, get_db())
    db = get_db()
    data = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "audience" in data:
        if data["audience"] not in AUDIENCES:
            raise HTTPException(400, f"Unknown audience: {data['audience']}")
        data["plan_type"] = _legacy_plan_type_for(data["audience"])
    if "price" in data:
        data["price_usd"] = data["price"]
    if "description" in data:
        data["purpose"] = data["description"]
    if "status" in data:
        data["active"] = (data["status"] == "active")
    data["updated_at"] = now_iso()
    await db.subscription_plans.update_one({"plan_id": plan_id}, {"$set": data})
    doc = await db.subscription_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Plan not found")
    return normalize_plan(doc)


@admin_audience_router.delete("/plans-v2/{plan_id}")
async def admin_delete_plan_v2(plan_id: str, request: Request):
    from admin_auth import require_super_admin  # type: ignore
    await require_super_admin(request, get_db())
    await get_db().subscription_plans.delete_one({"plan_id": plan_id})
    return {"deleted": True}


# ─── Admin: lightweight dropdowns ───────────────────────────────────────────

@admin_audience_router.get("/clinicians-simple")
async def admin_clinicians_simple(request: Request):
    """Dropdown source: minimal clinician list for the plan-builder form."""
    await _current_admin(request)
    clins = await get_db().users.find(
        {"role": "clinician"}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "org_id": 1},
    ).sort("name", 1).to_list(500)
    return {"clinicians": clins}


@admin_audience_router.get("/organizations-simple")
async def admin_organizations_simple(request: Request):
    """Dropdown source: minimal org list for the plan-builder form and the
    org assignment UI on clinicians.
    """
    await _current_admin(request)
    orgs = await get_db().users.find(
        {"role": "organization"}, {"_id": 0, "user_id": 1, "name": 1, "email": 1},
    ).sort("name", 1).to_list(500)
    return {"organizations": orgs}


class AssignOrgPayload(BaseModel):
    org_id: Optional[str] = None  # None / "" → unassign


@admin_audience_router.put("/clinicians/{user_id}/org")
async def admin_assign_clinician_to_org(user_id: str, payload: AssignOrgPayload, request: Request):
    """Assign a clinician to an org (or clear with null)."""
    from admin_auth import require_super_admin  # type: ignore
    await require_super_admin(request, get_db())
    db = get_db()
    if payload.org_id:
        org = await db.users.find_one({"user_id": payload.org_id, "role": "organization"}, {"_id": 0, "name": 1})
        if not org:
            raise HTTPException(404, "Organization not found")
    update = {"org_id": payload.org_id or None, "updated_at": now_iso()}
    res = await db.users.update_one({"user_id": user_id, "role": "clinician"}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Clinician not found")
    return {"ok": True, "user_id": user_id, "org_id": payload.org_id or None}
