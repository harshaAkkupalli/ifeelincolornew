"""Organization-portal backend routes.

An "organization" user (role=organization) can log in via /api/auth/login
and reach an Org Dashboard at /org/* on the frontend. From that dashboard
they can:
  • Add their own clinicians (those clinicians get a real email/password login
    they can use in the patient/clinician mobile app).
  • View the roster of clinicians under their org.
  • Remove or update clinicians.
  • See aggregated stats on patient subscribers (HIPAA-safe — no PHI).
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorDatabase

org_router = APIRouter(prefix="/api/organization", tags=["organization"])

_db: AsyncIOMotorDatabase | None = None


def init_org_routes(db: AsyncIOMotorDatabase):
    global _db
    _db = db


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Org routes not initialised")
    return _db


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _current_org(request: Request) -> dict:
    """Resolve current user from session and require organization role.

    Adds `role_tier` to the user dict:
      • Org_Admin   — root visibility to all org data (default for back-compat)
      • Org_Manager — restricted to clinicians + patients explicitly assigned
                      to this manager (via `clinician_info.manager_id` or
                      `patient_doctor_subscriptions.managed_by`).
    """
    from server import get_current_user  # type: ignore  # avoid circular
    user = await get_current_user(request)
    if user.get("role") != "organization":
        raise HTTPException(403, "Organizations only")
    # Back-fill role_tier for legacy org users (any existing org user without
    # the flag becomes Org_Admin so dashboards keep working).
    if not user.get("role_tier"):
        user["role_tier"] = "Org_Admin"
    return user


async def _require_org_admin(request: Request) -> dict:
    """Same as _current_org but rejects Org_Manager.

    Used to guard ADMIN-ONLY endpoints — Manager CRUD and portal-billing
    operations. Clinician CRUD is open to both tiers (Managers manage
    clinicians; Admins manage Managers + billing).
    """
    org = await _current_org(request)
    if org.get("role_tier") == "Org_Manager":
        raise HTTPException(403, "Admin tier required. Contact your Org Admin.")
    return org


def _effective_org_id(org: dict) -> str:
    """The organization's canonical ID used to scope clinicians, subscribers,
    etc.

    • Org_Admin   → their own user_id IS the org id
    • Org_Manager → the parent admin's user_id (stored on the manager doc as
                    `org_id`) — falls back to the manager's own user_id only
                    if the manager record is malformed (back-compat).
    """
    if org.get("role_tier") == "Org_Manager":
        return org.get("org_id") or org["user_id"]
    return org["user_id"]


async def _scoped_clinician_ids(org: dict) -> list[str]:
    """Returns the clinician_ids visible to this org user.

    • Org_Admin   → every clinician under the org (org_id == effective_org_id)
    • Org_Manager → only clinicians where clinician_info.manager_id == this
                    manager's user_id (Managers see only clinicians they
                    added / are explicitly assigned).
    """
    db = get_db()
    base_query = {"role": "clinician", "org_id": _effective_org_id(org)}
    if org.get("role_tier") == "Org_Manager":
        base_query["clinician_info.manager_id"] = org["user_id"]
    ids = []
    async for c in db.users.find(base_query, {"_id": 0, "user_id": 1}):
        ids.append(c["user_id"])
    return ids


# ─── Clinician management (the heart of the org portal) ─────────────────────

class OrgClinicianCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    mobile: Optional[str] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    years_experience: Optional[int] = 0


class OrgClinicianUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    years_experience: Optional[int] = None
    active: Optional[bool] = None


@org_router.post("/clinicians")
async def org_create_clinician(payload: OrgClinicianCreate, request: Request):
    """Org adds a clinician — both Admins and Managers can do this.

    The created clinician has:
      • role = "clinician"
      • org_id = the effective org id (Admin: self; Manager: parent admin)
      • clinician_info.manager_id = creator.user_id (so Managers' clinicians
        are auto-scoped to their roster)
      • password_hash (bcrypt) so they can sign in via /api/auth/login
      • status = "active"
    """
    org = await _current_org(request)
    db = get_db()
    eff_org_id = _effective_org_id(org)
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "A user with this email already exists")
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    clinician_info = {
        "specialization": payload.specialization or "Mental Health Specialist",
        "license_number": payload.license_number,
        "years_experience": payload.years_experience or 0,
    }
    # Stamp the creating Manager so /clinicians list scopes correctly.
    if org.get("role_tier") == "Org_Manager":
        clinician_info["manager_id"] = org["user_id"]
        clinician_info["manager_name"] = org.get("name")
    doc = {
        "user_id": user_id,
        "email": email,
        "name": payload.name.strip(),
        "mobile": (payload.mobile or "").strip() or None,
        "role": "clinician",
        "org_id": eff_org_id,
        "added_by_org": True,
        "added_by_org_name": org.get("name"),
        "added_by_user_id": org["user_id"],
        "password_hash": pwd_ctx.hash(payload.password),
        "status": "active",
        "created_at": now_iso(),
        "clinician_info": clinician_info,
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    # Best-effort welcome email — fail silent if email isn't configured.
    try:
        from email_provider import send_via_gmail
        await send_via_gmail(
            to_email=email,
            to_name=payload.name,
            subject=f"Welcome to {org.get('name')} on IFEELINCOLOR",
            html_body=(
                f"<div style='font-family:sans-serif;line-height:1.6'>"
                f"<h2>Hi {payload.name},</h2>"
                f"<p><strong>{org.get('name')}</strong> has added you as a clinician on IFEELINCOLOR.</p>"
                f"<p>Sign in with this email and your password to access the clinician portal and your mobile app.</p>"
                f"<p style='color:#999;font-size:12px'>If you did not expect this email please ignore it.</p>"
                f"</div>"
            ),
            plain_fallback=f"Hi {payload.name}, {org.get('name')} added you on IFEELINCOLOR. Sign in with this email and password to begin.",
        )
    except Exception:
        pass
    return {"ok": True, "clinician": doc}


@org_router.get("/clinicians")
async def org_list_clinicians(request: Request):
    """List clinicians belonging to this org (paginated max 200).

    • Org_Admin   → all clinicians under the effective org id
    • Org_Manager → only clinicians where clinician_info.manager_id == self
    """
    org = await _current_org(request)
    db = get_db()
    query = {"role": "clinician", "org_id": _effective_org_id(org)}
    if org.get("role_tier") == "Org_Manager":
        query["clinician_info.manager_id"] = org["user_id"]
    rows = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    # Lightweight stats: patient count — must match the clinician's own
    # dashboard count (union across patient_doctor_subscriptions +
    # patient_subscriptions + doctor_subscriptions, distinct user_id, and
    # filtered to user_ids that resolve to a real patient user).
    out = []
    for c in rows:
        cid = c["user_id"]
        ids: set = set()
        async for s in db.patient_doctor_subscriptions.find(
            {"$or": [{"clinician_id": cid}, {"doctor_id": cid}]}, {"_id": 0, "user_id": 1}
        ):
            if s.get("user_id"):
                ids.add(s["user_id"])
        async for s in db.patient_subscriptions.find(
            {"clinician_id": cid, "status": "active"}, {"_id": 0, "user_id": 1}
        ):
            if s.get("user_id"):
                ids.add(s["user_id"])
        async for s in db.doctor_subscriptions.find(
            {"clinician_id": cid}, {"_id": 0, "user_id": 1}
        ):
            if s.get("user_id"):
                ids.add(s["user_id"])
        # Drop stale ids (deleted/non-patient users) — same rule as
        # `_clinician_patient_ids` in server.py so org/admin/clinician agree.
        valid_count = 0
        if ids:
            valid_count = await db.users.count_documents(
                {"role": "patient", "user_id": {"$in": list(ids)}}
            )
        out.append({**c, "patient_count": valid_count})
    return {"clinicians": out, "total": len(out)}


@org_router.put("/clinicians/{user_id}")
async def org_update_clinician(user_id: str, payload: OrgClinicianUpdate, request: Request):
    """Update a clinician under this org. Both Admin + Manager.

    Manager can only update clinicians whose `manager_id == self`.
    """
    org = await _current_org(request)
    db = get_db()
    query = {"user_id": user_id, "role": "clinician", "org_id": _effective_org_id(org)}
    if org.get("role_tier") == "Org_Manager":
        query["clinician_info.manager_id"] = org["user_id"]
    existing = await db.users.find_one(query, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Clinician not found or not in your scope")
    update: dict = {}
    for k, v in payload.model_dump(exclude_none=True).items():
        if k in ("specialization", "license_number", "years_experience"):
            update[f"clinician_info.{k}"] = v
        elif k == "active":
            update["status"] = "active" if v else "disabled"
        else:
            update[k] = v
    update["updated_at"] = now_iso()
    await db.users.update_one({"user_id": user_id}, {"$set": update})
    return {"ok": True}


@org_router.delete("/clinicians/{user_id}")
async def org_remove_clinician(user_id: str, request: Request):
    """Detach a clinician from the org. Both Admin + Manager (Manager scoped
    to clinicians they added).

    We don't fully delete the user account — we just unset org_id so the
    patient-org-included free flow stops working. Existing
    patient_doctor_subscriptions stay intact.
    """
    org = await _current_org(request)
    db = get_db()
    query = {"user_id": user_id, "role": "clinician", "org_id": _effective_org_id(org)}
    if org.get("role_tier") == "Org_Manager":
        query["clinician_info.manager_id"] = org["user_id"]
    res = await db.users.update_one(
        query,
        {"$set": {"org_id": None, "updated_at": now_iso(), "detached_from_org_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Clinician not found or not in your scope")
    return {"ok": True}


# ─── Org dashboard stats ────────────────────────────────────────────────────

@org_router.get("/dashboard")
async def org_dashboard(request: Request):
    """Aggregated stats for the org's home page.

    Returns ONLY counts and aggregates — no PHI ever leaves this endpoint.
    Scope honors the caller's `role_tier`:
      • Org_Admin   → all clinicians + all org subscribers
      • Org_Manager → only clinicians flagged with manager_id == this manager,
                      and only their linked patients
    """
    org = await _current_org(request)
    db = get_db()
    org_id = _effective_org_id(org)
    role_tier = org.get("role_tier", "Org_Admin")

    clinician_ids = await _scoped_clinician_ids(org)
    clinician_count = len(clinician_ids)

    # Patients with an active org subscription pointing at THIS org — managers
    # are scoped to only the ones their clinicians own.
    if role_tier == "Org_Manager":
        # Manager's "org subscribers" = patients tied to one of the manager's clinicians
        org_subscribers = 0
        if clinician_ids:
            org_subscribers = await db.patient_doctor_subscriptions.count_documents({
                "clinician_id": {"$in": clinician_ids},
                "via_org_id": org_id,
            })
    else:
        org_subscribers = await db.patient_subscriptions.count_documents({
            "org_id": org_id, "status": "active",
        })

    # Patients linked to any clinician in scope
    linked_patients = 0
    if clinician_ids:
        seen = set()
        async for s in db.patient_doctor_subscriptions.find(
            {"clinician_id": {"$in": clinician_ids}},
            {"user_id": 1, "_id": 0},
        ):
            if s.get("user_id"):
                seen.add(s["user_id"])
        linked_patients = len(seen)

    # Recent activity (only events involving clinicians in scope)
    recent_activity = []
    if clinician_ids:
        async for r in db.patient_doctor_subscriptions.find(
            {"clinician_id": {"$in": clinician_ids}},
            {"_id": 0, "name": 1, "user_id": 1, "subscribed_at": 1, "plan_name": 1, "via_org_id": 1},
        ).sort("subscribed_at", -1).limit(10):
            recent_activity.append(r)

    return {
        "org": {
            "user_id": org_id,
            "name": org.get("name"),
            "email": org.get("email"),
            "role_tier": role_tier,
        },
        "clinician_count": clinician_count,
        "org_subscribers": org_subscribers,
        "linked_patients": linked_patients,
        "recent_activity": recent_activity,
    }


# ─── Patient-facing: see clinicians inside *my* subscribed org ──────────────

@org_router.get("/my-org-clinicians")
async def my_org_clinicians(request: Request):
    """Used by the patient: returns the clinicians inside the org the patient
    is currently subscribed to (if any). Each clinician carries an `included`
    flag = True so the patient UI can show the green badge.
    """
    from server import get_current_user  # type: ignore
    user = await get_current_user(request)
    if user.get("role") != "patient":
        raise HTTPException(403, "Patient only")
    db = get_db()
    # Find the patient's active org subscription
    sub = await db.patient_subscriptions.find_one(
        {"user_id": user["user_id"], "status": "active", "audience": "patient_organization"},
        {"_id": 0},
    )
    if not sub:
        # Legacy — try without audience but only return if linked plan is patient_organization
        legacy = await db.patient_subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"}, {"_id": 0}
        )
        if not legacy:
            return {"org": None, "clinicians": [], "already_linked": []}
        plan = await db.subscription_plans.find_one({"plan_id": legacy.get("plan_id")}, {"_id": 0})
        if not plan or plan.get("audience") != "patient_organization":
            return {"org": None, "clinicians": [], "already_linked": []}
        sub = legacy
        sub["org_id"] = plan.get("org_id")
    org_id = sub.get("org_id")
    if not org_id:
        return {"org": None, "clinicians": [], "already_linked": []}
    org = await db.users.find_one({"user_id": org_id, "role": "organization"}, {"_id": 0, "user_id": 1, "name": 1})
    if not org:
        return {"org": None, "clinicians": [], "already_linked": []}
    clins = await db.users.find(
        {"role": "clinician", "org_id": org_id},
        {"_id": 0, "password_hash": 0},
    ).to_list(200)
    # which of these is the patient already linked to?
    already = await db.patient_doctor_subscriptions.find(
        {"user_id": user["user_id"], "clinician_id": {"$in": [c["user_id"] for c in clins]}},
        {"_id": 0, "clinician_id": 1},
    ).to_list(200)
    already_set = {a["clinician_id"] for a in already}
    out = []
    palette = ["#5BC0BE", "#A78BFA", "#22D67E", "#F4D58D", "#FF8A95"]
    for i, c in enumerate(clins):
        info = c.get("clinician_info") or {}
        out.append({
            "doctor_id": c["user_id"],
            "clinician_id": c["user_id"],
            "name": c.get("name"),
            "specialty": info.get("specialization") or "Mental Health Specialist",
            "experience_years": info.get("years_experience", 0),
            "avatar_color": palette[i % len(palette)],
            "picture": c.get("picture"),
            "associated_with_ifeelincolor": True,
            "org_id": org_id,
            "org_name": org.get("name"),
            "included": True,
            "already_linked": c["user_id"] in already_set,
        })
    return {
        "org": {"org_id": org_id, "name": org.get("name")},
        "clinicians": out,
        "already_linked": list(already_set),
    }


# ─── Org Managers CRUD (Admin-only) ────────────────────────────────────────

class OrgManagerCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    mobile: Optional[str] = None


class OrgManagerUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    active: Optional[bool] = None


@org_router.post("/managers")
async def org_create_manager(payload: OrgManagerCreate, request: Request):
    """Admin adds a Manager. Manager gets a real /api/organization/login session
    with role=organization, role_tier=Org_Manager, org_id=<admin.user_id>.
    """
    admin = await _require_org_admin(request)
    db = get_db()
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "A user with this email already exists")
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "name": payload.name.strip(),
        "mobile": (payload.mobile or "").strip() or None,
        "role": "organization",
        "role_tier": "Org_Manager",
        "org_id": admin["user_id"],            # link to parent admin
        "parent_org_name": admin.get("name"),
        "added_by_user_id": admin["user_id"],
        "password_hash": pwd_ctx.hash(payload.password),
        "status": "active",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    # Best-effort welcome email
    try:
        from email_provider import send_via_gmail
        await send_via_gmail(
            to_email=email,
            to_name=payload.name,
            subject=f"You're an Org Manager at {admin.get('name')} on IFEELINCOLOR",
            html_body=(
                f"<div style='font-family:sans-serif;line-height:1.6'>"
                f"<h2>Hi {payload.name},</h2>"
                f"<p><strong>{admin.get('name')}</strong> has added you as an Organization Manager on IFEELINCOLOR.</p>"
                f"<p>Sign in at the Organization Portal with this email and your password. You'll be able to add and manage clinicians under your scope.</p>"
                f"</div>"
            ),
            plain_fallback=f"Hi {payload.name}, you're now an Org Manager at {admin.get('name')}. Sign in to the Organization portal.",
        )
    except Exception:
        pass
    return {"ok": True, "manager": doc}


@org_router.get("/managers")
async def org_list_managers(request: Request):
    """Admin lists their Managers (and counts of clinicians/patients per manager)."""
    admin = await _require_org_admin(request)
    db = get_db()
    rows = await db.users.find(
        {"role": "organization", "role_tier": "Org_Manager", "org_id": admin["user_id"]},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(200)
    out = []
    for m in rows:
        clin_count = await db.users.count_documents({
            "role": "clinician",
            "org_id": admin["user_id"],
            "clinician_info.manager_id": m["user_id"],
        })
        out.append({**m, "clinician_count": clin_count})
    return {"managers": out, "total": len(out)}


@org_router.put("/managers/{user_id}")
async def org_update_manager(user_id: str, payload: OrgManagerUpdate, request: Request):
    admin = await _require_org_admin(request)
    db = get_db()
    existing = await db.users.find_one(
        {"user_id": user_id, "role": "organization", "role_tier": "Org_Manager", "org_id": admin["user_id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(404, "Manager not found in your organization")
    update: dict = {}
    for k, v in payload.model_dump(exclude_none=True).items():
        if k == "active":
            update["status"] = "active" if v else "disabled"
        else:
            update[k] = v
    update["updated_at"] = now_iso()
    await db.users.update_one({"user_id": user_id}, {"$set": update})
    return {"ok": True}


@org_router.delete("/managers/{user_id}")
async def org_remove_manager(user_id: str, request: Request):
    """Soft-detach a Manager: their account stays but is disabled, and any
    clinicians they created stay attached to the org (their `manager_id` is
    cleared so the Admin can re-assign them to another manager later)."""
    admin = await _require_org_admin(request)
    db = get_db()
    res = await db.users.update_one(
        {"user_id": user_id, "role": "organization", "role_tier": "Org_Manager", "org_id": admin["user_id"]},
        {"$set": {"status": "disabled", "detached_at": now_iso(), "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Manager not found in your organization")
    # Clear manager_id from their clinicians so they remain visible to Admin
    await db.users.update_many(
        {"role": "clinician", "org_id": admin["user_id"], "clinician_info.manager_id": user_id},
        {"$unset": {"clinician_info.manager_id": "", "clinician_info.manager_name": ""}},
    )
    # Invalidate all active sessions for that manager
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"ok": True}


# ─── Portal Subscription (Admin-only) ──────────────────────────────────────

@org_router.get("/portal-plans")
async def org_portal_plans(request: Request):
    """Public-to-admin: list `organization_portal` audience plans the Admin
    can subscribe to via Razorpay.
    """
    await _require_org_admin(request)
    db = get_db()
    rows = await db.subscription_plans.find(
        {
            "$or": [
                {"audience": "organization_portal"},
                {"plan_type": "organization_portal"},
            ],
            "$and": [
                {"$or": [{"active": True}, {"active": {"$exists": False}}]},
                {"$or": [{"is_archived": False}, {"is_archived": {"$exists": False}}]},
            ],
        },
        {"_id": 0},
    ).sort("price_usd", 1).to_list(50)
    return {"plans": rows}


@org_router.get("/portal-subscription")
async def org_portal_subscription(request: Request):
    """Admin: read the org's current portal subscription (organization_portal
    audience). Returns the active sub or None.
    """
    admin = await _require_org_admin(request)
    db = get_db()
    sub = await db.organization_subscriptions.find_one(
        {"user_id": admin["user_id"], "status": "active"}, {"_id": 0},
    )
    return {"subscription": sub}
