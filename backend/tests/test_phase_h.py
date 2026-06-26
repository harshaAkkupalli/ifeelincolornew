"""Phase H backend tests — role-aware /api/plans, forgot-password→sent_emails, reset-password,
admin email-templates system protection, clinician-tier subscribe/mock, assessment-submit regression."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ifeel-backend.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"
PATIENT_EMAIL = "patient@ifeelincolor.com"
PATIENT_PASSWORD = "Patient@123"
CLINICIAN_EMAIL = "clinician@ifeelincolor.com"
CLINICIAN_PASSWORD = "Clinician@123"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture
def patient_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"patient login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture
def clinician_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": CLINICIAN_EMAIL, "password": CLINICIAN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"clinician login failed: {r.status_code} {r.text}"
    return s


# ─── /api/plans role param ───
class TestPlansRoleParam:
    def test_plans_role_patient(self):
        r = requests.get(f"{API}/plans?role=patient", timeout=15)
        assert r.status_code == 200
        plans = r.json()["plans"]
        assert isinstance(plans, list) and len(plans) > 0
        for p in plans:
            assert p.get("plan_type") in ("patient", None, "")
            assert p.get("plan_type") != "clinician"

    def test_plans_role_clinician_only_clinician_type(self):
        r = requests.get(f"{API}/plans?role=clinician", timeout=15)
        assert r.status_code == 200
        plans = r.json()["plans"]
        assert isinstance(plans, list)
        assert len(plans) >= 1, "Expected seeded clinician plans"
        for p in plans:
            assert p.get("plan_type") == "clinician", f"Non-clinician plan leaked: {p}"
        names = [p.get("name") for p in plans]
        # The seeded clinician plans
        assert any("Clinician" in (n or "") or "Clinic" in (n or "") for n in names), f"Expected clinician/clinic plans, got {names}"

    def test_plans_default_is_patient(self):
        r1 = requests.get(f"{API}/plans", timeout=15)
        r2 = requests.get(f"{API}/plans?role=patient", timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        ids1 = sorted([p["plan_id"] for p in r1.json()["plans"]])
        ids2 = sorted([p["plan_id"] for p in r2.json()["plans"]])
        assert ids1 == ids2, "Default /plans should equal role=patient"


# ─── Admin creates plan_type=clinician and patient endpoint picks it up ───
class TestAdminPlanCreate:
    def test_admin_create_clinician_plan_mirrors_price(self, admin_session):
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_Clinician_{suffix}",
            "description": "Test clinician tier",
            "price": 199,
            "duration_days": 30,
            "plan_type": "clinician",
            "features": ["a", "b"],
        }
        r = admin_session.post(f"{API}/admin/plans", json=payload, timeout=20)
        assert r.status_code == 200, f"admin create plan failed: {r.status_code} {r.text}"
        d = r.json()
        assert d["plan_type"] == "clinician"
        assert d["price_usd"] == 199, f"price not mirrored: {d}"
        assert d["active"] is True
        plan_id = d["plan_id"]

        # Verify it shows up in public /api/plans?role=clinician
        rr = requests.get(f"{API}/plans?role=clinician", timeout=15)
        assert rr.status_code == 200
        ids = [p["plan_id"] for p in rr.json()["plans"]]
        assert plan_id in ids, f"new clinician plan missing from public list: {ids}"

        # Cleanup: delete
        admin_session.delete(f"{API}/admin/plans/{plan_id}", timeout=20)


# ─── Forgot Password ───
class TestForgotPassword:
    def test_forgot_password_valid_email(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": PATIENT_EMAIL}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("mock_token"), f"Expected mock_token, got {d}"
        assert d.get("reset_link"), f"Expected reset_link, got {d}"
        assert "patient" in d["reset_link"]

    def test_forgot_password_nonexistent_email(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("mock_token") is None, f"Should not leak token for unknown email: {d}"

    def test_forgot_password_inserts_sent_emails_row(self, admin_session):
        # Trigger
        r = requests.post(f"{API}/auth/forgot-password", json={"email": PATIENT_EMAIL}, timeout=20)
        assert r.status_code == 200
        token = r.json()["mock_token"]
        # Admin recent sends endpoint
        rr = admin_session.get(f"{API}/admin/email/sent", timeout=15)
        assert rr.status_code == 200, f"sent emails endpoint failed: {rr.status_code} {rr.text}"
        emails = rr.json().get("emails", [])
        match = next((e for e in emails if e.get("trigger") == "password_reset" and e.get("token") == token), None)
        assert match is not None, f"No sent_emails row with trigger=password_reset+token={token}. Sample: {emails[:2]}"
        assert match["template_id"] == "tpl_password_reset"
        assert match["status"] in {"mock_sent", "sent", "failed"}
        assert match["to_email"] == PATIENT_EMAIL


# ─── Reset Password ───
class TestResetPassword:
    def test_reset_password_full_flow_and_restore(self):
        # 1. Request reset
        r = requests.post(f"{API}/auth/forgot-password", json={"email": PATIENT_EMAIL}, timeout=20)
        assert r.status_code == 200
        token = r.json()["mock_token"]
        assert token

        new_pw = f"NewPass_{uuid.uuid4().hex[:6]}"

        # 2. Reset
        rr = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "new_password": new_pw}, timeout=20)
        assert rr.status_code == 200, f"reset failed: {rr.text}"

        # 3. Login with new succeeds
        s = requests.Session()
        ok = s.post(f"{API}/auth/login", json={"email": PATIENT_EMAIL, "password": new_pw}, timeout=20)
        assert ok.status_code == 200, f"login w/ new failed: {ok.text}"

        # 4. Login with old fails
        bad = requests.post(f"{API}/auth/login", json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD}, timeout=20)
        assert bad.status_code == 401

        # 5. Reusing the token should now fail (used)
        used = requests.post(f"{API}/auth/reset-password",
                             json={"token": token, "new_password": "Whatever123"}, timeout=20)
        assert used.status_code == 400

        # 6. Restore original password via a new token
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": PATIENT_EMAIL}, timeout=20)
        tok2 = r2.json()["mock_token"]
        rr2 = requests.post(f"{API}/auth/reset-password",
                            json={"token": tok2, "new_password": PATIENT_PASSWORD}, timeout=20)
        assert rr2.status_code == 200, f"restore failed: {rr2.text}"

        # 7. Verify original creds work
        verify = requests.post(f"{API}/auth/login",
                               json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD}, timeout=20)
        assert verify.status_code == 200, "Failed to restore Patient@123!"

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": "garbage_" + uuid.uuid4().hex, "new_password": "Abcdef1"}, timeout=20)
        assert r.status_code == 400

    def test_reset_password_short_password(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": PATIENT_EMAIL}, timeout=20)
        tok = r.json()["mock_token"]
        rr = requests.post(f"{API}/auth/reset-password",
                           json={"token": tok, "new_password": "abc"}, timeout=20)
        assert rr.status_code == 400


# ─── Admin email-template system protection (regression) ───
class TestEmailTemplateSystemProtection:
    def test_cannot_delete_system_template(self, admin_session):
        # Get templates
        r = admin_session.get(f"{API}/admin/email-templates", timeout=15)
        assert r.status_code == 200
        templates = r.json().get("templates", [])
        # Only true system templates (explicit system: True flag)
        sys_tpls = [t for t in templates if t.get("system") is True]
        if not sys_tpls:
            pytest.skip("No system templates seeded with system=True flag")
        tpl = sys_tpls[0]
        tid = tpl["template_id"]
        rr = admin_session.delete(f"{API}/admin/email-templates/{tid}", timeout=15)
        # Should be blocked — 403 per current code
        assert rr.status_code in (400, 403, 409), f"System template {tid} was deletable! {rr.status_code} {rr.text}"


# ─── Clinician subscribe/mock with clinician-tier plan ───
class TestClinicianSubscribeMock:
    def test_clinician_can_subscribe_to_clinician_plan(self, clinician_session):
        # fetch clinician plans
        r = requests.get(f"{API}/plans?role=clinician", timeout=15)
        assert r.status_code == 200
        plans = r.json()["plans"]
        assert plans, "No clinician plans available"
        plan_id = plans[0]["plan_id"]
        rr = clinician_session.post(f"{API}/subscribe/mock", json={"plan_id": plan_id}, timeout=20)
        assert rr.status_code == 200, f"subscribe failed: {rr.text}"
        sub = rr.json()["subscription"]
        assert sub["status"] == "active"
        assert sub["payment_status"] == "mock_paid"
        assert sub["plan_id"] == plan_id


# ─── Regression: /api/patient/assessment-submit auto-assigns admin recs ───
class TestAssessmentAutoAssignRegression:
    def test_patient_assessment_submit_returns_admin_recs(self, patient_session):
        # ensure patient has active sub (idempotent)
        r = requests.get(f"{API}/plans?role=patient", timeout=15)
        plan_id = r.json()["plans"][0]["plan_id"]
        patient_session.post(f"{API}/subscribe/mock", json={"plan_id": plan_id}, timeout=20)
        # submit assessment
        payload = {"category_id": "assessment",
                   "answers": {"a1": "Several days", "a2": "Several days", "a3": 5, "a4": "No"}}
        rr = patient_session.post(f"{API}/patient/assessment-submit", json=payload, timeout=30)
        assert rr.status_code == 200, f"assessment-submit failed: {rr.text}"
        resp = rr.json()["response"]
        assert "severity" in resp
        assert "admin_recs" in resp
        # auto-assigned activity rows (may be 0 if no curated recs seeded)
        act = patient_session.get(f"{API}/patient/activity", timeout=15)
        assert act.status_code == 200
