"""
Backend tests for auth_extended.py — password login, email verification (mocked),
forgot/reset password (mocked), and WebAuthn endpoints (options + status).
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ifeel-backend.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXISTING_EMAIL = "testlogin@test.com"
EXISTING_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def fresh_user(session):
    """Register a fresh patient user we fully control for verify/reset/webauthn tests."""
    email = f"test_authext_{uuid.uuid4().hex[:8]}@test.com"
    password = "Test123!"
    payload = {
        "full_name": "Auth Ext Tester",
        "email": email,
        "password": password,
        "date_of_birth": "1990-01-01",
        "phone": "+15551234567",
        "address": "123 Test St",
        "is_minor": False,
        "guardian_consent": False,
        "terms_accepted": True,
    }
    r = session.post(f"{API}/auth/register/patient", json=payload)
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    user_id = data.get("user_id") or data.get("id")
    assert user_id, f"No user_id in register response: {data}"
    yield {"email": email, "password": password, "user_id": user_id}


# ─── Password Login ─────────────────────────────────────────
class TestPasswordLogin:
    def test_login_success_sets_cookie(self, session):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == EXISTING_EMAIL
        assert "password_hash" not in data
        # Cookie should be set
        assert any(c.name == "session_token" for c in s.cookies), f"Cookies: {s.cookies.items()}"

    def test_login_wrong_password_401(self, session):
        r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": "WrongPassword!"})
        assert r.status_code == 401

    def test_login_nonexistent_email_401(self, session):
        r = session.post(f"{API}/auth/login", json={"email": f"nope_{uuid.uuid4().hex[:6]}@test.com", "password": "x"})
        assert r.status_code == 401


# ─── Email Verification (Mocked) ────────────────────────────
class TestEmailVerification:
    def test_send_verification_returns_mock_code(self, session, fresh_user):
        r = session.post(f"{API}/auth/send-verification", json={"email": fresh_user["email"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "mock_code" in data
        assert data["mock_code"] and len(data["mock_code"]) == 6
        fresh_user["code"] = data["mock_code"]

    def test_verify_email_wrong_code_400(self, session, fresh_user):
        r = session.post(f"{API}/auth/verify-email", json={"email": fresh_user["email"], "code": "000000"})
        # 000000 is highly unlikely to match
        assert r.status_code == 400

    def test_verify_email_correct_code_success(self, session, fresh_user):
        # request a fresh code first to be safe
        r0 = session.post(f"{API}/auth/send-verification", json={"email": fresh_user["email"]})
        assert r0.status_code == 200
        code = r0.json()["mock_code"]
        r = session.post(f"{API}/auth/verify-email", json={"email": fresh_user["email"], "code": code})
        assert r.status_code == 200, r.text
        assert "verified" in r.json().get("message", "").lower()

    def test_send_verification_unknown_email_404(self, session):
        r = session.post(f"{API}/auth/send-verification", json={"email": f"nobody_{uuid.uuid4().hex[:6]}@x.com"})
        assert r.status_code == 404


# ─── Forgot / Reset Password (Mocked) ───────────────────────
class TestForgotResetPassword:
    def test_forgot_password_returns_mock_token(self, session, fresh_user):
        r = session.post(f"{API}/auth/forgot-password", json={"email": fresh_user["email"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("mock_token"), data
        assert len(data["mock_token"]) == 32
        fresh_user["reset_token"] = data["mock_token"]

    def test_reset_password_invalid_token_400(self, session):
        r = session.post(f"{API}/auth/reset-password", json={"token": "invalid_token_xxx", "new_password": "NewPass123!"})
        assert r.status_code == 400

    def test_reset_password_valid_token_and_login_with_new(self, session, fresh_user):
        new_pw = "NewPass456!"
        r = session.post(f"{API}/auth/reset-password", json={"token": fresh_user["reset_token"], "new_password": new_pw})
        assert r.status_code == 200, r.text
        # login with new
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        r2 = s2.post(f"{API}/auth/login", json={"email": fresh_user["email"], "password": new_pw})
        assert r2.status_code == 200, r2.text
        # old password must fail
        r3 = s2.post(f"{API}/auth/login", json={"email": fresh_user["email"], "password": fresh_user["password"]})
        assert r3.status_code == 401
        fresh_user["password"] = new_pw

    def test_reset_password_short_password_400(self, session, fresh_user):
        # get fresh token
        r0 = session.post(f"{API}/auth/forgot-password", json={"email": fresh_user["email"]})
        token = r0.json()["mock_token"]
        r = session.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "abc"})
        assert r.status_code == 400

    def test_forgot_password_unknown_email_no_token(self, session):
        # spec: should not reveal existence; returns mock_token=None
        r = session.post(f"{API}/auth/forgot-password", json={"email": f"ghost_{uuid.uuid4().hex[:6]}@x.com"})
        assert r.status_code == 200
        assert r.json().get("mock_token") is None


# ─── WebAuthn ──────────────────────────────────────────────
class TestWebAuthn:
    def test_status_new_user_not_registered(self, session, fresh_user):
        r = session.get(f"{API}/auth/webauthn/status/{fresh_user['user_id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["registered"] is False
        assert data["credential_count"] == 0

    def test_register_options_returns_publickey_options(self, session, fresh_user):
        r = session.post(
            f"{API}/auth/webauthn/register/options",
            json={"user_id": fresh_user["user_id"]},
            headers={"Origin": BASE_URL},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # standard fields of PublicKeyCredentialCreationOptions
        assert "challenge" in data
        assert "rp" in data
        assert "user" in data
        assert "pubKeyCredParams" in data

    def test_login_options_no_biometric_400(self, session, fresh_user):
        r = session.post(
            f"{API}/auth/webauthn/login/options",
            json={"email": fresh_user["email"]},
            headers={"Origin": BASE_URL},
        )
        assert r.status_code == 400

    def test_register_options_unknown_user_404(self, session):
        r = session.post(
            f"{API}/auth/webauthn/register/options",
            json={"user_id": "not_a_real_user_xxxx"},
            headers={"Origin": BASE_URL},
        )
        assert r.status_code == 404


# ─── Cleanup ────────────────────────────────────────────────
def teardown_module(module):
    # Best-effort cleanup via direct mongo if available; otherwise leave test users.
    try:
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if mongo_url and db_name:
            client = MongoClient(mongo_url)
            client[db_name].users.delete_many({"email": {"$regex": "^test_authext_"}})
    except Exception:
        pass
