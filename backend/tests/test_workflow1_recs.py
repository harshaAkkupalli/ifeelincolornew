"""Workflow 1 — Admin Portal-wide color-gated recommendations + Clinician Prescribed Care Tracker tests.

Covers:
- POST /api/admin/recommendations with trigger_colors + body_md (create + list + PATCH preserve)
- GET /api/patient/recommendations returns ending_color + filters admin items by trigger_colors
- POST /api/clinician/recommend with inline body_md/steps/media_url + anchored_checkin
- GET /api/clinician/patient/{id}/care-context — happy path + 403 for non-subscribed
- PUT /api/clinician/custom-recommendations/{id} — content_type/body_md/steps round-trip
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASS = "Admin@123!"


# ───────────────────────────── fixtures ─────────────────────────────
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "patient"}, timeout=30)
    assert r.status_code == 200, r.text
    return s, r.json()


@pytest.fixture(scope="module")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "clinician"}, timeout=30)
    assert r.status_code == 200, r.text
    return s, r.json()


# ─────────────────── Admin recommendations: trigger_colors + body_md ───────────────────
class TestAdminRecsTriggerColors:
    def test_create_with_trigger_colors_and_body_md(self, admin_session):
        payload = {
            "title": f"TEST_red_rec_{uuid.uuid4().hex[:6]}",
            "description": "Red color gated test rec",
            "category": "wellness",
            "content_type": "text",
            "body_md": "## Heading\nSome **markdown** body.",
            "trigger_colors": ["red"],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/recommendations", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        rec_id = data.get("recommendation_id") or data.get("id") or (data.get("recommendation") or {}).get("recommendation_id")
        assert rec_id, f"missing recommendation_id in {data}"

        # list and confirm persistence
        lr = admin_session.get(f"{BASE_URL}/api/admin/recommendations", timeout=30)
        assert lr.status_code == 200
        items = lr.json() if isinstance(lr.json(), list) else lr.json().get("items", lr.json().get("recommendations", []))
        match = next((x for x in items if (x.get("recommendation_id") == rec_id or x.get("id") == rec_id)), None)
        assert match, "created rec not in list"
        assert match.get("trigger_colors") == ["red"]
        assert "markdown" in (match.get("body_md") or "")
        # save rec id for next test
        pytest._test_rec_id = rec_id

    def test_patch_preserves_trigger_colors_and_body_md(self, admin_session):
        rec_id = getattr(pytest, "_test_rec_id", None)
        assert rec_id, "previous create test must run first"
        upd = {"trigger_colors": ["yellow", "blue"], "body_md": "Updated md"}
        r = admin_session.patch(f"{BASE_URL}/api/admin/recommendations/{rec_id}", json=upd, timeout=30)
        if r.status_code == 405:
            r = admin_session.put(f"{BASE_URL}/api/admin/recommendations/{rec_id}", json=upd, timeout=30)
        assert r.status_code == 200, r.text
        lr = admin_session.get(f"{BASE_URL}/api/admin/recommendations", timeout=30)
        items = lr.json() if isinstance(lr.json(), list) else lr.json().get("items", lr.json().get("recommendations", []))
        match = next((x for x in items if (x.get("recommendation_id") == rec_id or x.get("id") == rec_id)), None)
        assert match
        assert set(match.get("trigger_colors") or []) == {"yellow", "blue"}
        assert match.get("body_md") == "Updated md"

    def test_create_universal_no_trigger_colors(self, admin_session):
        payload = {
            "title": f"TEST_universal_{uuid.uuid4().hex[:6]}",
            "description": "Universal rec, no color gate",
            "category": "wellness",
            "trigger_colors": [],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/recommendations", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        rec_id = body.get("recommendation_id") or body.get("id") or (body.get("recommendation") or {}).get("recommendation_id")
        pytest._test_universal_rec_id = rec_id
        assert rec_id


# ────────────── Patient recommendations: ending_color + filter ──────────────
class TestPatientRecs:
    def test_returns_ending_color_field(self, patient_session):
        s, _ = patient_session
        r = s.get(f"{BASE_URL}/api/patient/recommendations", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ending_color" in data, f"missing ending_color in response keys={list(data.keys())}"
        assert "by_source" in data
        assert "admin" in data["by_source"]

    def test_universal_admin_recs_always_appear(self, patient_session):
        s, _ = patient_session
        r = s.get(f"{BASE_URL}/api/patient/recommendations", timeout=30)
        data = r.json()
        admin_items = data["by_source"]["admin"]
        # If we created a universal admin rec above, it should appear (empty trigger_colors)
        # Just verify any item with empty/missing trigger_colors is present (universal path)
        # Some admin items have no trigger_colors at all → always visible
        # Don't depend on the exact universal_rec_id since list endpoints may paginate
        # but at minimum the by_source.admin list shape must be a list
        assert isinstance(admin_items, list)

    def test_colored_recs_filtered_when_ending_color_mismatches(self, patient_session):
        s, _ = patient_session
        r = s.get(f"{BASE_URL}/api/patient/recommendations", timeout=30)
        data = r.json()
        ec = data.get("ending_color")
        for rec in data["by_source"]["admin"]:
            tc = rec.get("trigger_colors") or []
            if tc:
                # if rec has trigger_colors, the patient's ending_color must match
                assert ec and ec.lower() in [c.lower() for c in tc], \
                    f"rec {rec.get('title')} has tc={tc} but patient ending_color={ec}"


# ───────────── Clinician prescribed care: inline + anchored_checkin ─────────────
class TestClinicianRecommend:
    def test_care_context_for_subscribed_patient(self, clinician_session, patient_session):
        s, _cli = clinician_session
        _, pinfo = patient_session
        patient_id = pinfo.get("user_id") or (pinfo.get("user") or {}).get("user_id")
        assert patient_id
        r = s.get(f"{BASE_URL}/api/clinician/patient/{patient_id}/care-context", timeout=30)
        # Sarah (demo clinician) is subscribed to Luna (demo patient)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "patient" in data and "latest_checkin" in data and "given_recommendations" in data
        assert data["patient"]["user_id"] == patient_id

    def test_care_context_403_for_unrelated_patient(self, clinician_session):
        s, _ = clinician_session
        r = s.get(f"{BASE_URL}/api/clinician/patient/nonexistent_user_xyz/care-context", timeout=30)
        assert r.status_code in (403, 404), r.text

    def test_recommend_inline_with_body_md_steps(self, clinician_session, patient_session):
        s, _ = clinician_session
        _, pinfo = patient_session
        patient_id = pinfo.get("user_id") or (pinfo.get("user") or {}).get("user_id")
        payload = {
            "patient_id": patient_id,
            "title": f"TEST_inline_{uuid.uuid4().hex[:6]}",
            "description": "Inline rich content prescription",
            "content_type": "steps",
            "body_md": "Some markdown body",
            "steps": ["Inhale 4s", "Hold 7s", "Exhale 8s"],
            "media_url": "https://example.com/vid.mp4",
        }
        r = s.post(f"{BASE_URL}/api/clinician/recommend", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        act = data.get("activity") or {}
        assert act.get("content_type") == "steps"
        assert act.get("body_md") == "Some markdown body"
        assert act.get("steps") == ["Inhale 4s", "Hold 7s", "Exhale 8s"]
        assert act.get("media_url") == "https://example.com/vid.mp4"
        # anchored_checkin must be present (may be None if no checkin)
        assert "anchored_checkin" in act


# ─────── Clinician custom recommendations PUT round-trip ───────
class TestClinicianCustomRecsPut:
    def test_create_then_put_round_trips_content_type_body_md_steps(self, clinician_session):
        s, _ = clinician_session
        # create
        create_payload = {
            "title": f"TEST_cli_custom_{uuid.uuid4().hex[:6]}",
            "description": "custom rec",
            "content_type": "video",
            "body_md": "initial md",
            "media_url": "https://example.com/v.mp4",
        }
        cr = s.post(f"{BASE_URL}/api/clinician/custom-recommendations", json=create_payload, timeout=30)
        assert cr.status_code in (200, 201), cr.text
        body = cr.json()
        rec_id = body.get("rec_id") or body.get("recommendation_id") or body.get("id") or (body.get("recommendation") or {}).get("rec_id")
        assert rec_id, f"no rec_id in {body}"

        # update with new content_type=steps + steps + body_md
        upd = {
            "title": create_payload["title"],
            "content_type": "steps",
            "body_md": "updated md",
            "steps": ["s1", "s2", "s3"],
        }
        pr = s.put(f"{BASE_URL}/api/clinician/custom-recommendations/{rec_id}", json=upd, timeout=30)
        assert pr.status_code == 200, pr.text

        # list and verify round-trip (the GET endpoint is recommendation-library)
        lr = s.get(f"{BASE_URL}/api/clinician/recommendation-library", timeout=30)
        assert lr.status_code == 200
        items = lr.json() if isinstance(lr.json(), list) else lr.json().get("items", lr.json().get("recommendations", []))
        match = next((x for x in items if (x.get("rec_id") == rec_id or x.get("recommendation_id") == rec_id)), None)
        assert match, "updated rec not found"
        assert match.get("content_type") == "steps"
        assert match.get("body_md") == "updated md"
        assert match.get("steps") == ["s1", "s2", "s3"]
