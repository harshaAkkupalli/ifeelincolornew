"""Five-flow subscription system — central definition.

Audiences (the source of truth going forward):
    patient_portal         – Patient pays for IFEELINCOLOR platform access.
    patient_clinician      – Patient pays a specific clinician (per-clinician pricing).
    patient_organization   – Patient pays an organization (then any clinician inside that org is free).
    clinician_portal       – Clinician pays IFEELINCOLOR to use the platform.
    organization_portal    – Organization pays IFEELINCOLOR to use the platform.

We keep the legacy `plan_type` field on every plan for backwards compatibility,
but `audience` is the field new code reads/writes.

The `audience` <-> `plan_type` mapping is one-way deterministic; the migration
function below backfills `audience` for every existing plan on startup.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

AUDIENCES = (
    "patient_portal",
    "patient_clinician",
    "patient_organization",
    "clinician_portal",
    "organization_portal",
)

# Maps the legacy plan_type → audience (one-to-one). The collision in the old
# schema (plan_type="clinician" was used BOTH for clinician portal AND for
# patient→clinician) is resolved by inheriting patient_clinician — that has
# always been the dominant production usage. Newly created `clinician_portal`
# plans live in their own audience and won't be confused.
LEGACY_TYPE_TO_AUDIENCE = {
    "patient":      "patient_portal",
    "portal":       "patient_portal",
    "clinician":    "patient_clinician",   # historical dominant usage
    "organization": "patient_organization",
    "org":          "patient_organization",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def migrate_plan_audiences(db) -> dict:
    """Idempotently backfill `audience` on every subscription_plan document.

    Returns a small report so we can log it on cold boot.
    """
    if db is None:
        return {"migrated": 0, "skipped": 0}
    migrated = 0
    skipped = 0
    async for p in db.subscription_plans.find({"audience": {"$exists": False}}, {"_id": 0}):
        ptype = (p.get("plan_type") or "patient").lower()
        audience = LEGACY_TYPE_TO_AUDIENCE.get(ptype, "patient_portal")
        await db.subscription_plans.update_one(
            {"plan_id": p["plan_id"]},
            {"$set": {
                "audience": audience,
                "migrated_audience_at": now_iso(),
            }},
        )
        migrated += 1
    skipped = await db.subscription_plans.count_documents({"audience": {"$exists": True}})
    return {"migrated": migrated, "now_with_audience": skipped}


def normalize_plan(p: dict) -> dict:
    """Return a UI-friendly plan dict with consistent keys."""
    return {
        "plan_id": p.get("plan_id"),
        "name": p.get("name"),
        "description": p.get("description") or p.get("purpose") or "",
        "purpose": p.get("purpose") or p.get("description") or "",
        "price": float(p.get("price") or p.get("price_usd") or 0),
        "price_usd": float(p.get("price_usd") or p.get("price") or 0),
        "duration_days": int(p.get("duration_days") or 30),
        "features": p.get("features") or [],
        "is_trial": bool(p.get("is_trial", False)),
        "trial_days": int(p.get("trial_days") or 0),
        "color": p.get("color") or "#7C5BFF",
        "order": int(p.get("order") or 99),
        "audience": p.get("audience") or LEGACY_TYPE_TO_AUDIENCE.get(p.get("plan_type") or "patient", "patient_portal"),
        "plan_type": p.get("plan_type"),
        "clinician_id": p.get("clinician_id"),
        "org_id": p.get("org_id"),
        "active": p.get("active", True),
        "status": p.get("status", "active"),
    }


async def resolve_plans_for_clinician(db, clinician_id: str) -> list[dict]:
    """Return clinician-specific plans, falling back to global default if the
    clinician has not published any of their own.
    """
    own = await db.subscription_plans.find(
        {
            "audience": "patient_clinician",
            "clinician_id": clinician_id,
            "$or": [{"active": True}, {"status": "active"}],
        },
        {"_id": 0},
    ).sort([("order", 1), ("price", 1)]).to_list(20)
    if own:
        return [normalize_plan(p) for p in own]
    # Fallback to global (clinician_id is null/missing) patient_clinician plans
    globals_ = await db.subscription_plans.find(
        {
            "audience": "patient_clinician",
            "$or": [{"clinician_id": {"$exists": False}}, {"clinician_id": None}, {"clinician_id": ""}],
        },
        {"_id": 0},
    ).sort([("order", 1), ("price", 1)]).to_list(20)
    return [normalize_plan(p) for p in globals_]


async def resolve_plans_for_org(db, org_id: str) -> list[dict]:
    """Return org-specific plans, falling back to global default."""
    own = await db.subscription_plans.find(
        {
            "audience": "patient_organization",
            "org_id": org_id,
            "$or": [{"active": True}, {"status": "active"}],
        },
        {"_id": 0},
    ).sort([("order", 1), ("price", 1)]).to_list(20)
    if own:
        return [normalize_plan(p) for p in own]
    globals_ = await db.subscription_plans.find(
        {
            "audience": "patient_organization",
            "$or": [{"org_id": {"$exists": False}}, {"org_id": None}, {"org_id": ""}],
        },
        {"_id": 0},
    ).sort([("order", 1), ("price", 1)]).to_list(20)
    return [normalize_plan(p) for p in globals_]


async def resolve_plans_by_audience(db, audience: str) -> list[dict]:
    """Generic getter for the three audiences that don't have a parent entity."""
    assert audience in AUDIENCES, f"Unknown audience: {audience}"
    plans = await db.subscription_plans.find(
        {
            "audience": audience,
            "$or": [{"active": True}, {"status": "active"}],
        },
        {"_id": 0},
    ).sort([("order", 1), ("price", 1)]).to_list(20)
    return [normalize_plan(p) for p in plans]


async def patient_has_active_org_sub_for_clinician(db, *, patient_user_id: str, clinician_user_id: str) -> Optional[dict]:
    """Return the patient's active org subscription IF that clinician belongs to that org.

    Used to gate the 'free clinician inside subscribed org' flow.
    """
    # 1. find patient's active patient_organization subscription (if any)
    org_sub = await db.patient_subscriptions.find_one(
        {
            "user_id": patient_user_id,
            "status": "active",
            "audience": "patient_organization",
        },
        {"_id": 0},
    )
    if not org_sub:
        # legacy: row may not have audience set; check via plan_id
        legacy = await db.patient_subscriptions.find_one(
            {"user_id": patient_user_id, "status": "active"}, {"_id": 0}
        )
        if not legacy:
            return None
        plan = await db.subscription_plans.find_one({"plan_id": legacy.get("plan_id")}, {"_id": 0})
        if not plan or plan.get("audience") != "patient_organization":
            return None
        org_sub = legacy
        org_sub["org_id"] = plan.get("org_id")
    org_id = org_sub.get("org_id")
    if not org_id:
        # plan didn't carry org_id either → can't auto-link
        return None
    # 2. find the clinician's org_id
    clin = await db.users.find_one(
        {"user_id": clinician_user_id, "role": "clinician"},
        {"_id": 0, "org_id": 1, "name": 1, "clinician_info": 1},
    )
    if not clin:
        return None
    clin_org = clin.get("org_id") or (clin.get("clinician_info") or {}).get("org_id")
    if clin_org and clin_org == org_id:
        # Lookup org name for the UI badge
        org = await db.users.find_one({"user_id": org_id, "role": "organization"}, {"_id": 0, "name": 1, "user_id": 1})
        return {
            "org_id": org_id,
            "org_name": (org or {}).get("name", "Your organization"),
            "org_subscription_id": org_sub.get("subscription_id"),
        }
    return None
