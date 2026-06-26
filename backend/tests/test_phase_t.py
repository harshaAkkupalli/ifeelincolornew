"""Phase T backend tests:
1. GET /api/admin/patients?with_severity=1 enriches latest_severity & latest_color
2. Without with_severity, those fields are not populated (or null/absent)
3. POST /api/admin/patient/{id}/recommendation with recommendation_id creates patient_activity row
"""
import os
import pytest
import requests

def _read_env_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = _read_env_url().rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def luna_id():
    # demo-patient-001 per memory/test_credentials.md
    return "demo-patient-001"


# 1. with_severity=1 enrichment
def test_admin_patients_with_severity_enrich(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/patients?with_severity=1&limit=20", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "patients" in data
    patients = data["patients"]
    assert len(patients) > 0, "expected at least 1 patient"
    # All patients should have latest_severity and latest_color keys present
    for p in patients:
        assert "latest_severity" in p, f"missing latest_severity for {p.get('user_id')}"
        assert "latest_color" in p, f"missing latest_color for {p.get('user_id')}"
        # Existing fields still present
        assert "name" in p
        assert "email" in p
        assert "subscription" in p
        assert "checkin_count" in p
    # Find Luna - should have critical severity per main agent's manual verification
    luna = next((p for p in patients if p.get("user_id") == "demo-patient-001"), None)
    assert luna is not None, "Luna (demo-patient-001) not found in admin patients list"
    assert luna.get("latest_severity") == "critical", (
        f"Luna expected latest_severity='critical', got {luna.get('latest_severity')}"
    )


# 2. without with_severity, new fields should not be populated
def test_admin_patients_without_severity_flag(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/patients?limit=20", timeout=30)
    assert r.status_code == 200
    patients = r.json()["patients"]
    assert len(patients) > 0
    # latest_severity and latest_color should NOT be set (absent or None)
    for p in patients:
        assert p.get("latest_severity") is None, (
            f"latest_severity should not be set when with_severity=0, got {p.get('latest_severity')}"
        )
        assert p.get("latest_color") is None, (
            f"latest_color should not be set when with_severity=0, got {p.get('latest_color')}"
        )


# 3. POST manual recommendation regression
def test_admin_send_manual_recommendation_with_rec_id(admin_session, luna_id):
    # First fetch a recommendation_id from the library
    r = admin_session.get(f"{BASE_URL}/api/admin/recommendations", timeout=30)
    assert r.status_code == 200
    recs_payload = r.json()
    recs = recs_payload.get("recommendations") if isinstance(recs_payload, dict) else recs_payload
    assert recs and len(recs) > 0, "no recommendations in library"
    rec_id = recs[0]["recommendation_id"]
    rec_title = recs[0].get("title")

    # Send it to Luna
    r2 = admin_session.post(
        f"{BASE_URL}/api/admin/patient/{luna_id}/recommendation",
        json={"recommendation_id": rec_id},
        timeout=30,
    )
    assert r2.status_code == 200, f"send rec failed: {r2.status_code} {r2.text}"
    payload = r2.json()
    assert payload.get("ok") is True
    activity = payload.get("activity")
    assert activity is not None
    assert activity.get("source") == "admin"
    assert activity.get("trigger") == "manual"
    assert activity.get("from_admin") is True
    assert activity.get("recommendation_id") == rec_id
    assert activity.get("title") == rec_title
    assert activity.get("user_id") == luna_id
    assert "activity_id" in activity
    # _id stripped
    assert "_id" not in activity


def test_admin_send_manual_recommendation_invalid_rec_id(admin_session, luna_id):
    r = admin_session.post(
        f"{BASE_URL}/api/admin/patient/{luna_id}/recommendation",
        json={"recommendation_id": "nonexistent_xxxx"},
        timeout=30,
    )
    assert r.status_code == 404


def test_admin_send_manual_recommendation_invalid_patient(admin_session):
    r = admin_session.post(
        f"{BASE_URL}/api/admin/patient/nonexistent_patient/recommendation",
        json={"recommendation_id": "any"},
        timeout=30,
    )
    assert r.status_code == 404
