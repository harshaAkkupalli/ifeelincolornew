"""Phase M tests — multi-question editor on body parts AND emotion families.

Verifies:
- POST/PATCH /api/admin/checkin/body-parts with `questions` array
- POST/PATCH /api/admin/checkin/emotion-families with `questions` array
- Each question gets a stable `id` (q_xxxx) auto-assigned
- Diagnostic phrasing in question text returns 400 with offending_phrases
- GET /api/assessments/active surfaces questions on body_parts AND families
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASS = "Admin@123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


# ────────── Body Part questions ──────────
class TestBodyPartQuestions:
    def test_create_body_part_with_multi_questions_assigns_ids(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_zone_q_{unique}",
            "position_x": 30,
            "position_y": 30,
            "sensations": ["Tight"],
            "active": True,
            "questions": [
                {"text": "Do you notice tightness here?", "type": "yes_no", "required": True},
                {"text": "Rate the intensity", "type": "scale", "required": False},
                {"text": "Describe in your own words", "type": "long_answer"},
                {"text": "Which best describes it?", "type": "multiple_choice", "options": ["Dull", "Sharp"]},
            ],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        bp_id = created["body_part_id"]
        assert len(created["questions"]) == 4
        ids = [q["id"] for q in created["questions"]]
        assert all(qid and qid.startswith("q_") for qid in ids)
        assert len(set(ids)) == 4  # all unique

        # Re-GET from admin listing → questions persist with ids
        listed = admin_session.get(f"{BASE_URL}/api/admin/checkin/body-parts", timeout=15).json()["body_parts"]
        found = next(b for b in listed if b["body_part_id"] == bp_id)
        assert len(found["questions"]) == 4
        assert {q["id"] for q in found["questions"]} == set(ids)

        # /api/assessments/active surfaces them
        active = requests.get(f"{BASE_URL}/api/assessments/active", timeout=15).json()
        bp_in_active = next((b for b in active["body_parts"] if b["body_part_id"] == bp_id), None)
        assert bp_in_active is not None
        assert len(bp_in_active.get("questions") or []) == 4
        types = {q["type"] for q in bp_in_active["questions"]}
        assert {"yes_no", "scale", "long_answer", "multiple_choice"}.issubset(types)

        # cleanup
        admin_session.delete(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}", timeout=15)

    def test_create_body_part_rejects_diagnostic_question(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_bad_q_{unique}",
            "active": True,
            "questions": [
                {"text": "This proves you have anxiety, right?", "type": "yes_no"},
            ],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json=payload, timeout=15)
        assert r.status_code == 400, r.text
        detail = r.json()["detail"]
        assert detail["error"] == "non_compliant_language"
        assert "questions[0].text" in detail["offending_phrases"]

    def test_patch_body_part_questions_round_trip(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        # Create empty
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json={"name": f"TEST_patch_{unique}", "active": True},
                               timeout=15)
        bp_id = r.json()["body_part_id"]

        # Patch with questions
        upd = {
            "name": f"TEST_patch_{unique}",
            "active": True,
            "questions": [
                {"text": "Where exactly do you feel it?", "type": "long_answer", "required": True},
                {"text": "On a 1-10 scale, how strong?", "type": "scale", "required": False},
            ],
        }
        r = admin_session.patch(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}",
                                json=upd, timeout=15)
        assert r.status_code == 200, r.text

        # Verify persistence
        listed = admin_session.get(f"{BASE_URL}/api/admin/checkin/body-parts", timeout=15).json()["body_parts"]
        found = next(b for b in listed if b["body_part_id"] == bp_id)
        assert len(found["questions"]) == 2
        assert all(q["id"].startswith("q_") for q in found["questions"])
        assert found["questions"][0]["required"] is True

        admin_session.delete(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}", timeout=15)


# ────────── Emotion Family questions ──────────
class TestEmotionFamilyQuestions:
    def test_create_emotion_family_with_questions_assigns_ids(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        key = f"test_emo_q_{unique}"
        payload = {
            "key": key,
            "label": f"TEST emo {unique}",
            "color_hex": "#a1b2c3",
            "regulation_message": "Take a deep breath",
            "level2": [{"label": "Mild", "level3": ["A"]}],
            "regulation_activities": [{"title": "Box breath", "steps": ["in", "hold", "out"]}],
            "active": True,
            "questions": [
                {"text": "What might be underneath this feeling?", "type": "long_answer", "required": True},
                {"text": "Is this familiar to you?", "type": "yes_no"},
            ],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/emotion-families",
                               json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        em_id = created["emotion_id"]
        assert len(created["questions"]) == 2
        ids = [q["id"] for q in created["questions"]]
        assert all(qid and qid.startswith("q_") for qid in ids)

        # Active config surfaces them
        active = requests.get(f"{BASE_URL}/api/assessments/active", timeout=15).json()
        fam = next((f for f in active["families"] if f["key"] == key), None)
        assert fam is not None
        assert len(fam.get("questions") or []) == 2

        admin_session.delete(f"{BASE_URL}/api/admin/checkin/emotion-families/{em_id}", timeout=15)

    def test_create_emotion_family_rejects_diagnostic_question(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        payload = {
            "key": f"bad_emo_q_{unique}",
            "label": f"TEST bad q {unique}",
            "color_hex": "#000000",
            "regulation_message": "ok",
            "level2": [{"label": "x", "level3": []}],
            "regulation_activities": [{"title": "x", "steps": ["a"]}],
            "active": True,
            "questions": [
                {"text": "You have depression — do you agree?", "type": "yes_no"},
            ],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/emotion-families",
                               json=payload, timeout=15)
        assert r.status_code == 400, r.text
        detail = r.json()["detail"]
        assert detail["error"] == "non_compliant_language"
        assert "questions[0].text" in detail["offending_phrases"]

    def test_patch_emotion_family_questions_round_trip(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        key = f"test_emo_patch_{unique}"
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/emotion-families",
                               json={
                                   "key": key,
                                   "label": "tmp",
                                   "color_hex": "#aabbcc",
                                   "regulation_message": "ok",
                                   "level2": [{"label": "x", "level3": []}],
                                   "regulation_activities": [{"title": "x", "steps": ["a"]}],
                                   "active": True,
                               }, timeout=15)
        assert r.status_code in (200, 201), r.text
        em_id = r.json()["emotion_id"]

        upd = {
            "key": key,
            "label": "tmp updated",
            "color_hex": "#aabbcc",
            "regulation_message": "ok",
            "level2": [{"label": "x", "level3": []}],
            "regulation_activities": [{"title": "x", "steps": ["a"]}],
            "active": True,
            "questions": [
                {"text": "What sensation is loudest right now?", "type": "long_answer"},
                {"text": "Rate intensity", "type": "scale", "required": True},
                {"text": "Choose one", "type": "multiple_choice", "options": ["A", "B", "C"]},
            ],
        }
        r = admin_session.patch(f"{BASE_URL}/api/admin/checkin/emotion-families/{em_id}",
                                json=upd, timeout=15)
        assert r.status_code == 200, r.text

        fams = admin_session.get(f"{BASE_URL}/api/admin/checkin/emotion-families", timeout=15).json()["families"]
        found = next(f for f in fams if f["emotion_id"] == em_id)
        assert len(found["questions"]) == 3
        assert all(q["id"].startswith("q_") for q in found["questions"])

        admin_session.delete(f"{BASE_URL}/api/admin/checkin/emotion-families/{em_id}", timeout=15)


# ────────── Smoke ──────────
class TestAssessmentsActiveShape:
    def test_assessments_active_includes_questions_field(self):
        r = requests.get(f"{BASE_URL}/api/assessments/active", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "body_parts" in data and "families" in data
        # `questions` field may be absent on legacy seeded records; when present must be a list.
        for bp in data["body_parts"]:
            q = bp.get("questions", [])
            assert isinstance(q, list), f"body_part {bp.get('name')} questions must be list"
        for f in data["families"]:
            q = f.get("questions", [])
            assert isinstance(q, list), f"family {f.get('key')} questions must be list"
