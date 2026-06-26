from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection — supports both MONGO_URL (legacy) and the more
# generic DATABASE_URL (Heroku/DigitalOcean/Render style). Whichever
# is set wins; if both are present, DATABASE_URL takes priority because
# it's the convention used by most managed Postgres/Mongo hosts.
mongo_url = os.environ.get("DATABASE_URL") or os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Admin routes
from admin_routes import admin_router, set_db as set_admin_db
from admin_routes_ext import admin_ext_router, set_ext_db
from auth_extended import auth_ext_router, set_auth_ext_db
from admin_auth import seed_admin
from patient_flow import patient_flow_router, set_pf_db, seed_subscription_plans
from stripe_routes import stripe_router, set_stripe_db
from razorpay_routes import razorpay_router, set_razorpay_db
from email_templates import email_router, set_email_db, seed_email_templates
from checkin_routes import checkin_router, set_checkin_db, seed_checkin_content

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Pydantic Models ───

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Optional[str] = None
    mobile: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    is_first_login: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ProfileUpdate(BaseModel):
    role: Optional[str] = None
    name: Optional[str] = None
    mobile: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None

class PatientCheckIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    checkin_id: str = Field(default_factory=lambda: f"chk_{uuid.uuid4().hex[:12]}")
    patient_id: str
    date: str
    time: str
    starting_body_part: str
    starting_sensation: str
    suggested_color: Optional[str] = None
    suggested_emotions: Optional[List[str]] = None
    user_selected_color: str
    user_selected_emotion: str
    deeper_feeling: Optional[str] = None
    app_reflection_text: Optional[str] = None
    regulation_step_chosen: Optional[str] = None
    step_completed: bool = False
    ending_color: Optional[str] = None
    ending_emotion: Optional[str] = None
    ending_body_sensation: Optional[str] = None
    intensity_rating_before: int = Field(ge=0, le=10)
    intensity_rating_after: int = Field(ge=0, le=10)
    journal_notes: Optional[str] = None
    created_at: Optional[str] = None

class CheckInCreate(BaseModel):
    date: str
    time: str
    starting_body_part: str
    starting_sensation: str
    suggested_color: Optional[str] = None
    suggested_emotions: Optional[List[str]] = None
    user_selected_color: str
    user_selected_emotion: str
    deeper_feeling: Optional[str] = None
    app_reflection_text: Optional[str] = None
    regulation_step_chosen: Optional[str] = None
    step_completed: bool = False
    ending_color: Optional[str] = None
    ending_emotion: Optional[str] = None
    ending_body_sensation: Optional[str] = None
    intensity_rating_before: int = Field(ge=0, le=10)
    intensity_rating_after: int = Field(ge=0, le=10)
    journal_notes: Optional[str] = None

class AISuggestionRequest(BaseModel):
    body_part: str
    sensation: str
    current_feeling: Optional[str] = None

class ReflectionRequest(BaseModel):
    body_part: str
    sensations: str
    emotion: str
    color_name: str
    deeper_feeling: Optional[str] = None

# ─── Auth Helpers ───

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc

# ─── Auth Routes ───

# ─── Registration Endpoints ───

class PatientRegister(BaseModel):
    full_name: str
    email: str
    password: str
    date_of_birth: str
    phone: Optional[str] = None
    address: Optional[str] = None
    is_minor: bool = False
    guardian_name: Optional[str] = None
    guardian_relationship: Optional[str] = None
    guardian_email: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_address: Optional[str] = None
    guardian_consent: bool = False
    guardian_id_data: Optional[str] = None
    guardian_signature: Optional[str] = None
    terms_accepted: bool = False

class ClinicianRegister(BaseModel):
    full_name: str
    email: str
    password: str
    phone: str
    npi_number: str
    license_type: str
    license_number: str
    state_of_practice: str
    dea_number: Optional[str] = None
    specialization: str
    practice_name: str
    terms_accepted: bool = False

@api_router.post("/auth/register/patient")
async def register_patient(data: PatientRegister, response: Response):
    from admin_auth import hash_password
    existing = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if not data.terms_accepted:
        raise HTTPException(status_code=400, detail="Terms must be accepted")
    # Server-side minor detection from DOB
    from dateutil.relativedelta import relativedelta
    try:
        dob = datetime.fromisoformat(data.date_of_birth)
        age = relativedelta(datetime.now(timezone.utc), dob.replace(tzinfo=timezone.utc)).years
        is_minor = age < 18
    except Exception:
        is_minor = data.is_minor
    if is_minor and not data.guardian_consent:
        raise HTTPException(status_code=400, detail="Guardian consent required for minors")

    now = datetime.now(timezone.utc).isoformat()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id, "email": data.email.lower(), "name": data.full_name,
        "password_hash": hash_password(data.password),
        "role": "patient", "mobile": data.phone, "dob": data.date_of_birth,
        "address": data.address, "picture": None, "is_first_login": False,
        "is_minor": data.is_minor,
        "guardian_info": {
            "name": data.guardian_name, "relationship": data.guardian_relationship,
            "email": data.guardian_email, "phone": data.guardian_phone,
            "address": data.guardian_address, "consent": data.guardian_consent,
            "id_uploaded": bool(data.guardian_id_data), "signature_provided": bool(data.guardian_signature),
        } if data.is_minor else None,
        "created_at": now, "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    session_token = f"sess_{uuid.uuid4().hex[:16]}"
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now,
    })
    response.set_cookie(key="session_token", value=session_token, path="/", secure=True, httponly=True, samesite="none", max_age=7*24*3600)
    result = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    result.pop("password_hash", None)
    return result

@api_router.post("/auth/register/clinician")
async def register_clinician(data: ClinicianRegister, response: Response):
    from admin_auth import hash_password
    existing = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if not data.terms_accepted:
        raise HTTPException(status_code=400, detail="Terms must be accepted")

    now = datetime.now(timezone.utc).isoformat()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id, "email": data.email.lower(), "name": data.full_name,
        "password_hash": hash_password(data.password),
        "role": "clinician", "mobile": data.phone, "picture": None, "is_first_login": False,
        "clinician_info": {
            "npi_number": data.npi_number, "license_type": data.license_type,
            "license_number": data.license_number, "state_of_practice": data.state_of_practice,
            "dea_number": data.dea_number, "specialization": data.specialization,
            "practice_name": data.practice_name,
        },
        "created_at": now, "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    session_token = f"sess_{uuid.uuid4().hex[:16]}"
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now,
    })
    response.set_cookie(key="session_token", value=session_token, path="/", secure=True, httponly=True, samesite="none", max_age=7*24*3600)
    result = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    result.pop("password_hash", None)
    return result

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = resp.json()

    email = data["email"]
    name = data["name"]
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        is_first = existing_user.get("is_first_login", True)
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": None,
            "mobile": None,
            "dob": None,
            "address": None,
            "is_first_login": True,
            "created_at": now,
            "updated_at": now
        })
        is_first = True

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        path="/",
        secure=True,
        httponly=True,
        samesite="none",
        max_age=7 * 24 * 3600
    )

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user_doc

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/", secure=True, httponly=True, samesite="none")
    return {"message": "Logged out"}

@api_router.put("/auth/profile")
async def update_profile(update: ProfileUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if "role" in update_data:
        update_data["is_first_login"] = False

    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated

@api_router.put("/me")
async def update_me(request: Request):
    """Lightweight profile update for clinician/patient (name + picture)."""
    user = await get_current_user(request)
    body = await request.json()
    allowed = {k: v for k, v in body.items() if k in {"name", "picture", "avatar_url"} and v is not None}
    if not allowed:
        raise HTTPException(400, "No fields to update")
    allowed["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": allowed})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})

