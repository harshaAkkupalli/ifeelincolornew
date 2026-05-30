from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid, csv, io, os
from admin_auth import (
    hash_password, verify_password, create_admin_token,
    get_current_admin, require_super_admin, seed_admin
)

admin_router = APIRouter(prefix="/api/admin")

# Will be set from server.py
db = None
def set_db(database):
    global db
    db = database

# ─── Models ───
class AdminLogin(BaseModel):
    email: str
    password: str

class AssistantCreate(BaseModel):
    email: str
    name: str
    password: str
    permissions: List[str] = []

class PlanCreate(BaseModel):
    name: str
    description: str = ""
    price: float = 0.0
    duration_days: int = 30
    plan_type: str  # clinician, patient, portal
    is_trial: bool = False
    trial_days: int = 0
    features: List[str] = []

class RecommendationCreate(BaseModel):
    title: str
    description: str
    target_conditions: List[str] = []
    category: str = "general"
    # Rich-content fields
    content_type: Optional[str] = "text"  # text | video | image | steps | link
    media_url: Optional[str] = None  # video/image/link URL
    image_url: Optional[str] = None  # optional cover image for video/steps/text
    steps: Optional[List[str]] = []  # for "steps" type
    severity_filter: Optional[List[str]] = []  # critical|high|moderate|low
    duration_minutes: Optional[int] = None
    # NEW (Workflow 1): trigger_colors gates this Portal Recommendation by
    # the patient's ending check-in emotion family. Empty list = visible to all.
    trigger_colors: List[str] = []  # e.g. ["yellow", "blue", "red", "orange", "green", "grey", "purple"]
    # Markdown body for rich text instructions.
    body_md: Optional[str] = ""

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    status: Optional[str] = None
    role_tier: Optional[str] = None  # Org_Admin | Org_Manager (org users only)

