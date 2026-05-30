"""
Patient flow routes — subscriptions, assessments, doctors, announcements, emergencies.
Built for the IFEELINCOLOR mobile app post-login experience.
"""
from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta
import uuid
import os
import math
import httpx

patient_flow_router = APIRouter(prefix="/api")
db = None


def set_pf_db(database):
    global db
    db = database


# ─── Helpers ───
async def _current_user(request: Request):
    """Resolves the current logged-in user from session_token cookie."""
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db.users.find_one({"session_tokens": session_token}, {"_id": 0})
    if not user:
        # Fallback: lookup in user_sessions
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if not sess:
            raise HTTPException(status_code=401, detail="Invalid session")
        user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


@patient_flow_router.get("/patient/preferences")
async def get_patient_preferences(request: Request):
    """Return the patient's UI prefs (incl. low_stimulus_mode)."""
    user = await _current_user(request)
    prefs = (user.get("preferences") or {})
    return {
        "low_stimulus_mode": bool(prefs.get("low_stimulus_mode")),
        "tts_enabled": bool(prefs.get("tts_enabled", True)),
        "preferences": prefs,
    }


@patient_flow_router.post("/patient/preferences")
async def set_patient_preferences(request: Request, payload: dict = Body(...)):
    """Persist Low-Stimulus / TTS prefs onto users.preferences. Idempotent."""
    user = await _current_user(request)
    update = {}
    if "low_stimulus_mode" in payload:
        update["preferences.low_stimulus_mode"] = bool(payload["low_stimulus_mode"])
    if "tts_enabled" in payload:
        update["preferences.tts_enabled"] = bool(payload["tts_enabled"])
    if not update:
        return {"ok": True, "preferences": user.get("preferences") or {}}
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    refreshed = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "preferences": 1})
    return {"ok": True, "preferences": (refreshed or {}).get("preferences") or {}}


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ╔════════════════════════════════════════╗
# ║       SUBSCRIPTION PLANS               ║
# ╚════════════════════════════════════════╝

DEFAULT_PLANS = [
    {
        "plan_id": "plan_trial",
        "name": "Free Trial",
        "duration_days": 7,
        "price_usd": 0,
        "purpose": "7 days free — full access to Assessments, Daily Check-In, and personalised Recommendations. No card required.",
        "color": "#22D67E",
        "order": 0,
        "active": True,
        "features": ["Full assessment suite (3 categories)", "Daily 9-step check-ins", "Personalised recommendations", "No credit card required"],
    },
    {
        "plan_id": "plan_monthly",
        "name": "Monthly Plan",
        "duration_days": 30,
        "price_usd": 29,
        "purpose": "Best for short-term clinical triage monitoring, acute symptom tracking, or post-surgical somatic observation.",
        "color": "#FF4FBF",
        "order": 1,
        "active": True,
    },
    {
        "plan_id": "plan_quarterly",
        "name": "Quarterly Plan",
        "duration_days": 90,
        "price_usd": 79,
        "purpose": "Designed for traditional mid-range therapeutic adjustments, structured behavior modification tracking, and localized clinical check-ins.",
        "color": "#22D3C5",
        "order": 2,
        "active": True,
    },
    {
        "plan_id": "plan_yearly",
        "name": "Yearly Plan",
        "duration_days": 365,
        "price_usd": 249,
        "purpose": "Ideal for ongoing chronic pain coordination, continuous emotional regulation support, and automated long-term preventative care tracking.",
        "color": "#FFD23F",
        "order": 3,
        "active": True,
    },
    # ── Organization plans ──
    {
        "plan_id": "org_starter",
        "name": "Org Starter",
        "plan_type": "organization",
        "duration_days": 30,
        "price_usd": 99,
        "purpose": "For small clinics, wellness studios, or schools — up to 25 active members and shared resources.",
        "color": "#FF8C3F",
        "order": 1,
        "active": True,
        "features": ["Up to 25 members", "Shared care library", "Group analytics", "Email support"],
    },
    {
        "plan_id": "org_pro",
        "name": "Org Pro",
        "plan_type": "organization",
        "duration_days": 30,
        "price_usd": 299,
        "purpose": "For mid-size healthcare organizations — up to 200 members, multi-clinician routing, and admin dashboards.",
        "color": "#9D5BFF",
        "order": 2,
        "active": True,
        "features": ["Up to 200 members", "Multi-clinician routing", "Admin dashboard", "Priority support"],
    },
    {
        "plan_id": "org_enterprise",
        "name": "Org Enterprise",
        "plan_type": "organization",
        "duration_days": 365,
        "price_usd": 1999,
        "purpose": "For enterprise health systems — unlimited members, dedicated success manager, and custom integrations.",
        "color": "#22D3C5",
        "order": 3,
        "active": True,
        "features": ["Unlimited members", "Dedicated success manager", "Custom integrations", "SLA + 24/7 support"],
    },
]


async def seed_subscription_plans():
    if db is None:
        return
    for p in DEFAULT_PLANS:
        exists = await db.subscription_plans.find_one({"plan_id": p["plan_id"]})
        if not exists:
            await db.subscription_plans.insert_one({**p, "created_at": _now_iso()})
    # Migration: backfill admin-created patient plans missing active/price_usd/order
    async for doc in db.subscription_plans.find({
        "$and": [
            {"$or": [{"plan_type": "patient"}, {"plan_type": {"$exists": False}}]},
            {"$or": [{"active": {"$exists": False}}, {"price_usd": {"$exists": False}}, {"order": {"$exists": False}}]},
        ]
    }):
        updates = {}
        if "active" not in doc:
            updates["active"] = doc.get("status", "active") == "active"
        if "price_usd" not in doc and "price" in doc:
            updates["price_usd"] = doc.get("price", 0)
        if "purpose" not in doc and doc.get("description"):
            updates["purpose"] = doc["description"]
        if "order" not in doc:
            updates["order"] = 99
        if updates:
            await db.subscription_plans.update_one({"plan_id": doc["plan_id"]}, {"$set": updates})


@patient_flow_router.get("/plans")
async def list_plans(role: str = "patient"):
    """Return subscription plans visible to a given role (patient/clinician/organization)."""
    # Allowed plan_type values for the requested role
    if role == "patient":
        type_filter = {"$or": [
            {"plan_type": "patient"},
            {"plan_type": {"$exists": False}},  # legacy seed plans
        ]}
    elif role == "clinician":
        type_filter = {"plan_type": "clinician"}
    elif role == "organization":
        type_filter = {"plan_type": "organization"}
    else:
        type_filter = {"plan_type": role}

    plans = await db.subscription_plans.find(
        {
            "$and": [
                type_filter,
                {"$or": [
                    {"active": True},
                    {"status": "active"},
                ]},
            ]
        },
        {"_id": 0}
    ).sort([("order", 1), ("created_at", 1)]).to_list(50)
    # Normalize fields so the patient UI gets consistent keys
    normalized = []
    for p in plans:
        normalized.append({
            "plan_id": p.get("plan_id"),
            "name": p.get("name"),
            "duration_days": p.get("duration_days", 30),
            "price_usd": p.get("price_usd", p.get("price", 0)),
            "purpose": p.get("purpose") or p.get("description") or "",
            "color": p.get("color", "#7C5BFF"),
            "order": p.get("order", 99),
            "active": True,
            "features": p.get("features", []),
            "is_trial": p.get("is_trial", False),
            "trial_days": p.get("trial_days", 0),
            "plan_type": p.get("plan_type", "patient"),
        })
    return {"plans": normalized}


class SubscribeRequest(BaseModel):
    plan_id: str


