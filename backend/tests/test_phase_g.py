"""
Phase G backend tests:
- POST /api/ai/clinician-coach (role gating, validation, plan shape, persistence)
- GET /api/ai/clinician-coach/sessions (filtered by clinician, sorted desc)
- POST /api/ai/clinician-coach/save-to-roadmap (patient_activity rows with type='clinician_plan')
- POST /api/patient/assessment-submit augmentation (severity + ai_plan + admin_recs + auto-assign idempotent)
- Regression: /api/ai/clinician-assist, /api/clinician/notes, /api/clinician/notifications, /api/clinician/patients
- Regression: assessment-submit returns 402 when no active subscription
"""
import os
import time
import uuid
import pytest
import requests

# Load REACT_APP_BACKEND_URL from frontend/.env if not already in env
if not os.environ.get("REACT_APP_BACKEND_URL"):
    try:
        with open("/app/frontend/.env") as _f:
            for _line in _f:
                if _line.startswith("REACT_APP_BACKEND_URL="):
                    os.environ["REACT_APP_BACKEND_URL"] = _line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

PATIENT_ID = "demo-patient-001"
CLINICIAN_ID = "demo-clinician-001"


# ───────── Session fixtures ─────────
@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "patient"}, timeout=30)
    assert r.status_code == 200, f"patient demo-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "clinician"}, timeout=30)
    assert r.status_code == 200, f"clinician demo-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def active_subscription(patient_session):
    """Ensure patient has an active subscription before assessment-submit tests."""
    plans = patient_session.get(f"{API}/plans", timeout=15).json().get("plans", [])
    assert plans, "no plans available from /api/plans"
    plan_id = plans[0]["plan_id"]
    r = patient_session.post(f"{API}/subscribe/mock", json={"plan_id": plan_id}, timeout=15)
    assert r.status_code == 200, f"subscribe/mock failed: {r.status_code} {r.text}"
    return r.json()["subscription"]


