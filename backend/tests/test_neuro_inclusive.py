"""Iteration 32 — Backend tests for Neuro-Inclusive (Calm Mode) toggle.
Covers:
  B1 GET /api/patient/preferences default
  B2 POST /api/patient/preferences {low_stimulus_mode: true} persists
  B3 Toggle back to false persists
  B4 17-point check-in via POST /api/checkins succeeds and GETs back, with
     Calm Mode ON and OFF.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to local frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

PATIENT_EMAIL = "luna@demo.ifeelincolor.com"
PATIENT_PASSWORD = "Patient@123"


@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Try login → fallback demo-login
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD})
    if r.status_code != 200:
        r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "patient"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


def _seventeen_point_payload():
    today = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc).strftime("%H:%M")
    return {
        # 17 fields requested by the review (note: server model uses canonical
        # names like starting_body_part / deeper_feeling; we send both styles
        # to mimic frontend payload — extra fields are ignored by Pydantic).
        "date": today,
        "time": now,
        "session_id": f"sess_{uuid.uuid4().hex[:8]}",
        "body_parts": ["head", "chest"],
        "starting_body_part": "head",
        "starting_sensation": "tight",
        "starting_sensations": ["tight", "foggy"],
        "intensity_rating_before": 7,
        "user_selected_color": "blue",
        "user_selected_emotion": "calm",
        "level1_color": "blue",
        "level2_emotion": "calm",
        "level3_feeling": "settled",
        "deeper_feeling": "settled",
        "reflection_text": "Feeling more grounded after the breath orb.",
        "app_reflection_text": "Feeling more grounded after the breath orb.",
        "regulation_step": "breath_orb",
        "regulation_step_chosen": "breath_orb",
        "step_completed": True,
        "ending_color": "blue",
        "ending_emotion": "peaceful",
        "intensity_rating_after": 3,
    }


class TestPreferencesEndpoint:
    """B1, B2, B3"""

    def test_b1_default_preferences(self, patient_session):
        r = patient_session.get(f"{BASE_URL}/api/patient/preferences")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "low_stimulus_mode" in data
        assert "tts_enabled" in data
        # tts_enabled default True
        assert data["tts_enabled"] is True
        # If user has never toggled, low_stimulus_mode should be False
        # (but if prior test set it true, normalize first)
        patient_session.post(f"{BASE_URL}/api/patient/preferences",
                             json={"low_stimulus_mode": False})
        r2 = patient_session.get(f"{BASE_URL}/api/patient/preferences")
        assert r2.json()["low_stimulus_mode"] is False

    def test_b2_toggle_on_persists(self, patient_session):
        r = patient_session.post(f"{BASE_URL}/api/patient/preferences",
                                 json={"low_stimulus_mode": True})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        # Re-GET
        g = patient_session.get(f"{BASE_URL}/api/patient/preferences")
        assert g.status_code == 200
        assert g.json()["low_stimulus_mode"] is True

    def test_b3_toggle_off_persists(self, patient_session):
        r = patient_session.post(f"{BASE_URL}/api/patient/preferences",
                                 json={"low_stimulus_mode": False})
        assert r.status_code == 200
        assert r.json().get("ok") is True
        g = patient_session.get(f"{BASE_URL}/api/patient/preferences")
        assert g.json()["low_stimulus_mode"] is False


class TestCheckinWithCalmMode:
    """B4 — submit a check-in with Calm Mode ON and OFF, verify persistence."""

    def _submit(self, sess):
        payload = _seventeen_point_payload()
        r = sess.post(f"{BASE_URL}/api/checkins", json=payload)
        assert r.status_code in (200, 201), f"checkin failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("checkin_id"), "checkin_id missing"
        assert data.get("date") == payload["date"]
        assert data.get("user_selected_color") == "blue"
        assert data.get("intensity_rating_before") == 7
        assert data.get("intensity_rating_after") == 3
        return data["checkin_id"]

    def test_b4_calm_on_submit_and_get(self, patient_session):
        # Turn calm mode ON
        patient_session.post(f"{BASE_URL}/api/patient/preferences",
                             json={"low_stimulus_mode": True})
        cid = self._submit(patient_session)
        # Verify visible in GET /api/checkins
        g = patient_session.get(f"{BASE_URL}/api/checkins?limit=10")
        assert g.status_code == 200
        ids = [c.get("checkin_id") for c in g.json().get("checkins", [])]
        assert cid in ids, f"new checkin not visible in GET: {ids[:5]}"

    def test_b4_calm_off_submit_and_get(self, patient_session):
        # Turn calm mode OFF
        patient_session.post(f"{BASE_URL}/api/patient/preferences",
                             json={"low_stimulus_mode": False})
        cid = self._submit(patient_session)
        g = patient_session.get(f"{BASE_URL}/api/checkins?limit=10")
        assert g.status_code == 200
        ids = [c.get("checkin_id") for c in g.json().get("checkins", [])]
        assert cid in ids
