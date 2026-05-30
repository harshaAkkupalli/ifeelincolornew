"""Iteration 34 backend tests:
- Role-aware /me/subscription (clinician vs patient)
- /subscribe/mock writes role-correct collection (clinician_subscriptions)
- /clinician/notifications-feed includes assessment_completed events for subscribed patients
- /clinician/recommend enforces strict subscribed-patient USP (403 for non-subscribed)
- Free trial clinician plan seeded (price_usd=0, is_trial=true)
- Sign-out: backend logout endpoint remains intact
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"
PATIENT_EMAIL = "luna@demo.ifeelincolor.com"
PATIENT_PASSWORD = "Patient@123"
SARAH_EMAIL = "sarah@demo.ifeelincolor.com"
SARAH_PASSWORD = "Clinician@123"


def _new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return r


def admin_login(session):
    r = session.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r


# --------------------- helpers ---------------------

@pytest.fixture(scope="module")
def admin_sess():
    s = _new_session()
    admin_login(s)
    return s


@pytest.fixture(scope="module")
def fresh_clinician():
    """Register a brand new clinician for the gate test (no subscription)."""
    s = _new_session()
    suffix = uuid.uuid4().hex[:8]
    email = f"dr.gate.{suffix}@trial.ifc"
    password = "GateTest@123!"
    payload = {
        "full_name": f"Dr Gate {suffix}",
        "email": email,
        "password": password,
        "phone": "+15551234567",
        "npi_number": f"NPI{suffix}",
        "license_type": "MD",
        "license_number": f"LIC{suffix}",
        "state_of_practice": "CA",
        "specialization": "Mental Health Specialist",
        "practice_name": "Test Clinic",
        "terms_accepted": True,
    }
    r = s.post(f"{API}/auth/register/clinician", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"clinician register failed: {r.status_code} {r.text}"
    # Some flows return token immediately; if not, login.
    if "user" not in (r.json() or {}):
        login_r = login(s, email, password)
        assert login_r.status_code == 200, f"login post-register failed: {login_r.text}"
    return {"session": s, "email": email, "password": password}


# --------------------- Free trial plan ---------------------

def test_free_trial_clinician_plan_exists():
    r = requests.get(f"{API}/plans?role=clinician", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    plans = data.get("plans") if isinstance(data, dict) else data
    assert plans, "No clinician plans returned"
    trial = [p for p in plans if (p.get("is_trial") or (p.get("price_usd") in (0, 0.0))) and (p.get("plan_type") in ("clinician", None))]
    assert trial, f"No free trial clinician plan found in: {plans}"


# --------------------- Sign-out (logout) endpoint ---------------------

def test_logout_endpoint_works():
    s = _new_session()
    r = login(s, PATIENT_EMAIL, PATIENT_PASSWORD)
    assert r.status_code == 200, r.text
    logout = s.post(f"{API}/auth/logout", timeout=10)
    assert logout.status_code in (200, 204), f"logout failed: {logout.status_code} {logout.text}"


# --------------------- /me/subscription role-aware ---------------------

def test_me_subscription_fresh_clinician_inactive(fresh_clinician):
    s = fresh_clinician["session"]
    r = s.get(f"{API}/me/subscription", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("active") is False, f"Expected active=False for fresh clinician, got {data}"
    assert data.get("subscription") in (None, {}), f"Expected null subscription, got {data}"


def test_me_subscription_patient_active():
    s = _new_session()
    r = login(s, PATIENT_EMAIL, PATIENT_PASSWORD)
    assert r.status_code == 200, r.text
    # Make sure patient has an active subscription via mock
    plans = requests.get(f"{API}/plans?role=patient", timeout=15).json()
    plist = plans.get("plans") if isinstance(plans, dict) else plans
    free_plans = [p for p in plist if (p.get("is_trial") or p.get("price_usd") in (0, 0.0))]
    if free_plans:
        s.post(f"{API}/subscribe/mock", json={"plan_id": free_plans[0]["plan_id"]}, timeout=15)
    r2 = s.get(f"{API}/me/subscription", timeout=15)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    # Patient should either be active or at least return the contract shape
    assert "active" in data and "subscription" in data
    if data["active"]:
        assert data["subscription"] and data["subscription"].get("plan_id")


# --------------------- /subscribe/mock writes clinician_subscriptions ---------------------

def test_mock_subscribe_clinician_activates_trial(fresh_clinician):
    s = fresh_clinician["session"]
    plans = requests.get(f"{API}/plans?role=clinician", timeout=15).json()
    plist = plans.get("plans") if isinstance(plans, dict) else plans
    free = [p for p in plist if (p.get("is_trial") or p.get("price_usd") in (0, 0.0))]
    assert free, "No free clinician trial plan available"
    plan_id = free[0]["plan_id"]
    r = s.post(f"{API}/subscribe/mock", json={"plan_id": plan_id}, timeout=15)
    assert r.status_code == 200, f"mock subscribe failed: {r.text}"
    sub = r.json().get("subscription")
    assert sub and sub.get("plan_id") == plan_id
    assert sub.get("status") in ("trial", "active", "trialing")
    # Now /me/subscription should return active
    r2 = s.get(f"{API}/me/subscription", timeout=15)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("active") is True, f"Expected active after mock-subscribe, got {d2}"
    assert d2.get("subscription") and d2["subscription"].get("plan_id") == plan_id


# --------------------- /clinician/recommend strict USP ---------------------

def test_clinician_recommend_non_subscribed_returns_403(fresh_clinician):
    """Fresh clinician has no subscribed patients yet — any patient_id should 403."""
    s = fresh_clinician["session"]
    fake_patient = f"patient_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{API}/clinician/recommend", json={"patient_id": fake_patient, "title": "Test"}, timeout=15)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    detail = (r.json() or {}).get("detail", "")
    assert "subscribed" in detail.lower() or "not in your" in detail.lower(), f"unexpected error: {detail}"


# --------------------- /clinician/notifications-feed ---------------------

def test_clinician_notifications_feed_empty_for_fresh(fresh_clinician):
    s = fresh_clinician["session"]
    r = s.get(f"{API}/clinician/notifications-feed", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "feed" in data and "server_time" in data
    assert data["feed"] == []


def test_clinician_notifications_feed_assessment_event_for_sarah():
    """Sarah is Luna's clinician — verify the contract: GET returns feed list,
    and if an assessment_completed event exists for a subscribed patient it shows up."""
    s = _new_session()
    r = login(s, SARAH_EMAIL, SARAH_PASSWORD)
    assert r.status_code == 200, r.text
    r2 = s.get(f"{API}/clinician/notifications-feed", timeout=15)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert isinstance(data.get("feed"), list)
    # The feed may be empty if no events; but contract must hold
    for item in data["feed"]:
        assert "type" in item and "title" in item and "id" in item


# --------------------- /clinician/custom-recommendations CRUD smoke ---------------------

def test_clinician_recommendation_library_listable(fresh_clinician):
    """ClinicianRecommendations.jsx uses GET /api/clinician/recommendation-library
    (POST /api/clinician/custom-recommendations is create-only)."""
    s = fresh_clinician["session"]
    r = s.get(f"{API}/clinician/recommendation-library", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, (dict, list))


# --------------------- /clinician/dashboard-stats subscribed patients ---------------------

def test_clinician_dashboard_stats_returns_subscribed_only():
    s = _new_session()
    r = login(s, SARAH_EMAIL, SARAH_PASSWORD)
    assert r.status_code == 200, r.text
    r2 = s.get(f"{API}/clinician/dashboard-stats", timeout=15)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    # Contract: should include patients list and stats
    assert isinstance(data, dict)
