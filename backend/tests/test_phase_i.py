"""Phase I tests — Clinician Analytics, CSV exports, Admin Assignments,
notifications feed, real-clinician doctors_nearby, dashboard-stats inclusion."""

import os
import uuid
import pytest
import requests
from pathlib import Path

def _load_env_url():
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    return os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

BASE_URL = _load_env_url()
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"


# ── Sessions ───────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "patient"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "clinician"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/admin/auth/login",
               json={"email": "admin@ifeelincolor.com", "password": "Admin@123!"})
    assert r.status_code == 200, r.text
    return s


# ── 1. Clinician Analytics ─────────────────────────────────────────────────────

class TestClinicianAnalytics:
    def test_analytics_default_30d(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/analytics")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("severity_distribution", "checkin_frequency",
                  "emotion_frequency", "total_checkins", "patient_count",
                  "window_days"):
            assert k in d, f"missing {k}"
        assert d["window_days"] == 30
        assert isinstance(d["checkin_frequency"], list)
        assert len(d["checkin_frequency"]) == 30
        assert isinstance(d["severity_distribution"], list)
        # severity buckets should include 4 labels
        labels = {x["label"] for x in d["severity_distribution"]}
        assert {"low", "moderate", "high", "critical"} <= labels

    def test_analytics_7d(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/analytics", params={"days": 7})
        assert r.status_code == 200
        d = r.json()
        assert d["window_days"] == 7
        assert len(d["checkin_frequency"]) == 7

    def test_analytics_90d(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/analytics", params={"days": 90})
        assert r.status_code == 200
        d = r.json()
        assert d["window_days"] == 90
        assert len(d["checkin_frequency"]) == 90

    def test_analytics_patient_forbidden(self, patient_session):
        r = patient_session.get(f"{API}/clinician/analytics")
        assert r.status_code == 403

    def test_analytics_unauthenticated(self):
        r = requests.get(f"{API}/clinician/analytics")
        assert r.status_code in (401, 403)


# ── 2. CSV Exports ─────────────────────────────────────────────────────────────

class TestCSVExports:
    def test_patient_export_csv(self, patient_session):
        r = patient_session.get(f"{API}/patient/checkins/export")
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".csv" in cd
        first_line = r.text.split("\n", 1)[0]
        for h in ("date", "user_selected_emotion", "journal_notes"):
            assert h in first_line

    def test_patient_export_clinician_forbidden(self, clinician_session):
        r = clinician_session.get(f"{API}/patient/checkins/export")
        assert r.status_code == 403

    def test_clinician_export_csv(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/patient/demo-patient-001/checkins/export")
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        assert "demo-patient-001" in r.headers.get("content-disposition", "")

    def test_clinician_export_patient_forbidden(self, patient_session):
        r = patient_session.get(f"{API}/clinician/patient/demo-patient-001/checkins/export")
        assert r.status_code == 403


# ── 3. Doctors Nearby (real clinicians on top) ─────────────────────────────────

class TestDoctorsNearby:
    def test_real_clinicians_prepended(self, patient_session):
        r = patient_session.get(f"{API}/doctors/nearby")
        assert r.status_code == 200
        d = r.json()
        assert "doctors" in d
        docs = d["doctors"]
        assert len(docs) > 0
        real = [x for x in docs if x.get("source") == "real"]
        assert len(real) >= 1, "expected at least 1 real clinician"
        # real should be first
        assert docs[0]["source"] == "real"
        # test-clinician-001 should be among them
        ids = [x.get("doctor_id") for x in real]
        assert "test-clinician-001" in ids


# ── 4. Subscribe-paid + Admin Assignments ──────────────────────────────────────

class TestAssignments:
    """Subscribe a patient (new patient) to test-clinician-001 then verify admin endpoints."""

    @pytest.fixture(scope="class")
    def fresh_patient(self):
        """Register a brand-new patient so subscription is not 'already' existing."""
        s = requests.Session()
        email = f"TEST_phasei_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register/patient", json={
            "email": email,
            "password": "Test@123456",
            "full_name": "TEST Phase I Patient",
            "phone": "5551112222",
            "date_of_birth": "1990-01-01",
            "address": "1 Test St",
            "terms_accepted": True,
            "is_minor": False,
        })
        if r.status_code not in (200, 201):
            pytest.skip(f"cannot create fresh patient: {r.status_code} {r.text[:200]}")
        return s, email, (r.json() or {}).get("user_id")

    def test_subscribe_paid_real_clinician(self, fresh_patient):
        s, _, _ = fresh_patient
        r = s.post(f"{API}/patient/doctors/subscribe-paid",
                   json={"doctor_id": "test-clinician-001", "plan_id": "cp_basic"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        if not d.get("already"):
            sub = d.get("subscription") or {}
            assert sub.get("clinician_id") == "test-clinician-001"
            assert sub.get("amount_paid_usd") in (49, 49.0)
            assert sub.get("payment_status") == "mock_paid"

    def test_admin_list_assignments(self, admin_session):
        r = admin_session.get(f"{API}/admin/assignments")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "assignments" in d and "total" in d
        # At least the one we just made
        assert d["total"] >= 1
        for a in d["assignments"]:
            for k in ("subscription_id", "patient_id", "clinician_id",
                      "is_real_clinician", "amount_paid_usd"):
                assert k in a
        # At least one should be real_clinician=True since we subscribed to test-clinician-001
        assert any(a.get("is_real_clinician") for a in d["assignments"])
        # Stash for revoke
        TestAssignments._sub_id = next(
            (a["subscription_id"] for a in d["assignments"]
             if a.get("clinician_id") == "test-clinician-001" and a.get("subscription_id")),
            None,
        )

    def test_admin_revoke_assignment(self, admin_session):
        sub_id = getattr(TestAssignments, "_sub_id", None)
        if not sub_id:
            pytest.skip("no subscription_id captured")
        r = admin_session.delete(f"{API}/admin/assignments/{sub_id}")
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_admin_revoke_unknown_404(self, admin_session):
        r = admin_session.delete(f"{API}/admin/assignments/does-not-exist-xyz")
        assert r.status_code == 404

    def test_admin_assignments_requires_admin(self, patient_session):
        r = patient_session.get(f"{API}/admin/assignments")
        assert r.status_code in (401, 403)


# ── 5. Clinician Notifications Feed ────────────────────────────────────────────

class TestNotificationsFeed:
    def test_feed_basic(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/notifications-feed")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "feed" in d and isinstance(d["feed"], list)
        assert "server_time" in d
        # validate item shape if any items present
        for item in d["feed"][:3]:
            for k in ("id", "type", "title", "created_at"):
                assert k in item

    def test_feed_since_filter(self, clinician_session):
        # Use a future timestamp → should return empty/older feed only
        r = clinician_session.get(f"{API}/clinician/notifications-feed",
                                  params={"since": "2099-01-01T00:00:00Z"})
        assert r.status_code == 200
        d = r.json()
        assert d["feed"] == []

    def test_feed_patient_forbidden(self, patient_session):
        r = patient_session.get(f"{API}/clinician/notifications-feed")
        assert r.status_code == 403


# ── 6. Dashboard-stats inclusion of patient_doctor_subscriptions.clinician_id ──

class TestDashboardStatsLinking:
    """Subscribe a patient (with fresh user) to demo-clinician-001 paid plan,
    then assert demo-clinician-001 dashboard-stats shows revenue increment +
    patient with subscribed=True."""

    def test_pds_links_patient_to_demo_clinician(self, clinician_session):
        # snapshot before
        r0 = clinician_session.get(f"{API}/clinician/dashboard-stats")
        assert r0.status_code == 200
        before = r0.json()
        rev_before = before.get("revenue_usd", 0)

        # Create fresh patient and subscribe to demo-clinician-001
        ps = requests.Session()
        email = f"TEST_dash_{uuid.uuid4().hex[:8]}@example.com"
        reg = ps.post(f"{API}/auth/register/patient", json={
            "email": email, "password": "Test@123456",
            "full_name": "TEST Dash Patient",
            "phone": "5551113333", "date_of_birth": "1990-01-01",
            "address": "1 Dash St", "terms_accepted": True, "is_minor": False,
        })
        if reg.status_code not in (200, 201):
            pytest.skip(f"register failed: {reg.status_code} {reg.text[:200]}")
        user_id = (reg.json() or {}).get("user_id")

        sub = ps.post(f"{API}/patient/doctors/subscribe-paid",
                      json={"doctor_id": "demo-clinician-001", "plan_id": "cp_premium"})
        assert sub.status_code == 200, sub.text

        # check after
        r1 = clinician_session.get(f"{API}/clinician/dashboard-stats")
        assert r1.status_code == 200
        after = r1.json()
        assert after.get("revenue_usd", 0) >= rev_before + 129  # cp_premium price
        if user_id:
            match = [p for p in after.get("patients", []) if p.get("user_id") == user_id]
            assert match, "linked patient should appear in clinician dashboard"
            assert match[0].get("subscribed") is True
