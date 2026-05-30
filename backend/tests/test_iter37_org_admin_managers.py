"""Iteration 37 — Admin manages Managers; Managers manage Clinicians; Portal subscription."""
import os, uuid, pytest, requests
from passlib.context import CryptContext
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@demo.ifeelincolor.com"
ADMIN_PWD = "Organization@123"
MANAGER_EMAIL = "manager.test@demo.ifeelincolor.com"
MANAGER_PWD = "Manager@123"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="module")
def db():
    c = MongoClient(os.environ["MONGO_URL"])
    yield c[os.environ["DB_NAME"]]
    c.close()


@pytest.fixture(scope="module")
def seed_admin():
    try:
        requests.post(f"{API}/auth/demo-login/seed", json={"role": "organization"}, timeout=15)
    except Exception:
        pass
    return True


@pytest.fixture(scope="module")
def admin_uid(db, seed_admin):
    u = db.users.find_one({"email": ADMIN_EMAIL.lower()})
    assert u
    if u.get("role_tier") == "Org_Manager":
        db.users.update_one({"_id": u["_id"]}, {"$set": {"role_tier": "Org_Admin"}})
    return u["user_id"]


@pytest.fixture(scope="module")
def seed_manager(db, admin_uid):
    email = MANAGER_EMAIL.lower()
    existing = db.users.find_one({"email": email})
    if existing:
        db.users.update_one({"email": email}, {"$set": {
            "role": "organization", "role_tier": "Org_Manager",
            "org_id": admin_uid, "password_hash": pwd_ctx.hash(MANAGER_PWD),
            "status": "active",
        }})
        return existing["user_id"]
    uid = f"user_{uuid.uuid4().hex[:12]}"
    db.users.insert_one({
        "user_id": uid, "email": email, "name": "Test Manager",
        "role": "organization", "role_tier": "Org_Manager",
        "org_id": admin_uid, "password_hash": pwd_ctx.hash(MANAGER_PWD),
        "status": "active", "created_at": "2026-01-01T00:00:00+00:00",
    })
    return uid


def _login(s, email, pwd):
    return s.post(f"{API}/organization/login", json={"email": email, "password": pwd}, timeout=20)


@pytest.fixture
def admin_session(seed_admin):
    s = requests.Session()
    r = _login(s, ADMIN_EMAIL, ADMIN_PWD)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def manager_session(seed_manager):
    s = requests.Session()
    r = _login(s, MANAGER_EMAIL, MANAGER_PWD)
    assert r.status_code == 200, r.text
    return s


