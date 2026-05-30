"""Phase L tests — admin assessment page is the dynamic engine for the patient Daily Check-in.
Covers:
 - GET /api/assessments/active aggregate endpoint
 - Compliance guardrail (POST/PATCH body-parts & emotion-families)
 - POST /api/admin/checkin/compliance-check
 - Backfill of new body-part fields (question_text, reflection_template, sensation_emotion_map, default_emotion_key)
 - Happy path body-part create→patch→appears-in-active→delete
 - Public endpoints unchanged
"""
import os
import uuid
import pytest
import requests

def _backend_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except FileNotFoundError:
            pass
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")


BASE_URL = _backend_url()
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASS = "Admin@123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


# ────────── /api/assessments/active aggregate ──────────
class TestAssessmentsActive:
    def test_active_returns_aggregate_shape(self):
        r = requests.get(f"{BASE_URL}/api/assessments/active", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("body_parts", "families", "sensation_emotion_map", "generated_at"):
            assert key in data, f"missing key {key}"
        assert isinstance(data["body_parts"], list)
        assert isinstance(data["families"], list)
        assert isinstance(data["sensation_emotion_map"], dict)
        assert len(data["body_parts"]) >= 12
        assert len(data["families"]) >= 7

    def test_active_sensation_map_size_and_validity(self):
        data = requests.get(f"{BASE_URL}/api/assessments/active", timeout=20).json()
        sem = data["sensation_emotion_map"]
        # Spec requires > 50 sensations bound
        assert len(sem) > 50, f"sensation_emotion_map should have > 50 entries, got {len(sem)}"
        valid_keys = {f["key"] for f in data["families"]}
        for sens, emo in sem.items():
            assert emo in valid_keys, f"sensation '{sens}' bound to invalid family.key '{emo}'"

    def test_active_body_parts_have_phase_l_fields(self):
        data = requests.get(f"{BASE_URL}/api/assessments/active", timeout=20).json()
        for bp in data["body_parts"]:
            for k in ("question_text", "reflection_template", "sensation_emotion_map", "default_emotion_key"):
                assert k in bp, f"body part {bp.get('slug')} missing {k}"
            assert bp["question_text"], f"question_text empty for {bp.get('slug')}"
            assert bp["reflection_template"], f"reflection_template empty for {bp.get('slug')}"
            assert isinstance(bp["sensation_emotion_map"], dict)
            assert bp["default_emotion_key"], f"default_emotion_key empty for {bp.get('slug')}"


# ────────── Compliance preview endpoint ──────────
class TestCompliancePreviewEndpoint:
    def test_preview_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/checkin/compliance-check",
                          json={"text": "anything"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_preview_diagnostic_unsafe(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/compliance-check",
                               json={"text": "This proves you have depression"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["safe"] is False
        assert isinstance(data["warnings"], list) and len(data["warnings"]) >= 1
        assert isinstance(data["softened"], str) and len(data["softened"]) > 0
        # Softened text should no longer contain "this proves"
        assert "this proves" not in data["softened"].lower()

    def test_preview_safe_text(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/compliance-check",
                               json={"text": "Your body may be telling you something"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["safe"] is True
        assert data["warnings"] == []


# ────────── Compliance guardrail on POST/PATCH body-parts ──────────
class TestBodyPartsCompliance:
    def test_create_rejects_diagnostic_question(self, admin_session):
        payload = {
            "name": f"TEST_ncompl_{uuid.uuid4().hex[:6]}",
            "question_text": "This proves you have anxiety",
            "reflection_template": "Your [sensation] may be telling you about your [emotion]",
            "sensations": ["Tingling"],
            "sensation_emotion_map": {"Tingling": "surprised"},
            "default_emotion_key": "fearful",
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json=payload, timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"
        body = r.json()
        detail = body.get("detail", body)
        assert detail.get("error") == "non_compliant_language", detail
        offending = detail.get("offending_phrases", {})
        assert "question_text" in offending
        joined = " ".join(offending["question_text"]).lower()
        assert "this proves" in joined
        assert "you have anxiety" in joined

    def test_patch_rejects_diagnostic_reflection(self, admin_session):
        # Create a clean one first
        unique = uuid.uuid4().hex[:6]
        clean = {
            "name": f"TEST_clean_{unique}",
            "question_text": "What do you notice in your test area?",
            "reflection_template": "Your [sensation] may be telling you about your [emotion]",
            "sensations": ["Warm"],
            "sensation_emotion_map": {"Warm": "happy"},
            "default_emotion_key": "happy",
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json=clean, timeout=15)
        assert r.status_code in (200, 201), r.text
        bp_id = r.json()["body_part_id"]

        try:
            # PATCH with bad reflection
            bad = {**clean, "reflection_template": "This proves you have depression"}
            r = admin_session.patch(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}",
                                    json=bad, timeout=15)
            assert r.status_code == 400, r.text
            detail = r.json().get("detail", {})
            assert detail.get("error") == "non_compliant_language"
            assert "reflection_template" in detail.get("offending_phrases", {})
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}", timeout=15)


# ────────── Compliance guardrail on POST/PATCH emotion-families ──────────
class TestEmotionFamiliesCompliance:
    def test_create_rejects_diagnostic_regulation_message(self, admin_session):
        payload = {
            "key": f"test_bad_{uuid.uuid4().hex[:6]}",
            "label": "Bad Emo",
            "color_hex": "#112233",
            "regulation_message": "You have depression — this proves it",
            "level2": [{"label": "x", "level3": ["a"]}],
            "regulation_activities": [{"title": "t", "steps": ["s"]}],
            "order": 99,
            "active": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/emotion-families",
                               json=payload, timeout=15)
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", {})
        assert detail.get("error") == "non_compliant_language"
        assert "regulation_message" in detail.get("offending_phrases", {})


# ────────── Happy path: body-part with all new fields ──────────
class TestBodyPartHappyPath:
    def test_full_roundtrip_appears_in_active(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_happy_{unique}",
            "question_text": "What do you notice in your stomach?",
            "reflection_template": "Your [sensation] may be telling you about your [emotion]",
            "sensations": ["Butterflies", "Knot"],
            "sensation_emotion_map": {"Butterflies": "fearful", "Knot": "fearful"},
            "default_emotion_key": "fearful",
            "position_x": 50,
            "position_y": 50,
            "order": 50,
            "active": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        bp_id = created["body_part_id"]
        assert created["question_text"] == payload["question_text"]
        assert created["reflection_template"] == payload["reflection_template"]
        assert created["default_emotion_key"] == "fearful"
        assert created["sensation_emotion_map"]["Butterflies"] == "fearful"

        try:
            # PATCH (update question_text safely)
            upd = {**payload, "question_text": "What do you notice in your stomach right now?"}
            r = admin_session.patch(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}",
                                    json=upd, timeout=15)
            assert r.status_code == 200, r.text

            # Confirm it appears in /api/assessments/active sensation map
            active = requests.get(f"{BASE_URL}/api/assessments/active", timeout=15).json()
            # Butterflies should be mapped to 'fearful'
            assert active["sensation_emotion_map"].get("Butterflies") == "fearful"
            # New body part visible
            assert any(b["body_part_id"] == bp_id for b in active["body_parts"])
        finally:
            r = admin_session.delete(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}", timeout=15)
            assert r.status_code == 200
            # Confirm removed from active
            active = requests.get(f"{BASE_URL}/api/assessments/active", timeout=15).json()
            assert not any(b["body_part_id"] == bp_id for b in active["body_parts"])


# ────────── Public endpoints still working ──────────
class TestPublicEndpointsStillWork:
    def test_public_body_parts(self):
        r = requests.get(f"{BASE_URL}/api/checkin/body-parts", timeout=15)
        assert r.status_code == 200
        assert len(r.json().get("body_parts", [])) >= 12

    def test_public_emotion_families(self):
        r = requests.get(f"{BASE_URL}/api/checkin/emotion-families", timeout=15)
        assert r.status_code == 200
        assert len(r.json().get("families", [])) >= 7
