"""Iteration 36 — Organization Login + Org_Manager bifurcation tests.

Covers:
  • POST /api/organization/login   (happy path + 401 + 403 non-org)
  • POST /api/v1/auth/organization/login  (alias)
  • Org_Manager seeded directly via Mongo (role_tier=Org_Manager)
  • READ endpoints work for Manager
  • WRITE endpoints (POST/PUT/DELETE clinicians) return 403 for Manager
  • Org_Admin still able to POST/PUT/DELETE
  • Regression: /api/auth/login (generic) works
"""
import os
import uuid
import pytest
import requests
from passlib.context import CryptContext
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ORG_ADMIN_EMAIL = "admin@demo.ifeelincolor.com"
ORG_ADMIN_PWD = "Organization@123"
PATIENT_EMAIL = "luna@demo.ifeelincolor.com"
PATIENT_PWD = "Patient@123"
MANAGER_EMAIL = "manager.test@demo.ifeelincolor.com"
MANAGER_PWD = "Manager@123"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(os.environ["MONGO_URL"])
    yield client[os.environ["DB_NAME"]]
    client.close()


@pytest.fixture(scope="module")
def seed_admin():
    """Ensure the demo org admin exists by hitting demo-login/seed."""
    try:
        requests.post(f"{API}/auth/demo-login/seed", json={"role": "organization"}, timeout=15)
    except Exception:
        pass
    return True


@pytest.fixture(scope="module")
def org_admin_user_id(mongo_db, seed_admin):
    u = mongo_db.users.find_one({"email": ORG_ADMIN_EMAIL.lower()})
    assert u, "Org admin should exist"
    # Ensure no role_tier collision: default Org_Admin
    if u.get("role_tier") == "Org_Manager":
        mongo_db.users.update_one({"_id": u["_id"]}, {"$set": {"role_tier": "Org_Admin"}})
    return u["user_id"]


@pytest.fixture(scope="module")
def seed_manager(mongo_db, org_admin_user_id):
    """Insert (idempotently) an Org_Manager user linked to org admin's user_id."""
    email = MANAGER_EMAIL.lower()
    doc = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": "Test Manager",
        "role": "organization",
        "role_tier": "Org_Manager",
        "org_id": org_admin_user_id,
        "password_hash": pwd_ctx.hash(MANAGER_PWD),
        "status": "active",
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    existing = mongo_db.users.find_one({"email": email})
    if existing:
        mongo_db.users.update_one(
            {"email": email},
            {"$set": {
                "role": "organization",
                "role_tier": "Org_Manager",
                "password_hash": pwd_ctx.hash(MANAGER_PWD),
                "status": "active",
            }},
        )
        return existing["user_id"]
    mongo_db.users.insert_one(doc)
    return doc["user_id"]


def _login(session: requests.Session, path: str, email: str, password: str) -> requests.Response:
    return session.post(f"{API}{path}", json={"email": email, "password": password}, timeout=20)


# ─── A. Organization login endpoint ─────────────────────────────────
class TestOrgLoginEndpoint:
    def test_org_admin_happy_path(self, seed_admin):
        s = requests.Session()
        r = _login(s, "/organization/login", ORG_ADMIN_EMAIL, ORG_ADMIN_PWD)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "organization"
        assert data.get("role_tier") in ("Org_Admin", "Org_Manager")
        # default seeded admin should be Org_Admin
        assert data["role_tier"] == "Org_Admin"

    def test_org_login_wrong_password_401(self):
        s = requests.Session()
        r = _login(s, "/organization/login", ORG_ADMIN_EMAIL, "WrongPass!!")
        assert r.status_code == 401, r.text

    def test_org_login_non_org_user_403(self):
        s = requests.Session()
        # Patient credentials should be blocked at /organization/login
        r = _login(s, "/organization/login", PATIENT_EMAIL, PATIENT_PWD)
        # Either 401 (creds invalid) or 403 (role mismatch). Spec requires 403.
        assert r.status_code == 403, f"Expected 403 got {r.status_code}: {r.text}"

    def test_v1_alias_works(self, seed_admin):
        s = requests.Session()
        r = _login(s, "/v1/auth/organization/login", ORG_ADMIN_EMAIL, ORG_ADMIN_PWD)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "organization"