# ─── A. Admin Manager CRUD ─────────────────────────────────────────
class TestAdminManagerCRUD:
    def test_admin_create_manager(self, admin_session, db, admin_uid):
        email = f"TEST_mgr_{uuid.uuid4().hex[:6]}@demo.ifc"
        r = admin_session.post(f"{API}/organization/managers", json={
            "name": "TEST Mgr", "email": email, "password": "Mgr@123456",
            "mobile": "5551234567",
        }, timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        m = data.get("manager") or data
        assert m["role_tier"] == "Org_Manager"
        assert m["org_id"] == admin_uid
        uid = m["user_id"]
        # GET verify
        listing = admin_session.get(f"{API}/organization/managers", timeout=20)
        assert listing.status_code == 200
        mgrs = listing.json()["managers"]
        found = [x for x in mgrs if x["user_id"] == uid]
        assert found, "Created manager missing from list"
        assert "clinician_count" in found[0]
        # PUT
        u = admin_session.put(f"{API}/organization/managers/{uid}",
                              json={"name": "TEST Updated Mgr", "active": False}, timeout=20)
        assert u.status_code == 200, u.text
        doc = db.users.find_one({"user_id": uid})
        assert doc["name"] == "TEST Updated Mgr"
        assert doc["status"] == "disabled"
        # Re-enable so DELETE test works on different one (cleanup below)
        # DELETE
        d = admin_session.delete(f"{API}/organization/managers/{uid}", timeout=20)
        assert d.status_code == 200, d.text
        doc = db.users.find_one({"user_id": uid})
        assert doc["status"] == "disabled"
        db.users.delete_one({"user_id": uid})


# ─── B. Manager forbidden from /managers ───────────────────────────
class TestManagerCannotManageManagers:
    def test_manager_get_managers_403(self, manager_session):
        r = manager_session.get(f"{API}/organization/managers", timeout=20)
        assert r.status_code == 403, r.text

    def test_manager_post_managers_403(self, manager_session):
        r = manager_session.post(f"{API}/organization/managers", json={
            "name": "X", "email": f"x_{uuid.uuid4().hex[:4]}@x.ifc", "password": "X@123456"
        }, timeout=20)
        assert r.status_code == 403

    def test_manager_put_managers_403(self, manager_session):
        r = manager_session.put(f"{API}/organization/managers/anything", json={"name": "X"}, timeout=20)
        assert r.status_code == 403

    def test_manager_delete_managers_403(self, manager_session):
        r = manager_session.delete(f"{API}/organization/managers/anything", timeout=20)
        assert r.status_code == 403


# ─── C. Manager CAN manage clinicians ──────────────────────────────
class TestManagerCanManageClinicians:
    def test_manager_create_clinician_succeeds(self, manager_session, seed_manager, admin_uid, db):
        email = f"TEST_mgrclin_{uuid.uuid4().hex[:6]}@demo.ifc"
        r = manager_session.post(f"{API}/organization/clinicians", json={
            "name": "TEST Mgr Clinician", "email": email,
            "password": "Clinic@123456", "specialization": "Spec",
        }, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()["clinician"]
        assert c["org_id"] == admin_uid
        assert c["clinician_info"]["manager_id"] == seed_manager
        # Manager GET should include it
        listing = manager_session.get(f"{API}/organization/clinicians", timeout=20)
        assert listing.status_code == 200
        ids = [x["user_id"] for x in listing.json()["clinicians"]]
        assert c["user_id"] in ids
        # PUT works
        u = manager_session.put(f"{API}/organization/clinicians/{c['user_id']}",
                                json={"name": "TEST Updated"}, timeout=20)
        assert u.status_code == 200
        # DELETE works
        d = manager_session.delete(f"{API}/organization/clinicians/{c['user_id']}", timeout=20)
        assert d.status_code == 200
        db.users.delete_one({"user_id": c["user_id"]})

    def test_manager_scoped_listing(self, manager_session, admin_session, db, admin_uid, seed_manager):
        """Admin creates a clinician (not assigned to this manager). Manager must NOT see it."""
        email = f"TEST_adminclin_{uuid.uuid4().hex[:6]}@demo.ifc"
        r = admin_session.post(f"{API}/organization/clinicians", json={
            "name": "TEST Admin Clin", "email": email, "password": "Clinic@123456",
        }, timeout=30)
        assert r.status_code == 200
        cid = r.json()["clinician"]["user_id"]
        # Admin sees all
        a_list = admin_session.get(f"{API}/organization/clinicians", timeout=20).json()["clinicians"]
        assert cid in [c["user_id"] for c in a_list]
        # Manager should NOT see
        m_list = manager_session.get(f"{API}/organization/clinicians", timeout=20).json()["clinicians"]
        assert cid not in [c["user_id"] for c in m_list]
        # Manager PUT 404
        p = manager_session.put(f"{API}/organization/clinicians/{cid}", json={"name": "X"}, timeout=20)
        assert p.status_code == 404, p.text
        # Manager DELETE 404
        d = manager_session.delete(f"{API}/organization/clinicians/{cid}", timeout=20)
        assert d.status_code == 404
        # cleanup
        admin_session.delete(f"{API}/organization/clinicians/{cid}", timeout=20)
        db.users.delete_one({"user_id": cid})


# ─── D. Portal plans + subscription ────────────────────────────────
class TestPortalSubscription:
    def test_admin_get_portal_plans(self, admin_session):
        r = admin_session.get(f"{API}/organization/portal-plans", timeout=20)
        assert r.status_code == 200, r.text
        assert "plans" in r.json()

    def test_manager_portal_plans_403(self, manager_session):
        r = manager_session.get(f"{API}/organization/portal-plans", timeout=20)
        assert r.status_code == 403

    def test_admin_portal_subscription_null_then_populated(self, admin_session, db, admin_uid):
        # Cleanup
        db.organization_subscriptions.delete_many({"user_id": admin_uid})
        r = admin_session.get(f"{API}/organization/portal-subscription", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["subscription"] is None
        # Insert fake active sub
        db.organization_subscriptions.insert_one({
            "subscription_id": "sub_TEST_iter37",
            "user_id": admin_uid, "status": "active",
            "plan_id": "plan_org_test", "audience": "organization_portal",
        })
        r2 = admin_session.get(f"{API}/organization/portal-subscription", timeout=20)
        assert r2.status_code == 200
        sub = r2.json()["subscription"]
        assert sub is not None
        assert sub["user_id"] == admin_uid
        # cleanup
        db.organization_subscriptions.delete_many({"subscription_id": "sub_TEST_iter37"})


# ─── E. Razorpay order with organization_portal kind ───────────────
class TestRazorpayOrder:
    def test_razorpay_order_org_portal(self, admin_session, db):
        # Seed test plan
        db.subscription_plans.delete_many({"plan_id": "plan_org_test_iter37"})
        db.subscription_plans.insert_one({
            "plan_id": "plan_org_test_iter37", "name": "Org Portal Test",
            "audience": "organization_portal", "plan_type": "organization_portal",
            "price_usd": 1, "duration_days": 30, "active": True, "is_archived": False,
        })
        r = admin_session.post(f"{API}/razorpay/order", json={
            "kind": "organization_portal", "plan_id": "plan_org_test_iter37",
        }, timeout=20)
        # 200 (order ok), 503 (not configured), or 502 (keys configured but auth failed at Razorpay).
        # All three prove resolve_plan accepted organization_portal kind.
        assert r.status_code in (200, 502, 503), r.text
        body = r.text.lower()
        if r.status_code == 200:
            assert "order_id" in r.json() or "id" in r.json()
        else:
            # Must mention razorpay (not a 400 from bad plan resolution)
            assert "razorpay" in body
        db.subscription_plans.delete_many({"plan_id": "plan_org_test_iter37"})


# ─── F. Regression: generic auth login ─────────────────────────────
class TestAuthRegression:
    def test_auth_login_admin(self, seed_admin):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=20)
        assert r.status_code == 200
        assert r.json()["role"] == "organization"

    def test_auth_login_manager(self, seed_manager):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": MANAGER_EMAIL, "password": MANAGER_PWD}, timeout=20)
        assert r.status_code == 200
        assert r.json()["role"] == "organization"
        assert r.json().get("role_tier") == "Org_Manager"

    def test_org_login_admin(self, seed_admin):
        s = requests.Session()
        r = s.post(f"{API}/organization/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=20)
        assert r.status_code == 200
        assert r.json()["role_tier"] == "Org_Admin"

    def test_org_login_manager(self, seed_manager):
        s = requests.Session()
        r = s.post(f"{API}/organization/login", json={"email": MANAGER_EMAIL, "password": MANAGER_PWD}, timeout=20)
        assert r.status_code == 200
        assert r.json()["role_tier"] == "Org_Manager"


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    try:
        c = MongoClient(os.environ["MONGO_URL"])
        d = c[os.environ["DB_NAME"]]
        d.users.delete_many({"email": {"$regex": "^TEST_"}})
        d.subscription_plans.delete_many({"plan_id": "plan_org_test_iter37"})
        d.organization_subscriptions.delete_many({"subscription_id": "sub_TEST_iter37"})
        c.close()
    except Exception:
        pass
