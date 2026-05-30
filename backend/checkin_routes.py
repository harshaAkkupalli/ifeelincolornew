"""Check-In Content Management — admin-curated body parts & emotion families.
Patients load these via public endpoints; admin manages via admin endpoints."""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

checkin_router = APIRouter()
db = None  # injected from server.py


def set_checkin_db(_db):
    global db
    db = _db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Clinical-safety compliance guardrail ───
# Diagnostic phrases that MUST NOT be authored by admins for patient-facing strings.
# We detect them on POST/PATCH and either reject (strict) or auto-soften (rendering side).
DIAGNOSTIC_PATTERNS = [
    (r"\bthis proves\b",          "your body may be telling you"),
    (r"\bproves that you\b",      "may suggest that you"),
    (r"\byou definitely\b",       "you may"),
    (r"\byou clearly\b",          "you may"),
    (r"\byou certainly\b",        "you may"),
    (r"\byou are diagnosed\b",    "you may be experiencing"),
    (r"\byou have (\w+ disorder|depression|anxiety|adhd|ptsd|bipolar|ocd)\b", r"you may be noticing signs that connect with \1"),
    (r"\byou suffer from\b",      "you may be experiencing"),
    (r"\bguaranteed to\b",        "may help to"),
    (r"\bwill cure\b",            "may help with"),
    (r"\bmust be\b",              "may be"),
    (r"\bis caused by\b",         "may be connected to"),
    (r"\bis a symptom of\b",      "may be linked with"),
    (r"\balways means\b",         "may suggest"),
    (r"\bnever means\b",          "may not always mean"),
]


def compliance_check(text: str) -> List[str]:
    """Return a list of diagnostic warnings for the given text. Empty list → safe."""
    if not text:
        return []
    warnings = []
    lower = text.lower()
    for pat, _ in DIAGNOSTIC_PATTERNS:
        if re.search(pat, lower):
            warnings.append(re.search(pat, lower).group(0))
    return warnings


def compliance_soften(text: str) -> str:
    """Auto-rewrite diagnostic phrasing into non-diagnostic clinical-safety phrasing."""
    if not text:
        return text
    out = text
    for pat, replacement in DIAGNOSTIC_PATTERNS:
        out = re.sub(pat, replacement, out, flags=re.IGNORECASE)
    return out


def _enforce_compliance(payload: dict, fields: List[str]):
    """Raise HTTPException with the offending phrases if any diagnostic language is found."""
    all_warnings = {}
    for f in fields:
        v = payload.get(f)
        if isinstance(v, str):
            w = compliance_check(v)
            if w:
                all_warnings[f] = w
    if all_warnings:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "non_compliant_language",
                "message": "Diagnostic language is not allowed. Use clinical-safety phrasing like 'may be telling you', 'may be connected to', 'your body may need'.",
                "offending_phrases": all_warnings,
            },
        )


def _enforce_question_compliance(questions: List[dict]):
    """Each admin-authored question.text must pass the compliance gate too."""
    all_warnings = {}
    for i, q in enumerate(questions or []):
        text = (q or {}).get("text", "")
        if isinstance(text, str):
            w = compliance_check(text)
            if w:
                all_warnings[f"questions[{i}].text"] = w
    if all_warnings:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "non_compliant_language",
                "message": "Diagnostic language is not allowed in question text.",
                "offending_phrases": all_warnings,
            },
        )


def _assign_question_ids(questions: List[dict]):
    """Mutate in-place: ensure every question has a stable id."""
    for q in questions or []:
        if not q.get("id"):
            q["id"] = f"q_{uuid.uuid4().hex[:10]}"


