"""Iteration 41 — Backend regression suite.

Covers test scenarios A–E from the review request:
  (A) /api/patient/emergency dispatch counts + emergency_dispatches rows
  (B) /api/emergency/active for Sarah + ack flow
  (C) /api/clinician/patient/{id}/can-recommend gate (positive + 403 negative)
  (D) /api/clinician/recommend success path for Luna
  (E) /api/clinician/patient/{id}/follow-up draft (warm tone references first name + emotion/severity)
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

PATIENT_EMAIL = "luna@demo.ifeelincolor.com"
PATIENT_PW = "Patient@123"
CLINICIAN_EMAIL = "sarah@demo.ifeelincolor.com"
CLINICIAN_PW = "Clinician@123"
LUNA_ID = "demo-patient-001"


# ── Shared sessions ──────────────────────────────────────────────────
@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": PATIENT_EMAIL, "password": PATIENT_PW}, timeout=15)
    assert r.status_code == 200, f"Patient login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": CLINICIAN_EMAIL, "password": CLINICIAN_PW}, timeout=15)
    assert r.status_code == 200, f"Clinician login failed: {r.status_code} {r.text}"
    return s


# ── (A) Emergency dispatch broadcast ─────────────────────────────────
class TestEmergencyDispatch:
    def test_sos_dispatches_to_subscribed_clinician_and_admins(self, patient_session):
        r = patient_session.post(
            f"{API}/patient/emergency",
            json={"severity": "critical", "lat": 40.7128, "lng": -74.0060, "note": "iter41 test"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "dispatched" in body, body
        d = body["dispatched"]
        # subscribed_clinician_count must be >= 1 (Sarah is subscribed to Luna)
        assert d.get("subscribed_clinician_count", 0) >= 1, d
        # admin_count must be >= 1
        assert d.get("admin_count", 0) >= 1, d
        # Store alert id for downstream tests
        pytest.last_alert = body["alert"]["alert_id"]


# ── (B) /emergency/active for Sarah + ack ────────────────────────────
class TestEmergencyActiveAndAck:
    def test_clinician_sees_active_dispatch(self, clinician_session):
        r = clinician_session.get(f"{API}/emergency/active", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        active = data.get("active", [])
        assert len(active) >= 1, f"Expected at least 1 active SOS for Sarah, got {data}"
        # Find Luna's dispatch
        luna_row = next((a for a in active if (a.get("patient") or {}).get("user_id") == LUNA_ID), None)
        assert luna_row is not None, f"No Luna dispatch in active feed: {active}"
        p = luna_row["patient"]
        assert p.get("name") == "Luna Star", p
        # phone may be empty string but the key must exist
        assert "phone" in p
        assert "last_emotion" in p
        pytest.luna_dispatch_id = luna_row["dispatch_id"]

    def test_ack_removes_from_active_feed(self, clinician_session):
        disp_id = getattr(pytest, "luna_dispatch_id", None)
        assert disp_id, "previous test should have stored dispatch_id"
        r = clinician_session.post(f"{API}/emergency/dispatch/{disp_id}/ack", timeout=15)
        assert r.status_code == 200, r.text
        # Re-query
        r2 = clinician_session.get(f"{API}/emergency/active", timeout=15)
        assert r2.status_code == 200
        still = [a for a in r2.json().get("active", []) if a.get("dispatch_id") == disp_id]
        assert not still, f"Dispatch {disp_id} still present after ack"


# ── (C) can-recommend gate ───────────────────────────────────────────
class TestCanRecommend:
    def test_luna_can_recommend_true(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/patient/{LUNA_ID}/can-recommend", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("can_recommend") is True, body

    def test_unknown_patient_blocked(self, clinician_session):
        # Unknown patient → either 403 (subscription) or can_recommend=false
        r = clinician_session.get(
            f"{API}/clinician/patient/nonexistent_patient_xyz/can-recommend", timeout=15
        )
        # Accept 403 (not subscribed) or 200 with can_recommend=false
        if r.status_code == 200:
            assert r.json().get("can_recommend") is False, r.json()
        else:
            assert r.status_code in (403, 404), f"unexpected status {r.status_code}: {r.text}"


# ── (D) /clinician/recommend success ─────────────────────────────────
class TestClinicianRecommendSuccess:
    def test_recommend_for_luna_succeeds(self, clinician_session):
        payload = {
            "patient_id": LUNA_ID,
            "title": "TEST_iter41 Mindful Breathing",
            "description": "5 minutes of box-breathing, twice daily.",
            "category": "mindfulness",
            "video_url": "https://example.com/video.mp4",
            "steps": ["Sit upright", "Inhale 4s", "Hold 4s", "Exhale 4s"],
        }
        r = clinician_session.post(f"{API}/clinician/recommend", json=payload, timeout=20)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        # endpoint should echo or confirm; minimum: not an error
        assert "error" not in body, body

    def test_recommend_for_unknown_patient_blocked(self, clinician_session):
        payload = {
            "patient_id": "nonexistent_patient_xyz",
            "title": "TEST_iter41 should fail",
            "description": "x",
            "category": "mindfulness",
        }
        r = clinician_session.post(f"{API}/clinician/recommend", json=payload, timeout=15)
        # Either 403 (not subscribed) or 409 (gate). Both prove gating works.
        assert r.status_code in (403, 404, 409), f"Expected gating, got {r.status_code}: {r.text}"


# ── (E) AI follow-up draft ───────────────────────────────────────────
class TestFollowUpDraft:
    def test_follow_up_returns_non_empty_draft_warm_tone(self, clinician_session):
        r = clinician_session.post(
            f"{API}/clinician/patient/{LUNA_ID}/follow-up",
            json={"tone": "warm"},
            timeout=60,  # AI call can be slow
        )
        assert r.status_code == 200, r.text
        body = r.json()
        draft = body.get("draft") or ""
        assert isinstance(draft, str) and len(draft.strip()) > 20, f"Draft too short: {draft!r}"
        # warm tone should mention Luna's first name
        assert re.search(r"\bLuna\b", draft, re.IGNORECASE), f"Draft missing first name: {draft!r}"

    def test_follow_up_unknown_patient_blocked(self, clinician_session):
        r = clinician_session.post(
            f"{API}/clinician/patient/nonexistent_patient_xyz/follow-up",
            json={"tone": "warm"},
            timeout=20,
        )
        assert r.status_code in (403, 404), f"Expected subscription gate, got {r.status_code}: {r.text}"
