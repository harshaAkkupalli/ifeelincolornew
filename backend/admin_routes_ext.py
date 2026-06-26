from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone
import uuid, os, base64

admin_ext_router = APIRouter(prefix="/api/admin")
db = None
def set_ext_db(database):
    global db
    db = database

# ─── Helpers ───
async def _get_admin(request):
    from admin_auth import get_current_admin
    return await get_current_admin(request, db)

async def _require_super(request):
    from admin_auth import require_super_admin
    return await require_super_admin(request, db)

# ─── Assessment Templates ───
class QuestionData(BaseModel):
    text: str
    type: str = "yes_no"  # yes_no, multiple_choice, long_answer, scale, dropdown, file_upload, date_picker, image_based
    options: List[str] = []
    scale_min: int = 0
    scale_max: int = 10
    scale_min_label: str = "Low"
    scale_max_label: str = "High"
    image_url: str = ""
    accepted_types: str = ""
    required: bool = True

class AssessmentCreate(BaseModel):
    assessment_type: str  # mood, body, treatment_history, health_social
    title: str
    description: str = ""
    linked_emotion: str = ""
    linked_body_part: str = ""
    questions: List[QuestionData] = []

@admin_ext_router.get("/assessments")
async def list_assessments(request: Request, assessment_type: str = ""):
    await _get_admin(request)
    query = {}
    if assessment_type:
        query["assessment_type"] = assessment_type
    items = await db.assessment_templates.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"assessments": items}

