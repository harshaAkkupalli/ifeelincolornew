"""Admin Panel Backend API Tests - iteration 3"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ifeel-backend.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    assert data.get("role") == "super_admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# ── Auth ──
class TestAdminAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 20
        assert body["email"] == ADMIN_EMAIL
        assert "password_hash" not in body

    def test_login_invalid_password(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/login", json={"email": "nope@nope.com", "password": "x"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_logout(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/auth/logout")
        assert r.status_code == 200


# ── Dashboard ──
class TestDashboard:
    def test_stats(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["portal_patients", "total_patients", "portal_clinicians",
                  "total_clinicians", "total_subscriptions", "patient_subscriptions", "total_earnings"]:
            assert k in d, f"Missing key {k}"
            assert isinstance(d[k], (int, float))

    def test_stats_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard/stats")
        assert r.status_code == 401

    def test_subscription_trends(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/dashboard/subscription-trends")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_clinician_overview(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/dashboard/clinician-overview")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 3


# ── Patients ──
class TestPatients:
    def test_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/patients")
        assert r.status_code == 200
        d = r.json()
        assert "patients" in d and "total" in d
        assert isinstance(d["patients"], list)

    def test_search(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/patients?search=luna")
        assert r.status_code == 200

    def test_csv_export(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/patients/export/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "User ID" in r.text


# ── Clinicians ──
class TestClinicians:
    def test_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/clinicians")
        assert r.status_code == 200
        assert "clinicians" in r.json()

    def test_csv_export(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/clinicians/export/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")


# ── Organizations ──
class TestOrgs:
    def test_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/organizations")
        assert r.status_code == 200
        assert "organizations" in r.json()


# ── Assistants ──
class TestAssistants:
    created_id = None

    def test_create_assistant(self, admin_client):
        payload = {
            "email": "TEST_assist_001@ifeelincolor.com",
            "name": "TEST Assistant",
            "password": "TestPass@123",
            "permissions": ["patients", "plans"],
        }
        r = admin_client.post(f"{BASE_URL}/api/admin/assistants", json=payload)
        # Allow 400 if already exists from prior run
        if r.status_code == 400:
            # cleanup: list, find, delete
            listed = admin_client.get(f"{BASE_URL}/api/admin/assistants").json()["assistants"]
            for a in listed:
                if a["email"] == payload["email"].lower():
                    admin_client.delete(f"{BASE_URL}/api/admin/assistants/{a['admin_id']}")
            r = admin_client.post(f"{BASE_URL}/api/admin/assistants", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == payload["email"].lower()
        assert body["role"] == "assistant"
        assert "password_hash" not in body
        TestAssistants.created_id = body["admin_id"]

    def test_list_assistants(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/assistants")
        assert r.status_code == 200
        assert "assistants" in r.json()

    def test_update_assistant(self, admin_client):
        assert TestAssistants.created_id
        r = admin_client.put(
            f"{BASE_URL}/api/admin/assistants/{TestAssistants.created_id}",
            json={"name": "TEST Updated", "permissions": ["patients"]},
        )
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Updated"

    def test_delete_assistant(self, admin_client):
        assert TestAssistants.created_id
        r = admin_client.delete(f"{BASE_URL}/api/admin/assistants/{TestAssistants.created_id}")
        assert r.status_code == 200


# ── Plans ──
class TestPlans:
    created_id = None

    def test_create_plan(self, admin_client):
        payload = {
            "name": "TEST_Premium_Plan",
            "description": "Test plan",
            "price": 29.99,
            "duration_days": 30,
            "plan_type": "patient",
            "is_trial": False,
            "trial_days": 0,
            "features": ["a", "b"],
        }
        r = admin_client.post(f"{BASE_URL}/api/admin/plans", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == payload["name"]
        assert body["price"] == 29.99
        assert "plan_id" in body
        TestPlans.created_id = body["plan_id"]

    def test_list_plans_filter(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/plans?plan_type=patient")
        assert r.status_code == 200
        plans = r.json()["plans"]
        assert any(p["plan_id"] == TestPlans.created_id for p in plans)

    def test_update_plan(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/plans/{TestPlans.created_id}",
            json={"price": 39.99, "name": "TEST_Premium_Plan_Updated"},
        )
        assert r.status_code == 200
        assert r.json()["price"] == 39.99

    def test_delete_plan(self, admin_client):
        r = admin_client.delete(f"{BASE_URL}/api/admin/plans/{TestPlans.created_id}")
        assert r.status_code == 200


# ── Subscriptions ──
class TestSubscriptions:
    def test_list_all(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/subscriptions")
        assert r.status_code == 200
        d = r.json()
        assert "subscriptions" in d and "total" in d

    def test_list_filter(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/subscriptions?user_type=patient")
        assert r.status_code == 200

    def test_send_renewal_not_found(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/subscriptions/nonexistent_sub_id/send-renewal")
        assert r.status_code == 404


# ── Recommendations ──
class TestRecommendations:
    created_id = None

    def test_create(self, admin_client):
        payload = {
            "title": "TEST_Recommendation",
            "description": "Take 10 deep breaths daily",
            "target_conditions": ["anxiety"],
            "category": "breathing",
        }
        r = admin_client.post(f"{BASE_URL}/api/admin/recommendations", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["title"] == payload["title"]
        assert "recommendation_id" in body
        TestRecommendations.created_id = body["recommendation_id"]

    def test_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/recommendations")
        assert r.status_code == 200
        recs = r.json()["recommendations"]
        assert any(r2["recommendation_id"] == TestRecommendations.created_id for r2 in recs)

    def test_update(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/recommendations/{TestRecommendations.created_id}",
            json={"title": "TEST_Recommendation_Updated"},
        )
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Recommendation_Updated"

    def test_delete(self, admin_client):
        r = admin_client.delete(f"{BASE_URL}/api/admin/recommendations/{TestRecommendations.created_id}")
        assert r.status_code == 200


# ── Earnings ──
class TestEarnings:
    def test_earnings(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/earnings")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_earnings", "total_transactions", "pending_transactions", "monthly_earnings", "earnings_by_type"]:
            assert k in d

    def test_earnings_csv(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/earnings/export/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