# ─── B. Org_Manager seeded + login + role_tier surfacing ────────────
class TestOrgManagerLogin:
    def test_manager_login_returns_role_tier(self, seed_manager):
        s = requests.Session()
        r = _login(s, "/organization/login", MANAGER_EMAIL, MANAGER_PWD)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "organization"
        assert data["role_tier"] == "Org_Manager"

    def test_manager_can_read_dashboard(self, seed_manager):
        s = requests.Session()
        r = _login(s, "/organization/login", MANAGER_EMAIL, MANAGER_PWD)
        assert r.status_code == 200
        d = s.get(f"{API}/organization/dashboard", timeout=20)
        assert d.status_code == 200, d.text
        body = d.json()
        assert body["org"]["role_tier"] == "Org_Manager"
        assert "clinician_count" in body

    def test_manager_can_read_clinicians(self, seed_manager):
        s = requests.Session()
        _login(s, "/organization/login", MANAGER_EMAIL, MANAGER_PWD)
        r = s.get(f"{API}/organization/clinicians", timeout=20)
        assert r.status_code == 200, r.text
        assert "clinicians" in r.json()

    def test_manager_post_clinician_403(self, seed_manager):
        s = requests.Session()
        _login(s, "/organization/login", MANAGER_EMAIL, MANAGER_PWD)
        r = s.post(f"{API}/organization/clinicians", json={
            "name": "TEST_Blocked",
            "email": f"blocked_{uuid.uuid4().hex[:6]}@test.ifc",
            "password": "Test@123456",
        }, timeout=20)
        assert r.status_code == 403, r.text
        assert "read-only" in r.text.lower() or "manager" in r.text.lower()

    def test_manager_put_clinician_403(self, seed_manager, org_admin_clinician_id):
        s = requests.Session()
        _login(s, "/organization/login", MANAGER_EMAIL, MANAGER_PWD)
        r = s.put(f"{API}/organization/clinicians/{org_admin_clinician_id}",
                  json={"name": "Hacked"}, timeout=20)
        assert r.status_code == 403, r.text

    def test_manager_delete_clinician_403(self, seed_manager, org_admin_clinician_id):
        s = requests.Session()
        _login(s, "/organization/login", MANAGER_EMAIL, MANAGER_PWD)
        r = s.delete(f"{API}/organization/clinicians/{org_admin_clinician_id}", timeout=20)
        assert r.status_code == 403, r.text


# ─── C. Org_Admin write paths still work ────────────────────────────
@pytest.fixture(scope="module")
def admin_session(seed_admin):
    s = requests.Session()
    r = _login(s, "/organization/login", ORG_ADMIN_EMAIL, ORG_ADMIN_PWD)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def org_admin_clinician_id(admin_session, mongo_db, org_admin_user_id):
    """Create a clinician via admin so Manager can attempt PUT/DELETE on it."""
    email = f"TEST_clin_{uuid.uuid4().hex[:6]}@demo.ifc"
    r = admin_session.post(f"{API}/organization/clinicians", json={
        "name": "TEST Clinician",
        "email": email,
        "password": "Clinic@123456",
        "specialization": "Test Specialty",
    }, timeout=30)
    assert r.status_code == 200, r.text
    user_id = r.json()["clinician"]["user_id"]
    yield user_id
    # cleanup
    mongo_db.users.delete_one({"user_id": user_id})


class TestOrgAdminWrites:
    def test_admin_can_create_clinician(self, admin_session, mongo_db):
        email = f"TEST_admin_clin_{uuid.uuid4().hex[:6]}@demo.ifc"
        r = admin_session.post(f"{API}/organization/clinicians", json={
            "name": "TEST Admin Clinician",
            "email": email,
            "password": "Clinic@123456",
        }, timeout=30)
        assert r.status_code == 200, r.text
        uid = r.json()["clinician"]["user_id"]
        # GET to verify persistence
        listing = admin_session.get(f"{API}/organization/clinicians", timeout=20)
        assert listing.status_code == 200
        ids = [c["user_id"] for c in listing.json()["clinicians"]]
        assert uid in ids
        mongo_db.users.delete_one({"user_id": uid})

    def test_admin_can_update_clinician(self, admin_session, org_admin_clinician_id):
        r = admin_session.put(
            f"{API}/organization/clinicians/{org_admin_clinician_id}",
            json={"name": "TEST Updated Name"},
            timeout=20,
        )
        assert r.status_code == 200, r.text

    def test_admin_can_delete_clinician(self, admin_session, mongo_db):
        # create a throwaway one and delete it
        email = f"TEST_delete_{uuid.uuid4().hex[:6]}@demo.ifc"
        c = admin_session.post(f"{API}/organization/clinicians", json={
            "name": "TEST Delete Me",
            "email": email,
            "password": "Clinic@123456",
        }, timeout=30)
        assert c.status_code == 200, c.text
        uid = c.json()["clinician"]["user_id"]
        d = admin_session.delete(f"{API}/organization/clinicians/{uid}", timeout=20)
        assert d.status_code == 200, d.text
        mongo_db.users.delete_one({"user_id": uid})


# ─── D. Regression: generic /api/auth/login still serves all roles ──
class TestGenericAuthLoginRegression:
    def test_patient_login(self):
        s = requests.Session()
        r = _login(s, "/auth/login", PATIENT_EMAIL, PATIENT_PWD)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "patient"

    def test_org_admin_login(self, seed_admin):
        s = requests.Session()
        r = _login(s, "/auth/login", ORG_ADMIN_EMAIL, ORG_ADMIN_PWD)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "organization"

    def test_clinician_login(self):
        s = requests.Session()
        r = _login(s, "/auth/login", "sarah@demo.ifeelincolor.com", "Clinician@123")
        # demo clinician should exist; if not seeded yet, seed via demo-login
        if r.status_code != 200:
            requests.post(f"{API}/auth/demo-login/seed", json={"role": "clinician"}, timeout=15)
            r = _login(s, "/auth/login", "sarah@demo.ifeelincolor.com", "Clinician@123")
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "clinician"


# ─── Cleanup ──────────────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def _final_cleanup():
    yield
    try:
        client = MongoClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        db.users.delete_many({"email": MANAGER_EMAIL.lower()})
        db.users.delete_many({"email": {"$regex": "^TEST_"}})
        client.close()
    except Exception:
        pass
