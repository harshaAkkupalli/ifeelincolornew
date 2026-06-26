"""
Iteration 40 — Regression tests for two P0 bugs:

(A) PAID plans must NOT be silently activated through the mock/free endpoints.
    Both `/api/subscribe/mock` and `/api/patient/doctors/subscribe-paid`
    must return HTTP 402 when the resolved plan price > 0.

(B) Clinician patient counts must be consistent across:
       • GET /api/clinician/patients                  (canonical list)
       • GET /api/clinician/dashboard-stats           (must match the list)
       • GET /api/admin/clinicians                    (assigned_patient_count
                                                       per clinician must match
                                                       that clinician's own
                                                       dashboard-stats)
"""

import os
import pytest
import requests

# Load frontend/.env so REACT_APP_BACKEND_URL is available without a wrapper.
def _load_backend_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE_URL = _load_backend_url()

PATIENT_EMAIL = "luna@demo.ifeelincolor.com"
PATIENT_PASSWORD = "Patient@123"
CLINICIAN_EMAIL = "sarah@demo.ifeelincolor.com"
CLINICIAN_PASSWORD = "Clinician@123"
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"


# ─── Shared session helpers ──────────────────────────────────────────────

def _login(email: str, password: str, path: str = "/api/auth/login") -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}{path}", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("token") or body.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def patient_session():
    return _login(PATIENT_EMAIL, PATIENT_PASSWORD)


@pytest.fixture(scope="module")
def clinician_session():
    return _login(CLINICIAN_EMAIL, CLINICIAN_PASSWORD)


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ─── (A) Paid-plan bypass protection ─────────────────────────────────────

class TestPaidPlanBlockedFromMockEndpoints:
    """`/subscribe/mock` and `/patient/doctors/subscribe-paid` must refuse
    paid plans with HTTP 402."""

    # ---- /subscribe/mock — portal/patient plans ----
    def _get_portal_plans(self, session):
        for path in ("/api/subscribe/plans", "/api/plans", "/api/patient/plans"):
            r = session.get(f"{BASE_URL}{path}", timeout=20)
            if r.status_code == 200:
                data = r.json()
                plans = data.get("plans") if isinstance(data, dict) else data
                if plans:
                    return plans
        return []

    def test_portal_paid_plan_returns_402(self, patient_session):
        # plan_monthly is the canonical $29 portal plan referenced in the spec
        r = patient_session.post(
            f"{BASE_URL}/api/subscribe/mock",
            json={"plan_id": "plan_monthly"},
            timeout=20,
        )
        # Either the plan exists and we get 402, or the plan_id was not found
        # (404) — but we want explicit 402 for the seeded paid plan.
        assert r.status_code in (402, 404), f"Expected 402, got {r.status_code}: {r.text}"
        if r.status_code == 404:
            # Try every plan from the catalog with price > 0 to guarantee
            # at least one paid plan is tested.
            plans = self._get_portal_plans(patient_session)
            paid = [p for p in plans if float(p.get("price_usd") or p.get("price") or 0) > 0]
            assert paid, "No paid portal plan found in catalog — cannot verify 402 path"
            r2 = patient_session.post(
                f"{BASE_URL}/api/subscribe/mock",
                json={"plan_id": paid[0].get("plan_id")},
                timeout=20,
            )
            assert r2.status_code == 402, f"Expected 402 for paid plan, got {r2.status_code}: {r2.text}"

    def test_portal_free_trial_plan_succeeds(self, patient_session):
        # The seeded free trial plan ID from the spec
        r = patient_session.post(
            f"{BASE_URL}/api/subscribe/mock",
            json={"plan_id": "plan_9215176fa114"},
            timeout=20,
        )
        # Either 200 (newly activated) or 400/409 (already subscribed).
        # We must NOT get 402 (would mean the free plan was misclassified).
        assert r.status_code != 402, f"Free plan rejected as paid: {r.text}"
        assert r.status_code in (200, 201, 400, 409, 404), \
            f"Unexpected status for free trial: {r.status_code} {r.text}"

    # ---- /patient/doctors/subscribe-paid — clinician plans ----
    def _list_clinician_plans(self, session):
        r = session.get(f"{BASE_URL}/api/clinician-plans", timeout=20)
        assert r.status_code == 200, f"Cannot list clinician plans: {r.status_code} {r.text}"
        body = r.json()
        return body.get("plans") if isinstance(body, dict) else body

    def _pick_doctor_id(self, session):
        # Pull Sarah's user_id via any available endpoint
        r = session.get(f"{BASE_URL}/api/patient/doctors/list", timeout=20)
        if r.status_code != 200:
            r = session.get(f"{BASE_URL}/api/patient/doctors", timeout=20)
        if r.status_code == 200:
            data = r.json()
            doctors = data.get("doctors") or data.get("patients") or []
            if doctors:
                return doctors[0].get("user_id") or doctors[0].get("doctor_id")
        return "doc_dummy"  # unknown doctor — backend should still reach the price-check before the doctor lookup

    def test_clinician_paid_plan_returns_402(self, patient_session):
        plans = self._list_clinician_plans(patient_session)
        paid = [p for p in plans if float(p.get("price") or p.get("price_usd") or 0) > 0]
        assert paid, "No paid clinician plan present — cannot test 402"
        doctor_id = self._pick_doctor_id(patient_session)
        r = patient_session.post(
            f"{BASE_URL}/api/patient/doctors/subscribe-paid",
            json={"doctor_id": doctor_id, "plan_id": paid[0]["plan_id"]},
            timeout=20,
        )
        assert r.status_code == 402, (
            f"Paid clinician plan was NOT rejected with 402. "
            f"Got {r.status_code}: {r.text}"
        )

    def test_clinician_free_trial_plan_does_not_402(self, patient_session):
        plans = self._list_clinician_plans(patient_session)
        free = [p for p in plans if float(p.get("price") or p.get("price_usd") or 0) == 0]
        if not free:
            pytest.skip("No free clinician plan exists to exercise the success path")
        doctor_id = self._pick_doctor_id(patient_session)
        r = patient_session.post(
            f"{BASE_URL}/api/patient/doctors/subscribe-paid",
            json={"doctor_id": doctor_id, "plan_id": free[0]["plan_id"]},
            timeout=20,
        )
        assert r.status_code != 402, (
            f"Free clinician plan misclassified as paid: {r.text}"
        )
        assert r.status_code in (200, 201, 400, 404, 409), \
            f"Unexpected status {r.status_code}: {r.text}"