# ─── Auth ───
@admin_router.post("/auth/login")
async def admin_login(creds: AdminLogin, response: Response):
    admin = await db.admins.find_one({"email": creds.email.lower()}, {"_id": 0})
    if not admin or not verify_password(creds.password, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not admin.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_admin_token(admin["admin_id"], admin["email"], admin["role"])
    response.set_cookie(key="admin_token", value=token, path="/", secure=True, httponly=True, samesite="none", max_age=86400)
    admin.pop("password_hash", None)
    return {**admin, "token": token}

@admin_router.get("/auth/me")
async def admin_me(request: Request):
    admin = await get_current_admin(request, db)
    return admin

@admin_router.post("/auth/logout")
async def admin_logout(response: Response):
    response.delete_cookie(key="admin_token", path="/", secure=True, httponly=True, samesite="none")
    return {"message": "Logged out"}

@admin_router.put("/auth/me")
async def admin_update_me(request: Request):
    """Update own profile (name, picture, password) — works for both super_admin and assistant."""
    me = await get_current_admin(request, db)
    body = await request.json()
    updates = {}
    if "name" in body and body["name"]:
        updates["name"] = body["name"]
    if "picture" in body:
        updates["picture"] = body["picture"]
    if body.get("new_password"):
        if not body.get("current_password"):
            raise HTTPException(400, "current_password required")
        existing = await db.admins.find_one({"admin_id": me["admin_id"]})
        if not verify_password(body["current_password"], existing.get("password_hash", "")):
            raise HTTPException(400, "Current password incorrect")
        updates["password_hash"] = hash_password(body["new_password"])
    if not updates:
        raise HTTPException(400, "Nothing to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.admins.update_one({"admin_id": me["admin_id"]}, {"$set": updates})
    updated = await db.admins.find_one({"admin_id": me["admin_id"]}, {"_id": 0, "password_hash": 0})
    return updated

# ─── Dashboard ───
@admin_router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    await get_current_admin(request, db)
    total_patients = await db.users.count_documents({"role": "patient"})
    portal_patients = await db.subscriptions.count_documents({"user_type": "patient", "status": "active"})
    total_clinicians = await db.users.count_documents({"role": "clinician"})
    active_clinicians = await db.subscriptions.count_documents({"user_type": "clinician", "status": "active"})
    total_subs = await db.subscriptions.count_documents({})
    patient_subs = await db.subscriptions.count_documents({"user_type": "patient"})
    pipeline = [{"$match": {"payment_status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    earnings_result = await db.payment_transactions.aggregate(pipeline).to_list(1)
    total_earnings = earnings_result[0]["total"] if earnings_result else 0
    return {
        "portal_patients": portal_patients, "total_patients": total_patients,
        "portal_clinicians": active_clinicians, "total_clinicians": total_clinicians,
        "total_subscriptions": total_subs, "patient_subscriptions": patient_subs,
        "total_earnings": round(total_earnings, 2),
    }

@admin_router.get("/dashboard/subscription-trends")
async def subscription_trends(request: Request):
    await get_current_admin(request, db)
    pipeline = [
        {"$group": {"_id": {"$substr": ["$created_at", 0, 7]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}, {"$limit": 12}
    ]
    data = await db.subscriptions.aggregate(pipeline).to_list(12)
    return [{"month": d["_id"], "subscriptions": d["count"]} for d in data]

@admin_router.get("/dashboard/clinician-overview")
async def clinician_overview(request: Request):
    await get_current_admin(request, db)
    active = await db.users.count_documents({"role": "clinician"})
    subscribed = await db.subscriptions.count_documents({"user_type": "clinician", "status": "active"})
    return [
        {"name": "Active", "value": active},
        {"name": "Subscribed", "value": subscribed},
        {"name": "Unsubscribed", "value": max(0, active - subscribed)},
    ]

# ─── Patient Management ───
class UserCreate(BaseModel):
    name: str
    email: str
    mobile: Optional[str] = ""
    password: Optional[str] = None
    role: str  # patient | clinician | organization
    status: Optional[str] = "active"
    specialty: Optional[str] = None  # clinician
    org_name: Optional[str] = None  # organization


@admin_router.post("/users")
async def admin_create_user(payload: UserCreate, request: Request):
    """Admin can create a Patient, Clinician, or Organization user."""
    await get_current_admin(request, db)
    if payload.role not in ("patient", "clinician", "organization"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    import bcrypt
    pw = (payload.password or "Welcome@123!").encode()
    pw_hash = bcrypt.hashpw(pw, bcrypt.gensalt()).decode()
    doc = {
        "user_id": str(uuid.uuid4()),
        "name": payload.name,
        "email": payload.email.lower(),
        "mobile": payload.mobile or "",
        "role": payload.role,
        "status": payload.status or "active",
        "password_hash": pw_hash,
        "is_first_login": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_admin": True,
    }
    if payload.role == "clinician" and payload.specialty:
        doc["specialty"] = payload.specialty
    if payload.role == "organization" and payload.org_name:
        doc["org_name"] = payload.org_name
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    # Auto-send welcome email (real Gmail when configured, mock_sent otherwise)
    try:
        from email_templates import wrap_html, _now
        from email_provider import send_via_gmail
        import uuid as _uuid
        tpl_map = {"patient": "tpl_welcome_patient", "clinician": "tpl_welcome_clinician"}
        tpl_id = tpl_map.get(payload.role)
        tpl = await db.email_templates.find_one({"template_id": tpl_id}, {"_id": 0}) if tpl_id else None
        if tpl:
            vars_ = {"name": payload.name, "login_url": "/", "temp_password": payload.password or "Welcome@123!"}
            subject = tpl["subject"]
            body = tpl["body"]
            cta_url = tpl.get("cta_url", "")
            for k, v in vars_.items():
                subject = subject.replace(f"{{{{{k}}}}}", str(v))
                body = body.replace(f"{{{{{k}}}}}", str(v))
                cta_url = cta_url.replace(f"{{{{{k}}}}}", str(v))
            html = wrap_html(subject, body, tpl.get("cta_label", ""), cta_url)
            ok, status, err = await send_via_gmail(
                to_email=payload.email.lower(),
                to_name=payload.name,
                subject=subject,
                html_body=html,
            )
            await db.sent_emails.insert_one({
                "email_id": f"em_{_uuid.uuid4().hex[:12]}",
                "to_email": payload.email.lower(),
                "to_name": payload.name,
                "subject": subject,
                "template_id": tpl["template_id"],
                "status": status,
                "error": err,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "trigger": "user_create",
            })
    except Exception as _e:
        pass
    return {"user": doc, "temporary_password": payload.password or "Welcome@123!"}


@admin_router.get("/patients")
async def list_patients(request: Request, search: str = "", skip: int = 0, limit: int = 50, with_severity: int = 0):
    await get_current_admin(request, db)
    query = {"role": "patient"}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    patients = await db.users.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    for p in patients:
        sub = await db.subscriptions.find_one({"user_id": p["user_id"], "status": "active"}, {"_id": 0})
        p["subscription"] = sub
        checkin_count = await db.patient_checkins.count_documents({"patient_id": p["user_id"]})
        p["checkin_count"] = checkin_count
        # Assigned clinicians — every active patient↔doctor subscription. Surfaces
        # the relationships that used to live on the removed Assignments page.
        assigned = []
        async for s in db.patient_doctor_subscriptions.find(
            {"user_id": p["user_id"], "$or": [
                {"status": {"$in": ["active", "trial", "trialing"]}},
                {"status": {"$exists": False}},
            ]},
            {"_id": 0, "doctor_id": 1, "clinician_id": 1, "name": 1, "specialty": 1, "end_date": 1, "subscribed_at": 1},
        ):
            cid = s.get("clinician_id") or s.get("doctor_id")
            if not cid:
                continue
            clin = await db.users.find_one({"user_id": cid}, {"_id": 0, "name": 1, "email": 1})
            assigned.append({
                "clinician_id": cid,
                "name": (clin or {}).get("name") or s.get("name") or "Clinician",
                "email": (clin or {}).get("email"),
                "specialty": s.get("specialty"),
                "subscribed_at": s.get("subscribed_at"),
                "end_date": s.get("end_date"),
            })
        p["assigned_clinicians"] = assigned
        p["assigned_clinician_count"] = len(assigned)
        if with_severity:
            # Latest assessment severity (Step-3 first, else any other category)
            latest_assess = await db.patient_assessment_responses.find_one(
                {"user_id": p["user_id"], "severity": {"$exists": True}},
                {"_id": 0, "severity": 1, "submitted_at": 1, "category_id": 1},
                sort=[("submitted_at", -1)],
            )
            p["latest_severity"] = latest_assess.get("severity") if latest_assess else None
            # Latest check-in ending color (for color-gated rec matching)
            latest_ck = await db.patient_checkins.find_one(
                {"patient_id": p["user_id"]},
                {"_id": 0, "user_selected_color": 1, "ending_color": 1, "created_at": 1},
                sort=[("created_at", -1)],
            )
            p["latest_color"] = (latest_ck.get("ending_color") or latest_ck.get("user_selected_color")) if latest_ck else None
    return {"patients": patients, "total": total}

@admin_router.put("/patients/{user_id}")
async def update_patient(user_id: str, update: UserUpdate, request: Request):
    await require_super_admin(request, db)
    data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user_id, "role": "patient"}, {"$set": data})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

@admin_router.delete("/patients/{user_id}")
async def delete_patient(user_id: str, request: Request):
    await require_super_admin(request, db)
    await db.users.delete_one({"user_id": user_id, "role": "patient"})
    await db.patient_checkins.delete_many({"patient_id": user_id})
    await db.subscriptions.delete_many({"user_id": user_id})
    return {"message": "Deleted"}

@admin_router.get("/patients/export/csv")
async def export_patients_csv(request: Request):
    await get_current_admin(request, db)
    patients = await db.users.find({"role": "patient"}, {"_id": 0}).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["User ID", "Name", "Email", "Mobile", "DOB", "Created At"])
    for p in patients:
        writer.writerow([p.get("user_id"), p.get("name"), p.get("email"), p.get("mobile", ""), p.get("dob", ""), p.get("created_at", "")])
    from starlette.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=patients.csv"})

# ─── Clinician Management ───
@admin_router.get("/clinicians")
async def list_clinicians(request: Request, search: str = "", skip: int = 0, limit: int = 50):
    await get_current_admin(request, db)
    query = {"role": "clinician"}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    clinicians = await db.users.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    for c in clinicians:
        sub = await db.subscriptions.find_one({"user_id": c["user_id"], "status": "active"}, {"_id": 0})
        c["subscription"] = sub
        # Assigned patient count + a small preview list (surfaces the data that
        # used to live on the removed Assignments page directly inside the
        # Clinician row).
        assigned = []
        async for s in db.patient_doctor_subscriptions.find(
            {"$or": [{"clinician_id": c["user_id"]}, {"doctor_id": c["user_id"]}], "$and": [
                {"$or": [{"status": {"$in": ["active", "trial", "trialing"]}}, {"status": {"$exists": False}}]}
            ]},
            {"_id": 0, "user_id": 1, "subscribed_at": 1, "end_date": 1},
        ):
            pid = s.get("user_id")
            if not pid:
                continue
            pt = await db.users.find_one({"user_id": pid}, {"_id": 0, "name": 1, "email": 1})
            assigned.append({
                "patient_id": pid,
                "name": (pt or {}).get("name") or "Patient",
                "email": (pt or {}).get("email"),
                "subscribed_at": s.get("subscribed_at"),
                "end_date": s.get("end_date"),
            })
        c["assigned_patients"] = assigned
        c["assigned_patient_count"] = len(assigned)
    return {"clinicians": clinicians, "total": total}

@admin_router.put("/clinicians/{user_id}")
async def update_clinician(user_id: str, update: UserUpdate, request: Request):
    await require_super_admin(request, db)
    data = {k: v for k, v in update.model_dump().items() if v is not None}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user_id, "role": "clinician"}, {"$set": data})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

@admin_router.delete("/clinicians/{user_id}")
async def delete_clinician(user_id: str, request: Request):
    await require_super_admin(request, db)
    await db.users.delete_one({"user_id": user_id, "role": "clinician"})
    return {"message": "Deleted"}

@admin_router.get("/clinicians/export/csv")
async def export_clinicians_csv(request: Request):
    await get_current_admin(request, db)
    clinicians = await db.users.find({"role": "clinician"}, {"_id": 0}).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["User ID", "Name", "Email", "Mobile", "Created At"])
    for c in clinicians:
        writer.writerow([c.get("user_id"), c.get("name"), c.get("email"), c.get("mobile", ""), c.get("created_at", "")])
    from starlette.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=clinicians.csv"})

# ─── Organization Management ───
@admin_router.get("/organizations")
async def list_orgs(request: Request, search: str = "", skip: int = 0, limit: int = 50):
    await get_current_admin(request, db)
    query = {"role": "organization"}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    orgs = await db.users.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"organizations": orgs, "total": total}

@admin_router.put("/organizations/{user_id}")
async def update_org(user_id: str, update: UserUpdate, request: Request):
    await require_super_admin(request, db)
    data = {k: v for k, v in update.model_dump().items() if v is not None}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user_id, "role": "organization"}, {"$set": data})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