# ─── Default seed data (fallbacks for fresh installs) ───
DEFAULT_BODY_PARTS = [
    # Coordinates calibrated against the holographic SVG body (viewBox 0 0 200 500).
    # x/y are stored as percentages so they map directly to the rendered map.
    ("Head",                "head",                50,  5,  ["Racing thoughts", "Pressure", "Headache", "Foggy", "Dizzy/lightheaded", "Heavy", "Clear", "Busy", "Overloaded", "Blank/numb"]),
    ("Eyes/Face",           "eyes_face",           50, 11,  ["Tears welling", "Tight jaw", "Watery eyes", "Flushed", "Tingling", "Frowning", "Relaxed face"]),
    ("Jaw/Mouth",           "jaw_mouth",           50, 14,  ["Clenched jaw", "Grinding teeth", "Dry mouth", "Tight throat", "Bitter taste"]),
    ("Throat",              "throat",              50, 20,  ["Tight", "Lump", "Choked", "Difficulty swallowing", "Open"]),
    ("Shoulders/Neck",      "shoulders_neck",      35, 23,  ["Tight shoulders", "Knot in neck", "Hunched", "Heavy", "Loose"]),
    ("Chest/Heart",         "chest",               50, 28,  ["Tight chest", "Heart racing", "Fluttering", "Heavy", "Warm", "Breathless", "Calm"]),
    ("Back",                "back",                64, 34,  ["Stiff", "Aching", "Heavy", "Tight", "Loose"]),
    ("Stomach/Gut",         "stomach",             50, 44,  ["Butterflies", "Knot", "Nausea", "Hunger", "Heavy", "Empty", "Settled"]),
    ("Whole Body/Energy",   "whole_body_energy",   50, 52,  ["Drained", "Energised", "Heavy", "Light", "Restless", "Calm"]),
    ("Skin/Whole Body",     "skin_whole_body",     75, 38,  ["Hot", "Cold", "Sweaty", "Goosebumps", "Tingling", "Numb"]),
    ("Arms/Hands",          "arms_hands",          22, 48,  ["Trembling", "Tingling", "Clenched fists", "Numb", "Warm", "Cold"]),
    ("Legs/Feet",           "legs_feet",           50, 82,  ["Restless", "Heavy", "Tingling", "Weak", "Grounded"]),
]

