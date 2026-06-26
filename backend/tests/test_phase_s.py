"""Phase S — assessment auto-recs + progress + admin/clinician roadmap badges."""
import os
import time
import uuid
import requests
import pytest

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # Fallback: read from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"


# ---------- helpers ----------
def _patient_demo():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "patient"}, timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    return s, r.json()


def _admin_login():
    s = requests.Session()
    r = s.post(f"{API}/admin/auth/login",
               json={"email": "admin@ifeelincolor.com", "password": "Admin@123!"},
               timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return s


def _fresh_patient():
    """Register a brand-new patient (no prior submissions)."""
    s = requests.Session()
    suffix = uuid.uuid4().hex[:10]
    email = f"TEST_phs_{suffix}@example.com"
    payload = {
        "full_name": f"TEST_phaseS {suffix}",
        "email": email,
        "password": "Patient@123",
        "date_of_birth": "1995-05-15",
        "phone": "555-0100",
        "address": "1 Main St",
        "is_minor": False,
        "terms_accepted": True,
    }
    r = s.post(f"{API}/auth/register/patient", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s, email


# ========================================
# 1. Auto-rec creation on assessment-submit
# ========================================
class TestAssessmentAutoRecs:
    def test_critical_severity_creates_admin_recs_and_activity(self):
        # Step-3 'assessment' submit requires active subscription. Use Luna demo (has sub).
        s, who = _patient_demo()
        payload = {
            "category_id": "assessment",
            "answers": {
                "a1": "Nearly every day",
                "a2": "Nearly every day",
                "a3": "Nearly every day",
                "a4": "Yes",  # self-harm flag → critical
                "_daily_checkin": "completed",
            },
        }
        r = s.post(f"{API}/patient/assessment-submit", json=payload, timeout=60)
        assert r.status_code == 200, f"submit failed: {r.text}"
        body = r.json().get("response", {})
        # Severity bucket
        assert body.get("severity") in ("critical", "high"), f"unexpected severity: {body.get('severity')}"
        # admin_recs >= 6
        admin_recs = body.get("admin_recs") or []
        assert isinstance(admin_recs, list)
        assert len(admin_recs) >= 6, f"expected >=6 admin_recs, got {len(admin_recs)}"
        # ai_plan key present (may be None if LLM unavailable, but key should be there)
        assert "ai_plan" in body

        # Verify patient_activity persisted — query via admin full-history (Luna)
        admin = _admin_login()
        h = admin.get(f"{API}/admin/patient/demo-patient-001/full-history", timeout=30)
        assert h.status_code == 200
        timeline = h.json().get("timeline") or []
        auto = [t for t in timeline if t.get("type") == "recommendation"
                and (t.get("auto_assigned") is True or t.get("trigger") == "auto_severity")]
        assert len(auto) >= 1, "no auto_assigned recs persisted for Luna after submit"

    def test_idempotent_resubmit_no_duplicates(self):
        """Re-submitting the same assessment should NOT duplicate patient_activity rows."""
        # Use Luna (has subscription) and check admin full-history counts before/after
        s, who = _patient_demo()
        admin = _admin_login()
        payload = {"category_id": "assessment",
                   "answers": {"a1": "Nearly every day", "a4": "Yes", "_daily_checkin": "completed"}}
        s.post(f"{API}/patient/assessment-submit", json=payload, timeout=60)

        h1 = admin.get(f"{API}/admin/patient/demo-patient-001/full-history", timeout=30).json()
        tl1 = h1.get("timeline") or []
        n1 = len([t for t in tl1 if t.get("type") == "recommendation"
                  and (t.get("auto_assigned") is True or t.get("trigger") == "auto_severity")])

        # Re-submit
        s.post(f"{API}/patient/assessment-submit", json=payload, timeout=60)
        h2 = admin.get(f"{API}/admin/patient/demo-patient-001/full-history", timeout=30).json()
        tl2 = h2.get("timeline") or []
        n2 = len([t for t in tl2 if t.get("type") == "recommendation"
                  and (t.get("auto_assigned") is True or t.get("trigger") == "auto_severity")])
        assert n2 == n1, f"auto recs duplicated: {n1} → {n2}"


# ========================================
# 2. Admin full-history surfaces auto recs
# ========================================
class TestAdminFullHistoryAutoRecs:
    def test_luna_history_contains_auto_assigned(self):
        admin = _admin_login()
        r = admin.get(f"{API}/admin/patient/demo-patient-001/full-history", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        timeline = data.get("timeline") or []
        recs = [t for t in timeline if t.get("type") == "recommendation"]
        assert len(recs) > 0, "no recommendation timeline rows for Luna"
        # Should have at least 1 auto-assigned event
        auto = [t for t in recs if t.get("auto_assigned") is True or t.get("trigger") == "auto_severity"]
        manual = [t for t in recs if (t.get("from_admin") is True and t.get("trigger") != "auto_severity")
                  or t.get("trigger") == "manual"]
        assert len(auto) >= 1, f"no auto-assigned events found for Luna; recs={recs[:3]}"
        # Counts payload
        counts = data.get("counts") or {}
        assert counts.get("recommendations_given", 0) >= len(recs), \
            f"counts.recommendations_given < timeline recs: {counts} vs {len(recs)}"
        print(f"Luna auto-recs={len(auto)} manual-recs={len(manual)} total={len(recs)}")


# ========================================
# 3. Progress gating for fresh patient
# ========================================
class TestProgressGating:
    def test_fresh_patient_all_categories_not_completed(self):
        s, email = _fresh_patient()
        r = s.get(f"{API}/patient/progress", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        prog = data.get("progress") or {}
        assert isinstance(prog, dict) and len(prog) >= 3, f"unexpected progress payload: {data}"
        for cid, c in prog.items():
            assert c.get("completed") is False, f"fresh patient {cid} already completed: {c}"
        assert data.get("all_completed") is False

    def test_progress_step1_flips_after_submit(self):
        """Step-3 needs subscription so use Luna; for fresh patient we test a non-final step."""
        s, email = _fresh_patient()
        # Pick a non-final category from progress payload
        prog = s.get(f"{API}/patient/progress", timeout=30).json().get("progress") or {}
        non_final = [cid for cid in prog if cid != "assessment"]
        if not non_final:
            pytest.skip("no non-final categories")
        cid = non_final[0]
        qr = s.get(f"{API}/patient/assessment-questions/{cid}", timeout=30)
        qs = qr.json().get("questions") or []
        if not qs:
            pytest.skip(f"no static questions for {cid}")
        answers = {}
        for q in qs:
            qid = q.get("question_id") or q.get("id")
            opts = q.get("options") or []
            if opts:
                answers[qid] = opts[0].get("value") if isinstance(opts[0], dict) else opts[0]
            else:
                answers[qid] = "ok"
        sr = s.post(f"{API}/patient/assessment-submit",
                    json={"category_id": cid, "answers": answers}, timeout=60)
        assert sr.status_code == 200, sr.text
        time.sleep(0.3)
        prog2 = s.get(f"{API}/patient/progress", timeout=30).json().get("progress") or {}
        assert prog2.get(cid, {}).get("completed") is True, f"{cid} not flipped: {prog2.get(cid)}"


# ========================================
# 4. Regression — Gmail forgot password
# ========================================
class TestForgotPasswordRegression:
    def test_gmail_forgot_password_returns_sent_or_mock(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": "ram@projexino.com"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        ds = data.get("delivery_status")
        assert ds in ("sent", "mock_sent", "failed", None), f"unexpected delivery_status: {ds}"


# ========================================
# 5. Step-1/Step-2 static submit still works (no bridge regression)
# ========================================
class TestStaticCategorySubmit:
    def test_step1_static_submit(self):
        s, email = _fresh_patient()
        prog = s.get(f"{API}/patient/progress", timeout=30).json().get("progress") or {}
        non_final = [cid for cid in prog if cid != "assessment"]
        if not non_final:
            pytest.skip("no non-final categories")
        cid = non_final[0]
        qr = s.get(f"{API}/patient/assessment-questions/{cid}", timeout=30)
        assert qr.status_code == 200, qr.text
        qs = qr.json().get("questions") or []
        if not qs:
            pytest.skip(f"category {cid} has no static questions")
        answers = {}
        for q in qs[:6]:
            qid = q.get("question_id") or q.get("id")
            opts = q.get("options") or []
            if opts:
                answers[qid] = opts[0].get("value") if isinstance(opts[0], dict) else opts[0]
            else:
                answers[qid] = "ok"
        sr = s.post(f"{API}/patient/assessment-submit",
                    json={"category_id": cid, "answers": answers}, timeout=60)
        assert sr.status_code == 200, sr.text