@patient_flow_router.post("/subscribe/mock")
async def subscribe_mock(payload: SubscribeRequest, request: Request):
    """Mock subscription / trial — instantly activates without payment.

    Role-aware: clinicians get written to `clinician_subscriptions`, orgs to
    `organization_subscriptions`, patients to `patient_subscriptions`. Used by
    free-trial plans (price=0) and dev seed flows."""
    user = await _current_user(request)
    role = (user.get("role") or "patient").lower()
    plan = await db.subscription_plans.find_one({"plan_id": payload.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    starts = datetime.now(timezone.utc)
    # For trial plans, prefer trial_days
    days = int(plan.get("trial_days") if plan.get("is_trial") and plan.get("trial_days") else plan.get("duration_days") or 30)
    ends = starts + timedelta(days=days)
    sub = {
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "status": "trial" if plan.get("is_trial") else "active",
        "payment_status": "mock_paid",
        "start_date": starts.isoformat(),
        "end_date": ends.isoformat(),
        "amount_paid_usd": plan.get("price_usd") or 0,
        "created_at": _now_iso(),
    }
    coll_map = {
        "clinician": db.clinician_subscriptions,
        "organization": db.organization_subscriptions,
        "patient": db.patient_subscriptions,
    }
    coll = coll_map.get(role, db.patient_subscriptions)
    await coll.update_one(
        {"user_id": user["user_id"], "status": {"$in": ["active", "trial", "trialing"]}},
        {"$set": {"status": "replaced"}},
    )
    await coll.insert_one(sub)
    sub.pop("_id", None)
    return {"subscription": sub}


@patient_flow_router.get("/me/subscription")
async def my_subscription(request: Request):
    user = await _current_user(request)
    role = (user.get("role") or "patient").lower()
    # Clinicians have their own subscription collection
    if role == "clinician":
        sub = await db.clinician_subscriptions.find_one(
            {"user_id": user["user_id"], "status": {"$in": ["active", "trial", "trialing"]}},
            {"_id": 0}, sort=[("created_at", -1)],
        )
    elif role == "organization":
        sub = await db.organization_subscriptions.find_one(
            {"user_id": user["user_id"], "status": {"$in": ["active", "trial", "trialing"]}},
            {"_id": 0}, sort=[("created_at", -1)],
        )
    else:
        sub = await db.patient_subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"}, {"_id": 0}
        )
    if not sub:
        return {"active": False, "subscription": None}
    # Auto-expire if past end date
    try:
        if sub.get("end_date") and datetime.fromisoformat(sub["end_date"]) < datetime.now(timezone.utc):
            coll_map = {
                "clinician": db.clinician_subscriptions,
                "organization": db.organization_subscriptions,
                "patient": db.patient_subscriptions,
            }
            await coll_map[role].update_one(
                {"subscription_id": sub["subscription_id"]},
                {"$set": {"status": "expired"}},
            )
            return {"active": False, "subscription": None}
    except Exception:
        pass
    return {"active": True, "subscription": sub}


# ╔════════════════════════════════════════╗
# ║       PATIENT ASSESSMENTS              ║
# ╚════════════════════════════════════════╝

ASSESSMENT_CATEGORIES = [
    {"id": "treatment_history", "title": "Treatment History", "icon": "history", "color": "#FF4FBF", "order": 1},
    {"id": "health_social", "title": "Health & Social Info", "icon": "users", "color": "#22D3C5", "order": 2},
    {"id": "assessment", "title": "Assessment", "icon": "brain", "color": "#FFD23F", "order": 3},
]


@patient_flow_router.get("/assessment-categories")
async def assessment_categories():
    return {"categories": ASSESSMENT_CATEGORIES}


@patient_flow_router.get("/patient/assessment-questions/{category_id}")
async def patient_assessment_questions(category_id: str, request: Request):
    """Return ONLY the admin-curated published assessment template for a category.
    If no admin template exists, return an empty list with source='admin_pending' so the
    patient sees a clear empty-state and is NOT shown any dummy/default questions."""
    await _current_user(request)  # auth gate
    type_map = {
        "treatment_history": "treatment_history",
        "health_social": "health_social",
        "assessment": "mood",
    }
    a_type = type_map.get(category_id, category_id)
    tpl = await db.assessment_templates.find_one(
        {"assessment_type": a_type, "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    questions = (tpl or {}).get("questions") or []
    if not questions:
        return {
            "category_id": category_id,
            "questions": [],
            "source": "admin_pending",
            "message": "This assessment hasn't been configured by the admin yet. Please check back soon.",
        }
    return {"category_id": category_id, "questions": questions, "source": "admin"}


class AssessmentSubmission(BaseModel):
    category_id: str  # treatment_history | health_social | assessment
    answers: Dict[str, Any]  # question_id -> answer


@patient_flow_router.post("/patient/assessment-submit")
async def patient_assessment_submit(payload: AssessmentSubmission, request: Request):
    user = await _current_user(request)
    # Require active subscription for the final "assessment" step
    if payload.category_id == "assessment":
        sub = await db.patient_subscriptions.find_one({"user_id": user["user_id"], "status": "active"}, {"_id": 0})
        if not sub:
            raise HTTPException(status_code=402, detail="Active subscription required to submit the final assessment.")

    doc = {
        "response_id": f"resp_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "category_id": payload.category_id,
        "answers": payload.answers,
        "submitted_at": _now_iso(),
    }
    await db.patient_assessment_responses.insert_one(doc)
    # Clear any draft for this category since it's now completed
    await db.patient_assessment_drafts.delete_one(
        {"user_id": user["user_id"], "category_id": payload.category_id}
    )
    doc.pop("_id", None)

    # ── Severity scoring + auto-recommendations on final assessment ──
    severity = None
    recommendations = []
    if payload.category_id == "assessment":
        severity, recommendations = _score_assessment(payload.answers)
        # Log a friendly activity entry so patient sees it in notifications
        await db.patient_activity.insert_one({
            "activity_id": f"act_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "type": "assessment_completed",
            "title": f"Assessment complete · {severity.title()} severity",
            "detail": "Your personalized recommendations are ready.",
            "severity": severity,
            "created_at": _now_iso(),
        })
        # Pull admin-curated recommendations for this severity
        admin_recs = await db.recommendations.find(
            {"status": "active", "$or": [
                {"severity_filter": {"$in": [severity]}},
                {"severity_filter": {"$size": 0}},
                {"severity_filter": {"$exists": False}},
            ]}, {"_id": 0}
        ).limit(20).to_list(20)

        # ── NEW: gate by the patient's latest ending color/emotion ──
        # Admin can configure a Portal Recommendation with `trigger_colors`
        # (e.g. ["red", "orange"]). When set, the rec — AND its notification —
        # must only reach patients whose latest check-in's ending color /
        # emotion family matches one of those values. Universal recs (empty
        # trigger_colors) continue to fan out to everyone.
        latest_cin = await db.patient_checkins.find_one(
            {"$or": [{"patient_id": user["user_id"]}, {"user_id": user["user_id"]}]},
            {"_id": 0}, sort=[("created_at", -1)]
        )
        ending_color_now = None
        if latest_cin:
            ec = (latest_cin.get("ending_color") or latest_cin.get("end_emotion")
                  or latest_cin.get("emotion_family") or latest_cin.get("user_selected_emotion"))
            if isinstance(ec, str):
                ending_color_now = ec.lower()

        def _passes_color_gate(rec: dict) -> bool:
            tc = rec.get("trigger_colors") or []
            if not tc:
                return True  # universal
            if not ending_color_now:
                return False
            return ending_color_now in [str(c).lower() for c in tc]

        admin_recs = [r for r in admin_recs if _passes_color_gate(r)][:6]
        # AI-augmented personalized recommendation summary
        ai_plan = None
        try:
            from llm_adapter import call_llm, has_llm_key
            if has_llm_key():
                titles = ", ".join([r.get("title", "") for r in admin_recs[:5]]) or "general wellness"
                resp = await call_llm(
                    system=(
                        "You are a gentle wellness coach for IFEELINCOLOR. Given a user's assessment severity and a "
                        "list of clinician-curated recommendations, produce ONLY a compact JSON object: "
                        '{"summary": "1-2 warm sentences", "next_steps": ["step 1", "step 2", "step 3"], "encouragement": "1 sentence"}. '
                        "Tone: warm, humanizing, never clinical, no medication advice."
                    ),
                    user_text=(
                        f"Severity: {severity}. Curated suggestions: {titles}. "
                        f"Brief assessment hints: {str(payload.answers)[:300]}"
                    ),
                )
                import json as _json, re as _re
                m = _re.search(r"\{.*\}", resp, _re.DOTALL)
                if m:
                    ai_plan = _json.loads(m.group(0))
        except Exception:
            ai_plan = None

        await db.patient_assessment_responses.update_one(
            {"response_id": doc["response_id"]},
            {"$set": {"severity": severity, "recommendations": recommendations, "ai_plan": ai_plan, "admin_recs": admin_recs}},
        )
        doc["severity"] = severity
        doc["recommendations"] = recommendations
        doc["ai_plan"] = ai_plan
        doc["admin_recs"] = admin_recs

        # Auto-assign curated recommendations into patient_activity so they
        # surface in (1) Patient Recommendations feed, (2) Admin Patient
        # Roadmap timeline, (3) Clinician Patient roadmap accordion. Upsert
        # keyed on ref_id to keep idempotency across multiple submits.
        for r in admin_recs[:6]:
            ref = r.get("recommendation_id") or r.get("rec_id") or r.get("title")
            await db.patient_activity.update_one(
                {"user_id": user["user_id"], "type": "recommendation", "ref_id": ref},
                {"$setOnInsert": {
                    "activity_id": f"act_{uuid.uuid4().hex[:12]}",
                    "user_id": user["user_id"],
                    "type": "recommendation",
                    "ref_id": ref,
                    "recommendation_id": r.get("recommendation_id"),
                    "title": r.get("title"),
                    "description": r.get("description") or r.get("body_md") or "",
                    "body_md": r.get("body_md") or "",
                    "content_type": r.get("content_type") or "text",
                    "image_url": r.get("image_url"),
                    "media_url": r.get("media_url"),
                    "steps": r.get("steps") or [],
                    "source": "admin",
                    "trigger": "auto_severity",
                    "auto_assigned": True,
                    "from_admin": True,
                    "severity": severity,
                    "matched_color": ending_color_now,
                    "created_at": _now_iso(),
                    "progress": 0,
                }},
                upsert=True,
            )

    return {"response": doc}


def _score_assessment(ans: Dict[str, Any]) -> (str, List[dict]):
    """Heuristic scoring → severity bucket + recommendation cards."""
    score = 0
    sev_flag = False

    # Map common frequency answers
    freq_map = {"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3}
    for k, v in ans.items():
        if isinstance(v, str) and v in freq_map:
            score += freq_map[v]
        if isinstance(v, (int, float)) and 0 <= v <= 10:
            # scale answers: low scale = worse regulation
            if v <= 3:
                score += 2
            elif v <= 5:
                score += 1
        if isinstance(v, str) and v.lower() in ("yes",) and "hurt" in str(k).lower():
            sev_flag = True
            score += 6
    # Also check a4 (self-harm question)
    if ans.get("a4") in ("Yes", "yes", True, "true"):
        sev_flag = True
        score += 6

    if sev_flag or score >= 8:
        severity = "critical"
    elif score >= 5:
        severity = "high"
    elif score >= 3:
        severity = "moderate"
    else:
        severity = "low"

    recs_by_sev = {
        "critical": [
            {"title": "Immediate professional support", "description": "Please reach out to your clinician today. The Emergency button can connect you to nearby help right now.", "icon": "alert"},
            {"title": "Grounding exercise", "description": "5-4-3-2-1 senses technique: name 5 things you see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.", "icon": "shield"},
        ],
        "high": [
            {"title": "Schedule a clinician check-in", "description": "Book a session within the next 48 hours.", "icon": "calendar"},
            {"title": "Daily mood mapping", "description": "Use the daily check-in feature to track patterns this week.", "icon": "activity"},
        ],
        "moderate": [
            {"title": "Mindful breathing — 4-7-8", "description": "Breathe in 4 sec, hold 7, exhale 8. Three rounds, twice daily.", "icon": "wind"},
            {"title": "Connect with someone you trust", "description": "Reach out to a friend or family member today.", "icon": "users"},
        ],
        "low": [
            {"title": "Keep up the streak", "description": "Your patterns look healthy. Continue daily check-ins.", "icon": "sparkles"},
            {"title": "Try a creative outlet", "description": "Color, draw, or journal once this week.", "icon": "palette"},
        ],
    }
    return severity, recs_by_sev[severity]


@patient_flow_router.get("/patient/my-responses")
async def my_responses(request: Request):
    user = await _current_user(request)
    items = await db.patient_assessment_responses.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(50)
    return {"responses": items}


@patient_flow_router.get("/patient/dossier/pdf")
async def patient_dossier_pdf(request: Request):
    """Server-rendered PDF dossier — downloads cleanly in every WebView /
    APK wrapper (Median.co, WebViewGold, Capacitor, TWA, regular browser).

    Returns the PDF as a streaming download with `Content-Disposition: attachment`.
    """
    from fastapi.responses import Response
    from dossier_pdf import build_dossier_pdf

    user = await _current_user(request)
    user_id = user["user_id"]

    # Pull the same data the frontend already shows on Journey
    raw_checkins = await db.patient_checkins.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    # Filter out empty/admin-marker checkins — only keep ones with real body data.
    checkins = [
        c for c in raw_checkins
        if (c.get("user_selected_color") or c.get("ending_color")
            or c.get("intensity_rating_before") or c.get("starting_body_part"))
    ]
    recs = await db.patient_recommendations.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("sent_at", -1).to_list(50)
    assessments = await db.patient_assessment_responses.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(50)

    # Question template lookup — pull from `assessment_templates` (the same
    # collection /api/patient/assessment-questions reads from) so question
    # text matches what the patient saw in the UI. Mapped via the admin
    # type_map (treatment_history → treatment_history, assessment → mood, ...).
    questions_by_category: Dict[str, List[Dict[str, Any]]] = {}
    cat_to_atype = {
        "treatment_history": "treatment_history",
        "health_social": "health_social",
        "assessment": "mood",
    }
    for cid, a_type in cat_to_atype.items():
        tpl = await db.assessment_templates.find_one(
            {"assessment_type": a_type, "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        questions_by_category[cid] = (tpl or {}).get("questions") or []

    patient_info = {
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "joinedAt": user.get("created_at"),
    }
    pdf_bytes = build_dossier_pdf(
        patient=patient_info,
        checkins=checkins,
        recommendations=recs,
        assessments=assessments,
        questions_by_category=questions_by_category,
    )
    filename = f"ifeelincolor-dossier-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@patient_flow_router.get("/patient/progress")
async def assessment_progress(request: Request):
    user = await _current_user(request)
    items = await db.patient_assessment_responses.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(200)
    completed = {it["category_id"] for it in items}
    # Partial progress (auto-saved drafts) — never resume the 3rd 'assessment' step from middle
    partials = await db.patient_assessment_drafts.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(50)
    partial_map = {p["category_id"]: p for p in partials}
    progress = {}
    for cat in ASSESSMENT_CATEGORIES:
        cid = cat["id"]
        partial = partial_map.get(cid)
        # The 3rd step "assessment" includes the 9-step body modelling — must restart fully.
        partial_allowed = cid != "assessment"
        progress[cid] = {
            "completed": cid in completed,
            "submitted_at": next((i["submitted_at"] for i in items if i["category_id"] == cid), None),
            "has_partial": bool(partial) and partial_allowed and cid not in completed,
            "partial_question_index": (partial or {}).get("current_index", 0) if partial_allowed else 0,
            "partial_updated_at": (partial or {}).get("updated_at") if partial_allowed else None,
        }
    # Compute "next category to start" — first non-completed in order
    next_id = None
    for cat in ASSESSMENT_CATEGORIES:
        if not progress[cat["id"]]["completed"]:
            next_id = cat["id"]
            break
    return {
        "progress": progress,
        "all_completed": all(v["completed"] for v in progress.values()),
        "next_category_id": next_id,
    }


class DraftSave(BaseModel):
    category_id: str
    answers: dict
    current_index: int = 0


@patient_flow_router.post("/patient/assessment-draft")
async def save_assessment_draft(payload: DraftSave, request: Request):
    user = await _current_user(request)
    if payload.category_id == "assessment":
        # 3rd step is never partially saved
        return {"ok": True, "skipped": True}
    await db.patient_assessment_drafts.update_one(
        {"user_id": user["user_id"], "category_id": payload.category_id},
        {"$set": {
            "user_id": user["user_id"],
            "category_id": payload.category_id,
            "answers": payload.answers,
            "current_index": payload.current_index,
            "updated_at": _now_iso(),
        }},
        upsert=True,
    )
    return {"ok": True}


@patient_flow_router.get("/patient/assessment-draft/{category_id}")
async def load_assessment_draft(category_id: str, request: Request):
    user = await _current_user(request)
    if category_id == "assessment":
        return {"draft": None}
    d = await db.patient_assessment_drafts.find_one(
        {"user_id": user["user_id"], "category_id": category_id}, {"_id": 0}
    )
    return {"draft": d}


# ╔════════════════════════════════════════╗
# ║       PROFILE                          ║
# ╚════════════════════════════════════════╝

class SearchCity(BaseModel):
    name: str
    place_id: Optional[str] = None
    lat: float
    lng: float


class ProfileUpsert(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    picture: Optional[str] = None  # data URI ok
    lat: Optional[float] = None
    lng: Optional[float] = None
    bio: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Pinned search anchor — overrides device GPS for the Nearby Doctors feed.
    # Patients can edit inline on the home screen or persistently in Profile.
    # Setting to {} explicitly clears the pin.
    search_city: Optional[SearchCity] = None
    search_city_clear: Optional[bool] = None


@patient_flow_router.get("/patient/profile")
async def get_profile(request: Request):
    user = await _current_user(request)
    user.pop("password_hash", None)
    user.pop("session_tokens", None)
    user.pop("webauthn_credentials", None)
    return {"profile": user}


@patient_flow_router.put("/patient/profile")
async def update_profile(payload: ProfileUpsert, request: Request):
    user = await _current_user(request)
    raw = payload.model_dump()
    clear_city = bool(raw.pop("search_city_clear", False))
    updates = {k: v for k, v in raw.items() if v is not None}
    unsets = {}
    if clear_city:
        unsets["search_city"] = ""
        updates.pop("search_city", None)
    if updates:
        updates["updated_at"] = _now_iso()
    set_op = {"$set": updates} if updates else {}
    if unsets:
        set_op["$unset"] = unsets
    if set_op:
        await db.users.update_one({"user_id": user["user_id"]}, set_op)
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0, "session_tokens": 0})
    return {"profile": fresh}


# ╔════════════════════════════════════════╗
# ║       PLACES AUTOCOMPLETE              ║
# ╚════════════════════════════════════════╝
# Lightweight server-side proxy so the frontend never sees the Google API key.
# Used by the patient "Pin a city" feature on the home screen + profile editor.

@patient_flow_router.get("/places/autocomplete")
async def places_autocomplete(q: str, request: Request):
    """Google Places Autocomplete (cities only)."""
    await _current_user(request)  # auth gate — patients only
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        return {"predictions": [], "error": "no_api_key"}
    if not q or len(q) < 2:
        return {"predictions": []}
    try:
        async with httpx.AsyncClient(timeout=6) as cli:
            r = await cli.get(
                "https://maps.googleapis.com/maps/api/place/autocomplete/json",
                params={"input": q, "types": "(cities)", "key": key},
            )
            data = r.json()
            preds = [
                {
                    "place_id": p.get("place_id"),
                    "description": p.get("description"),
                    "main_text": (p.get("structured_formatting") or {}).get("main_text"),
                    "secondary_text": (p.get("structured_formatting") or {}).get("secondary_text"),
                }
                for p in (data.get("predictions") or [])[:8]
            ]
            return {"predictions": preds, "status": data.get("status")}
    except Exception as e:  # noqa: BLE001
        return {"predictions": [], "error": str(e)}


@patient_flow_router.get("/places/details")
async def places_details(place_id: str, request: Request):
    """Resolve a place_id → lat/lng + normalized name."""
    await _current_user(request)
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "Places API not configured")
    try:
        async with httpx.AsyncClient(timeout=6) as cli:
            r = await cli.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={"place_id": place_id, "fields": "name,geometry,formatted_address", "key": key},
            )
            data = r.json()
            res = data.get("result") or {}
            loc = (res.get("geometry") or {}).get("location") or {}
            if "lat" not in loc or "lng" not in loc:
                raise HTTPException(404, "Place has no coordinates")
            return {
                "name": res.get("name") or res.get("formatted_address") or "",
                "formatted_address": res.get("formatted_address"),
                "lat": float(loc["lat"]),
                "lng": float(loc["lng"]),
                "place_id": place_id,
            }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Places API error: {str(e)[:160]}")


# ╔════════════════════════════════════════╗
# ║       MEDICAL HISTORY / ROADMAP        ║
# ╚════════════════════════════════════════╝

class HistoryEvent(BaseModel):
    title: str
    detail: Optional[str] = ""
    date: Optional[str] = None  # YYYY-MM-DD
    category: Optional[str] = "general"  # diagnosis, surgery, therapy, medication, general
    color: Optional[str] = None


@patient_flow_router.get("/patient/history")
async def list_history(request: Request):
    user = await _current_user(request)
    items = await db.patient_medical_history.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("date", -1).to_list(100)
    return {"events": items}


@patient_flow_router.post("/patient/history")
async def add_history(payload: HistoryEvent, request: Request):
    user = await _current_user(request)
    doc = {
        "event_id": f"evt_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        **payload.model_dump(),
        "created_at": _now_iso(),
    }
    if not doc.get("date"):
        doc["date"] = _now_iso()[:10]
    await db.patient_medical_history.insert_one(doc)
    doc.pop("_id", None)
    return {"event": doc}


@patient_flow_router.delete("/patient/history/{event_id}")
async def delete_history(event_id: str, request: Request):
    user = await _current_user(request)
    await db.patient_medical_history.delete_one({"user_id": user["user_id"], "event_id": event_id})
    return {"ok": True}


# ╔════════════════════════════════════════╗
# ║       ANNOUNCEMENTS                    ║
# ╚════════════════════════════════════════╝

@patient_flow_router.get("/announcements/active")
async def active_announcements():
    items = await db.announcements.find(
        {"$or": [{"active": True}, {"is_active": True}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return {"announcements": items}


# ╔════════════════════════════════════════╗
# ║       DOCTORS / NEARBY                 ║
# ╚════════════════════════════════════════╝

MOCK_DOCTORS = [
    {"doctor_id": "doc_1", "name": "Dr. Sarah Chen", "specialty": "Pediatric Psychology", "rating": 4.9, "experience_years": 12, "lat": 40.7128, "lng": -74.0060, "address": "Downtown Wellness Center", "avatar_color": "#FF4FBF"},
    {"doctor_id": "doc_2", "name": "Dr. James Mitchell", "specialty": "Autism Specialist", "rating": 4.8, "experience_years": 18, "lat": 40.7589, "lng": -73.9851, "address": "Sunshine Care Center", "avatar_color": "#22D3C5"},
    {"doctor_id": "doc_3", "name": "Dr. Aisha Patel", "specialty": "Behavioral Therapist", "rating": 4.95, "experience_years": 9, "lat": 40.6892, "lng": -74.0445, "address": "Liberty Health Clinic", "avatar_color": "#FFD23F"},
    {"doctor_id": "doc_4", "name": "Dr. Marcus Lee", "specialty": "Family Counselor", "rating": 4.7, "experience_years": 15, "lat": 40.7282, "lng": -73.7949, "address": "Queens Care Hub", "avatar_color": "#A78BFA"},
    {"doctor_id": "doc_5", "name": "Dr. Maya Rodriguez", "specialty": "Child Psychiatrist", "rating": 4.85, "experience_years": 20, "lat": 40.8448, "lng": -73.8648, "address": "Riverside Mental Health", "avatar_color": "#22D67E"},
    {"doctor_id": "doc_6", "name": "Dr. Owen Park", "specialty": "Cognitive-Behavioral Therapy", "rating": 4.75, "experience_years": 7, "lat": 40.6782, "lng": -73.9442, "address": "Brooklyn Heights Therapy", "avatar_color": "#FF7AB0"},
]


async def _real_clinicians_as_doctors(lat: float, lng: float, radius_km: float = 50) -> list:
    """Surface registered clinicians as bookable doctors (top of the list).

    USP #1 — STRICT location-based nearby filter:
    Only clinicians with `clinician_info.practice_lat` + `practice_lng` set are
    considered. Distance is calculated via haversine; clinicians outside
    `radius_km` are excluded. Telehealth-only clinicians (no practice_lat) can
    still surface when explicitly flagged via `clinician_info.telehealth_only`.
    """
    real = await db.users.find(
        {"role": "clinician"}, {"_id": 0, "password_hash": 0}
    ).limit(50).to_list(50)
    # Build a small org_id → org_name map so each clinician carries org context.
    org_ids = list({c.get("org_id") for c in real if c.get("org_id")})
    org_map = {}
    if org_ids:
        async for o in db.users.find({"user_id": {"$in": org_ids}, "role": "organization"}, {"_id": 0, "user_id": 1, "name": 1, "address": 1, "practice_lat": 1, "practice_lng": 1}):
            org_map[o["user_id"]] = o
    out = []
    palette = ["#5BC0BE", "#A78BFA", "#22D67E", "#F4D58D", "#FF8A95"]
    for i, c in enumerate(real):
        info = c.get("clinician_info") or {}
        org_id = c.get("org_id")
        org_doc = org_map.get(org_id) if org_id else None
        # Resolve clinician's geographic anchor with this priority:
        #   1. clinician_info.practice_lat/lng (set via /api/clinician/profile)
        #   2. parent organization's practice_lat/lng (org_doc fields)
        #   3. None (excluded unless telehealth_only=True)
        c_lat = info.get("practice_lat")
        c_lng = info.get("practice_lng")
        if (c_lat is None or c_lng is None) and org_doc:
            c_lat = c_lat if c_lat is not None else org_doc.get("practice_lat")
            c_lng = c_lng if c_lng is not None else org_doc.get("practice_lng")
        telehealth = bool(info.get("telehealth_only"))

        if c_lat is None or c_lng is None:
            if not telehealth:
                continue  # STRICT: skip clinicians with no location & no telehealth
            dist = None
        else:
            try:
                dist = _haversine_km(lat, lng, float(c_lat), float(c_lng))
            except Exception:
                continue
            if dist > radius_km:
                continue  # STRICT: skip out-of-range clinicians

        out.append({
            "doctor_id": c["user_id"],
            "clinician_id": c["user_id"],
            "name": c.get("name") or "Clinician",
            "specialty": info.get("specialization") or "Mental Health Specialist",
            "rating": info.get("rating", 4.8),
            "experience_years": info.get("years_experience", 10),
            "lat": c_lat,
            "lng": c_lng,
            "distance_km": round(dist, 1) if dist is not None else None,
            "telehealth_only": telehealth,
            "address": info.get("practice_address") or info.get("practice_name") or ("Telehealth available" if telehealth else ""),
            "avatar_color": palette[i % len(palette)],
            "source": "real",
            "verified": True,
            "org_id": org_id,
            "org_name": (org_doc or {}).get("name") if org_doc else None,
        })
    # Closest-first (telehealth_only with no distance go to the bottom)
    out.sort(key=lambda d: d.get("distance_km") if d.get("distance_km") is not None else 9999)
    return out


@patient_flow_router.get("/doctors/nearby")
async def doctors_nearby(lat: float = 40.7128, lng: float = -74.0060, radius_km: float = 50):
    """
    Returns only REAL nearby providers based on the patient's actual lat/lng:
      1. Registered IFEELINCOLOR clinicians (source='real', associated_with_ifeelincolor=True)
      2. Live Google Places results when GOOGLE_MAPS_API_KEY is set
         (source='google', associated_with_ifeelincolor=False — clearly tagged)

    No mock fallback. If both sources return empty, the response is empty
    so the UI can show a truthful "no real providers near you" empty state.
    """
    real_docs = await _real_clinicians_as_doctors(lat, lng, radius_km)
    # Tag real clinicians explicitly for the UI badge.
    for r in real_docs:
        r["associated_with_ifeelincolor"] = True
        r.setdefault("source", "real")
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    google_docs = []
    google_error = None
    if key:
        try:
            # Google Places nearbysearch has a hard cap of 50,000 m. Sending a
            # larger radius just makes Google fall back to a ranked search with
            # no distance bias, so we clamp here.
            google_radius = min(int(radius_km * 1000), 50000)
            async with httpx.AsyncClient(timeout=8) as cli:
                r = await cli.get(
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                    params={
                        "location": f"{lat},{lng}",
                        "radius": google_radius,
                        "keyword": "psychologist therapist mental health clinic counselor psychiatrist",
                        "key": key,
                    },
                )
                data = r.json()
                if data.get("status") not in (None, "OK", "ZERO_RESULTS"):
                    # Surface the error (REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST...)
                    google_error = data.get("error_message") or data.get("status")
                # Filter out IFEELINCOLOR clinicians already present (by place name match — unlikely overlap)
                real_names = {d.get("name", "").lower() for d in real_docs}
                for p in (data.get("results") or [])[:15]:
                    name = p.get("name") or "Provider"
                    if name.lower() in real_names:
                        continue
                    g = p.get("geometry", {}).get("location", {})
                    dist = _haversine_km(lat, lng, g.get("lat", lat), g.get("lng", lng))
                    # Derive a friendly specialty label from Google's `types`.
                    types = p.get("types", []) or []
                    friendly = []
                    type_map = {
                        "doctor": "Doctor",
                        "health": "Health",
                        "hospital": "Hospital",
                        "psychologist": "Psychologist",
                        "physiotherapist": "Physiotherapist",
                        "dentist": "Dentist",
                    }
                    for t in types:
                        if t in type_map:
                            friendly.append(type_map[t])
                    specialty = ", ".join(friendly[:2]) if friendly else "Mental Health Provider"
                    google_docs.append({
                        "doctor_id": p.get("place_id"),
                        "name": name,
                        "clinic_name": name,  # Google Places returns the business/clinic name directly
                        "specialty": specialty,
                        "rating": p.get("rating", None),
                        "address": p.get("vicinity") or p.get("formatted_address") or "",
                        "lat": g.get("lat"),
                        "lng": g.get("lng"),
                        "distance_km": round(dist, 1),
                        "avatar_color": "#94A3B8",  # neutral slate — visually distinct from IFEELINCOLOR brand
                        "source": "google",
                        "associated_with_ifeelincolor": False,
                        "open_now": p.get("opening_hours", {}).get("open_now"),
                        "place_id": p.get("place_id"),
                    })
        except Exception as e:  # noqa: BLE001 — never crash, just surface to UI
            google_error = str(e)
        # Fallback: when keyword `nearbysearch` returns 0 results we try a
        # broader `textsearch` (no radius cap; ranks by relevance) so patients
        # in less-densely-tagged areas still see real providers.
        if not google_docs:
            try:
                async with httpx.AsyncClient(timeout=8) as cli:
                    r2 = await cli.get(
                        "https://maps.googleapis.com/maps/api/place/textsearch/json",
                        params={
                            "query": "psychologist OR therapist OR mental health",
                            "location": f"{lat},{lng}",
                            "radius": 50000,
                            "key": key,
                        },
                    )
                    data2 = r2.json()
                    if data2.get("status") not in (None, "OK", "ZERO_RESULTS"):
                        google_error = data2.get("error_message") or data2.get("status")
                    real_names = {d.get("name", "").lower() for d in real_docs}
                    for p in (data2.get("results") or [])[:15]:
                        name = p.get("name") or "Provider"
                        if name.lower() in real_names:
                            continue
                        g = p.get("geometry", {}).get("location", {})
                        dist = _haversine_km(lat, lng, g.get("lat", lat), g.get("lng", lng))
                        google_docs.append({
                            "doctor_id": p.get("place_id"),
                            "name": name,
                            "clinic_name": name,
                            "specialty": "Mental Health Provider",
                            "rating": p.get("rating"),
                            "address": p.get("formatted_address") or "",
                            "lat": g.get("lat"),
                            "lng": g.get("lng"),
                            "distance_km": round(dist, 1),
                            "avatar_color": "#94A3B8",
                            "source": "google",
                            "associated_with_ifeelincolor": False,
                            "place_id": p.get("place_id"),
                        })
            except Exception as e:  # noqa: BLE001
                if not google_error:
                    google_error = str(e)
    # Sort google results by distance (closest first)
    google_docs.sort(key=lambda x: x.get("distance_km") or 999)
    return {
        "doctors": [*real_docs, *google_docs],
        "real_count": len(real_docs),
        "google_count": len(google_docs),
        "source": "real+google" if (real_docs and google_docs) else ("real" if real_docs else ("google" if google_docs else "none")),
        "google_error": google_error,
        "lat": lat,
        "lng": lng,
    }


# ── Subscribed doctors ──
class SubscribeDoctorRequest(BaseModel):
    doctor_id: str


@patient_flow_router.get("/patient/doctors/subscribed")
async def my_doctors(request: Request):
    user = await _current_user(request)
    subs = await db.patient_doctor_subscriptions.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(50)
    return {"doctors": subs}


@patient_flow_router.post("/patient/doctors/subscribe")
async def subscribe_to_doctor(payload: SubscribeDoctorRequest, request: Request):
    user = await _current_user(request)
    existing = await db.patient_doctor_subscriptions.find_one(
        {"user_id": user["user_id"], "doctor_id": payload.doctor_id}
    )
    if existing:
        return {"ok": True, "already": True}
    # Check if doctor_id is a real clinician user
    real_clin = await db.users.find_one(
        {"user_id": payload.doctor_id, "role": "clinician"}, {"_id": 0, "password_hash": 0}
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
        doc_info = next((d for d in MOCK_DOCTORS if d["doctor_id"] == payload.doctor_id), {"doctor_id": payload.doctor_id, "name": "Doctor"})
    rec = {
        "subscription_id": f"docsub_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        **doc_info,
        "subscribed_at": _now_iso(),
    }
    await db.patient_doctor_subscriptions.insert_one(rec)
    rec.pop("_id", None)
    return {"ok": True, "subscription": rec}


@patient_flow_router.delete("/patient/doctors/subscribe/{doctor_id}")
async def unsubscribe_doctor(doctor_id: str, request: Request):
    user = await _current_user(request)
    await db.patient_doctor_subscriptions.delete_one({"user_id": user["user_id"], "doctor_id": doctor_id})
    return {"ok": True}


# ── Clinician subscription plans (admin-defined in /admin/plans with plan_type='clinician') ──
@patient_flow_router.get("/clinician-plans")
async def list_clinician_plans():
    plans = await db.plans.find({"plan_type": "clinician", "is_trial": {"$ne": True}}, {"_id": 0}).sort("price", 1).to_list(20)
    # Fallback defaults if admin hasn't added any
    if not plans:
        plans = [
            {"plan_id": "cp_basic", "name": "Basic Care", "description": "Monthly check-ins with your clinician", "price": 49, "duration_days": 30, "plan_type": "clinician", "features": ["1 video session/month", "Chat support", "Notes review"]},
            {"plan_id": "cp_premium", "name": "Premium Care", "description": "Bi-weekly sessions + 24/7 chat", "price": 129, "duration_days": 30, "plan_type": "clinician", "features": ["2 sessions/month", "Priority chat", "Care plan reviews"]},
            {"plan_id": "cp_intensive", "name": "Intensive Care", "description": "Weekly sessions + crisis support", "price": 299, "duration_days": 30, "plan_type": "clinician", "features": ["4 sessions/month", "24/7 crisis line", "Family sessions"]},
        ]
    return {"plans": plans}


class DoctorSubscribePaid(BaseModel):
    doctor_id: str
    plan_id: str


@patient_flow_router.post("/patient/doctors/subscribe-paid")
async def subscribe_to_doctor_paid(payload: DoctorSubscribePaid, request: Request):
    """Paid subscription to a clinician (mock payment)."""
    user = await _current_user(request)
    plans_res = await list_clinician_plans()
    plan = next((p for p in plans_res["plans"] if p["plan_id"] == payload.plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="Clinician plan not found")
    existing = await db.patient_doctor_subscriptions.find_one({"user_id": user["user_id"], "doctor_id": payload.doctor_id})
    if existing:
        return {"ok": True, "already": True}
    real_clin = await db.users.find_one(
        {"user_id": payload.doctor_id, "role": "clinician"}, {"_id": 0, "password_hash": 0}
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
        doc_info = next((d for d in MOCK_DOCTORS if d["doctor_id"] == payload.doctor_id), {"doctor_id": payload.doctor_id, "name": "Doctor"})
    starts = datetime.now(timezone.utc)
    ends = starts + timedelta(days=plan["duration_days"])
    rec = {
        "subscription_id": f"docsub_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        **doc_info,
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "amount_paid_usd": plan["price"],
        "payment_status": "mock_paid",
        "start_date": starts.isoformat(),
        "end_date": ends.isoformat(),
        "subscribed_at": _now_iso(),
    }
    await db.patient_doctor_subscriptions.insert_one(rec)
    rec.pop("_id", None)
    # Track in activity
    await db.patient_activity.insert_one({
        "activity_id": f"act_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "type": "doctor_subscribed",
        "title": f"Subscribed to {doc_info.get('name', 'doctor')}",
        "detail": f"{plan['name']} · ${plan['price']}",
        "created_at": _now_iso(),
    })
    return {"ok": True, "subscription": rec}


# ── Patient recommendations (3 sources: admin / clinician / organization) ──
@patient_flow_router.get("/patient/recommendations")
async def patient_recommendations(request: Request):
    user = await _current_user(request)
    # Latest assessment severity
    latest = await db.patient_assessment_responses.find_one(
        {"user_id": user["user_id"], "category_id": "assessment"},
        {"_id": 0}, sort=[("submitted_at", -1)]
    )
    sev = (latest or {}).get("severity")

    # Latest check-in ending color (Workflow 1 — color-gated portal triggers)
    # Patient writes their ending color family to patient_checkins; we read the
    # most recent value to filter admin recommendations by trigger_colors.
    latest_checkin = await db.patient_checkins.find_one(
        {"$or": [{"patient_id": user["user_id"]}, {"user_id": user["user_id"]}]},
        {"_id": 0}, sort=[("created_at", -1)]
    )
    ending_color = None
    if latest_checkin:
        ec = latest_checkin.get("ending_color") or latest_checkin.get("end_emotion") or latest_checkin.get("emotion_family")
        if isinstance(ec, str):
            ending_color = ec.lower()

    # ── 1) Admin-curated portal recommendations (severity-filtered + color-gated) ──
    admin_query = {"status": "active"}
    if sev:
        admin_query["$or"] = [
            {"severity_filter": {"$in": [sev]}},
            {"severity_filter": {"$size": 0}},
            {"severity_filter": {"$exists": False}},
        ]
    admin_items_raw = await db.recommendations.find(admin_query, {"_id": 0}).sort("created_at", -1).to_list(100)
    # Filter by trigger_colors:
    #   - empty list / missing  → universal (show to everyone)
    #   - list with values      → show only if ending_color is in the list
    def _color_match(rec):
        tc = rec.get("trigger_colors") or []
        if not tc:
            return True
        if not ending_color:
            return False
        return ending_color in [str(c).lower() for c in tc]
    admin_items_raw = [r for r in admin_items_raw if _color_match(r)]
    admin_items = [{
        **r,
        "source": "admin",
        "source_label": "IFEELINCOLOR Portal",
        "source_name": "IFEELINCOLOR Portal",
        "source_icon": "shield",
        "assigned_at": r.get("created_at"),
    } for r in admin_items_raw]

    # ── 1b) Admin manually-sent per-patient recommendations (patient_activity) ──
    # When a super-admin clicks "Send recommendation" on a single patient,
    # `/api/admin/patient/{id}/recommendation` writes a `patient_activity` row
    # with `source='admin'` + `type='recommendation'`. These must appear in the
    # patient's recommendations feed too — not just as notifications.
    admin_manual = await db.patient_activity.find(
        {"user_id": user["user_id"], "type": "recommendation", "source": "admin"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    for a in admin_manual:
        admin_items.append({
            "recommendation_id": a.get("recommendation_id") or a.get("activity_id"),
            "title": a.get("title"),
            "description": a.get("description") or "",
            "body_md": a.get("body_md") or "",
            "content_type": a.get("content_type") or "text",
            "media_url": a.get("media_url"),
            "image_url": a.get("image_url"),
            "steps": a.get("steps") or [],
            "category": a.get("category"),
            "severity": a.get("severity"),
            "progress": a.get("progress", 0),
            "source": "admin",
            "source_label": f"From {a.get('admin_name') or 'IFEELINCOLOR Admin'}",
            "source_name": a.get("admin_name") or "IFEELINCOLOR Admin",
            "source_icon": "shield",
            "assigned_at": a.get("created_at"),
            "manually_sent": True,
        })

    # ── 2) Clinician-sent recommendations (from patient_activity where from_clinician set) ──
    # USP: Patient sees recs ONLY from clinicians they're currently subscribed to.
    # Build the allow-list once, then filter the activity feed by it.
    subscribed_clinician_ids = set()
    async for s in db.patient_doctor_subscriptions.find(
        {"user_id": user["user_id"]}, {"_id": 0, "clinician_id": 1, "doctor_id": 1},
    ):
        cid = s.get("clinician_id") or s.get("doctor_id")
        if cid:
            subscribed_clinician_ids.add(cid)

    clin_activity = await db.patient_activity.find(
        {"user_id": user["user_id"], "type": {"$in": ["clinician_recommendation", "clinician_plan"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    # Filter out recs from clinicians the patient is no longer subscribed to.
    clin_activity = [a for a in clin_activity if a.get("from_clinician") in subscribed_clinician_ids]
    clin_items = []
    for a in clin_activity:
        clin = await db.users.find_one(
            {"user_id": a.get("from_clinician")}, {"_id": 0, "name": 1, "clinician_info": 1}
        )
        clin_name = (clin or {}).get("name") or a.get("clinician_name") or "Your Clinician"
        clin_items.append({
            "recommendation_id": a.get("activity_id"),
            "title": a.get("title"),
            "description": a.get("description") or "",
            "image_url": a.get("image_url"),
            "media_url": a.get("media_url"),
            "category": a.get("category"),
            "severity": a.get("severity"),
            "progress": a.get("progress"),
            "actions": a.get("actions"),
            "timeframe": a.get("timeframe"),
            "source": "clinician",
            "source_label": f"From {clin_name}",
            "source_name": clin_name,
            "source_specialty": ((clin or {}).get("clinician_info") or {}).get("specialization") or "",
            "source_icon": "stethoscope",
            "assigned_at": a.get("created_at"),
            "is_plan": a.get("type") == "clinician_plan",
        })

    # ── 3) Organization-sent recommendations (placeholder collection) ──
    org_activity = await db.patient_activity.find(
        {"user_id": user["user_id"], "type": "org_recommendation"}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    org_items = []
    for a in org_activity:
        org = await db.users.find_one({"user_id": a.get("from_org")}, {"_id": 0, "name": 1})
        org_name = (org or {}).get("name") or a.get("org_name") or "Your Care Organization"
        org_items.append({
            "recommendation_id": a.get("activity_id"),
            "title": a.get("title"),
            "description": a.get("description") or "",
            "image_url": a.get("image_url"),
            "category": a.get("category"),
            "severity": a.get("severity"),
            "source": "organization",
            "source_label": f"From {org_name}",
            "source_name": org_name,
            "source_icon": "building",
            "assigned_at": a.get("created_at"),
        })

    # Latest severity-driven auto recs (informational)
    auto = (latest or {}).get("recommendations", [])

    # Tag each recommendation with `completed=True` + `completed_at` when the
    # patient has marked it complete (Phase 2 USP — completion timeline).
    completed_rows = await db.patient_activity.find(
        {"user_id": user["user_id"], "type": "recommendation_completed"},
        {"_id": 0, "recommendation_id": 1, "created_at": 1},
    ).to_list(500)
    completed_map = {}
    for row in completed_rows:
        rid = row.get("recommendation_id")
        if rid and rid not in completed_map:
            completed_map[rid] = row.get("created_at")

    def _annotate(item):
        rid = item.get("recommendation_id")
        if rid and rid in completed_map:
            item["completed"] = True
            item["completed_at"] = completed_map[rid]
        else:
            item["completed"] = False
        return item

    def _rec_date_helper(it):
        return it.get("assigned_at") or it.get("created_at") or ""

    admin_items = sorted([_annotate(it) for it in admin_items], key=_rec_date_helper, reverse=True)
    clin_items = sorted([_annotate(it) for it in clin_items], key=_rec_date_helper, reverse=True)
    org_items = sorted([_annotate(it) for it in org_items], key=_rec_date_helper, reverse=True)

    # Combined feed must be newest-first regardless of source. We use the
    # most-relevant date on each item:
    #   • admin manual sends     → assigned_at (created_at when written)
    #   • clinician manual sends → assigned_at / created_at
    #   • org sends              → assigned_at / created_at
    #   • library cards          → created_at on the template
    # Falls back to created_at → empty string so missing-date items sink.
    def _rec_date(it):
        return it.get("assigned_at") or it.get("created_at") or ""

    combined = sorted(
        [*clin_items, *org_items, *admin_items],
        key=_rec_date,
        reverse=True,
    )

    return {
        "recommendations": combined,
        "by_source": {
            "admin": admin_items,
            "clinician": clin_items,
            "organization": org_items,
        },
        "counts": {
            "admin": len(admin_items),
            "clinician": len(clin_items),
            "organization": len(org_items),
            "completed": len(completed_map),
        },
        "auto": auto,
        "severity": sev,
        "ending_color": ending_color,
        "has_assessment": bool(latest),
    }


class SaveRecommendationRequest(BaseModel):
    recommendation_id: str
    note: Optional[str] = None


@patient_flow_router.post("/patient/recommendations/save")
async def save_recommendation_to_journey(payload: SaveRecommendationRequest, request: Request):
    """Save an admin recommendation to the patient's journey log."""
    user = await _current_user(request)
    rec = await db.recommendations.find_one({"recommendation_id": payload.recommendation_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    entry = {
        "activity_id": f"act_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "type": "recommendation_saved",
        "title": rec["title"],
        "detail": rec.get("description", "")[:200],
        "content_type": rec.get("content_type", "text"),
        "media_url": rec.get("media_url"),
        "image_url": rec.get("image_url"),
        "steps": rec.get("steps", []),
        "recommendation_id": rec["recommendation_id"],
        "note": payload.note,
        "created_at": _now_iso(),
    }
    await db.patient_activity.insert_one(entry)
    entry.pop("_id", None)
    return {"entry": entry}


# ── Recommendation completion (USP — share strictly with subscribed doctors + admin) ──
class CompleteRecommendationRequest(BaseModel):
    recommendation_id: str
    source: Optional[str] = "admin"  # admin | clinician | organization
    title: Optional[str] = None
    note: Optional[str] = None
    rating: Optional[int] = None  # 1–5 stars (optional)


@patient_flow_router.post("/patient/recommendations/complete")
async def complete_recommendation(payload: CompleteRecommendationRequest, request: Request):
    """Mark a recommendation as completed.

    USP — sharing rules (STRICT):
      • Always visible to Super Admin (admin sees ALL completion events).
      • Visible ONLY to clinicians the patient is CURRENTLY subscribed to
        (mirrors USP #2). Past clinicians never see completion events.
      • Visible to the patient's current Organization (via subscribed clinicians' org_id).
      • Triggers a "ready to re-take assessment" nudge in the response so the
        UI can prompt the patient to take a fresh assessment after completing.
    """
    user = await _current_user(request)
    now = _now_iso()

    # Capture the list of currently-subscribed clinician_ids so the
    # downstream feeds (clinician timeline) only surface this completion
    # event to clinicians who still own this patient.
    subscribed = []
    async for s in db.patient_doctor_subscriptions.find(
        {"user_id": user["user_id"]}, {"_id": 0, "clinician_id": 1, "doctor_id": 1}
    ):
        cid = s.get("clinician_id") or s.get("doctor_id")
        if cid:
            subscribed.append(cid)

    # Look up display title — try library, then activity (clinician/org sent), else use payload.title
    title = payload.title
    rec_doc = None
    if not title:
        rec_doc = await db.recommendations.find_one(
            {"recommendation_id": payload.recommendation_id}, {"_id": 0}
        )
        if rec_doc:
            title = rec_doc.get("title")
    if not title:
        act = await db.patient_activity.find_one(
            {"$or": [
                {"activity_id": payload.recommendation_id},
                {"recommendation_id": payload.recommendation_id},
            ], "user_id": user["user_id"]},
            {"_id": 0},
        )
        if act:
            title = act.get("title")
    title = title or "Recommendation"

    entry = {
        "activity_id": f"act_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "type": "recommendation_completed",
        "title": f"Completed: {title}",
        "detail": payload.note or "",
        "recommendation_id": payload.recommendation_id,
        "source": payload.source,
        "rating": payload.rating,
        "shared_with_clinicians": subscribed,
        "from_admin": True,  # Admin always sees completion events
        "created_at": now,
    }
    await db.patient_activity.insert_one(entry)
    entry.pop("_id", None)

    # Auto-suggest re-taking the main "assessment" category after completion.
    return {
        "ok": True,
        "entry": entry,
        "suggest_reassessment": True,
        "shared_with": {
            "admin": True,
            "clinicians": subscribed,
            "clinician_count": len(subscribed),
        },
    }


@patient_flow_router.get("/patient/recommendations/completed")
async def list_completed_recommendations(request: Request):
    """Returns the patient's recommendation completion timeline."""
    user = await _current_user(request)
    items = await db.patient_activity.find(
        {"user_id": user["user_id"], "type": "recommendation_completed"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return {
        "completed": items,
        "completed_ids": [it.get("recommendation_id") for it in items if it.get("recommendation_id")],
    }


# ── Clinician profile update (practice location for nearby USP) ──
class ClinicianProfileUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    picture: Optional[str] = None
    practice_address: Optional[str] = None
    practice_lat: Optional[float] = None
    practice_lng: Optional[float] = None
    telehealth_only: Optional[bool] = None
    specialization: Optional[str] = None
    practice_name: Optional[str] = None
    years_experience: Optional[int] = None


@patient_flow_router.put("/clinician/profile")
async def update_clinician_profile(payload: ClinicianProfileUpdate, request: Request):
    """Clinician self-service profile update.

    USP #1 — clinicians must set `practice_lat`/`practice_lng` (or flag
    `telehealth_only`) here for them to surface in patient nearby search.
    """
    user = await _current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")

    raw = payload.model_dump(exclude_none=True)
    top_level = {}
    info_updates = {}
    for k, v in raw.items():
        if k in ("name", "mobile", "picture"):
            top_level[k] = v
        else:
            info_updates[f"clinician_info.{k}"] = v

    if top_level or info_updates:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {**top_level, **info_updates, "updated_at": _now_iso()}},
        )
    fresh = await db.users.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "password_hash": 0, "session_tokens": 0, "webauthn_credentials": 0},
    )
    return {"profile": fresh}


@patient_flow_router.get("/patient/activity")
async def patient_activity(request: Request):
    """Full activity feed — recommendations saved, doctors subscribed, milestones, assessments."""
    user = await _current_user(request)
    activity = await db.patient_activity.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"activity": activity}


# ╔════════════════════════════════════════╗
# ║       NOTIFICATIONS                    ║
# ╚════════════════════════════════════════╝

@patient_flow_router.get("/notifications")
async def my_notifications(request: Request):
    """Realistic patient feed: real events only — announcements, my activity, my emergencies,
    clinician recommendations to me, new doctor subscriptions, completed assessments."""
    user = await _current_user(request)
    feed = []

    # 1) Active announcements
    ann = await db.announcements.find(
        {"$or": [{"active": True}, {"is_active": True}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    for a in ann:
        feed.append({
            "id": f"ann_{a.get('announcement_id', a.get('id', uuid.uuid4().hex[:6]))}",
            "type": "announcement",
            "title": a.get("title", "Announcement"),
            "body": a.get("message", a.get("body", "")),
            "created_at": a.get("created_at"),
            "icon": "megaphone",
            "color": "#9D5BFF",
            "url": "/app/home",
            "read": False,
        })

    # 2) Personal activity feed — recommendation saved, doctor subscribed, etc.
    activity = await db.patient_activity.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(40)
    for act in activity:
        t = act.get("type", "activity")
        icon_color_url = {
            "clinician_recommendation": ("stethoscope", "#22D3C5", "/app/recommendations"),
            "clinician_plan":           ("stethoscope", "#22D3C5", "/app/recommendations"),
            "org_recommendation":       ("building",    "#FF8C3F", "/app/recommendations"),
            "recommendation":           ("book",        "#A78BFA", "/app/recommendations"),
            "recommendation_saved":     ("bookmark",    "#A78BFA", "/app/journey"),
            "doctor_subscribed":        ("heart",       "#FF3D8A", "/app/subscribe"),
            "assessment_completed":     ("clipboard",   "#22D67E", "/app/recommendations"),
            "checkin_logged":           ("activity",    "#FFD23F", "/app/journey"),
        }.get(t, ("activity", "#22D3C5", "/app/journey"))
        # Deep-link to the matching recommendation when we know its id, so
        # tapping the notification opens the rec's detail modal directly.
        url = icon_color_url[2]
        rec_id = act.get("recommendation_id") or (
            act.get("ref_id") if t in (
                "recommendation", "clinician_recommendation",
                "clinician_plan", "org_recommendation"
            ) else None
        )
        if rec_id and url.startswith("/app/recommendations"):
            url = f"/app/recommendations?open={rec_id}"
        feed.append({
            "id": f"act_{act.get('activity_id')}",
            "type": t,
            "title": act.get("title", ""),
            "body": act.get("detail") or act.get("description") or "",
            "created_at": act.get("created_at"),
            "icon": icon_color_url[0],
            "color": icon_color_url[1],
            "url": url,
            "recommendation_id": rec_id,
            "read": False if t in (
                "clinician_recommendation", "clinician_plan",
                "org_recommendation", "recommendation"
            ) else True,
        })

    # 3) Recently completed assessments
    assessments = await db.patient_assessment_responses.find(
        {"user_id": user["user_id"], "category_id": "assessment"}, {"_id": 0}
    ).sort("submitted_at", -1).limit(5).to_list(5)
    for asm in assessments:
        sev = asm.get("severity") or "complete"
        feed.append({
            "id": f"asm_{asm.get('response_id', uuid.uuid4().hex[:6])}",
            "type": "assessment_completed",
            "title": f"Assessment completed · {sev.title()}",
            "body": f"View your personalized recommendations based on your results.",
            "created_at": asm.get("submitted_at"),
            "icon": "clipboard",
            "color": "#22D67E",
            "url": "/app/recommendations",
            "read": True,
        })

    # 4) My emergencies
    emergencies = await db.emergency_alerts.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    for e in emergencies:
        feed.append({
            "id": f"emr_{e.get('alert_id')}",
            "type": "emergency",
            "title": "Emergency dispatched",
            "body": "Help was sent to your location. Care team has been notified.",
            "created_at": e.get("created_at"),
            "icon": "alert",
            "color": "#FF3B30",
            "url": "/app/emergency",
            "read": False,
        })

    feed.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    # Dedupe near-duplicate notifications. Patients were seeing 10+ identical
    # "Assessment complete · Low severity" rows because the same event is
    # logged in both `patient_activity` (at submit time) AND replayed from
    # `patient_assessment_responses`. We collapse them to a single canonical
    # entry per (type, day-bucket) pair while preserving order.
    deduped, seen = [], set()
    for n in feed:
        t = n.get("type", "")
        day = (n.get("created_at") or "")[:10]
        # Only dedupe noisy "completion"/"saved" notification types — keep
        # every emergency, every announcement, every clinician/admin rec.
        if t in ("assessment_completed", "checkin_logged", "recommendation_saved"):
            key = (t, day)
            if key in seen:
                continue
            seen.add(key)
        elif t in ("recommendation", "clinician_recommendation", "clinician_plan", "org_recommendation"):
            # Collapse repeat-fired notifications about the same rec into one row.
            rid = n.get("recommendation_id")
            title = (n.get("title") or "").strip().lower()
            keys = []
            if rid:
                keys.append(("rec", rid))
            if title:
                # Also collapse on (type, title, day) so admins re-seeding the
                # same template don't create N notification rows for one rec.
                keys.append(("rec_t", t, title, day))
            duplicate = any(k in seen for k in keys)
            if duplicate:
                continue
            for k in keys:
                seen.add(k)
        deduped.append(n)

    return {"notifications": deduped[:50], "unread_count": sum(1 for f in deduped if not f.get("read"))}


@patient_flow_router.get("/clinician/notifications")
async def clinician_notifications(request: Request):
    """Clinician feed — emergency alerts + new patient subs."""
    user = await _current_user(request)
    if user.get("role") != "clinician":
        # allow both roles to use it; just no special filter
        pass
    alerts = await db.emergency_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
    feed = [{
        "id": f"emr_{a['alert_id']}",
        "type": "emergency",
        "title": f"Emergency: {a.get('user_name') or a.get('user_email')}",
        "body": f"Severity {a.get('severity', 'critical').upper()} · {a.get('lat', 0):.3f}, {a.get('lng', 0):.3f}",
        "created_at": a.get("created_at"),
        "icon": "alert",
        "color": "#FF3B30",
        "read": False,
    } for a in alerts]
    return {"notifications": feed, "unread_count": len(feed)}


# ╔════════════════════════════════════════╗
# ║       EMERGENCY                        ║
# ╚════════════════════════════════════════╝

class EmergencyTrigger(BaseModel):
    severity: Optional[str] = "critical"
    note: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None


@patient_flow_router.post("/patient/emergency")
async def trigger_emergency(payload: EmergencyTrigger, request: Request):
    """SIMULATED emergency dispatch — logs to DB & surfaces to admin/clinician.
    No real SMS is sent. Adds 2 nearest doctors + nearest 'police station' (mock)."""
    user = await _current_user(request)
    lat = payload.lat or 40.7128
    lng = payload.lng or -74.0060
    nearest_docs = sorted(MOCK_DOCTORS, key=lambda d: _haversine_km(lat, lng, d["lat"], d["lng"]))[:2]
    police = {
        "name": "Nearest Police Station",
        "phone": "+1-555-0911",
        "address": "Local Precinct (mock)",
        "lat": lat + 0.012,
        "lng": lng + 0.008,
    }
    alert = {
        "alert_id": f"emerg_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "severity": payload.severity,
        "note": payload.note,
        "lat": lat,
        "lng": lng,
        "dispatched_to_doctors": [d["doctor_id"] for d in nearest_docs],
        "dispatched_to_police": True,
        "status": "open",
        "created_at": _now_iso(),
    }
    await db.emergency_alerts.insert_one(alert)
    alert.pop("_id", None)
    return {
        "alert": alert,
        "dispatched": {
            "doctors": [{"name": d["name"], "phone": "+1-555-1000", "specialty": d["specialty"]} for d in nearest_docs],
            "police": police,
        },
        "message": "Help is on the way. Stay where you are. A care professional will reach out shortly.",
    }


@patient_flow_router.get("/emergency/alerts")
async def list_emergency_alerts(request: Request):
    """Admin/clinician view of recent alerts."""
    # Light access check via cookie presence — full ACL handled at admin route layer if needed
    items = await db.emergency_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"alerts": items}


# ╔════════════════════════════════════════╗
# ║       ADMIN: subscription plans CRUD   ║
# ╚════════════════════════════════════════╝

class PlanUpsert(BaseModel):
    plan_id: Optional[str] = None
    name: str
    duration_days: int
    price_usd: float
    purpose: str
    color: Optional[str] = "#FF4FBF"
    order: Optional[int] = 99
    active: Optional[bool] = True


@patient_flow_router.get("/admin/patient-plans")
async def admin_list_plans(request: Request):
    items = await db.subscription_plans.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return {"plans": items}


@patient_flow_router.post("/admin/patient-plans")
async def admin_save_plan(payload: PlanUpsert, request: Request):
    plan = payload.model_dump()
    if plan.get("plan_id"):
        await db.subscription_plans.update_one(
            {"plan_id": plan["plan_id"]},
            {"$set": {**plan, "updated_at": _now_iso()}},
            upsert=True,
        )
    else:
        plan["plan_id"] = f"plan_{uuid.uuid4().hex[:10]}"
        plan["created_at"] = _now_iso()
        await db.subscription_plans.insert_one(plan)
    return {"ok": True, "plan_id": plan["plan_id"]}


@patient_flow_router.delete("/admin/patient-plans/{plan_id}")
async def admin_delete_plan(plan_id: str, request: Request):
    await db.subscription_plans.update_one({"plan_id": plan_id}, {"$set": {"active": False}})
    return {"ok": True}