DEFAULT_EMOTIONS = [
    {"key": "happy",      "label": "Happy",       "color_hex": "#FFD23F",
     "regulation_message": "Your body may want to share or celebrate this joy.",
     "level2": [
        {"label": "Joyful",   "level3": ["Playful", "Content"]},
        {"label": "Grateful", "level3": ["Thankful", "Warm"]},
        {"label": "Proud",    "level3": ["Confident", "Accomplished"]},
     ],
     "regulation_activities": [
        {"title": "Gratitude Moment", "steps": ["Close your eyes gently", "Think of 3 things that make you smile", "Hold each one in your heart for a moment", "Open your eyes and carry that warmth"]},
        {"title": "Joy Sharing",      "steps": ["Think of someone who makes you feel good", "Picture their face smiling at you", "Send them a warm, happy thought", "Notice how your body feels lighter"]},
     ]},
    {"key": "sad",        "label": "Sad",         "color_hex": "#5B8DEF",
     "regulation_message": "Your body may be asking for gentle care and rest.",
     "level2": [
        {"label": "Lonely",       "level3": ["Isolated", "Abandoned"]},
        {"label": "Hurt",         "level3": ["Disappointed", "Embarrassed"]},
        {"label": "Hopeless",     "level3": ["Empty", "Powerless"]},
     ],
     "regulation_activities": [
        {"title": "Comfort Breathing",  "steps": ["Put one hand on your heart", "Breathe in slowly... 1, 2, 3, 4", "Hold gently... 1, 2, 3, 4", "Breathe out softly... 1, 2, 3, 4, 5, 6", "Repeat, feeling the warmth of your hand"]},
        {"title": "Gentle Self-Hug",    "steps": ["Cross your arms and give yourself a hug", "Squeeze gently", "Rock softly side to side", "Whisper: \"I am okay, this feeling will pass\""]},
     ]},
    {"key": "angry",      "label": "Angry",       "color_hex": "#FF3B30",
     "regulation_message": "Your body may be protecting a boundary, need, value, or hurt.",
     "level2": [
        {"label": "Frustrated", "level3": ["Annoyed", "Irritated"]},
        {"label": "Hurt",       "level3": ["Betrayed", "Resentful"]},
        {"label": "Threatened", "level3": ["Defensive", "Provoked"]},
     ],
     "regulation_activities": [
        {"title": "Cool Down Breathing", "steps": ["Breathe in through your nose slowly", "Imagine cool, blue air flowing in", "Breathe out through your mouth like blowing through a straw", "Feel the heat leaving your body", "Repeat 5 times"]},
        {"title": "Tension Release",     "steps": ["Unclench your jaw and hands", "Step back before responding", "Squeeze both fists as tight as you can", "Now slowly open your hands wide", "Shake them out gently"]},
     ]},
    {"key": "fearful",    "label": "Fearful",     "color_hex": "#FF8C3F",
     "regulation_message": "Your body may be looking for safety. Let's help it feel safe again.",
     "level2": [
        {"label": "Anxious",   "level3": ["Worried", "Overwhelmed"]},
        {"label": "Scared",    "level3": ["Terrified", "Helpless"]},
        {"label": "Insecure",  "level3": ["Inadequate", "Inferior"]},
     ],
     "regulation_activities": [
        {"title": "5-4-3-2-1 Grounding", "steps": ["Name 5 things you can SEE right now", "Name 4 things you can TOUCH", "Name 3 things you can HEAR", "Name 2 things you can SMELL", "Name 1 thing you can TASTE"]},
        {"title": "Safe Place",          "steps": ["Close your eyes", "Picture the safest, coziest place you know", "What colors do you see there?", "What sounds do you hear?", "Stay there for a moment. You are safe."]},
     ]},
    {"key": "disgusted",  "label": "Disgusted",   "color_hex": "#8B8FA0",
     "regulation_message": "Your body may be telling you something feels off — let's clear the air.",
     "level2": [
        {"label": "Repelled",      "level3": ["Hesitant", "Horrified"]},
        {"label": "Disappointed",  "level3": ["Appalled", "Revolted"]},
     ],
     "regulation_activities": [
        {"title": "Fresh Air Reset", "steps": ["Take a big, deep breath in", "Imagine breathing in fresh mountain air", "Breathe out slowly, pushing away what bothers you", "Repeat 3 more times", "Feel the freshness fill your lungs"]},
        {"title": "Boundary Reset",  "steps": ["Name what feels unwelcome", "Take 3 slow breaths", "Picture pushing it gently away", "Notice what feels okay again"]},
     ]},
    {"key": "bad",        "label": "Bad",         "color_hex": "#86EFAC",
     "regulation_message": "Your body may be overloaded — let's lighten the weight.",
     "level2": [
        {"label": "Tired",       "level3": ["Sleepy", "Unfocused"]},
        {"label": "Stressed",    "level3": ["Overwhelmed", "Out of control"]},
        {"label": "Bored",       "level3": ["Indifferent", "Apathetic"]},
     ],
     "regulation_activities": [
        {"title": "Self-Compassion", "steps": ["Place your hand on your heart", "Feel your heartbeat — it is strong", "Say: \"It is okay to feel this way\"", "Say: \"I am doing my best\"", "Take one more slow breath"]},
        {"title": "Body Scan",       "steps": ["Start at the top of your head", "Slowly notice each part of your body", "If you find tension, breathe into it", "Let it soften with each exhale", "End at your toes, feeling more relaxed"]},
     ]},
    {"key": "surprised",  "label": "Surprised",   "color_hex": "#A78BFA",
     "regulation_message": "Your body may need a moment to settle and orient.",
     "level2": [
        {"label": "Startled", "level3": ["Shocked", "Dismayed"]},
        {"label": "Excited",  "level3": ["Eager", "Energetic"]},
     ],
     "regulation_activities": [
        {"title": "Grounding Touch", "steps": ["Press your feet firmly into the floor", "Feel the solid ground underneath you", "Press your palms together in front of your chest", "Take 3 slow breaths", "You are here. You are present."]},
        {"title": "Orient & Breathe", "steps": ["Look slowly around the room", "Name 3 colors you see", "Take a slow breath in", "Long exhale out", "Settle into where you are now"]},
     ]},
]