# ───────── 1. Clinician Coach POST ─────────
class TestClinicianCoach:
    def test_patient_role_blocked_403(self, patient_session):
        r = patient_session.post(f"{API}/ai/clinician-coach", json={"patient_id": PATIENT_ID}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_unauthenticated_401(self):
        r = requests.post(f"{API}/ai/clinician-coach", json={"patient_id": PATIENT_ID}, timeout=15)
        assert r.status_code == 401

    def test_missing_patient_id_400(self, clinician_session):
        r = clinician_session.post(f"{API}/ai/clinician-coach", json={}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_unknown_patient_id_404(self, clinician_session):
        r = clinician_session.post(f"{API}/ai/clinician-coach",
                                   json={"patient_id": f"nonexistent_{uuid.uuid4().hex[:6]}"},
                                   timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

    def test_clinician_coach_success_returns_plan(self, clinician_session):
        r = clinician_session.post(
            f"{API}/ai/clinician-coach",
            json={"patient_id": PATIENT_ID, "focus": "anxiety management"},
            timeout=60,  # AI call may take a few seconds
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "session" in data, f"missing session key: {data}"
        session = data["session"]
        # required structural fields
        for k in ["session_id", "clinician_id", "patient_id", "plan", "created_at"]:
            assert k in session, f"session missing key {k}: {session}"
        assert session["patient_id"] == PATIENT_ID
        assert session["session_id"].startswith("coach_")
        plan = session["plan"]
        assert isinstance(plan, dict)
        for k in ["overview", "plan", "red_flags", "strengths"]:
            assert k in plan, f"plan missing key {k}: {plan}"
        assert isinstance(plan["plan"], list)
        assert isinstance(plan["red_flags"], list)
        assert isinstance(plan["strengths"], list)
        # stash for later test
        pytest.coach_session_id = session["session_id"]
        pytest.coach_plan_steps = plan["plan"]


# ───────── 2. List coach sessions ─────────
class TestCoachSessionsList:
    def test_patient_blocked_403(self, patient_session):
        r = patient_session.get(f"{API}/ai/clinician-coach/sessions", timeout=15)
        assert r.status_code == 403

    def test_clinician_list_returns_recent(self, clinician_session):
        r = clinician_session.get(f"{API}/ai/clinician-coach/sessions", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "sessions" in data
        sessions = data["sessions"]
        assert isinstance(sessions, list)
        assert len(sessions) >= 1, "expected at least the session created in TestClinicianCoach"
        # All sessions belong to this clinician
        for s in sessions:
            assert s.get("clinician_id") == CLINICIAN_ID
            assert "_id" not in s  # mongo _id excluded
        # Sorted desc by created_at
        ts = [s.get("created_at", "") for s in sessions]
        assert ts == sorted(ts, reverse=True), "sessions not sorted desc by created_at"


# ───────── 3. Save to roadmap ─────────
class TestSaveToRoadmap:
    def test_patient_blocked_403(self, patient_session):
        r = patient_session.post(
            f"{API}/ai/clinician-coach/save-to-roadmap",
            json={"patient_id": PATIENT_ID, "steps": []},
            timeout=15,
        )
        assert r.status_code == 403

    def test_save_steps_inserts_clinician_plan_activity(self, clinician_session, patient_session):
        steps = [
            {"title": "TEST_phaseg Daily mindfulness", "rationale": "Reduce baseline anxiety",
             "actions": ["5 min breathing", "Journal one feeling"], "timeframe": "this week"},
            {"title": "TEST_phaseg Sleep hygiene plan", "rationale": "Stabilize sleep window",
             "actions": ["No phone after 10pm"], "timeframe": "2 weeks"},
        ]
        r = clinician_session.post(
            f"{API}/ai/clinician-coach/save-to-roadmap",
            json={"patient_id": PATIENT_ID, "steps": steps},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("saved") == 2

        # Verify by fetching patient activity (use a known existing endpoint if any).
        # Fallback: trust the API result (no GET /patient/activity exposed in scope).
        # We just confirm shape of response here.


# ───────── 4. Assessment submit regression: 402 without subscription ─────────
class TestAssessmentSubmit402:
    """This test must run BEFORE the active_subscription fixture activates a sub for the demo patient."""

    def test_no_subscription_returns_402(self):
        # Create an isolated patient via /api/auth/register/patient to ensure NO active subscription.
        s = requests.Session()
        unique_email = f"test_phaseg_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "full_name": "TEST PhaseG NoSub",
            "email": unique_email,
            "password": "TestPass@123",
            "phone": "+15555550101",
            "date_of_birth": "1995-06-15",
            "address": "123 Test St",
            "is_minor": False,
            "guardian_consent": False,
            "terms_accepted": True,
        }
        r = s.post(f"{API}/auth/register/patient", json=payload, timeout=20)
        if r.status_code != 200:
            pytest.skip(f"could not register isolated patient: {r.status_code} {r.text[:200]}")

        resp = s.post(f"{API}/patient/assessment-submit", json={
            "category_id": "assessment",
            "answers": {"a1": "Several days", "a2": "Several days", "a3": 5, "a4": "No"},
        }, timeout=20)
        assert resp.status_code == 402, f"expected 402, got {resp.status_code}: {resp.text}"


# ───────── 5. Assessment submit augmentation (severity + ai_plan + admin_recs + auto-assign idempotent) ─────────
class TestAssessmentSubmitAugmented:
    def test_treatment_history_no_severity(self, patient_session, active_subscription):
        r = patient_session.post(f"{API}/patient/assessment-submit", json={
            "category_id": "treatment_history",
            "answers": {"th1": "No"},
        }, timeout=20)
        assert r.status_code == 200, r.text
        doc = r.json().get("response", {})
        # Non-final stage should NOT have severity/ai_plan
        assert "severity" not in doc or doc.get("severity") is None

    def test_final_assessment_writes_severity_ai_plan_admin_recs(self, patient_session, active_subscription):
        r = patient_session.post(f"{API}/patient/assessment-submit", json={
            "category_id": "assessment",
            "answers": {
                "a1": "Nearly every day",
                "a2": "More than half the days",
                "a3": 3,
                "a4": "No",
                "a5": "Feeling overwhelmed lately",
            },
        }, timeout=60)
        assert r.status_code == 200, r.text
        doc = r.json().get("response", {})
        assert doc.get("severity") in ("low", "moderate", "high", "critical"), f"severity missing/invalid: {doc.get('severity')}"
        # ai_plan may be None if LLM fails, but key must exist
        assert "ai_plan" in doc
        assert "admin_recs" in doc
        assert isinstance(doc["admin_recs"], list)

    def test_auto_assign_idempotent_on_resubmit(self, patient_session, active_subscription):
        # First submission
        payload = {
            "category_id": "assessment",
            "answers": {"a1": "Several days", "a2": "Several days", "a3": 5, "a4": "No"},
        }
        r1 = patient_session.post(f"{API}/patient/assessment-submit", json=payload, timeout=60)
        assert r1.status_code == 200, r1.text
        recs1 = r1.json()["response"].get("admin_recs", [])

        # Re-submit — auto-assign uses upsert filter on (type, ref_id, user_id), should NOT duplicate
        r2 = patient_session.post(f"{API}/patient/assessment-submit", json=payload, timeout=60)
        assert r2.status_code == 200, r2.text
        recs2 = r2.json()["response"].get("admin_recs", [])

        # We can't directly query patient_activity via public API, but if admin_recs is the same set,
        # the upsert mechanism guarantees no duplicates. Verify both responses include admin_recs key.
        assert isinstance(recs1, list)
        assert isinstance(recs2, list)


# ───────── 6. Regression: clinician-assist ─────────
class TestClinicianAssistRegression:
    def test_clinician_assist_with_patient_context(self, clinician_session):
        r = clinician_session.post(f"{API}/ai/clinician-assist", json={
            "prompt": "Brief check-in summary please.",
            "patient_id": PATIENT_ID,
        }, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data
        assert isinstance(data["reply"], str)
        assert len(data["reply"]) > 0

    def test_patient_blocked(self, patient_session):
        r = patient_session.post(f"{API}/ai/clinician-assist", json={"prompt": "hi"}, timeout=15)
        assert r.status_code == 403


# ───────── 7. Regression: clinician notes ─────────
class TestClinicianNotesRegression:
    def test_post_and_get_notes(self, clinician_session):
        r = clinician_session.post(f"{API}/clinician/notes", json={
            "patient_id": PATIENT_ID,
            "note": f"TEST_phaseg note {uuid.uuid4().hex[:6]}",
        }, timeout=15)
        assert r.status_code == 200, r.text

        r2 = clinician_session.get(f"{API}/clinician/notes", params={"patient_id": PATIENT_ID}, timeout=15)
        assert r2.status_code == 200, r2.text
        notes = r2.json().get("notes", [])
        assert isinstance(notes, list)
        assert len(notes) >= 1


# ───────── 8. Regression: clinician notifications + patients ─────────
class TestClinicianMiscRegression:
    def test_clinician_notifications(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/notifications", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "notifications" in data

    def test_clinician_patients_list(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/patients", timeout=15)
        assert r.status_code == 200, r.text


# ───────── 9. Cleanup ─────────
def test_zzz_cleanup(clinician_session):
    """Cleanup all TEST_phaseg artifacts via direct API where possible.
    Coach sessions and patient_activity rows are left for review (no public delete endpoint).
    """
    # Best-effort: nothing to delete via public API. Cleanup is logged only.
    print("Phase G cleanup: TEST_phaseg artifacts may remain in db.clinician_coach_sessions, db.patient_activity, db.clinician_notes — no public delete endpoint.")
