"""
Iteration 23 backend tests — Phase R admin roadmap + manual recs + clinician roadmap.

Covers:
 - GET /api/admin/patient/{patient_id}/full-history (admin cookie auth)
 - POST /api/admin/patient/{patient_id}/recommendation (library + inline)
 - GET /api/clinician/patient/{patient_id}/full-history (clinician cookie auth)
 - Gmail SMTP regression: POST /api/auth/forgot-password
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PW = "Admin@123!"


# ─── Fixtures ───

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "clinician"}, timeout=15)
    assert r.status_code == 200, f"Clinician demo-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "patient"}, timeout=15)
    assert r.status_code == 200, f"Patient demo-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def luna_id(admin_session):
    # find seeded Luna patient via admin search
    r = admin_session.get(f"{BASE_URL}/api/admin/patients?search=luna", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data.get("patients") or data.get("items") or data.get("users") or data
    if isinstance(items, dict):
        items = items.get("data") or items.get("results") or []
    luna = None
    for u in items:
        if "luna" in (u.get("email", "") + " " + (u.get("name") or "")).lower():
            luna = u
            break
    assert luna, f"Luna not found in admin patient list. response keys={list(data.keys()) if isinstance(data, dict) else type(data)}"
    return luna.get("user_id") or luna.get("id")


# ─── Admin Full History ───

class TestAdminFullHistory:
    def test_full_history_shape(self, admin_session, luna_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/patient/{luna_id}/full-history", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "patient" in d
        assert "subscription" in d
        assert "timeline" in d
        assert "counts" in d
        assert isinstance(d["timeline"], list)
        c = d["counts"]
        assert "checkins" in c and "assessments" in c and "recommendations_given" in c

    def test_full_history_counts_positive_for_luna(self, admin_session, luna_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/patient/{luna_id}/full-history", timeout=20)
        d = r.json()
        # Luna is seeded with check-ins + 19 assessments + 14 recommendations
        assert d["counts"]["assessments"] > 0, f"expected assessments>0, got {d['counts']}"
        assert d["counts"]["recommendations_given"] > 0, f"expected recs>0, got {d['counts']}"

    def test_timeline_event_types_and_sort(self, admin_session, luna_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/patient/{luna_id}/full-history", timeout=20)
        d = r.json()
        types = {ev.get("type") for ev in d["timeline"]}
        assert types.intersection({"assessment", "recommendation"}), f"timeline missing required types: {types}"
        # sorted desc by date
        dates = [ev.get("date") or "" for ev in d["timeline"]]
        assert dates == sorted(dates, reverse=True), "timeline not sorted by date desc"

    def test_full_history_requires_admin(self, luna_id):
        r = requests.get(f"{BASE_URL}/api/admin/patient/{luna_id}/full-history", timeout=15)
        assert r.status_code in (401, 403), f"expected auth required, got {r.status_code}"

    def test_full_history_patient_not_found(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/patient/nonexistent-xyz/full-history", timeout=15)
        assert r.status_code == 404


# ─── Admin Manual Recommendation ───

class TestAdminManualRecommendation:
    def test_manual_inline_recommendation(self, admin_session, patient_session, luna_id):
        payload = {
            "title": "TEST_iter23 Manual inline rec",
            "body_md": "Hello from iter23 test",
            "content_type": "text",
            "description": "iter23 description",
        }
        r = admin_session.post(
            f"{BASE_URL}/api/admin/patient/{luna_id}/recommendation",
            json=payload, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        a = d.get("activity", {})
        assert a.get("source") == "admin"
        assert a.get("trigger") == "manual"
        assert a.get("from_admin") is True
        assert a.get("title") == payload["title"]
        assert a.get("activity_id"), "missing activity_id"

        # Verify activity persisted by re-reading admin full-history timeline
        r2 = admin_session.get(f"{BASE_URL}/api/admin/patient/{luna_id}/full-history", timeout=20)
        assert r2.status_code == 200
        titles = [ev.get("title") for ev in r2.json()["timeline"] if ev.get("type") == "recommendation"]
        assert payload["title"] in titles, \
            f"new rec not visible in admin roadmap. recent recs={titles[:10]}"

    def test_manual_library_recommendation(self, admin_session, luna_id):
        # pick a library rec
        r = admin_session.get(f"{BASE_URL}/api/admin/recommendations", timeout=15)
        if r.status_code != 200:
            pytest.skip(f"library list unavailable: {r.status_code}")
        body = r.json()
        items = body if isinstance(body, list) else (body.get("recommendations") or body.get("items") or [])
        if not items:
            pytest.skip("No library recommendations seeded")
        lib = items[0]
        rec_id = lib.get("recommendation_id") or lib.get("id")
        if not rec_id:
            pytest.skip("library rec missing id")
        r2 = admin_session.post(
            f"{BASE_URL}/api/admin/patient/{luna_id}/recommendation",
            json={"recommendation_id": rec_id}, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["ok"] is True
        a = d["activity"]
        assert a["source"] == "admin"
        assert a["trigger"] == "manual"
        assert a.get("recommendation_id") == rec_id

    def test_manual_recommendation_unknown_patient(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/patient/unknown-xyz/recommendation",
            json={"title": "x"}, timeout=15,
        )
        assert r.status_code == 404


# ─── Clinician Full History ───

class TestClinicianFullHistory:
    def test_clinician_full_history(self, clinician_session, luna_id):
        r = clinician_session.get(f"{BASE_URL}/api/clinician/patient/{luna_id}/full-history", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "patient" in d
        assert isinstance(d.get("timeline"), list)
        types = {ev.get("type") for ev in d["timeline"]}
        # clinician should at least see assessments
        assert "assessment" in types or "recommendation" in types or "checkin" in types, \
            f"clinician timeline empty/unexpected: {types}"


# ─── Gmail SMTP regression ───

class TestGmailRegression:
    def test_forgot_password_sanity(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "ram@projexino.com"}, timeout=20,
        )
        # endpoint may return 200 regardless to prevent enumeration
        assert r.status_code == 200, r.text
        d = r.json()
        # delivery_status='sent' only when the user exists; for unknown emails it can be 'skipped'
        assert "delivery_status" in d or "message" in d or d.get("ok") is True