async def seed_checkin_content():
    # Default seed for body parts (only when collection is empty)
    if await db.checkin_body_parts.count_documents({}) == 0:
        await db.checkin_body_parts.insert_many([{
            "body_part_id": f"bp_{uuid.uuid4().hex[:10]}",
            "name": n, "slug": s, "position_x": x, "position_y": y,
            "sensations": sens, "order": i,
            "question_text": f"What do you notice in your {n.lower()} area?",
            "reflection_template": "The [sensation] in your [body_part] often shows up when you're feeling [emotion]. Your body is sharing something — pause and listen with kindness.",
            "sensation_emotion_map": _DEFAULT_SENSATION_EMOTION_MAP_FOR.get(s, {}),
            "default_emotion_key": _DEFAULT_BODY_EMOTION.get(s, "bad"),
            "active": True, "created_at": _now(), "updated_at": _now(),
        } for i, (n, s, x, y, sens) in enumerate(DEFAULT_BODY_PARTS)])
    if await db.checkin_emotion_families.count_documents({}) == 0:
        await db.checkin_emotion_families.insert_many([{
            "emotion_id": f"em_{uuid.uuid4().hex[:10]}",
            **e, "order": i, "active": True,
            "created_at": _now(), "updated_at": _now(),
        } for i, e in enumerate(DEFAULT_EMOTIONS)])

    # Backfill new fields on existing docs (idempotent)
    # Re-calibrate legacy positions ONLY if they still match a previously-seeded
    # default (so admin-customised positions are preserved). Includes both the
    # original Phase-J coordinates and the Phase-L coordinates.
    LEGACY_POSITIONS = {
        # Phase-J originals + Phase-L + Phase-Z2 (pre-anatomical-fix)
        "head": [(52, 11), (50, 8), (50, 5)],
        "eyes_face": [(50, 17), (50, 10), (50, 11)],
        "jaw_mouth": [(50, 21), (50, 13), (50, 14)],
        "throat": [(50, 24), (50, 16), (50, 17)],
        "chest": [(48, 32), (50, 24)],
        "shoulders_neck": [(30, 26), (35, 19)],
        "stomach": [(52, 44), (50, 42)],
        "back": [(70, 36), (64, 30)],
        "arms_hands": [(25, 44), (27, 57)],
        "legs_feet": [(45, 78), (50, 90)],
        "skin_whole_body": [(76, 56), (82, 52)],
        "whole_body_energy": [(24, 56), (18, 52)],
    }
    CALIBRATED = {n[1]: (n[2], n[3]) for n in [(t[0], t[1], t[2], t[3]) for t in DEFAULT_BODY_PARTS]}

    async for bp in db.checkin_body_parts.find({}, {"slug": 1, "name": 1, "question_text": 1, "reflection_template": 1, "sensation_emotion_map": 1, "default_emotion_key": 1, "position_x": 1, "position_y": 1}):
        patch = {}
        slug = bp.get("slug", "")
        name = bp.get("name", "")
        if not bp.get("question_text"):
            patch["question_text"] = f"What do you notice in your {name.lower()} area?"
        # Set or migrate the reflection template:
        #  • If missing → seed with the new emotion-linking template.
        #  • If still matches the legacy broken pattern ("Your <X> feeling
        #    [sensation] may be telling you something about your [emotion].")
        #    → upgrade to the new one. Admin-customised templates are left
        #    untouched.
        new_template = (
            "The [sensation] in your [body_part] often shows up when you're "
            "feeling [emotion]. Your body is sharing something — pause and "
            "listen with kindness."
        )
        legacy_template = (
            f"Your {name.lower()} feeling [sensation] may be telling you "
            f"something about your [emotion]."
        )
        current_tpl = (bp.get("reflection_template") or "").strip()
        if not current_tpl:
            patch["reflection_template"] = new_template
        elif current_tpl == legacy_template.strip():
            patch["reflection_template"] = new_template
        if bp.get("sensation_emotion_map") in (None, {}):
            patch["sensation_emotion_map"] = _DEFAULT_SENSATION_EMOTION_MAP_FOR.get(slug, {})
        if not bp.get("default_emotion_key"):
            patch["default_emotion_key"] = _DEFAULT_BODY_EMOTION.get(slug, "bad")
        # Re-calibrate anatomically wrong legacy positions
        cx, cy = bp.get("position_x"), bp.get("position_y")
        if slug in LEGACY_POSITIONS and slug in CALIBRATED:
            for lx, ly in LEGACY_POSITIONS[slug]:
                if cx is not None and cy is not None and abs(float(cx) - lx) < 0.5 and abs(float(cy) - ly) < 0.5:
                    nx, ny = CALIBRATED[slug]
                    if (nx, ny) != (float(cx), float(cy)):
                        patch["position_x"] = nx
                        patch["position_y"] = ny
                    break
        if patch:
            patch["updated_at"] = _now()
            await db.checkin_body_parts.update_one({"_id": bp["_id"]}, {"$set": patch})


