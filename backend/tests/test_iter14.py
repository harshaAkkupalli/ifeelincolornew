"""Iteration 14 backend tests:
- /api/patient/recommendations 3-source structure
- /api/notifications realistic feed
- /api/me/subscription
- /api/plans?role=patient|clinician|organization
- assessment-submit writes patient_activity assessment_completed
"""
import os, requests, pytest
from pathlib import Path

def _load_url():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if u:
        return u.rstrip("/")
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_url()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "patient"}, timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "clinician"}, timeout=15)
    assert r.status_code == 200
    return s


# ── Plans endpoint by role ──
class TestPlansByRole:
    def test_patient_plans(self):
        r = requests.get(f"{API}/plans", params={"role": "patient"}, timeout=15)
        assert r.status_code == 200
        plans = r.json().get("plans", [])
        assert len(plans) >= 1, "Expected at least 1 patient plan"
        assert all("name" in p and "price_usd" in p for p in plans)

    def test_clinician_plans(self):
        r = requests.get(f"{API}/plans", params={"role": "clinician"}, timeout=15)
        assert r.status_code == 200
        plans = r.json().get("plans", [])
        assert len(plans) >= 1, f"Expected at least 1 clinician plan, got {len(plans)}"

    def test_organization_plans(self):
        r = requests.get(f"{API}/plans", params={"role": "organization"}, timeout=15)
        assert r.status_code == 200
        plans = r.json().get("plans", [])
        assert len(plans) >= 1, f"Expected at least 1 organization plan, got {len(plans)}"


# ── /me/subscription ──
class TestMySubscription:
    def test_demo_patient_has_active_sub(self, patient_session):
        r = patient_session.get(f"{API}/me/subscription", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("active") is True, f"Expected active=true, got {data}"
        sub = data.get("subscription") or {}
        for k in ("plan_name", "amount_paid_usd", "start_date", "end_date"):
            assert k in sub, f"Missing key {k} in subscription: {sub}"


# ── /patient/recommendations 3-source ──
class TestPatientRecommendations:
    def test_structure(self, patient_session):
        r = patient_session.get(f"{API}/patient/recommendations", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("by_source", "counts", "severity", "has_assessment", "recommendations"):
            assert k in data, f"Missing key {k}"
        by = data["by_source"]
        for src in ("admin", "clinician", "organization"):
            assert src in by, f"Missing source {src}"
            assert isinstance(by[src], list)
        counts = data["counts"]
        for src in ("admin", "clinician", "organization"):
            assert src in counts

    def test_demo_patient_has_recommendations(self, patient_session):
        r = patient_session.get(f"{API}/patient/recommendations", timeout=15)
        data = r.json()
        # admin>=1 and clinician>=1 expected (Luna has clinician-recommended items)
        assert data["counts"]["admin"] >= 1, f"Expected admin >= 1, got {data['counts']}"
        assert data["counts"]["clinician"] >= 1, f"Expected clinician >= 1, got {data['counts']}"
        # Verify clinician items have source_name and assigned_at
        for c in data["by_source"]["clinician"]:
            assert c.get("source") == "clinician"
            assert c.get("source_name")
            assert c.get("source_label", "").startswith("From ")
            assert c.get("assigned_at")
        # Admin items have source label too
        for a in data["by_source"]["admin"][:3]:
            assert a.get("source") == "admin"
            assert a.get("source_label")


# ── /notifications realistic feed ──
class TestNotifications:
    def test_feed_shape(self, patient_session):
        r = patient_session.get(f"{API}/notifications", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "notifications" in data and isinstance(data["notifications"], list)
        assert "unread_count" in data
        assert len(data["notifications"]) >= 1, "Expected at least 1 notification"
        for n in data["notifications"]:
            for k in ("title", "body", "created_at", "color", "url", "type"):
                assert k in n, f"Notification missing key {k}: {n}"

    def test_realistic_types_present(self, patient_session):
        r = patient_session.get(f"{API}/notifications", timeout=15)
        types = {n["type"] for n in r.json()["notifications"]}
        # At least one of the expected realistic types should appear for Luna
        expected = {"assessment_completed", "clinician_recommendation", "clinician_plan",
                    "doctor_subscribed", "announcement", "recommendation_saved"}
        assert types & expected, f"No realistic types found. Got: {types}"


# ── assessment-submit writes patient_activity ──
class TestAssessmentActivityLog:
    def test_assessment_completion_creates_activity(self, patient_session):
        # baseline activity count
        before = patient_session.get(f"{API}/patient/activity", timeout=15).json().get("activity", [])
        before_assess = [a for a in before if a.get("type") == "assessment_completed"]

        payload = {
            "category_id": "assessment",
            "answers": {
                "a1": "Several days",
                "a2": "Several days",
                "a3": 5,
                "a4": "No",
                "a5": "TEST_iter14",
            },
        }
        r = patient_session.post(f"{API}/patient/assessment-submit", json=payload, timeout=30)
        assert r.status_code == 200, f"assessment-submit failed: {r.status_code} {r.text}"
        resp = r.json().get("response", {})
        assert resp.get("category_id") == "assessment"
        assert resp.get("severity") in ("low", "moderate", "high", "critical")

        # Verify a new assessment_completed activity entry was added
        after = patient_session.get(f"{API}/patient/activity", timeout=15).json().get("activity", [])
        after_assess = [a for a in after if a.get("type") == "assessment_completed"]
        assert len(after_assess) > len(before_assess), (
            f"No new assessment_completed activity. before={len(before_assess)} after={len(after_assess)}"
        )
        latest = after_assess[0]
        assert "severity" in latest.get("title", "").lower() or latest.get("severity")