@admin_router.delete("/organizations/{user_id}")
async def delete_org(user_id: str, request: Request):
    await require_super_admin(request, db)
    await db.users.delete_one({"user_id": user_id, "role": "organization"})
    return {"message": "Deleted"}

# ─── Assistant Management ───
@admin_router.get("/assistants")
async def list_assistants(request: Request):
    await require_super_admin(request, db)
    assistants = await db.admins.find({"role": "assistant"}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"assistants": assistants}

@admin_router.post("/assistants")
async def create_assistant(data: AssistantCreate, request: Request):
    await require_super_admin(request, db)
    existing = await db.admins.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(400, "Email already exists")
    assistant = {
        "admin_id": f"asst_{uuid.uuid4().hex[:12]}",
        "email": data.email.lower(),
        "name": data.name,
        "password_hash": hash_password(data.password),
        "role": "assistant",
        "permissions": data.permissions,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admins.insert_one(assistant)
    assistant.pop("password_hash"); assistant.pop("_id", None)
    # Auto-send assistant invite email (real Gmail or mock_sent)
    try:
        from email_templates import wrap_html
        from email_provider import send_via_gmail
        import uuid as _uuid
        tpl = await db.email_templates.find_one({"template_id": "tpl_assistant_invite"}, {"_id": 0})
        if tpl:
            vars_ = {"name": data.name, "temp_password": data.password, "admin_url": "/admin/login"}
            subject = tpl["subject"]
            body = tpl["body"]
            cta_url = tpl.get("cta_url", "")
            for k, v in vars_.items():
                subject = subject.replace(f"{{{{{k}}}}}", str(v))
                body = body.replace(f"{{{{{k}}}}}", str(v))
                cta_url = cta_url.replace(f"{{{{{k}}}}}", str(v))
            html = wrap_html(subject, body, tpl.get("cta_label", ""), cta_url)
            ok, status, err = await send_via_gmail(
                to_email=data.email.lower(),
                to_name=data.name,
                subject=subject,
                html_body=html,
            )
            await db.sent_emails.insert_one({
                "email_id": f"em_{_uuid.uuid4().hex[:12]}",
                "to_email": data.email.lower(),
                "to_name": data.name,
                "subject": subject,
                "template_id": "tpl_assistant_invite",
                "status": status,
                "error": err,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "trigger": "assistant_create",
            })
    except Exception:
        pass
    return assistant

@admin_router.put("/assistants/{admin_id}")
async def update_assistant(admin_id: str, request: Request):
    await require_super_admin(request, db)
    body = await request.json()
    data = {k: v for k, v in body.items() if k in ["name", "permissions", "is_active"] and v is not None}
    if "password" in body and body["password"]:
        data["password_hash"] = hash_password(body["password"])
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.admins.update_one({"admin_id": admin_id, "role": "assistant"}, {"$set": data})
    updated = await db.admins.find_one({"admin_id": admin_id}, {"_id": 0, "password_hash": 0})
    return updated

@admin_router.delete("/assistants/{admin_id}")
async def delete_assistant(admin_id: str, request: Request):
    await require_super_admin(request, db)
    await db.admins.delete_one({"admin_id": admin_id, "role": "assistant"})
    return {"message": "Deleted"}

# ─── Plan Management ───
@admin_router.get("/plans")
async def list_plans(request: Request, plan_type: str = ""):
    await get_current_admin(request, db)
    query = {}
    if plan_type:
        query["plan_type"] = plan_type
    plans = await db.subscription_plans.find(query, {"_id": 0}).to_list(100)
    return {"plans": plans}

@admin_router.post("/plans")
async def create_plan(plan: PlanCreate, request: Request):
    await require_super_admin(request, db)
    pd = plan.model_dump()
    # Normalize so patient-facing endpoint can pick this up
    doc = {
        "plan_id": f"plan_{uuid.uuid4().hex[:12]}",
        **pd,
        "status": "active",
        "active": True,
        # Mirror price → price_usd so patient UI shows same number
        "price_usd": pd.get("price", 0),
        # Use description as purpose if purpose isn't supplied
        "purpose": pd.get("description", ""),
        "order": 99,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subscription_plans.insert_one(doc)
    doc.pop("_id", None)
    return doc

@admin_router.put("/plans/{plan_id}")
async def update_plan(plan_id: str, request: Request):
    await require_super_admin(request, db)
    body = await request.json()
    allowed = ["name", "description", "price", "duration_days", "plan_type", "is_trial", "trial_days", "features", "status", "active", "purpose", "color", "order"]
    data = {k: v for k, v in body.items() if k in allowed}
    # Mirror price → price_usd when price is updated
    if "price" in data:
        data["price_usd"] = data["price"]
    if "description" in data and "purpose" not in data:
        data["purpose"] = data["description"]
    if "status" in data and "active" not in data:
        data["active"] = (data["status"] == "active")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.subscription_plans.update_one({"plan_id": plan_id}, {"$set": data})
    return await db.subscription_plans.find_one({"plan_id": plan_id}, {"_id": 0})

@admin_router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, request: Request):
    await require_super_admin(request, db)
    await db.subscription_plans.delete_one({"plan_id": plan_id})
    return {"message": "Deleted"}

# ─── Subscriptions ───
@admin_router.get("/subscriptions")
async def list_subscriptions(request: Request, user_type: str = "", status: str = "", skip: int = 0, limit: int = 50):
    await get_current_admin(request, db)
    query = {}
    if user_type:
        query["user_type"] = user_type
    if status:
        query["status"] = status
    subs = await db.subscriptions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.subscriptions.count_documents(query)
    for s in subs:
        user = await db.users.find_one({"user_id": s.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        s["user"] = user
        plan = await db.subscription_plans.find_one({"plan_id": s.get("plan_id")}, {"_id": 0, "name": 1, "price": 1})
        s["plan"] = plan
    return {"subscriptions": subs, "total": total}

@admin_router.post("/subscriptions/{sub_id}/send-renewal")
async def send_renewal(sub_id: str, request: Request):
    await get_current_admin(request, db)
    sub = await db.subscriptions.find_one({"subscription_id": sub_id}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    user = await db.users.find_one({"user_id": sub["user_id"]}, {"_id": 0})
    subject = "Subscription Renewal Reminder - IFEELINCOLOR"
    body = f"Dear {user.get('name', 'User')}, your subscription is expiring on {sub.get('end_date', 'soon')}. Please renew."
    try:
        from email_templates import wrap_html
        from email_provider import send_via_gmail
        html = wrap_html(subject, f"<p>{body}</p>", "Renew Now", "/")
        ok, status, err = await send_via_gmail(
            to_email=user.get("email", ""),
            to_name=user.get("name", ""),
            subject=subject,
            html_body=html,
        )
    except Exception as _e:
        ok, status, err = False, "failed", str(_e)
    email_log = {
        "log_id": f"email_{uuid.uuid4().hex[:12]}",
        "to": user.get("email", "unknown"),
        "subject": subject,
        "body": body,
        "status": status,
        "error": err,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.email_logs.insert_one(email_log)
    email_log.pop("_id", None)
    return {"message": "Renewal email dispatched", "email_log": email_log}

# ─── Recommendations ───
@admin_router.get("/recommendations")
async def list_recommendations(request: Request):
    await get_current_admin(request, db)
    recs = await db.recommendations.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"recommendations": recs}

@admin_router.post("/recommendations")
async def create_recommendation(rec: RecommendationCreate, request: Request):
    admin = await get_current_admin(request, db)
    doc = {
        "recommendation_id": f"rec_{uuid.uuid4().hex[:12]}",
        **rec.model_dump(),
        "created_by": admin["admin_id"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recommendations.insert_one(doc)
    doc.pop("_id", None)
    return doc

@admin_router.put("/recommendations/{rec_id}")
async def update_recommendation(rec_id: str, request: Request):
    await get_current_admin(request, db)
    body = await request.json()
    allowed = ["title", "description", "target_conditions", "category", "status",
               "content_type", "media_url", "image_url", "steps", "severity_filter", "duration_minutes",
               "trigger_colors", "body_md"]
    data = {k: v for k, v in body.items() if k in allowed}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.recommendations.update_one({"recommendation_id": rec_id}, {"$set": data})
    return await db.recommendations.find_one({"recommendation_id": rec_id}, {"_id": 0})

@admin_router.delete("/recommendations/{rec_id}")
async def delete_recommendation(rec_id: str, request: Request):
    await get_current_admin(request, db)
    await db.recommendations.delete_one({"recommendation_id": rec_id})
    return {"message": "Deleted"}

# ─── Earnings ───
@admin_router.get("/earnings")
async def earnings_data(request: Request):
    await get_current_admin(request, db)
    pipeline_total = [{"$match": {"payment_status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}]
    total = await db.payment_transactions.aggregate(pipeline_total).to_list(1)
    pipeline_monthly = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 7]}, "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}, {"$limit": 12}
    ]
    monthly = await db.payment_transactions.aggregate(pipeline_monthly).to_list(12)
    pipeline_by_type = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": "$metadata.plan_type", "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    by_type = await db.payment_transactions.aggregate(pipeline_by_type).to_list(10)
    pending = await db.payment_transactions.count_documents({"payment_status": {"$in": ["initiated", "pending"]}})
    return {
        "total_earnings": total[0]["total"] if total else 0,
        "total_transactions": total[0]["count"] if total else 0,
        "pending_transactions": pending,
        "monthly_earnings": [{"month": m["_id"], "amount": round(m["amount"], 2), "count": m["count"]} for m in monthly],
        "earnings_by_type": [{"type": t["_id"] or "other", "amount": round(t["amount"], 2), "count": t["count"]} for t in by_type],
    }

@admin_router.get("/earnings/export/csv")
async def export_earnings_csv(request: Request):
    await get_current_admin(request, db)
    txns = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Transaction ID", "User ID", "Amount", "Currency", "Status", "Plan Type", "Created At"])
    for t in txns:
        writer.writerow([t.get("transaction_id"), t.get("user_id"), t.get("amount"), t.get("currency"), t.get("payment_status"), t.get("metadata", {}).get("plan_type", ""), t.get("created_at")])
    from starlette.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=earnings.csv"})

# ─── Stripe Subscription Checkout ───
@admin_router.post("/subscribe/checkout")
async def create_subscription_checkout(request: Request):
    body = await request.json()
    plan_id = body.get("plan_id")
    user_id = body.get("user_id")
    origin_url = body.get("origin_url", "")
    plan = await db.subscription_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plan not found")
    if plan.get("is_trial"):
        sub = {
            "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
            "user_id": user_id, "plan_id": plan_id,
            "user_type": plan["plan_type"], "status": "active",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=plan.get("trial_days", 15))).isoformat(),
            "is_trial": True, "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.subscriptions.insert_one(sub)
        sub.pop("_id", None)
        return {"trial": True, "subscription": sub}
    try:
        from stripe_adapter import StripeCheckout, CheckoutSessionRequest
        api_key = os.environ.get("STRIPE_API_KEY", "")
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        success_url = f"{origin_url}/admin/subscriptions?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/admin/subscriptions"
        checkout_req = CheckoutSessionRequest(
            amount=float(plan["price"]),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"plan_id": plan_id, "user_id": user_id, "plan_type": plan["plan_type"]}
        )
        session = await stripe_checkout.create_checkout_session(checkout_req)
        txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user_id, "amount": float(plan["price"]),
            "currency": "usd", "session_id": session.session_id,
            "payment_status": "initiated",
            "metadata": {"plan_id": plan_id, "plan_type": plan["plan_type"]},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.payment_transactions.insert_one(txn)
        return {"url": session.url, "session_id": session.session_id}
    except Exception as e:
        raise HTTPException(500, f"Stripe error: {str(e)}")

@admin_router.get("/subscribe/status/{session_id}")
async def check_subscription_status(session_id: str, request: Request):
    try:
        from stripe_adapter import StripeCheckout
        api_key = os.environ.get("STRIPE_API_KEY", "")
        host_url = str(request.base_url).rstrip("/")
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=f"{host_url}/api/webhook/stripe")
        status = await stripe_checkout.get_checkout_status(session_id)
        txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if txn and txn["payment_status"] != "paid" and status.payment_status == "paid":
            await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}})
            meta = txn.get("metadata", {})
            plan = await db.subscription_plans.find_one({"plan_id": meta.get("plan_id")}, {"_id": 0})
            duration = plan.get("duration_days", 30) if plan else 30
            sub = {
                "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
                "user_id": meta.get("user_id"), "plan_id": meta.get("plan_id"),
                "user_type": meta.get("plan_type", "patient"), "status": "active",
                "start_date": datetime.now(timezone.utc).isoformat(),
                "end_date": (datetime.now(timezone.utc) + timedelta(days=duration)).isoformat(),
                "stripe_session_id": session_id, "is_trial": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.subscriptions.insert_one(sub)
        return {"status": status.status, "payment_status": status.payment_status, "amount_total": status.amount_total}
    except Exception as e:
        raise HTTPException(500, f"Status check error: {str(e)}")


# ─── Admin Patient Roadmap (Full History) ───
@admin_router.get("/patient/{patient_id}/full-history")
async def admin_patient_full_history(patient_id: str, request: Request):
    """
    Unified Patient Roadmap for the admin panel.

    Aggregates everything we know about a single patient and returns a
    single, date-desc sorted `timeline` plus headline `patient` metadata
    so the admin can render a roadmap-style UL with no further calls.

    Includes:
      • Daily check-ins (`patient_checkins`)
      • Assessment category submissions (`patient_assessment_responses`)
      • All recommendations on the patient activity feed (admin-auto,
        clinician-manual, organization)
      • Active subscription
    """
    await get_current_admin(request, db)
    patient = await db.users.find_one({"user_id": patient_id, "role": "patient"}, {"_id": 0, "password_hash": 0})
    if not patient:
        raise HTTPException(404, "Patient not found")
    checkins = await db.patient_checkins.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    assessments = await db.patient_assessment_responses.find(
        {"user_id": patient_id}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(200)
    activity = await db.patient_activity.find({"user_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    sub = await db.subscriptions.find_one(
        {"user_id": patient_id, "status": {"$in": ["active", "trial", "trialing"]}},
        {"_id": 0}, sort=[("created_at", -1)],
    )
    timeline = []
    for c in checkins:
        timeline.append({
            "event_id": c.get("checkin_id"),
            "type": "checkin",
            "category": "daily",
            "title": f"Daily check-in · {c.get('user_selected_emotion') or c.get('core_emotion') or 'reflection'}",
            "date": c.get("created_at") or c.get("date"),
            "color": c.get("user_selected_color"),
            "ending_color": c.get("ending_color"),
            "emotion": c.get("user_selected_emotion") or c.get("core_emotion"),
            "body_part": c.get("starting_body_part"),
            "sensation": c.get("starting_sensation"),
            "intensity_before": c.get("intensity_rating_before"),
            "intensity_after": c.get("intensity_rating_after"),
            "reflection": c.get("app_reflection_text") or c.get("notes"),
            "raw": c,
        })
    for a in assessments:
        cat = a.get("category_id") or "assessment"
        timeline.append({
            "event_id": a.get("response_id"),
            "type": "assessment",
            "category": cat,
            "title": f"{cat.replace('_', ' ').title()} assessment",
            "date": a.get("submitted_at"),
            "severity": a.get("severity"),
            "ai_plan": a.get("ai_plan"),
            "recommendations": a.get("recommendations"),
            "answers": a.get("answers"),
            "questions": a.get("questions"),  # snapshot if backend stored it
            "raw": a,
        })
    for ac in activity:
        if ac.get("type") in {"clinician_recommendation", "clinician_plan", "recommendation", "admin_recommendation", "org_recommendation"}:
            timeline.append({
                "event_id": ac.get("activity_id"),
                "type": "recommendation",
                "category": ac.get("type"),
                "title": ac.get("title") or "Recommendation",
                "date": ac.get("created_at"),
                "progress": ac.get("progress"),
                "description": ac.get("description") or ac.get("body_md"),
                "body_md": ac.get("body_md"),
                "image_url": ac.get("image_url"),
                "media_url": ac.get("media_url"),
                "content_type": ac.get("content_type"),
                "from_clinician": ac.get("from_clinician"),
                "clinician_name": ac.get("clinician_name"),
                "from_admin": ac.get("from_admin") or (ac.get("trigger") == "manual" and ac.get("source") == "admin"),
                "trigger": ac.get("trigger"),
                "source": ac.get("source"),
                "raw": ac,
            })
        elif ac.get("type") == "recommendation_completed":
            # Phase 2 USP — Admin always sees every completion event.
            timeline.append({
                "event_id": ac.get("activity_id"),
                "type": "recommendation_completed",
                "category": "recommendation_completed",
                "title": ac.get("title") or "Recommendation completed",
                "date": ac.get("created_at"),
                "description": ac.get("detail") or "",
                "recommendation_id": ac.get("recommendation_id"),
                "source": ac.get("source"),
                "rating": ac.get("rating"),
                "raw": ac,
            })
    timeline.sort(key=lambda x: x.get("date") or "", reverse=True)
    return {
        "patient": patient,
        "subscription": sub,
        "timeline": timeline,
        "counts": {
            "checkins": len(checkins),
            "assessments": len(assessments),
            "recommendations_given": sum(1 for ac in activity if ac.get("type") in {"clinician_recommendation", "clinician_plan", "recommendation", "admin_recommendation", "org_recommendation"}),
        },
    }


# ─── Admin: Manual Per-Patient Recommendation ───
@admin_router.post("/patient/{patient_id}/recommendation")
async def admin_send_manual_recommendation(patient_id: str, request: Request):
    """
    Send a manual recommendation to a single patient from the admin panel.

    Accepts either:
      - `recommendation_id` referencing an existing entry in `db.recommendations`
      - Inline payload: `title`, `description` / `body_md`, optional
        `content_type` ('text'|'video'|'image'|'steps'|'link'), `media_url`,
        `image_url`, `steps[]`.

    Stored as a `patient_activity` row with `source='admin'`, `trigger='manual'`
    so the patient's existing Recommendations UI (which merges admin/clinician/
    organization sources) picks it up automatically alongside the auto-gated
    color-based recs.
    """
    admin = await get_current_admin(request, db)
    patient = await db.users.find_one({"user_id": patient_id, "role": "patient"}, {"_id": 0})
    if not patient:
        raise HTTPException(404, "Patient not found")
    body = await request.json()
    rec_doc = None
    if body.get("recommendation_id"):
        rec_doc = await db.recommendations.find_one({"recommendation_id": body["recommendation_id"]}, {"_id": 0})
        if not rec_doc:
            raise HTTPException(404, "Recommendation not found in library")
    title = (rec_doc and rec_doc.get("title")) or body.get("title") or "Recommendation"
    description = (rec_doc and rec_doc.get("description")) or body.get("description") or body.get("body_md") or ""
    activity = {
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "user_id": patient_id,
        "type": "recommendation",
        "title": title,
        "description": description,
        "body_md": body.get("body_md") or (rec_doc and rec_doc.get("body_md")) or "",
        "content_type": body.get("content_type") or (rec_doc and rec_doc.get("content_type")) or "text",
        "media_url": body.get("media_url") or (rec_doc and rec_doc.get("media_url")) or "",
        "image_url": body.get("image_url") or (rec_doc and rec_doc.get("image_url")) or "",
        "steps": body.get("steps") or (rec_doc and rec_doc.get("steps")) or [],
        "source": "admin",
        "trigger": "manual",
        "from_admin": True,
        "admin_id": admin["admin_id"],
        "admin_name": admin.get("name") or admin.get("email") or "Admin",
        "recommendation_id": rec_doc and rec_doc.get("recommendation_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "progress": 0,
    }
    # Idempotency: if this admin already sent the same library rec to this
    # patient in the past 24h, refresh `created_at` rather than create a dup.
    if rec_doc:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        existing = await db.patient_activity.find_one({
            "user_id": patient_id,
            "type": "recommendation",
            "source": "admin",
            "trigger": "manual",
            "recommendation_id": rec_doc.get("recommendation_id"),
            "created_at": {"$gte": cutoff},
        }, {"_id": 0})
        if existing:
            await db.patient_activity.update_one(
                {"activity_id": existing["activity_id"]},
                {"$set": {"created_at": activity["created_at"], "admin_id": admin["admin_id"], "admin_name": activity["admin_name"]}},
            )
            return {"ok": True, "activity": {**existing, **{"created_at": activity["created_at"]}}, "deduped": True}
    await db.patient_activity.insert_one(activity)
    activity.pop("_id", None)
    return {"ok": True, "activity": activity, "deduped": False}