# Default sensation→emotion mappings used at seed/backfill time so the 12 stock
# zones come pre-wired and patient flows never crash for a fresh database.
_DEFAULT_BODY_EMOTION = {
    "head": "fearful", "eyes_face": "sad", "jaw_mouth": "angry", "throat": "fearful",
    "chest": "fearful", "shoulders_neck": "angry", "stomach": "fearful", "back": "bad",
    "arms_hands": "fearful", "legs_feet": "fearful", "skin_whole_body": "disgusted",
    "whole_body_energy": "sad",
}

_DEFAULT_SENSATION_EMOTION_MAP_FOR = {
    "head":             {"Racing thoughts": "fearful", "Pressure": "bad", "Headache": "bad", "Foggy": "sad", "Dizzy/lightheaded": "surprised", "Heavy": "sad", "Clear": "happy", "Busy": "bad", "Overloaded": "fearful", "Blank/numb": "sad"},
    "eyes_face":        {"Tears welling": "sad", "Tight jaw": "angry", "Watery eyes": "sad", "Flushed": "angry", "Tingling": "surprised", "Frowning": "angry", "Relaxed face": "happy"},
    "jaw_mouth":        {"Clenched jaw": "angry", "Grinding teeth": "angry", "Dry mouth": "fearful", "Tight throat": "fearful", "Bitter taste": "disgusted"},
    "throat":           {"Tight": "fearful", "Lump": "sad", "Choked": "fearful", "Difficulty swallowing": "fearful", "Open": "happy"},
    "chest":            {"Tight chest": "fearful", "Heart racing": "fearful", "Fluttering": "surprised", "Heavy": "sad", "Warm": "happy", "Breathless": "fearful", "Calm": "happy"},
    "shoulders_neck":   {"Tight shoulders": "angry", "Knot in neck": "angry", "Hunched": "sad", "Heavy": "sad", "Loose": "happy"},
    "stomach":          {"Butterflies": "fearful", "Knot": "fearful", "Nausea": "disgusted", "Hunger": "bad", "Heavy": "sad", "Empty": "sad", "Settled": "happy"},
    "back":             {"Stiff": "angry", "Aching": "bad", "Heavy": "sad", "Tight": "angry", "Loose": "happy"},
    "arms_hands":       {"Trembling": "fearful", "Tingling": "surprised", "Clenched fists": "angry", "Numb": "sad", "Warm": "happy", "Cold": "sad"},
    "legs_feet":        {"Restless": "fearful", "Heavy": "sad", "Tingling": "surprised", "Weak": "sad", "Grounded": "happy"},
    "skin_whole_body":  {"Hot": "angry", "Cold": "sad", "Sweaty": "fearful", "Goosebumps": "surprised", "Tingling": "surprised", "Numb": "sad"},
    "whole_body_energy":{"Drained": "sad", "Energised": "happy", "Heavy": "sad", "Light": "happy", "Restless": "fearful", "Calm": "happy"},
}