@admin_ext_router.post("/assessments")
async def create_assessment(data: AssessmentCreate, request: Request):
    await _require_super(request)
    questions = []
    for i, q in enumerate(data.questions):
        questions.append({"question_id": f"q_{uuid.uuid4().hex[:8]}", **q.model_dump(), "order": i + 1})
    doc = {
        "template_id": f"asmnt_{uuid.uuid4().hex[:12]}",
        "assessment_type": data.assessment_type,
        "title": data.title,
        "description": data.description,
        "linked_emotion": data.linked_emotion,
        "linked_body_part": data.linked_body_part,
        "questions": questions,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.assessment_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc

@admin_ext_router.put("/assessments/{template_id}")
async def update_assessment(template_id: str, request: Request):
    await _require_super(request)
    body = await request.json()
    allowed = ["title", "description", "linked_emotion", "linked_body_part", "status"]
    data = {k: v for k, v in body.items() if k in allowed}
    if "questions" in body:
        questions = []
        for i, q in enumerate(body["questions"]):
            qid = q.get("question_id", f"q_{uuid.uuid4().hex[:8]}")
            questions.append({**q, "question_id": qid, "order": i + 1})
        data["questions"] = questions
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.assessment_templates.update_one({"template_id": template_id}, {"$set": data})
    return await db.assessment_templates.find_one({"template_id": template_id}, {"_id": 0})

@admin_ext_router.delete("/assessments/{template_id}")
async def delete_assessment(template_id: str, request: Request):
    await _require_super(request)
    await db.assessment_templates.delete_one({"template_id": template_id})
    return {"message": "Deleted"}

@admin_ext_router.post("/assessments/{template_id}/questions")
async def add_question(template_id: str, q: QuestionData, request: Request):
    await _require_super(request)
    tmpl = await db.assessment_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not tmpl:
        raise HTTPException(404, "Assessment not found")
    existing_qs = tmpl.get("questions", [])
    new_q = {"question_id": f"q_{uuid.uuid4().hex[:8]}", **q.model_dump(), "order": len(existing_qs) + 1}
    await db.assessment_templates.update_one({"template_id": template_id}, {"$push": {"questions": new_q}})
    return new_q

@admin_ext_router.delete("/assessments/{template_id}/questions/{question_id}")
async def remove_question(template_id: str, question_id: str, request: Request):
    await _require_super(request)
    await db.assessment_templates.update_one({"template_id": template_id}, {"$pull": {"questions": {"question_id": question_id}}})
    return {"message": "Question removed"}


# ─── Assessment category-level toggle (admin) ───
# Lets Super Admin disable Treatment History / Health & Social Info for ALL
# patients. The `assessment` category is always required (paid step) so it
# can never be toggled off.
class CategoryToggle(BaseModel):
    enabled: bool


@admin_ext_router.get("/assessment-categories")
async def admin_assessment_categories(request: Request):
    await _get_admin(request)
    cats = [
        {"id": "treatment_history", "title": "Treatment History"},
        {"id": "health_social",     "title": "Health & Social Info"},
    ]
    out = []
    for c in cats:
        s = await db.assessment_category_settings.find_one({"category_id": c["id"]}, {"_id": 0})
        # Count active templates so the UI can prompt admin to add questions
        # when toggling on for the first time.
        tpl = await db.assessment_templates.find_one(
            {"assessment_type": c["id"], "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
            {"_id": 0, "template_id": 1, "questions": 1},
        )
        out.append({
            **c,
            "enabled": bool(s.get("enabled", True)) if s else True,
            "has_active_template": bool(tpl),
            "question_count": len(tpl.get("questions", [])) if tpl else 0,
        })
    return {"categories": out}


@admin_ext_router.post("/assessment-categories/{category_id}/toggle")
async def admin_toggle_category(category_id: str, payload: CategoryToggle, request: Request):
    await _require_super(request)
    if category_id not in ("treatment_history", "health_social"):
        raise HTTPException(status_code=400, detail="Only treatment_history and health_social can be toggled.")
    now = datetime.now(timezone.utc).isoformat()
    await db.assessment_category_settings.update_one(
        {"category_id": category_id},
        {"$set": {"category_id": category_id, "enabled": bool(payload.enabled), "updated_at": now}},
        upsert=True,
    )
    # If enabling, surface whether the admin still needs to add questions
    needs_setup = False
    if payload.enabled:
        tpl = await db.assessment_templates.find_one(
            {"assessment_type": category_id, "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
            {"_id": 0, "questions": 1},
        )
        needs_setup = not (tpl and tpl.get("questions"))
    return {"ok": True, "category_id": category_id, "enabled": payload.enabled, "needs_setup": needs_setup}

# ─── Custom Body Parts ───
@admin_ext_router.get("/body-parts")
async def list_body_parts(request: Request):
    await _get_admin(request)
    parts = await db.custom_body_parts.find({}, {"_id": 0}).to_list(100)
    return {"body_parts": parts}

@admin_ext_router.post("/body-parts")
async def create_body_part(request: Request):
    await _require_super(request)
    body = await request.json()
    doc = {
        "body_part_id": f"bp_{uuid.uuid4().hex[:8]}",
        "name": body.get("name", ""),
        "description": body.get("description", ""),
        "position": body.get("position", {"x": 50, "y": 50}),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.custom_body_parts.insert_one(doc)
    doc.pop("_id", None)
    return doc

@admin_ext_router.delete("/body-parts/{body_part_id}")
async def delete_body_part(body_part_id: str, request: Request):
    await _require_super(request)
    await db.custom_body_parts.delete_one({"body_part_id": body_part_id})
    return {"message": "Deleted"}

# ─── Announcements ───
@admin_ext_router.get("/announcements")
async def list_announcements(request: Request, target: str = ""):
    await _get_admin(request)
    query = {}
    if target:
        query["target_audience"] = target
    items = await db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"announcements": items}

@admin_ext_router.post("/announcements")
async def create_announcement(request: Request):
    await _require_super(request)
    body = await request.json()
    doc = {
        "announcement_id": f"ann_{uuid.uuid4().hex[:12]}",
        "title": body.get("title", ""),
        "content": body.get("content", ""),
        "image_data": body.get("image_data", ""),
        "target_audience": body.get("target_audience", "all"),
        # Optional deep-link the user is taken to when they tap the card in
        # their portal. Eg "/app/subscribe?tab=clinician" for patients or
        # "/clinician/patients" for clinicians.
        "link_target": (body.get("link_target") or "").strip(),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.announcements.insert_one(doc)
    doc.pop("_id", None)
    return doc

@admin_ext_router.put("/announcements/{ann_id}")
async def update_announcement(ann_id: str, request: Request):
    await _require_super(request)
    body = await request.json()
    allowed = ["title", "content", "image_data", "target_audience", "link_target", "status"]
    data = {k: v for k, v in body.items() if k in allowed}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.announcements.update_one({"announcement_id": ann_id}, {"$set": data})
    return await db.announcements.find_one({"announcement_id": ann_id}, {"_id": 0})

@admin_ext_router.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, request: Request):
    await _require_super(request)
    await db.announcements.delete_one({"announcement_id": ann_id})
    return {"message": "Deleted"}

# ─── Permissions ───
PERMISSION_PAGES = ["dashboard", "patients", "clinicians", "organizations", "assistants",
    "plans", "subscriptions", "recommendations", "earnings", "assessments", "announcements", "payment_setup"]
PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "export"]

@admin_ext_router.get("/permissions")
async def list_permissions(request: Request):
    await _require_super(request)
    admins = await db.admins.find({"role": {"$ne": "super_admin"}}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"admins": admins, "pages": PERMISSION_PAGES, "actions": PERMISSION_ACTIONS}

@admin_ext_router.put("/permissions/{admin_id}")
async def update_permissions(admin_id: str, request: Request):
    await _require_super(request)
    target = await db.admins.find_one({"admin_id": admin_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Admin not found")
    body = await request.json()
    page_permissions = body.get("page_permissions", {})
    await db.admins.update_one({"admin_id": admin_id}, {"$set": {
        "page_permissions": page_permissions,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})
    return await db.admins.find_one({"admin_id": admin_id}, {"_id": 0, "password_hash": 0})

# ─── Payment Setup ───
@admin_ext_router.post("/payment-setup/send-link")
async def send_payment_link(request: Request):
    await _require_super(request)
    body = await request.json()
    org_user_id = body.get("organization_id")
    amount = float(body.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    org = await db.users.find_one({"user_id": org_user_id, "role": "organization"}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organization not found")
    try:
        from stripe_adapter import StripeCheckout, CheckoutSessionRequest
        api_key = os.environ.get("STRIPE_API_KEY", "")
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        origin = body.get("origin_url", host_url)
        session = await stripe_checkout.create_checkout_session(CheckoutSessionRequest(
            amount=amount, currency="usd",
            success_url=f"{origin}/admin/payment-setup?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url=f"{origin}/admin/payment-setup?status=cancelled",
            metadata={"organization_id": org_user_id, "org_name": org.get("name", ""), "type": "org_payment"}
        ))
        txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": org_user_id, "amount": amount, "currency": "usd",
            "session_id": session.session_id, "payment_status": "initiated",
            "metadata": {"organization_id": org_user_id, "type": "org_payment"},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.payment_transactions.insert_one(txn)
        # Real email dispatch (Gmail SMTP when configured)
        sent_status = "mock_sent"
        sent_err = None
        try:
            from email_templates import wrap_html
            from email_provider import send_via_gmail
            subject = f"Payment Request - ${amount:.2f} - IFEELINCOLOR"
            body_html = f"<p>Dear {org.get('name')},</p><p>Please complete your payment of <strong>${amount:.2f}</strong> using the button below.</p>"
            html = wrap_html(subject, body_html, "Pay Now", session.url)
            ok, sent_status, sent_err = await send_via_gmail(
                to_email=org.get("email", ""),
                to_name=org.get("name", ""),
                subject=subject,
                html_body=html,
            )
        except Exception:
            pass
        email_log = {
            "log_id": f"email_{uuid.uuid4().hex[:12]}",
            "to": org.get("email", ""),
            "subject": f"Payment Request - ${amount:.2f} - IFEELINCOLOR",
            "body": f"Dear {org.get('name')}, please complete your payment of ${amount:.2f} using this link: {session.url}",
            "payment_url": session.url,
            "status": sent_status,
            "error": sent_err,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.email_logs.insert_one(email_log)
        email_log.pop("_id", None)
        return {"payment_url": session.url, "session_id": session.session_id, "email_log": email_log}
    except Exception as e:
        raise HTTPException(500, f"Payment setup error: {str(e)}")

# ─── Settings (Demo Toggle etc.) ───
@admin_ext_router.get("/settings")
async def get_settings(request: Request):
    await _get_admin(request)
    settings = await db.admin_settings.find({}, {"_id": 0}).to_list(100)
    result = {}
    for s in settings:
        result[s["setting_key"]] = s["value"]
    return result

@admin_ext_router.put("/settings")
async def update_settings(request: Request):
    await _require_super(request)
    body = await request.json()
    for key, value in body.items():
        await db.admin_settings.update_one(
            {"setting_key": key},
            {"$set": {"value": value, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
    settings = await db.admin_settings.find({}, {"_id": 0}).to_list(100)
    return {s["setting_key"]: s["value"] for s in settings}

# Public endpoint for demo visibility
@admin_ext_router.get("/settings/demo-visible")
async def demo_visible():
    setting = await db.admin_settings.find_one({"setting_key": "show_demo_credentials"}, {"_id": 0})
    return {"visible": setting["value"] if setting else True}
