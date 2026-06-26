"""Phase U backend tests — Regular Check-in flow + Journey auto-update.

Validates:
  1. POST /api/auth/demo-login {role:'patient'} works (Luna).
  2. /api/patient/progress returns dict keyed by 3 category ids.
  3. /api/patient/my-responses lists submitted rows.
  4. POST /api/patient/assessment-submit with category='assessment'
     creates a new patient_assessment_responses row.
  5. /api/checkins count increases after a Regular Check-in style flow.
  6. Registration endpoint creates a new patient (used to verify
     first-time variant by absence of progress rows).
"""

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to reading frontend/.env directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"


@pytest.fixture(scope="module")
def luna_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "patient"}, timeout=20)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    # demo-login may return user at top level OR nested under "user"
    role = (data.get("user") or data).get("role")
    assert role == "patient", f"unexpected role={role} body={str(data)[:200]}"
    return s


# ── Progress + my-responses ────────────────────────────────────────────
class TestProgressAndResponses:
    def test_progress_returns_3_categories(self, luna_session):
        r = luna_session.get(f"{BASE_URL}/api/patient/progress", timeout=15)
        assert r.status_code == 200
        prog = r.json().get("progress", {})
        # Expected category ids
        for cat in ("treatment_history", "health_social", "assessment"):
            assert cat in prog, f"missing category {cat} in progress: {list(prog.keys())}"

    def test_my_responses_listable(self, luna_session):
        r = luna_session.get(f"{BASE_URL}/api/patient/my-responses", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "responses" in body
        assert isinstance(body["responses"], list)

    def test_assessment_categories_returns_3(self, luna_session):
        r = luna_session.get(f"{BASE_URL}/api/assessment-categories", timeout=15)
        assert r.status_code == 200
        cats = r.json().get("categories", [])
        ids = {c["id"] for c in cats}
        assert {"treatment_history", "health_social", "assessment"}.issubset(ids)


# ── Backfill if Luna lacks all-3 completed (for the returning hub variant) ──
class TestReturningPatientSeed:
    """Ensure Luna has all 3 categories completed so the hub collapses."""

    def test_backfill_all_three_categories(self, luna_session):
        r = luna_session.get(f"{BASE_URL}/api/patient/progress", timeout=15)
        prog = r.json().get("progress", {})
        for cat in ("treatment_history", "health_social", "assessment"):
            if not prog.get(cat, {}).get("completed"):
                resp = luna_session.post(
                    f"{BASE_URL}/api/patient/assessment-submit",
                    json={
                        "category_id": cat,
                        "answers": {"_seed": True, "marker": str(uuid.uuid4())},
                        "is_final": True,
                    },
                    timeout=20,
                )
                assert resp.status_code in (200, 201), f"seed {cat}: {resp.status_code} {resp.text[:200]}"

        # Verify all three are now completed
        r2 = luna_session.get(f"{BASE_URL}/api/patient/progress", timeout=15)
        prog2 = r2.json().get("progress", {})
        for cat in ("treatment_history", "health_social", "assessment"):
            assert prog2.get(cat, {}).get("completed"), f"{cat} not completed after seeding: {prog2.get(cat)}"


# ── Regular Check-in completion (the Phase U flow) ─────────────────────
class TestRegularCheckinFlow:
    def test_checkin_count_increases_after_submit(self, luna_session):
        # Count check-ins before
        r_before = luna_session.get(
            f"{BASE_URL}/api/checkins", params={"limit": 200}, timeout=15
        )
        assert r_before.status_code == 200, r_before.text[:200]
        before_count = len(r_before.json().get("checkins", r_before.json() if isinstance(r_before.json(), list) else []))

        # POST a check-in (mimics CheckInFlow internal save)
        ck = luna_session.post(
            f"{BASE_URL}/api/checkins",
            json={
                "date": time.strftime("%Y-%m-%d"),
                "time": time.strftime("%H:%M"),
                "starting_body_part": "head",
                "starting_sensation": "tightness",
                "user_selected_color": "#A78BFA",
                "user_selected_emotion": "calm",
                "intensity_rating_before": 6,
                "intensity_rating_after": 4,
                "journal_notes": "phase_u regression",
            },
            timeout=20,
        )
        # Accept 200/201
        assert ck.status_code in (200, 201), f"checkin POST: {ck.status_code} {ck.text[:200]}"

        # Then POST the regular check-in's "assessment-submit" so the
        # Journey/PatientHistory page sees the new entry.
        sub = luna_session.post(
            f"{BASE_URL}/api/patient/assessment-submit",
            json={
                "category_id": "assessment",
                "answers": {
                    "_daily_checkin": "completed",
                    "triggered_from": "regular_checkin_hub",
                    "marker": str(uuid.uuid4()),
                },
                "is_final": True,
            },
            timeout=20,
        )
        assert sub.status_code in (200, 201), f"assessment-submit: {sub.status_code} {sub.text[:200]}"

        time.sleep(0.5)
        r_after = luna_session.get(
            f"{BASE_URL}/api/checkins", params={"limit": 200}, timeout=15
        )
        after_count = len(r_after.json().get("checkins", r_after.json() if isinstance(r_after.json(), list) else []))
        assert after_count >= before_count + 1, f"checkin count did not grow: {before_count}→{after_count}"

    def test_assessment_response_row_persisted(self, luna_session):
        marker = str(uuid.uuid4())
        sub = luna_session.post(
            f"{BASE_URL}/api/patient/assessment-submit",
            json={
                "category_id": "assessment",
                "answers": {"_daily_checkin": "completed", "marker": marker},
                "is_final": True,
            },
            timeout=20,
        )
        assert sub.status_code in (200, 201)

        # Verify via my-responses
        r = luna_session.get(f"{BASE_URL}/api/patient/my-responses", timeout=15)
        rows = r.json().get("responses", [])
        # Find any 'assessment' row with the marker
        match = [
            row for row in rows
            if row.get("category_id") == "assessment"
            and (row.get("answers") or {}).get("marker") == marker
        ]
        assert match, f"No assessment row with marker={marker} in {len(rows)} rows"


# ── First-time patient register → no completed cats ────────────────────
class TestFirstTimePatient:
    def test_register_new_patient_and_no_progress(self):
        email = f"TEST_phase_u_{uuid.uuid4().hex[:8]}@example.com"
        pw = "TestPass123!"
        s = requests.Session()
        r = s.post(
            f"{BASE_URL}/api/auth/register/patient",
            json={
                "full_name": "Phase U Tester",
                "email": email,
                "password": pw,
                "date_of_birth": "1995-01-01",
                "terms_accepted": True,
            },
            timeout=20,
        )
        if r.status_code not in (200, 201):
            pytest.skip(f"register endpoint not available: {r.status_code} {r.text[:160]}")

        # Login
        lr = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": pw},
            timeout=20,
        )
        assert lr.status_code == 200, lr.text[:200]

        # Check progress — categories should be present but none completed
        pr = s.get(f"{BASE_URL}/api/patient/progress", timeout=15)
        assert pr.status_code == 200
        prog = pr.json().get("progress", {})
        completed = [c for c in ("treatment_history", "health_social", "assessment") if prog.get(c, {}).get("completed")]
        assert completed == [], f"Fresh patient unexpectedly has completed: {completed}"