# ─── Pydantic models ───
class QuestionItem(BaseModel):
    id: Optional[str] = None
    text: str
    type: str = "yes_no"  # yes_no | multiple_choice | long_answer | scale
    options: List[str] = []
    required: bool = False


class BodyPartIn(BaseModel):
    name: str
    slug: Optional[str] = None
    position_x: float = 50
    position_y: float = 50
    sensations: List[str] = []
    # NEW (Phase L — admin → patient assessment binding)
    question_text: Optional[str] = ""
    reflection_template: Optional[str] = ""
    sensation_emotion_map: Dict[str, str] = {}  # { sensation_name: emotion_family_key }
    default_emotion_key: Optional[str] = ""    # fallback family when no sensation match
    # NEW (Phase M — multi-question support)
    questions: List[QuestionItem] = []
    order: Optional[int] = 0
    active: bool = True


class Level2Item(BaseModel):
    label: str
    level3: List[str] = []


class RegActivity(BaseModel):
    title: str
    steps: List[str]


class EmotionFamilyIn(BaseModel):
    key: str
    label: str
    color_hex: str = "#FFD23F"
    regulation_message: str = ""
    level2: List[Level2Item] = []
    regulation_activities: List[RegActivity] = []
    # NEW (Phase M — multi-question support)
    questions: List[QuestionItem] = []
    order: Optional[int] = 0
    active: bool = True


# ─── Admin auth helper ───
async def _admin(request: Request):
    from admin_auth import get_current_admin
    return await get_current_admin(request, db)


# ─── Public endpoints (patient app) ───
@checkin_router.get("/checkin/body-parts")
async def public_body_parts():
    items = await db.checkin_body_parts.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    return {"body_parts": items}


@checkin_router.get("/checkin/emotion-families")
async def public_emotion_families():
    items = await db.checkin_emotion_families.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    return {"families": items}


# ─── Active assessment configuration (Phase L) ───
# Single endpoint the Patient Daily Check-in pulls for Step 1 & Step 2.
# Aggregates active body parts + emotion families + a flattened
# sensation → emotion family lookup so the patient app can dynamically map
# every checkbox to the correct color/emotion on the Feelings Wheel.
@checkin_router.get("/assessments/active")
async def active_assessment_config():
    body_parts = await db.checkin_body_parts.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    families = await db.checkin_emotion_families.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    valid_keys = {f["key"] for f in families}

    # Flatten admin-set per-body-part maps; later parts override earlier
    sensation_emotion_map = {}
    for bp in body_parts:
        for sens, emo in (bp.get("sensation_emotion_map") or {}).items():
            if emo in valid_keys:
                sensation_emotion_map[sens] = emo

    # Auto-soften any text fields on the way out so the patient never sees diagnostic phrasing,
    # even if a legacy record slipped through compliance validation.
    for bp in body_parts:
        if bp.get("question_text"):
            bp["question_text"] = compliance_soften(bp["question_text"])
        if bp.get("reflection_template"):
            bp["reflection_template"] = compliance_soften(bp["reflection_template"])
    for f in families:
        if f.get("regulation_message"):
            f["regulation_message"] = compliance_soften(f["regulation_message"])

    return {
        "body_parts": body_parts,
        "families": families,
        "sensation_emotion_map": sensation_emotion_map,
        "generated_at": _now(),
    }