# ─── (B) Patient-count consistency across portals ────────────────────────

class TestClinicianCountConsistency:
    """patient_count / subscribed_count from dashboard-stats must equal the
    length of /clinician/patients, and admin's assigned_patient_count must
    equal the clinician's own dashboard-stats patient_count."""

    def test_dashboard_stats_matches_patients_list(self, clinician_session):
        r_stats = clinician_session.get(f"{BASE_URL}/api/clinician/dashboard-stats", timeout=20)
        assert r_stats.status_code == 200, f"dashboard-stats failed: {r_stats.text}"
        stats = r_stats.json()

        r_pts = clinician_session.get(f"{BASE_URL}/api/clinician/patients", timeout=20)
        assert r_pts.status_code == 200, f"/clinician/patients failed: {r_pts.text}"
        patients = r_pts.json().get("patients") or []

        list_count = len(patients)
        assert stats.get("patient_count") == list_count, (
            f"patient_count {stats.get('patient_count')} != /patients list len {list_count}"
        )
        assert stats.get("subscribed_count") == list_count, (
            f"subscribed_count {stats.get('subscribed_count')} != /patients list len {list_count}"
        )
        # Same user_ids set
        list_ids = {p.get("user_id") for p in patients}
        stats_ids = {p.get("user_id") for p in (stats.get("patients") or [])}
        assert list_ids == stats_ids, (
            f"User-id mismatch — list:{list_ids} vs stats:{stats_ids}"
        )

    def test_admin_assigned_patient_count_matches_clinician_dashboard(
        self, clinician_session, admin_session
    ):
        # Fetch clinician's own count first
        r_stats = clinician_session.get(f"{BASE_URL}/api/clinician/dashboard-stats", timeout=20)
        assert r_stats.status_code == 200
        clinician_count = r_stats.json().get("patient_count")
        clinician_user_id = r_stats.json().get("clinician_id") or None

        # Pull from admin
        r_admin = admin_session.get(
            f"{BASE_URL}/api/admin/clinicians",
            params={"search": "sarah"},
            timeout=20,
        )
        assert r_admin.status_code == 200, f"admin/clinicians failed: {r_admin.text}"
        clinicians = r_admin.json().get("clinicians") or []
        sarah = next(
            (c for c in clinicians if (c.get("email") or "").lower() == CLINICIAN_EMAIL),
            None,
        )
        assert sarah, "Sarah not returned from /api/admin/clinicians"
        admin_count = sarah.get("assigned_patient_count")
        assert admin_count == clinician_count, (
            f"Admin assigned_patient_count {admin_count} != "
            f"clinician dashboard-stats patient_count {clinician_count}"
        )

    def test_luna_in_sarah_patients_list(self, clinician_session, patient_session):
        # Luna's user_id
        r_me = patient_session.get(f"{BASE_URL}/api/auth/me", timeout=20)
        if r_me.status_code != 200:
            r_me = patient_session.get(f"{BASE_URL}/api/users/me", timeout=20)
        assert r_me.status_code == 200, f"who-am-i failed: {r_me.text}"
        luna_id = (r_me.json().get("user") or r_me.json()).get("user_id")
        assert luna_id, "Could not resolve Luna's user_id"

        r_pts = clinician_session.get(f"{BASE_URL}/api/clinician/patients", timeout=20)
        assert r_pts.status_code == 200
        ids = {p.get("user_id") for p in r_pts.json().get("patients") or []}
        assert luna_id in ids, (
            f"Luna ({luna_id}) not present in Sarah's caseload: {ids}"
        )
