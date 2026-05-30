"""
Iteration 29 — backend regression tests for the new fixes:
  B1) Recommendation trigger_colors gating at assessment-submit
  B2) Notification dedupe by (type, day) and by recommendation_id
  B3) /app/journey route serves PatientHistory (FE-only; backend history+dossier still work)
  B4) POST /api/admin/email-templates/ai-edit (placeholder preservation)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL",
                          "https://ifeel-backend.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASS = "Admin@123!"


def _admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


def _patient_demo_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login",
               json={"role": "patient"}, timeout=30)
    assert r.status_code == 200, f"patient demo login failed: {r.status_code} {r.text}"
    return s


def _patient_luna_session():
    """Manual login as Luna (the demo patient) — same user_id as demo-login."""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "luna@demo.ifeelincolor.com",
                     "password": "Patient@123"}, timeout=30)
    assert r.status_code == 200, f"luna login failed: {r.status_code} {r.text}"
    return s


def _create_checkin(sess, ending_color="blue"):
    payload = {
        "date": "2026-01-15", "time": "10:00",
        "starting_body_part": "chest", "starting_sensation": "calm",
        "user_selected_color": ending_color,
        "user_selected_emotion": "calm",
        "ending_color": ending_color, "ending_emotion": "calm",
        "intensity_rating_before": 5, "intensity_rating_after": 3,
    }
    return sess.post(f"{BASE_URL}/api/checkins", json=payload, timeout=30)


# ───────────────── B1: color-gating ─────────────────
class TestColorGating:
    def test_luna_ending_color_blue_and_red_rec_does_not_leak(self):
        admin = _admin_session()
        rid_red_title = f"TEST_red_{uuid.uuid4().hex[:6]}"
        rid_univ_title = f"TEST_univ_{uuid.uuid4().hex[:6]}"
        created_ids = []
        for payload in (
            {"title": rid_red_title, "summary": "x",
             "description": "Test red", "kind": "tip",
             "trigger_colors": ["red"], "severity_filter": [], "status": "active",
             "target": "portal"},
            {"title": rid_univ_title, "summary": "y",
             "description": "Test universal", "kind": "tip",
             "trigger_colors": [], "severity_filter": [], "status": "active",
             "target": "portal"},
        ):
            r = admin.post(f"{BASE_URL}/api/admin/recommendations", json=payload, timeout=30)
            assert r.status_code in (200, 201), f"seed {payload['title']}: {r.status_code} {r.text}"
            created_ids.append(r.json().get("recommendation_id"))

        try:
            # Luna manual login (same user_id as the demo seed)
            try:
                pat = _patient_luna_session()
            except AssertionError:
                pat = _patient_demo_session()
            ci = _create_checkin(pat, ending_color="blue")
            assert ci.status_code == 200, f"checkin: {ci.status_code} {ci.text}"

            # Pull /api/patient/recommendations (this endpoint sorts by created_at
            # desc with limit 100, so brand-new recs are guaranteed visible).
            recs = pat.get(f"{BASE_URL}/api/patient/recommendations", timeout=30)
            assert recs.status_code == 200, f"{recs.status_code} {recs.text[:300]}"
            d = recs.json()

            # Verify Luna's ending_color resolves to blue (NOT red)
            ec = (d.get("ending_color") or d.get("latest_color") or "").lower()
            # Some shapes nest under 'meta' or 'latest_checkin'
            if not ec:
                meta = d.get("meta") or d.get("latest_checkin") or {}
                ec = (meta.get("ending_color") or "").lower()
            assert ec == "blue", f"Luna ending_color expected 'blue', got '{ec}' — payload keys: {list(d.keys())}"

            # Find admin recs in the feed (response may use 'admin_recs', 'items',
            # or top-level 'recommendations').
            buckets = []
            for k in ("admin_recs", "items", "recommendations", "data"):
                v = d.get(k)
                if isinstance(v, list):
                    buckets.extend(v)
            titles = [r.get("title") for r in buckets if isinstance(r, dict)]
            assert rid_univ_title in titles, \
                f"universal rec missing from /patient/recommendations — got {titles[:30]}"
            assert rid_red_title not in titles, \
                f"red-gated rec LEAKED to blue patient — {titles[:30]}"
        finally:
            for rid in created_ids:
                if rid:
                    admin.delete(f"{BASE_URL}/api/admin/recommendations/{rid}", timeout=15)


# ───────────────── B2: notification dedupe ─────────────────
class TestNotificationDedupe:
    def test_assessment_completed_dedup_by_day(self):
        pat = _patient_demo_session()
        # Submit 3 non-final assessments back-to-back
        for _ in range(3):
            r = pat.post(f"{BASE_URL}/api/patient/assessment-submit", json={
                "category_id": "treatment_history", "answers": {"q1": "ok"},
            }, timeout=30)
            assert r.status_code == 200, f"submit: {r.status_code} {r.text}"
            time.sleep(0.3)
        feed = pat.get(f"{BASE_URL}/api/patient/notifications", timeout=30).json()
        notes = feed.get("notifications", [])
        # Group assessment_completed by day
        from collections import Counter
        c = Counter((n.get("created_at") or "")[:10] for n in notes
                    if n.get("type") == "assessment_completed")
        worst = max(c.values()) if c else 0
        assert worst <= 1, f"dedupe failed — found {worst} assessment_completed rows in one day: {c}"

    def test_recommendation_notifications_dedup_by_rec_id(self):
        pat = _patient_demo_session()
        feed = pat.get(f"{BASE_URL}/api/patient/notifications", timeout=30).json()
        notes = feed.get("notifications", [])
        rec_ids = [n.get("recommendation_id") for n in notes
                   if n.get("type") in ("recommendation", "clinician_recommendation",
                                        "clinician_plan", "org_recommendation")
                   and n.get("recommendation_id")]
        assert len(rec_ids) == len(set(rec_ids)), f"duplicate rec rows: {rec_ids}"


# ───────────────── B3: journey backend ─────────────────
class TestJourneyEndpoints:
    def test_patient_history_endpoint(self):
        pat = _patient_demo_session()
        # GET retrieves the patient's medical history
        r = pat.get(f"{BASE_URL}/api/patient/history", timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        data = r.json()
        assert "events" in data, f"missing 'events' key in {data.keys()}"

    def test_patient_dossier_pdf_download(self):
        pat = _patient_demo_session()
        r = pat.get(f"{BASE_URL}/api/patient/dossier/pdf", timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        assert "application/pdf" in r.headers.get("content-type", "").lower()
        assert r.content[:4] == b"%PDF"


# ───────────────── B4: ai-edit endpoint ─────────────────
class TestEmailAiEdit:
    def test_ai_edit_preserves_placeholder(self):
        admin = _admin_session()
        payload = {
            "prompt": "Make it warmer; add a sentence about wellness.",
            "subject": "Welcome {{name}}",
            "body": "Hi {{name}}, please log in at {{login_url}}.",
            "cta_label": "Sign In",
            "cta_url": "{{login_url}}",
            "audience": "patient",
        }
        r = admin.post(f"{BASE_URL}/api/admin/email-templates/ai-edit",
                       json=payload, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        for k in ("subject", "body"):
            assert k in data, f"missing {k} in {data.keys()}"
        merged = (data.get("subject", "") + " " + data.get("body", ""))
        assert "{{name}}" in merged, f"{{{{name}}}} placeholder not preserved: {merged}"
        assert "{{login_url}}" in data.get("body", ""), \
            f"{{{{login_url}}}} not preserved in body: {data.get('body')}"


# ───────────────── B5: ai-edit / ai-generate auth gating ─────────────────
class TestEmailAiAuthGate:
    def test_ai_edit_requires_admin_auth(self):
        # No admin cookie → expect 401
        anon = requests.Session()
        r = anon.post(f"{BASE_URL}/api/admin/email-templates/ai-edit", json={
            "prompt": "x", "subject": "Hi {{name}}", "body": "Hello",
            "cta_label": "Go", "cta_url": "{{login_url}}", "audience": "patient",
        }, timeout=30)
        assert r.status_code == 401, \
            f"ai-edit MUST require admin auth — got {r.status_code} {r.text[:200]}"

    def test_ai_edit_with_admin_returns_200(self):
        admin = _admin_session()
        r = admin.post(f"{BASE_URL}/api/admin/email-templates/ai-edit", json={
            "prompt": "Add a wellness sentence.",
            "subject": "Welcome {{name}}",
            "body": "Hi {{name}}, please log in at {{login_url}}.",
            "cta_label": "Sign In",
            "cta_url": "{{login_url}}",
            "audience": "patient",
        }, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        for k in ("subject", "body", "cta_label", "cta_url"):
            assert k in d, f"missing {k} in {list(d.keys())}"
        merged = (d.get("subject", "") + " " + d.get("body", ""))
        assert "{{name}}" in merged, f"{{name}} placeholder lost: {merged}"

    def test_ai_generate_requires_admin_auth(self):
        anon = requests.Session()
        r = anon.post(f"{BASE_URL}/api/admin/email-templates/ai-generate", json={
            "prompt": "Generate a welcome email",
            "audience": "patient",
        }, timeout=30)
        assert r.status_code == 401, \
            f"ai-generate MUST require admin auth — got {r.status_code} {r.text[:200]}"

    def test_ai_generate_with_admin_returns_200(self):
        admin = _admin_session()
        r = admin.post(f"{BASE_URL}/api/admin/email-templates/ai-generate", json={
            "prompt": "Generate a friendly welcome email with a clear CTA",
            "audience": "patient",
        }, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert "subject" in d and "body" in d, f"missing keys: {list(d.keys())}"


# ───────────────── B6: recommendation_* dedupe by (type,title,day) ─────────────────
class TestRecommendationDedupByTitleDay:
    def test_two_admin_recs_same_title_collapse_to_one_notification(self):
        admin = _admin_session()
        dup_title = f"TEST_dup_title_{uuid.uuid4().hex[:6]}"
        created = []
        # Seed 2 distinct universal admin recs with the SAME title on same day
        for i in range(2):
            payload = {
                "title": dup_title, "summary": f"dup-{i}",
                "description": "Test dedupe by title/day", "kind": "tip",
                "trigger_colors": [], "severity_filter": [], "status": "active",
                "target": "portal",
            }
            r = admin.post(f"{BASE_URL}/api/admin/recommendations", json=payload, timeout=30)
            assert r.status_code in (200, 201), f"seed: {r.status_code} {r.text}"
            created.append(r.json().get("recommendation_id"))

        # Luna (manual login) — same user_id as demo. Trigger a check-in so the
        # patient/recommendations feed runs and notifications get assigned.
        try:
            pat = _patient_luna_session()
        except AssertionError:
            pat = _patient_demo_session()
        _create_checkin(pat, ending_color="blue")
        # Pull notifications
        feed = pat.get(f"{BASE_URL}/api/patient/notifications", timeout=30).json()
        notes = feed.get("notifications", [])
        # Count rows whose title matches dup_title (case-insensitive contains)
        matches = [n for n in notes if dup_title.lower() in (n.get("title") or "").lower()]
        try:
            assert len(matches) <= 1, \
                f"dedupe by (type,title,day) failed — got {len(matches)} rows: " \
                f"{[(m.get('type'), m.get('title'), m.get('recommendation_id')) for m in matches]}"
        finally:
            for rid in created:
                if rid:
                    admin.delete(f"{BASE_URL}/api/admin/recommendations/{rid}", timeout=15)