# Admin previews compliance impact on arbitrary text before saving (no DB write)
class CompliancePreviewIn(BaseModel):
    text: str


@checkin_router.post("/admin/checkin/compliance-check")
async def admin_compliance_check(payload: CompliancePreviewIn, request: Request):
    await _admin(request)
    warnings = compliance_check(payload.text or "")
    return {
        "safe": len(warnings) == 0,
        "warnings": warnings,
        "softened": compliance_soften(payload.text or ""),
    }


# ─── Admin endpoints — Body Parts ───
@checkin_router.get("/admin/checkin/body-parts")
async def admin_list_body_parts(request: Request):
    await _admin(request)
    items = await db.checkin_body_parts.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return {"body_parts": items}


@checkin_router.post("/admin/checkin/body-parts")
async def admin_create_body_part(payload: BodyPartIn, request: Request):
    await _admin(request)
    doc = payload.dict()
    _enforce_compliance(doc, ["question_text", "reflection_template"])
    _enforce_question_compliance(doc.get("questions") or [])
    _assign_question_ids(doc.get("questions") or [])
    doc["body_part_id"] = f"bp_{uuid.uuid4().hex[:10]}"
    doc["slug"] = doc.get("slug") or doc["name"].lower().replace(" ", "_").replace("/", "_")
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    await db.checkin_body_parts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@checkin_router.patch("/admin/checkin/body-parts/{body_part_id}")
async def admin_update_body_part(body_part_id: str, payload: BodyPartIn, request: Request):
    await _admin(request)
    upd = payload.dict()
    _enforce_compliance(upd, ["question_text", "reflection_template"])
    _enforce_question_compliance(upd.get("questions") or [])
    _assign_question_ids(upd.get("questions") or [])
    upd["updated_at"] = _now()
    r = await db.checkin_body_parts.update_one({"body_part_id": body_part_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Body part not found")
    return {"ok": True}


@checkin_router.delete("/admin/checkin/body-parts/{body_part_id}")
async def admin_delete_body_part(body_part_id: str, request: Request):
    await _admin(request)
    r = await db.checkin_body_parts.delete_one({"body_part_id": body_part_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Body part not found")
    return {"ok": True}


# ─── Admin endpoints — Emotion Families ───
@checkin_router.get("/admin/checkin/emotion-families")
async def admin_list_emotions(request: Request):
    await _admin(request)
    items = await db.checkin_emotion_families.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return {"families": items}


@checkin_router.post("/admin/checkin/emotion-families")
async def admin_create_emotion(payload: EmotionFamilyIn, request: Request):
    await _admin(request)
    doc = payload.dict()
    _enforce_compliance(doc, ["regulation_message"])
    _enforce_question_compliance(doc.get("questions") or [])
    _assign_question_ids(doc.get("questions") or [])
    doc["emotion_id"] = f"em_{uuid.uuid4().hex[:10]}"
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    await db.checkin_emotion_families.insert_one(doc)
    doc.pop("_id", None)
    return doc


@checkin_router.patch("/admin/checkin/emotion-families/{emotion_id}")
async def admin_update_emotion(emotion_id: str, payload: EmotionFamilyIn, request: Request):
    await _admin(request)
    upd = payload.dict()
    _enforce_compliance(upd, ["regulation_message"])
    _enforce_question_compliance(upd.get("questions") or [])
    _assign_question_ids(upd.get("questions") or [])
    upd["updated_at"] = _now()
    r = await db.checkin_emotion_families.update_one({"emotion_id": emotion_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Emotion not found")
    return {"ok": True}


@checkin_router.delete("/admin/checkin/emotion-families/{emotion_id}")
async def admin_delete_emotion(emotion_id: str, request: Request):
    await _admin(request)
    r = await db.checkin_emotion_families.delete_one({"emotion_id": emotion_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Emotion not found")
    return {"ok": True}