@api_router.post("/me/change-password")
async def me_change_password(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    cur = body.get("current_password") or ""
    new = body.get("new_password") or ""
    if not new or len(new) < 6:
        raise HTTPException(400, "New password must be 6+ characters")
    import bcrypt
    full = await db.users.find_one({"user_id": user["user_id"]})
    stored = (full or {}).get("password_hash", "")
    if not stored or not bcrypt.checkpw(cur.encode("utf-8"), stored.encode("utf-8")):
        raise HTTPException(400, "Current password incorrect")
    new_hash = bcrypt.hashpw(new.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}

@api_router.get("/me/notification-prefs")
async def get_notification_prefs(request: Request):
    user = await get_current_user(request)
    doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "notification_prefs": 1})
    return {"prefs": (doc or {}).get("notification_prefs", {})}

@api_router.put("/me/notification-prefs")
async def update_notification_prefs(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    prefs = body.get("prefs", {})
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"notification_prefs": prefs, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True, "prefs": prefs}

# ─── Check-In Routes ───

@api_router.post("/checkins", response_model=PatientCheckIn)
async def create_checkin(checkin: CheckInCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can create check-ins")

    checkin_obj = PatientCheckIn(
        patient_id=user["user_id"],
        created_at=datetime.now(timezone.utc).isoformat(),
        **checkin.model_dump()
    )
    doc = checkin_obj.model_dump()
    await db.patient_checkins.insert_one(doc)
    result = await db.patient_checkins.find_one({"checkin_id": doc["checkin_id"]}, {"_id": 0})
    return PatientCheckIn(**result)

@api_router.get("/checkins")
async def get_checkins(request: Request, patient_id: Optional[str] = None, limit: int = 50, skip: int = 0):
    user = await get_current_user(request)
    query = {}
    if user.get("role") == "patient":
        query["patient_id"] = user["user_id"]
    elif patient_id:
        query["patient_id"] = patient_id

    checkins = await db.patient_checkins.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.patient_checkins.count_documents(query)
    return {"checkins": checkins, "total": total}

@api_router.get("/checkins/{checkin_id}")
async def get_checkin(checkin_id: str, request: Request):
    user = await get_current_user(request)
    checkin = await db.patient_checkins.find_one({"checkin_id": checkin_id}, {"_id": 0})
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in not found")
    if user.get("role") == "patient" and checkin["patient_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return checkin

# ─── AI Suggestions ───

@api_router.post("/ai/suggestions")
async def get_ai_suggestions(req: AISuggestionRequest, request: Request):
    await get_current_user(request)

    try:
        from llm_adapter import call_llm
        system = (
            "You are a therapeutic color-emotion mapping assistant for children. "
            "Given a body part and sensation, suggest colors and emotions that might relate. "
            "Respond in JSON format only: "
            "{\"suggested_color\": \"#hex\", \"suggested_emotions\": [\"emotion1\", \"emotion2\", \"emotion3\"], "
            "\"reflection\": \"A gentle, child-friendly reflection text about this feeling.\"} "
            "Keep language simple, warm, and age-appropriate for children."
        )
        user_text = (
            f"Body part: {req.body_part}. Sensation: {req.sensation}. "
            f"Current feeling: {req.current_feeling or 'not specified'}."
        )
        resp = await call_llm(system, user_text)

        import json
        clean = resp.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            clean = clean.rsplit("```", 1)[0]
        result = json.loads(clean)
        return result
    except Exception as e:
        logger.error(f"AI suggestion error: {e}")
        # Fallback static mapping
        color_map = {
            "head": "#118AB2", "chest": "#EF476F", "stomach": "#FFD166",
            "hands": "#06D6A0", "legs": "#B56576", "back": "#4A6FA5"
        }
        emotion_map = {
            "tingling": ["curious", "excited", "nervous"],
            "tightness": ["worried", "stressed", "anxious"],
            "warmth": ["happy", "loved", "comfortable"],
            "heaviness": ["sad", "tired", "overwhelmed"],
            "lightness": ["happy", "free", "calm"],
            "pain": ["hurt", "frustrated", "upset"]
        }
        body = req.body_part.lower()
        sense = req.sensation.lower()
        return {
            "suggested_color": color_map.get(body, "#FFD166"),
            "suggested_emotions": emotion_map.get(sense, ["calm", "neutral", "okay"]),
            "reflection": f"It sounds like you're feeling something in your {body}. That's okay! Let's explore this feeling together."
        }

# ─── Clinician Routes ───

@api_router.post("/ai/reflection")
async def generate_reflection(req: ReflectionRequest, request: Request):
    await get_current_user(request)
    try:
        from llm_adapter import call_llm
        system = (
            "You are a gentle therapeutic guide. Generate a 2-sentence personalized "
            "reflection that CLEARLY CONNECTS the body sensation to the emotion. "
            "Follow this EXACT formula: \"The [sensation] in your [body part] often "
            "shows up when you're feeling [emotion]. Your body may need [need].\" "
            "Important grammar rules: (a) the body part and sensation must be "
            "lowercase mid-sentence, (b) use 'when you're feeling [emotion]' so "
            "adjective emotions like 'grateful' or 'anxious' read naturally, "
            "(c) the [need] must be a warm, specific, age-appropriate suggestion. "
            "Respond ONLY with JSON: {\"reflection\": \"the full string\", \"need\": \"just the need part\"}"
        )
        user_text = (
            f"Body part: {req.body_part}. Sensations: {req.sensations}. Emotion: {req.emotion}. "
            f"Color: {req.color_name}. Deeper feeling: {req.deeper_feeling or 'not specified'}."
        )
        resp = await call_llm(system, user_text)
        import json
        clean = resp.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            clean = clean.rsplit("```", 1)[0]
        return json.loads(clean)
    except Exception as e:
        logger.error(f"Reflection generation error: {e}")
        needs_map = {
            "happy": "to celebrate and share this joy with someone you love",
            "sad": "some gentle comfort, a warm blanket, and quiet time",
            "angry": "a moment to slow down, breathe deeply, and release the tension",
            "fearful": "to feel safe and grounded, perhaps holding something comforting",
            "disgusted": "some fresh air and space to feel clean and clear",
            "bad": "kindness toward yourself and a gentle reminder that you are enough",
            "surprised": "a moment to pause, process, and understand what just happened"
        }
        emotion_lower = req.emotion.lower()
        need = needs_map.get(emotion_lower, "some gentle attention and care")
        return {
            "reflection": (
                f"The {(req.sensations or 'sensation').lower()} in your "
                f"{(req.body_part or 'body').lower()} often shows up when you're "
                f"feeling {(req.emotion or '').lower()}. Your body may need {need}."
            ),
            "need": need
        }

# ─── Clinician Routes (original) ───

async def _clinician_patient_ids(clinician_id: str) -> set:
    """Return the set of patient user_ids this clinician is authorized to see.

    Authorization is established when the patient subscribes via ANY of the
    three legacy/current subscription collections:
      • patient_doctor_subscriptions  (current — Patient → Doctor card)
      • patient_subscriptions         (legacy plan-style)
      • doctor_subscriptions          (oldest legacy)
    Without an entry in at least one of these, the clinician must NOT see
    the patient's data. This protects PHI.

    We also REQUIRE the user_id to resolve to a real patient user — stale
    subscriptions pointing to deleted/non-patient accounts are dropped so
    that every count (stats, patients list, admin view, org view) tells
    the same story.
    """
    ids: set = set()
    async for s in db.patient_doctor_subscriptions.find({"clinician_id": clinician_id}, {"user_id": 1, "_id": 0}):
        if s.get("user_id"):
            ids.add(s["user_id"])
    async for s in db.patient_subscriptions.find({"clinician_id": clinician_id, "status": "active"}, {"user_id": 1, "_id": 0}):
        if s.get("user_id"):
            ids.add(s["user_id"])
    async for s in db.doctor_subscriptions.find({"clinician_id": clinician_id}, {"user_id": 1, "_id": 0}):
        if s.get("user_id"):
            ids.add(s["user_id"])
    if not ids:
        return ids
    # Drop ids that don't resolve to a current patient user.
    real_ids: set = set()
    async for u in db.users.find(
        {"role": "patient", "user_id": {"$in": list(ids)}}, {"user_id": 1, "_id": 0}
    ):
        real_ids.add(u["user_id"])
    return real_ids


@api_router.get("/clinician/patients")
async def get_patients(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    allowed = await _clinician_patient_ids(user["user_id"])
    if not allowed:
        return {"patients": []}
    patients = await db.users.find(
        {"role": "patient", "user_id": {"$in": list(allowed)}}, {"_id": 0, "password_hash": 0}
    ).to_list(500)
    return {"patients": patients}

@api_router.get("/clinician/patient/{patient_id}/checkins")
async def get_patient_checkins(patient_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    allowed = await _clinician_patient_ids(user["user_id"])
    if patient_id not in allowed:
        raise HTTPException(status_code=403, detail="Patient not in your caseload")
    checkins = await db.patient_checkins.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"checkins": checkins}

@api_router.get("/clinician/patient/{patient_id}/assessments")
async def get_patient_assessments(patient_id: str, request: Request):
    """Return full assessment-response history for a patient (Phase 1 + Phase 2)."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    allowed = await _clinician_patient_ids(user["user_id"])
    if patient_id not in allowed:
        raise HTTPException(status_code=403, detail="Patient not in your caseload")
    assessments = await db.patient_assessment_responses.find(
        {"user_id": patient_id}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(50)
    return {"assessments": assessments}

@api_router.get("/clinician/dashboard-stats")
async def clinician_dashboard_stats(request: Request):
    """Aggregate the clinician's own caseload metrics + revenue from subscribed patients.

    SOURCE OF TRUTH: this endpoint MUST use the exact same patient-id set as
    `GET /clinician/patients` (via `_clinician_patient_ids`) — otherwise the
    Home tile, Patients tab, AI Coach picker and Recommendations all show
    different counts and the user reports inconsistency.
    """
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    clinician_id = user["user_id"]

    # Unified patient set — same helper used by /clinician/patients.
    allowed_ids = await _clinician_patient_ids(clinician_id)
    all_patient_ids = list(allowed_ids)

    # Fetch ALL active subs across the 3 collections so revenue + plan info
    # is correct, but DERIVE counts from `allowed_ids` (the canonical set).
    subs = await db.patient_subscriptions.find(
        {"clinician_id": clinician_id, "status": "active"}, {"_id": 0}
    ).to_list(1000)
    pds_subs = await db.patient_doctor_subscriptions.find(
        {"clinician_id": clinician_id}, {"_id": 0}
    ).to_list(1000)
    subscribed_patient_ids = {s.get("user_id") for s in subs if s.get("user_id")}
    pds_patient_ids = {s.get("user_id") for s in pds_subs if s.get("user_id")}

    # PHI guard — only show patients explicitly in the caseload.
    if all_patient_ids:
        patients = await db.users.find(
            {"user_id": {"$in": all_patient_ids}, "role": "patient"}, {"_id": 0, "password_hash": 0}
        ).to_list(500)
    else:
        patients = []
    # Revenue calc (legacy + new PDS) — derived from real money trail.
    revenue_usd = 0.0
    for s in subs:
        revenue_usd += float(s.get("amount_paid", s.get("price_usd", 0)) or 0)
    for s in pds_subs:
        revenue_usd += float(s.get("amount_paid_usd", 0) or 0)
    # Active alerts / pending recs
    alerts = await db.emergency_alerts.count_documents({"clinician_id": clinician_id, "status": {"$ne": "resolved"}})
    recs_given = await db.patient_activity.count_documents({"from_clinician": clinician_id})
    # Last activity per patient
    enriched = []
    for p in patients:
        last_checkin = await db.patient_checkins.find_one(
            {"patient_id": p["user_id"]}, {"_id": 0}, sort=[("created_at", -1)]
        )
        latest_assessment = await db.patient_assessment_responses.find_one(
            {"user_id": p["user_id"], "category_id": "assessment"}, {"_id": 0},
            sort=[("submitted_at", -1)]
        )
        enriched.append({
            **p,
            "last_checkin_at": (last_checkin or {}).get("created_at"),
            "last_emotion": (last_checkin or {}).get("user_selected_emotion") or (last_checkin or {}).get("core_emotion"),
            "assessment_severity": (latest_assessment or {}).get("severity"),
            "subscribed": p["user_id"] in subscribed_patient_ids or p["user_id"] in pds_patient_ids,
        })
    # ── Canonical counts ──
    # patient_count    = total patients in this clinician's caseload (auth set)
    # subscribed_count = same — every patient in the caseload reached us via a
    #                    subscription, so these must be equal across portals.
    canonical_count = len(allowed_ids)
    return {
        "patient_count": canonical_count,
        "subscribed_count": canonical_count,
        "revenue_usd": round(revenue_usd, 2),
        "alerts_count": alerts,
        "recommendations_given": recs_given,
        "patients": enriched,
    }

@api_router.get("/clinician/recommendation-library")
async def clinician_recommendation_library(request: Request):
    """Return admin-curated PLUS this clinician's custom recommendation templates."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    admin_recs = await db.recommendations.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    custom = await db.clinician_recommendations.find(
        {"clinician_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    for r in admin_recs:
        r["source"] = "admin"
    for r in custom:
        r["source"] = "custom"
        r.setdefault("recommendation_id", r.get("rec_id"))
    return {"recommendations": [*custom, *admin_recs]}


@api_router.post("/clinician/custom-recommendations")
async def create_custom_recommendation(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    body = await request.json()
    if not body.get("title"):
        raise HTTPException(400, "Title required")
    rec_id = f"crec_{uuid.uuid4().hex[:12]}"
    doc = {
        "rec_id": rec_id,
        "recommendation_id": rec_id,
        "clinician_id": user["user_id"],
        "title": body.get("title"),
        "description": body.get("description", ""),
        "category": body.get("category", "general"),
        "severity": body.get("severity"),
        "media_type": body.get("media_type", "image"),
        # NEW (Workflow 1) — match admin rich-content schema
        "content_type": body.get("content_type", body.get("media_type", "text")),
        "body_md": body.get("body_md", ""),
        "steps": body.get("steps", []),
        "image_url": body.get("image_url"),
        "media_url": body.get("media_url"),
        "tags": body.get("tags", []),
        "duration_minutes": body.get("duration_minutes"),
        "source": "custom",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.clinician_recommendations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/clinician/custom-recommendations/{rec_id}")
async def update_custom_recommendation(rec_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    body = await request.json()
    allowed = ["title", "description", "category", "severity", "media_type", "image_url", "media_url",
               "tags", "duration_minutes", "content_type", "body_md", "steps"]
    data = {k: v for k, v in body.items() if k in allowed}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.clinician_recommendations.update_one(
        {"rec_id": rec_id, "clinician_id": user["user_id"]}, {"$set": data}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Recommendation not found")
    return await db.clinician_recommendations.find_one({"rec_id": rec_id}, {"_id": 0})


@api_router.delete("/clinician/custom-recommendations/{rec_id}")
async def delete_custom_recommendation(rec_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    res = await db.clinician_recommendations.delete_one(
        {"rec_id": rec_id, "clinician_id": user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Recommendation not found")
    return {"ok": True}


@api_router.get("/clinician/patient/{patient_id}/full-history")
async def get_patient_full_history(patient_id: str, request: Request):
    """Combined timeline: check-ins + all assessment categories + recommendations, sorted by date desc."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    allowed = await _clinician_patient_ids(user["user_id"])
    if patient_id not in allowed:
        raise HTTPException(403, "Patient not in your caseload")
    patient = await db.users.find_one({"user_id": patient_id, "role": "patient"}, {"_id": 0, "password_hash": 0})
    if not patient:
        raise HTTPException(404, "Patient not found")
    checkins = await db.patient_checkins.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    assessments = await db.patient_assessment_responses.find(
        {"user_id": patient_id}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(200)
    activity = await db.patient_activity.find({"user_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    timeline = []
    for c in checkins:
        timeline.append({
            "event_id": c.get("checkin_id"),
            "type": "checkin",
            "category": "daily",
            "title": f"Daily check-in · {c.get('user_selected_emotion') or c.get('core_emotion') or 'reflection'}",
            "date": c.get("created_at") or c.get("date"),
            "color": c.get("user_selected_color"),
            "emotion": c.get("user_selected_emotion") or c.get("core_emotion"),
            "body_part": c.get("starting_body_part"),
            "sensation": c.get("starting_sensation"),
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
            "raw": a,
        })
    for ac in activity:
        if ac.get("type") in {"clinician_recommendation", "clinician_plan", "recommendation"}:
            timeline.append({
                "event_id": ac.get("activity_id"),
                "type": "recommendation",
                "category": ac.get("type"),
                "title": ac.get("title") or "Recommendation",
                "date": ac.get("created_at"),
                "progress": ac.get("progress"),
                "description": ac.get("description"),
                "image_url": ac.get("image_url"),
                "from_clinician": ac.get("from_clinician"),
                "clinician_name": ac.get("clinician_name"),
                "raw": ac,
            })
        elif ac.get("type") == "recommendation_completed":
            # USP — clinician sees completion events only if they were one
            # of the subscribed clinicians at completion time.
            shared = ac.get("shared_with_clinicians") or []
            if user["user_id"] in shared:
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
        "timeline": timeline,
        "counts": {
            "checkins": len(checkins),
            "assessments": len(assessments),
            "recommendations_given": sum(1 for ac in activity if ac.get("type") in {"clinician_recommendation", "clinician_plan", "recommendation"}),
        }
    }

@api_router.post("/clinician/recommend")
async def clinician_assign_recommendation(request: Request):
    """Clinician prescribes care to one of their subscribed patients.
    Supports three input modes:
      1. recommendation_id from the admin library (`db.recommendations`)
      2. rec_id / recommendation_id from the clinician's own templates (`db.clinician_recommendations`)
      3. an inline rich-content prescription (title + body_md/steps/media_url/etc)
    Stored as a `clinician_recommendation` activity on the patient timeline.
    """
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    body = await request.json()
    patient_id = body.get("patient_id")
    if not patient_id:
        raise HTTPException(400, "patient_id required")

    # Verify the clinician is subscribed to this patient (Prescribed Care Tracker scope)
    is_assigned = await db.users.find_one({
        "user_id": patient_id,
        "$or": [
            {"clinician_id": user["user_id"]},
            {"assigned_clinician_ids": user["user_id"]},
        ],
    }, {"_id": 0, "user_id": 1})
    if not is_assigned:
        allowed = await _clinician_patient_ids(user["user_id"])
        if patient_id not in allowed:
            # Fall back to the assignments collection if used
            assigned = await db.clinician_assignments.find_one({
                "clinician_id": user["user_id"], "patient_id": patient_id, "status": "active"
            }, {"_id": 0})
            if not assigned:
                raise HTTPException(403, "Patient is not in your subscribed list")

    # ── Assessment gate ───────────────────────────────────────────────
    # Per 2026-06-04 user directive: clinicians may NOT send recommendations
    # until the patient has completed at least one assessment. This protects
    # against clinical reach-outs that lack any baseline data.
    has_assessment = await db.patient_assessment_responses.find_one(
        {"user_id": patient_id, "category_id": "assessment"}, {"_id": 0, "submitted_at": 1}
    )
    if not has_assessment:
        # Also accept any submitted check-in as a baseline (some installs run
        # a single intake check-in instead of a full assessment).
        has_checkin = await db.patient_checkins.find_one(
            {"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]},
            {"_id": 0, "checkin_id": 1},
        )
        if not has_checkin:
            raise HTTPException(
                status_code=409,
                detail="Patient must complete at least one assessment or check-in before you can send recommendations.",
            )

    rec_id = body.get("recommendation_id") or body.get("rec_id")
    rec_data = None
    if rec_id:
        rec_data = await db.recommendations.find_one({"recommendation_id": rec_id}, {"_id": 0})
        if not rec_data:
            rec_data = await db.clinician_recommendations.find_one(
                {"$or": [{"rec_id": rec_id}, {"recommendation_id": rec_id}], "clinician_id": user["user_id"]},
                {"_id": 0},
            )
        if not rec_data:
            raise HTTPException(404, "Recommendation not found")

    # Pull the patient's latest check-in variables so the assignment is anchored
    # to the 17-point state at time of prescription (audit trail for clinicians).
    latest_checkin = await db.patient_checkins.find_one(
        {"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]},
        {"_id": 0}, sort=[("created_at", -1)]
    )

    entry = {
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "user_id": patient_id,
        "type": "clinician_recommendation",
        "title": (rec_data or {}).get("title") or body.get("title", "Custom recommendation"),
        "description": (rec_data or {}).get("description") or body.get("description", ""),
        "image_url": (rec_data or {}).get("image_url") or body.get("image_url"),
        "media_url": (rec_data or {}).get("media_url") or body.get("media_url"),
        "category": (rec_data or {}).get("category") or body.get("category", "general"),
        "severity": (rec_data or {}).get("severity") or body.get("severity"),
        # Rich content
        "content_type": (rec_data or {}).get("content_type") or body.get("content_type", "text"),
        "body_md": (rec_data or {}).get("body_md") or body.get("body_md", ""),
        "steps": (rec_data or {}).get("steps") or body.get("steps", []),
        # Clinical anchor
        "anchored_checkin": {
            "checkin_id": (latest_checkin or {}).get("checkin_id"),
            "ending_color": (latest_checkin or {}).get("ending_color"),
            "intensity_before": (latest_checkin or {}).get("intensity_before"),
            "intensity_after": (latest_checkin or {}).get("intensity_after"),
            "body_zone": (latest_checkin or {}).get("body_zone"),
            "sensations": (latest_checkin or {}).get("sensations"),
        } if latest_checkin else None,
        "from_clinician": user["user_id"],
        "clinician_name": user.get("name"),
        "ref_id": rec_id,
        "progress": "assigned",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.patient_activity.insert_one(entry)
    entry.pop("_id", None)
    return {"ok": True, "activity": entry}


# ── Assessment-eligibility gate (read-only) ──
@api_router.get("/clinician/patient/{patient_id}/can-recommend")
async def clinician_can_recommend(patient_id: str, request: Request):
    """Returns whether the patient has completed at least one assessment or
    check-in. The Clinician UI calls this before showing the 'Send
    recommendation' button so it can disable the action and explain why."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    allowed = await _clinician_patient_ids(user["user_id"])
    if patient_id not in allowed:
        raise HTTPException(403, "Patient is not in your subscribed list")
    asm = await db.patient_assessment_responses.find_one(
        {"user_id": patient_id, "category_id": "assessment"},
        {"_id": 0, "submitted_at": 1}, sort=[("submitted_at", -1)],
    )
    chk = await db.patient_checkins.find_one(
        {"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]},
        {"_id": 0, "created_at": 1}, sort=[("created_at", -1)],
    )
    return {
        "can_recommend": bool(asm or chk),
        "has_assessment": bool(asm),
        "has_checkin": bool(chk),
        "last_assessment_at": (asm or {}).get("submitted_at"),
        "last_checkin_at": (chk or {}).get("created_at"),
    }


# ── AI-drafted follow-up message ──
@api_router.post("/clinician/patient/{patient_id}/follow-up")
async def clinician_draft_follow_up(patient_id: str, request: Request):
    """Draft a warm, humanised follow-up message for a patient using their
    most recent assessment severity + last few recommendations given.

    Body (optional): { tone?: "warm" | "check_in" | "celebration", note?: "..." }
    Response: { draft: "...", context: {...} }

    Uses the Emergent LLM key via `call_llm` (Claude Sonnet by default).
    Falls back to a deterministic template if no LLM key is configured.
    """
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    allowed = await _clinician_patient_ids(user["user_id"])
    if patient_id not in allowed:
        raise HTTPException(403, "Patient is not in your subscribed list")
    body = await request.json() if (await request.body()) else {}
    tone = (body.get("tone") or "warm").lower()
    extra_note = body.get("note") or ""

    patient = await db.users.find_one({"user_id": patient_id}, {"_id": 0, "name": 1, "email": 1})
    latest_assessment = await db.patient_assessment_responses.find_one(
        {"user_id": patient_id, "category_id": "assessment"},
        {"_id": 0}, sort=[("submitted_at", -1)],
    )
    latest_checkin = await db.patient_checkins.find_one(
        {"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]},
        {"_id": 0}, sort=[("created_at", -1)],
    )
    recs = await db.patient_activity.find(
        {"user_id": patient_id, "from_clinician": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(3)

    severity = (latest_assessment or {}).get("severity") or "—"
    last_emotion = (latest_checkin or {}).get("user_selected_emotion") or "—"
    last_color = (latest_checkin or {}).get("user_selected_color") or "—"
    rec_titles = [r.get("title") for r in recs if r.get("title")][:3]

    context = {
        "patient_first_name": (patient or {}).get("name", "there").split(" ")[0] if (patient and patient.get("name")) else "there",
        "clinician_first_name": (user.get("name") or "Dr.").split(" ")[0],
        "severity": severity,
        "last_emotion": last_emotion,
        "last_color": last_color,
        "rec_titles": rec_titles,
        "tone": tone,
        "extra_note": extra_note,
    }

    # Build prompt for the LLM ─────────────────────────────────────
    system_msg = (
        "You are a kind, evidence-informed mental-health clinician writing a "
        "follow-up message to a patient inside the IFEELINCOLOR app. Your "
        "tone is warm, hopeful, never clinical-cold, never preachy. Use the "
        "patient's first name once. Keep it 2-4 short sentences. End with a "
        "gentle invitation (not a command). Never diagnose. Never give "
        "medication advice. Never claim certainty about their feelings."
    )
    user_msg = (
        f"Patient first name: {context['patient_first_name']}\n"
        f"Clinician first name: {context['clinician_first_name']}\n"
        f"Latest assessment severity: {severity}\n"
        f"Latest emotion in check-in: {last_emotion} (colour: {last_color})\n"
        f"Recent recommendations I gave: {', '.join(rec_titles) if rec_titles else 'none yet'}\n"
        f"Tone preset: {tone}\n"
        f"Clinician's extra note (optional): {extra_note}\n\n"
        "Write the follow-up message now. Output ONLY the message — no "
        "preamble, no salutation line break before, no signoff with title."
    )

    draft = ""
    try:
        from llm_adapter import call_llm, has_llm_key
        if has_llm_key():
            draft = await call_llm(system_msg, user_msg)
    except Exception as e:
        logger.warning("Follow-up LLM call failed: %s", e)

    if not draft:
        # Deterministic template fallback — still warm + humanised.
        rec_blurb = (
            f" I'm glad you're working on {rec_titles[0]}." if rec_titles else ""
        )
        sev_blurb = {
            "critical": "I noticed your last check-in felt really heavy",
            "high": "I saw things have been hard lately",
            "moderate": "I noticed your last check-in was a little tender",
            "low": "I'm so glad to see how steady you've been",
        }.get(str(severity).lower(), "I'm thinking of you today")
        draft = (
            f"Hi {context['patient_first_name']}, {sev_blurb}.{rec_blurb} "
            "If you have a minute, I'd love to know how you're feeling right "
            "now — even a single word is enough. I'm here whenever you're ready."
        )

    return {"draft": draft.strip(), "context": context}


@api_router.get("/clinician/patient/{patient_id}/care-context")
async def clinician_patient_care_context(patient_id: str, request: Request):
    """Pre-flight info for the Prescribed Care Tracker form: latest 17-point
    check-in variables + all currently-active prescriptions for this patient."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    patient = await db.users.find_one({"user_id": patient_id}, {"_id": 0, "password_hash": 0})
    if not patient:
        raise HTTPException(404, "Patient not found")
    # Access check — assigned via legacy fields OR active subscription
    is_assigned = (
        patient.get("clinician_id") == user["user_id"]
        or user["user_id"] in (patient.get("assigned_clinician_ids") or [])
    )
    if not is_assigned:
        allowed = await _clinician_patient_ids(user["user_id"])
        if patient_id not in allowed:
            assigned = await db.clinician_assignments.find_one({
                "clinician_id": user["user_id"], "patient_id": patient_id, "status": "active"
            }, {"_id": 0})
            if not assigned:
                raise HTTPException(403, "Patient is not in your subscribed list")
    latest_checkin = await db.patient_checkins.find_one(
        {"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]},
        {"_id": 0}, sort=[("created_at", -1)]
    )
    given = await db.patient_activity.find(
        {"user_id": patient_id, "type": "clinician_recommendation", "from_clinician": user["user_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return {
        "patient": {
            "user_id": patient.get("user_id"),
            "name": patient.get("name"),
            "email": patient.get("email"),
            "subscription_tier": patient.get("subscription_tier") or patient.get("plan"),
            "account_status": patient.get("status", "active"),
        },
        "latest_checkin": latest_checkin,
        "given_recommendations": given,
    }

@api_router.get("/clinician/recommendations-given")
async def clinician_recommendations_given(request: Request):
    """List recommendations this clinician has given, with per-patient progress."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    rows = await db.patient_activity.find(
        {"from_clinician": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    # Hydrate with patient name
    out = []
    for r in rows:
        patient = await db.users.find_one({"user_id": r.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "user_id": 1})
        out.append({**r, "patient_name": (patient or {}).get("name"), "patient_email": (patient or {}).get("email")})
    return {"recommendations": out}

@api_router.post("/clinician/recommend/{activity_id}/progress")
async def update_recommendation_progress(activity_id: str, request: Request):
    """Update a recommendation progress note (e.g., 'reminded', 'in_progress', 'completed')."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    body = await request.json()
    progress = body.get("progress", "reminded")
    note = body.get("note", "")
    await db.patient_activity.update_one(
        {"activity_id": activity_id, "from_clinician": user["user_id"]},
        {"$set": {"progress": progress, "progress_note": note, "progress_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}

# ─── Organization Routes ───

@api_router.post("/clinician/notes")
async def save_clinician_note(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    body = await request.json()
    pid = body.get("patient_id")
    if pid:
        allowed = await _clinician_patient_ids(user["user_id"])
        if pid not in allowed:
            raise HTTPException(403, "Patient not in your caseload")
    # Accept either `note` (canonical) or `body` (frontend ergonomics).
    text = body.get("note") or body.get("body") or body.get("text") or ""
    note = {
        "note_id": f"note_{uuid.uuid4().hex[:12]}",
        "clinician_id": user["user_id"],
        "patient_id": pid,
        "note": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.clinician_notes.insert_one(note)
    note.pop("_id", None)
    return {"ok": True, "note": note}

@api_router.get("/clinician/notes")
async def list_clinician_notes(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    pid = request.query_params.get("patient_id")
    q = {"clinician_id": user["user_id"]}
    if pid:
        # Verify access — clinician must be subscribed to view this patient's notes
        allowed = await _clinician_patient_ids(user["user_id"])
        if pid not in allowed:
            raise HTTPException(403, "Patient not in your caseload")
        q["patient_id"] = pid
    notes = await db.clinician_notes.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"notes": notes}

@api_router.post("/ai/clinician-assist")
async def clinician_ai_assist(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    body = await request.json()
    prompt = body.get("prompt", "")
    patient_id = body.get("patient_id")
    context = ""
    if patient_id:
        recent = await db.patient_checkins.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(5)
        if recent:
            context = "Recent check-ins:\n" + "\n".join(
                [f"- {c.get('date')}: emotion={c.get('user_selected_emotion')}, color={c.get('user_selected_color')}, body={c.get('starting_body_part')}/{c.get('starting_sensation')}" for c in recent]
            )
    try:
        from llm_adapter import call_llm
        system = (
            "You are a clinical assistant for IFEELINCOLOR. Provide concise, evidence-informed guidance for clinicians. "
            "Keep responses under 180 words, use a warm professional tone, and avoid prescribing medication. "
            "When asked to summarize, lead with the key emotional pattern, then 1-2 suggested next steps."
        )
        text = prompt if not context else f"{prompt}\n\n{context}"
        resp = await call_llm(system, text)
        return {"reply": resp}
    except Exception as e:
        logger.error(f"Clinician AI assist error: {e}")
        return {"reply": "AI service is temporarily unavailable. Try again in a moment or jot a manual note for now."}


@api_router.post("/ai/clinician-coach")
async def clinician_ai_coach(request: Request):
    """Generate a full 5-step treatment plan with reasoning for a specific patient."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    body = await request.json()
    patient_id = body.get("patient_id")
    focus = body.get("focus", "")  # optional area of focus
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id required")
    patient = await db.users.find_one({"user_id": patient_id, "role": "patient"}, {"_id": 0, "password_hash": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Gather context: recent check-ins + assessment severity + current saved recs
    checkins = await db.patient_checkins.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(10)
    latest_assessment = await db.patient_assessment_responses.find_one(
        {"user_id": patient_id, "category_id": "assessment"}, {"_id": 0}, sort=[("submitted_at", -1)]
    )
    saved = await db.patient_activity.find({"user_id": patient_id, "type": "recommendation"}, {"_id": 0}).limit(5).to_list(5)

    summary = []
    summary.append(f"Patient: {patient.get('name', 'Unknown')} ({patient.get('dob', 'DOB unknown')}).")
    if latest_assessment:
        summary.append(f"Latest assessment severity: {latest_assessment.get('severity', 'unknown')}.")
    if checkins:
        emos = [c.get('user_selected_emotion', '') for c in checkins[:5] if c.get('user_selected_emotion')]
        if emos:
            summary.append(f"Recent emotions: {', '.join(emos)}.")
    if saved:
        summary.append(f"Already-saved suggestions: {', '.join([s.get('title', '') for s in saved[:3] if s.get('title')])}.")
    if focus:
        summary.append(f"Clinician focus: {focus}.")
    ctx = " ".join(summary)

    try:
        from llm_adapter import call_llm
        system = (
            "You are an evidence-informed clinical coach for IFEELINCOLOR therapists. "
            "Generate a 5-step treatment plan tailored to the patient summary provided. "
            "Output ONLY compact JSON in this shape: "
            '{"overview": "2-3 sentence pattern recap", '
            '"plan": [{"title": "...", "rationale": "1 sentence why", "actions": ["a1","a2"], "timeframe": "this week|2 weeks|month"}], '
            '"red_flags": ["any concerning patterns"], '
            '"strengths": ["resilience signals"]}. '
            "Tone: warm, professional, non-prescriptive. No medication advice."
        )
        resp = await call_llm(system, ctx)
        import json as _json, re as _re
        m = _re.search(r"\{.*\}", resp, _re.DOTALL)
        plan = _json.loads(m.group(0)) if m else {"overview": resp, "plan": [], "red_flags": [], "strengths": []}
    except Exception as e:
        logger.error(f"Clinician AI coach error: {e}")
        plan = {
            "overview": "AI coach is temporarily unavailable. Use your clinical judgment and revisit recent check-ins.",
            "plan": [], "red_flags": [], "strengths": []
        }

    # Save the coach session
    session_doc = {
        "session_id": f"coach_{uuid.uuid4().hex[:12]}",
        "clinician_id": user["user_id"],
        "patient_id": patient_id,
        "focus": focus,
        "plan": plan,
        "context": ctx,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.clinician_coach_sessions.insert_one(session_doc)
    session_doc.pop("_id", None)
    return {"session": session_doc}


@api_router.get("/ai/clinician-coach/sessions")
async def list_coach_sessions(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    sessions = await db.clinician_coach_sessions.find(
        {"clinician_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return {"sessions": sessions}


@api_router.post("/ai/clinician-coach/save-to-roadmap")
async def save_coach_to_roadmap(request: Request):
    """Push selected coach plan steps to the patient's activity roadmap."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    body = await request.json()
    patient_id = body.get("patient_id")
    steps = body.get("steps", [])
    for s in steps:
        await db.patient_activity.insert_one({
            "activity_id": f"act_{uuid.uuid4().hex[:12]}",
            "user_id": patient_id,
            "type": "clinician_plan",
            "title": s.get("title"),
            "description": s.get("rationale", ""),
            "actions": s.get("actions", []),
            "timeframe": s.get("timeframe", ""),
            "from_clinician": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True, "saved": len(steps)}


# ─── Organization Routes ───

@api_router.get("/org/stats")
async def get_org_stats(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "organization":
        raise HTTPException(status_code=403, detail="Organizations only")
    total_patients = await db.users.count_documents({"role": "patient"})
    total_clinicians = await db.users.count_documents({"role": "clinician"})
    total_checkins = await db.patient_checkins.count_documents({})
    return {
        "total_patients": total_patients,
        "total_clinicians": total_clinicians,
        "total_checkins": total_checkins
    }

# ─── Clinician Analytics ───

@api_router.get("/clinician/analytics")
async def clinician_analytics(request: Request, days: int = 30):
    """Caseload analytics for the clinician: severity dist, check-in frequency, emotion frequency."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(status_code=403, detail="Clinicians only")
    cid = user["user_id"]
    # Resolve patient IDs via patient_doctor_subscriptions + patient_subscriptions
    pds = await db.patient_doctor_subscriptions.find({"clinician_id": cid}, {"_id": 0}).to_list(1000)
    ps = await db.patient_subscriptions.find({"clinician_id": cid, "status": "active"}, {"_id": 0}).to_list(1000)
    patient_ids = list({*(p.get("user_id") for p in pds), *(p.get("user_id") for p in ps)})
    # Fallback: if none, use all patients (so demo accounts see something)
    if not patient_ids:
        all_p = await db.users.find({"role": "patient"}, {"_id": 0, "user_id": 1}).limit(50).to_list(50)
        patient_ids = [p["user_id"] for p in all_p]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    # Severity distribution from latest assessments
    severity = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    for pid in patient_ids:
        latest = await db.patient_assessment_responses.find_one(
            {"user_id": pid, "category_id": "assessment"}, {"_id": 0}, sort=[("submitted_at", -1)]
        )
        sev = (latest or {}).get("severity")
        if sev in severity:
            severity[sev] += 1
        elif sev == "medium":
            severity["moderate"] += 1
    # Check-in frequency per day
    pipeline = [
        {"$match": {"patient_id": {"$in": patient_ids}, "created_at": {"$gte": since}}},
        {"$project": {"day": {"$substr": ["$created_at", 0, 10]}, "emotion": "$user_selected_emotion"}},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    by_day = await db.patient_checkins.aggregate(pipeline).to_list(60)
    # Fill missing days
    out_days = []
    day_map = {d["_id"]: d["count"] for d in by_day}
    today = datetime.now(timezone.utc).date()
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        out_days.append({"date": d, "count": day_map.get(d, 0)})
    # Emotion frequency
    emotions_pipeline = [
        {"$match": {"patient_id": {"$in": patient_ids}, "created_at": {"$gte": since}}},
        {"$group": {"_id": "$user_selected_emotion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]
    em_raw = await db.patient_checkins.aggregate(emotions_pipeline).to_list(8)
    emotions = [{"emotion": e["_id"] or "Unspecified", "count": e["count"]} for e in em_raw if e["_id"]]
    # Total check-ins
    total_checkins = await db.patient_checkins.count_documents({"patient_id": {"$in": patient_ids}, "created_at": {"$gte": since}})
    # Recommendations given
    recs_given = await db.patient_activity.count_documents({"from_clinician": cid})
    return {
        "severity_distribution": [{"label": k, "value": v} for k, v in severity.items()],
        "checkin_frequency": out_days,
        "emotion_frequency": emotions,
        "total_checkins": total_checkins,
        "recommendations_given": recs_given,
        "patient_count": len(patient_ids),
        "window_days": days,
    }


# ─── CSV Exports ───

def _csv_response(rows: list, headers: list, filename: str):
    import io, csv
    from fastapi.responses import StreamingResponse
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({h: r.get(h, "") for h in headers})
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@api_router.get("/patient/checkins/export")
async def patient_export_checkins(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "patient":
        raise HTTPException(403, "Patients only")
    rows = await db.patient_checkins.find({"patient_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    headers = ["date", "time", "starting_body_part", "starting_sensation", "user_selected_color",
               "user_selected_emotion", "intensity_rating_before", "intensity_rating_after",
               "ending_emotion", "journal_notes", "created_at"]
    return _csv_response(rows, headers, f"checkins_{user['user_id']}.csv")

@api_router.get("/clinician/patient/{patient_id}/checkins/export")
async def clinician_export_checkins(patient_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    allowed = await _clinician_patient_ids(user["user_id"])
    if patient_id not in allowed:
        raise HTTPException(403, "Patient not in your caseload")
    rows = await db.patient_checkins.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    headers = ["date", "time", "starting_body_part", "starting_sensation", "user_selected_color",
               "user_selected_emotion", "intensity_rating_before", "intensity_rating_after",
               "ending_emotion", "journal_notes", "created_at"]
    return _csv_response(rows, headers, f"patient_{patient_id}_checkins.csv")


# ─── Admin: Patient↔Clinician Assignments ───

@api_router.get("/admin/assignments")
async def admin_list_assignments(request: Request):
    from admin_auth import get_current_admin
    await get_current_admin(request, db)
    pds = await db.patient_doctor_subscriptions.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(2000)
    out = []
    for r in pds:
        patient = await db.users.find_one({"user_id": r.get("user_id")}, {"_id": 0, "password_hash": 0})
        clin_id = r.get("clinician_id") or r.get("doctor_id")
        clinician = await db.users.find_one({"user_id": clin_id, "role": "clinician"}, {"_id": 0, "password_hash": 0})
        out.append({
            "subscription_id": r.get("subscription_id"),
            "patient_id": r.get("user_id"),
            "patient_name": (patient or {}).get("name"),
            "patient_email": (patient or {}).get("email"),
            "clinician_id": clin_id,
            "clinician_name": (clinician or {}).get("name") or r.get("name"),
            "clinician_email": (clinician or {}).get("email"),
            "is_real_clinician": bool(clinician),
            "plan_name": r.get("plan_name"),
            "amount_paid_usd": r.get("amount_paid_usd"),
            "payment_status": r.get("payment_status", "free"),
            "subscribed_at": r.get("subscribed_at"),
            "end_date": r.get("end_date"),
        })
    return {"assignments": out, "total": len(out)}

@api_router.delete("/admin/assignments/{subscription_id}")
async def admin_revoke_assignment(subscription_id: str, request: Request):
    from admin_auth import get_current_admin
    await get_current_admin(request, db)
    res = await db.patient_doctor_subscriptions.delete_one({"subscription_id": subscription_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Assignment not found")
    return {"ok": True}


# ─── Push Notifications (poll-based + Web Notification API) ───

@api_router.get("/clinician/notifications-feed")
async def clinician_notifications_feed(request: Request, since: Optional[str] = None):
    """Returns a unified feed for the clinician: new check-ins (from their patients),
    emergencies, and new patient subscriptions. Used for polling-based browser push."""
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    cid = user["user_id"]
    # Resolve patients
    pds = await db.patient_doctor_subscriptions.find({"clinician_id": cid}, {"_id": 0}).to_list(1000)
    patient_ids = list({p.get("user_id") for p in pds if p.get("user_id")})
    feed = []
    if not patient_ids:
        # No linked patients yet — return empty feed (avoid leaking global activity)
        return {"feed": [], "server_time": datetime.now(timezone.utc).isoformat()}
    # New check-ins from subscribed patients
    q_check = {"patient_id": {"$in": patient_ids}}
    if since:
        q_check["created_at"] = {"$gt": since}
    checks = await db.patient_checkins.find(q_check, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    for c in checks:
        patient = await db.users.find_one({"user_id": c.get("patient_id")}, {"_id": 0, "name": 1})
        feed.append({
            "id": f"chk_{c.get('checkin_id')}",
            "type": "checkin",
            "title": f"{(patient or {}).get('name', 'Patient')} logged a check-in",
            "body": f"Emotion: {c.get('user_selected_emotion', '—')} · Body: {c.get('starting_body_part', '—')}",
            "created_at": c.get("created_at"),
            "patient_id": c.get("patient_id"),
            "url": f"/clinician/patient/{c.get('patient_id')}/roadmap",
        })

    # Assessment submissions by subscribed patients (USP — clinician must
    # know when their patient takes a fresh assessment so they can review).
    q_assess = {"user_id": {"$in": patient_ids}, "type": "assessment_completed"}
    if since:
        q_assess["created_at"] = {"$gt": since}
    assess_events = await db.patient_activity.find(q_assess, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    for a in assess_events:
        patient = await db.users.find_one({"user_id": a.get("user_id")}, {"_id": 0, "name": 1})
        feed.append({
            "id": f"asm_{a.get('activity_id')}",
            "type": "assessment",
            "title": f"{(patient or {}).get('name', 'Patient')} completed an assessment",
            "body": a.get("title") or "New assessment ready to review",
            "created_at": a.get("created_at"),
            "patient_id": a.get("user_id"),
            "url": f"/clinician/patient/{a.get('user_id')}/roadmap",
        })
    # Emergencies for these patients only
    q_emerg = {"user_id": {"$in": patient_ids}}
    if since:
        q_emerg["created_at"] = {"$gt": since}
    emergencies = await db.emergency_alerts.find(q_emerg, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    for e in emergencies:
        feed.append({
            "id": f"emr_{e.get('alert_id')}",
            "type": "emergency",
            "title": f"SOS: {e.get('user_name', 'Patient')}",
            "body": f"Severity {(e.get('severity', 'critical') or 'critical').upper()}",
            "created_at": e.get("created_at"),
            "patient_id": e.get("user_id"),
            "url": "/clinician/home",
        })
    feed.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"feed": feed[:50], "server_time": datetime.now(timezone.utc).isoformat()}


@api_router.get("/clinician/celebration-feed")
async def clinician_celebration_feed(request: Request, since: Optional[str] = None):
    """Lightweight feed dedicated to 'a new patient just subscribed to you'
    events. Polled by the Clinician Shell every ~25 s — when a new entry
    appears with `created_at > since`, the UI fires a confetti toast.

    Returns `{events: [{id, patient_id, patient_name, patient_photo,
    plan_name, created_at}], server_time}`.
    """
    user = await get_current_user(request)
    if user.get("role") != "clinician":
        raise HTTPException(403, "Clinicians only")
    cid = user["user_id"]
    q = {"clinician_id": cid}
    if since:
        q["created_at"] = {"$gt": since}
    # patient_doctor_subscriptions docs store doctor_id (== clinician user_id)
    # for compatibility — match either field for safety.
    docs = await db.patient_doctor_subscriptions.find(
        {"$and": [{"$or": [{"clinician_id": cid}, {"doctor_id": cid}]}] + ([{"created_at": q["created_at"]}] if since else [])},
        {"_id": 0}
    ).sort("created_at", -1).limit(30).to_list(30)
    events = []
    for d in docs:
        pid = d.get("user_id") or d.get("patient_id")
        if not pid:
            continue
        pdoc = await db.users.find_one({"user_id": pid}, {"_id": 0, "name": 1, "patient_info": 1, "avatar_url": 1})
        info = (pdoc or {}).get("patient_info") or {}
        events.append({
            "id": d.get("subscription_id") or f"sub_{pid}_{d.get('created_at')}",
            "patient_id": pid,
            "patient_name": (pdoc or {}).get("name") or "A new patient",
            "patient_photo": info.get("profile_photo") or (pdoc or {}).get("avatar_url"),
            "plan_name": d.get("plan_name") or "Care plan",
            "created_at": d.get("created_at"),
        })
    return {"events": events, "server_time": datetime.now(timezone.utc).isoformat()}


# ─── Demo Login (for testing) ───

@api_router.post("/auth/demo-login/seed")
async def demo_login_seed(request: Request):
    """Idempotent seed of demo account credentials. Does NOT set a session — call this
    before a manual /api/auth/login attempt to ensure the demo account exists with a password."""
    body = await request.json()
    role = body.get("role", "patient")
    from admin_auth import hash_password

    demo_accounts = {
        "patient": {"user_id": "demo-patient-001", "name": "Luna Star", "email": "luna@demo.ifeelincolor.com", "role": "patient", "_password": "Patient@123"},
        "clinician": {"user_id": "demo-clinician-001", "name": "Dr. Sarah Chen", "email": "sarah@demo.ifeelincolor.com", "role": "clinician", "_password": "Clinician@123"},
        "organization": {"user_id": "demo-org-001", "name": "Sunshine Care Center", "email": "admin@demo.ifeelincolor.com", "role": "organization", "_password": "Organization@123"},
    }
    account = demo_accounts.get(role)
    if not account:
        raise HTTPException(status_code=400, detail="Invalid role")
    demo_pw = account.pop("_password")
    pw_hash = hash_password(demo_pw)
    existing = await db.users.find_one({"user_id": account["user_id"]}, {"_id": 0})
    now = datetime.now(timezone.utc).isoformat()
    if not existing:
        await db.users.insert_one({
            **account, "password_hash": pw_hash, "picture": None, "mobile": None,
            "dob": None, "address": None, "is_first_login": False,
            "created_at": now, "updated_at": now,
        })
    elif not existing.get("password_hash"):
        await db.users.update_one(
            {"user_id": account["user_id"]},
            {"$set": {"password_hash": pw_hash, "updated_at": now}},
        )
    return {"ok": True, "email": account["email"]}


@api_router.post("/auth/demo-login")
async def demo_login(request: Request, response: Response):
    body = await request.json()
    role = body.get("role", "patient")
    from admin_auth import hash_password

    demo_accounts = {
        "patient": {"user_id": "demo-patient-001", "name": "Luna Star", "email": "luna@demo.ifeelincolor.com", "role": "patient", "_password": "Patient@123"},
        "clinician": {"user_id": "demo-clinician-001", "name": "Dr. Sarah Chen", "email": "sarah@demo.ifeelincolor.com", "role": "clinician", "_password": "Clinician@123"},
        "organization": {"user_id": "demo-org-001", "name": "Sunshine Care Center", "email": "admin@demo.ifeelincolor.com", "role": "organization", "_password": "Organization@123"},
    }

    account = demo_accounts.get(role)
    if not account:
        raise HTTPException(status_code=400, detail="Invalid role")

    demo_pw = account.pop("_password")
    pw_hash = hash_password(demo_pw)
    existing = await db.users.find_one({"user_id": account["user_id"]}, {"_id": 0})
    now = datetime.now(timezone.utc).isoformat()
    if not existing:
        await db.users.insert_one({
            **account,
            "password_hash": pw_hash,
            "picture": None,
            "mobile": None,
            "dob": None,
            "address": None,
            "is_first_login": False,
            "created_at": now,
            "updated_at": now,
        })
    elif not existing.get("password_hash"):
        await db.users.update_one(
            {"user_id": account["user_id"]},
            {"$set": {"password_hash": pw_hash, "updated_at": now}},
        )

    session_token = f"demo_{role}_{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": account["user_id"],
        "expires_at": expires_at.isoformat(),
        "created_at": now,
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        path="/",
        secure=True,
        httponly=True,
        samesite="none",
        max_age=7 * 24 * 3600,
    )

    user_doc = await db.users.find_one({"user_id": account["user_id"]}, {"_id": 0})
    return user_doc

# ─── Public Org Portal ───
@api_router.get("/org/{slug}")
async def get_org_by_slug(slug: str):
    orgs = await db.users.find({"role": "organization"}, {"_id": 0}).to_list(200)
    for org in orgs:
        org_slug = org.get("name", "").lower().strip().replace(" ", "-").replace("'", "").replace(".", "").replace(",", "")
        if org_slug == slug:
            return org
    raise HTTPException(status_code=404, detail="Organization not found")

# ─── Root ───

@api_router.get("/")
async def root():
    return {"message": "IFEELINCOLOR API v1"}

app.include_router(api_router)

# Public docs routes (renders user guide as styled HTML)
from docs_routes import docs_router
app.include_router(docs_router)

# Admin routes
set_admin_db(db)
app.include_router(admin_router)
set_ext_db(db)
app.include_router(admin_ext_router)
set_auth_ext_db(db)
app.include_router(auth_ext_router)

# ─── Org-specific login routes (alias + canonical v1) ────────────────────
from auth_extended import org_login_flow, LoginRequest as _AuthLoginRequest
from fastapi import Response as _Response

@app.post("/api/organization/login", include_in_schema=False)
async def _org_login_alias(data: _AuthLoginRequest, response: _Response):
    return await org_login_flow(data, response)

@app.post("/api/v1/auth/organization/login")
async def _org_login_v1(data: _AuthLoginRequest, response: _Response):
    return await org_login_flow(data, response)
set_pf_db(db)
app.include_router(patient_flow_router)
set_stripe_db(db)
app.include_router(stripe_router, prefix="/api")
set_razorpay_db(db)
app.include_router(razorpay_router, prefix="/api")
set_email_db(db)
app.include_router(email_router)
set_checkin_db(db)
app.include_router(checkin_router, prefix="/api")

# ─── 5-flow subscription audience routes (Patient↔Clinician/Portal/Org, Clinician↔Portal, Org↔Portal) ──
from subscription_routes_v2 import audience_router, admin_audience_router, init_audience_routes
from subscription_audiences import migrate_plan_audiences
init_audience_routes(db)
# Expose `_get_current_user` so audience_router can reuse the canonical
# session-resolution logic without a circular import.
async def _get_current_user(request: Request) -> dict:  # noqa: F811
    return await get_current_user(request)
app.include_router(audience_router)
app.include_router(admin_audience_router)

# Organization portal routes (org login → manage own clinicians)
from org_routes import org_router, init_org_routes
init_org_routes(db)
app.include_router(org_router)

# Stripe webhook
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    try:
        from stripe_adapter import StripeCheckout
        body = await request.body()
        api_key = os.environ.get("STRIPE_API_KEY", "")
        host_url = str(request.base_url).rstrip("/")
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=f"{host_url}/api/webhook/stripe")
        event = await stripe_checkout.handle_webhook(body, request.headers.get("Stripe-Signature"))
        if event.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}

# Startup event - seed admin
@app.on_event("startup")
async def startup():
    await seed_admin(db)
    await db.admins.create_index("email", unique=True)
    await db.subscription_plans.create_index("plan_id", unique=True)
    await db.subscriptions.create_index("subscription_id", unique=True)
    await seed_subscription_plans()
    await seed_email_templates()
    await seed_checkin_content()
    try:
        report = await migrate_plan_audiences(db)
        logger.info(f"[audience-migration] {report}")
    except Exception as e:
        logger.error(f"[audience-migration] failed: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
