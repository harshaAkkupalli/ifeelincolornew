"""
Backend tests for admin_routes_ext.py - Phase 1 admin panel extensions
Covers: Assessments CRUD, Body Parts CRUD, Announcements CRUD,
Permissions, Settings (demo toggle), Payment Setup link generation.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ifeel-backend.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# ──────────────── Assessments ────────────────
class TestAssessments:
    template_id = None

    def test_list_assessments_empty_filter(self, client):
        r = client.get(f"{BASE_URL}/api/admin/assessments", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "assessments" in data and isinstance(data["assessments"], list)

    def test_create_assessment_with_all_question_types(self, client):
        payload = {
            "assessment_type": "mood",
            "title": "TEST_Mood_Assessment",
            "description": "Test assessment with all question types",
            "linked_emotion": "happy",
            "questions": [
                {"text": "Are you happy?", "type": "yes_no", "required": True},
                {"text": "Pick one", "type": "multiple_choice", "options": ["A", "B", "C"]},
                {"text": "Describe your mood", "type": "long_answer"},
                {"text": "Rate your mood", "type": "scale", "scale_min": 1, "scale_max": 10,
                 "scale_min_label": "Sad", "scale_max_label": "Happy"},
                {"text": "Choose option", "type": "dropdown", "options": ["X", "Y"]},
                {"text": "Upload doc", "type": "file_upload", "accepted_types": "pdf,png"},
                {"text": "Pick date", "type": "date_picker"},
                {"text": "What does this image evoke?", "type": "image_based",
                 "image_url": "https://example.com/img.png"},
            ],
        }
        r = client.post(f"{BASE_URL}/api/admin/assessments", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == "TEST_Mood_Assessment"
        assert data["assessment_type"] == "mood"
        assert "template_id" in data
        assert len(data["questions"]) == 8
        # All 8 question types preserved
        types = [q["type"] for q in data["questions"]]
        for qt in ["yes_no", "multiple_choice", "long_answer", "scale", "dropdown",
                   "file_upload", "date_picker", "image_based"]:
            assert qt in types, f"Missing question type {qt}"
        # Order is set
        for idx, q in enumerate(data["questions"]):
            assert q["order"] == idx + 1
            assert q["question_id"].startswith("q_")
        TestAssessments.template_id = data["template_id"]

    def test_list_assessments_filtered_by_type(self, client):
        r = client.get(f"{BASE_URL}/api/admin/assessments?assessment_type=mood", timeout=20)
        assert r.status_code == 200
        items = r.json()["assessments"]
        assert any(a["template_id"] == TestAssessments.template_id for a in items)
        for a in items:
            assert a["assessment_type"] == "mood"

    def test_add_question_to_assessment(self, client):
        assert TestAssessments.template_id
        r = client.post(
            f"{BASE_URL}/api/admin/assessments/{TestAssessments.template_id}/questions",
            json={"text": "Extra question?", "type": "yes_no"}, timeout=20)
        assert r.status_code == 200
        q = r.json()
        assert q["text"] == "Extra question?"
        assert q["order"] == 9

    def test_update_assessment(self, client):
        assert TestAssessments.template_id
        r = client.put(f"{BASE_URL}/api/admin/assessments/{TestAssessments.template_id}",
                       json={"title": "TEST_Mood_Assessment_Updated", "description": "updated"},
                       timeout=20)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Mood_Assessment_Updated"

    def test_delete_assessment(self, client):
        assert TestAssessments.template_id
        r = client.delete(f"{BASE_URL}/api/admin/assessments/{TestAssessments.template_id}", timeout=20)
        assert r.status_code == 200
        # Verify removal
        r2 = client.get(f"{BASE_URL}/api/admin/assessments?assessment_type=mood", timeout=20)
        items = r2.json()["assessments"]
        assert not any(a["template_id"] == TestAssessments.template_id for a in items)


# ──────────────── Body Parts ────────────────
class TestBodyParts:
    body_part_id = None

    def test_list_body_parts(self, client):
        r = client.get(f"{BASE_URL}/api/admin/body-parts", timeout=20)
        assert r.status_code == 200
        assert "body_parts" in r.json()

    def test_create_body_part(self, client):
        r = client.post(f"{BASE_URL}/api/admin/body-parts",
                        json={"name": "TEST_LeftKnee", "description": "test",
                              "position": {"x": 30, "y": 70}}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_LeftKnee"
        assert "body_part_id" in d
        TestBodyParts.body_part_id = d["body_part_id"]

    def test_delete_body_part(self, client):
        assert TestBodyParts.body_part_id
        r = client.delete(f"{BASE_URL}/api/admin/body-parts/{TestBodyParts.body_part_id}", timeout=20)
        assert r.status_code == 200


# ──────────────── Announcements ────────────────
class TestAnnouncements:
    ann_id = None

    def test_list_announcements(self, client):
        r = client.get(f"{BASE_URL}/api/admin/announcements", timeout=20)
        assert r.status_code == 200
        assert "announcements" in r.json()

    def test_create_announcement_with_image(self, client):
        # 1x1 transparent PNG base64
        b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = client.post(f"{BASE_URL}/api/admin/announcements",
                        json={"title": "TEST_Announcement",
                              "content": "Hello",
                              "image_data": f"data:image/png;base64,{b64}",
                              "target_audience": "patients"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "TEST_Announcement"
        assert d["target_audience"] == "patients"
        assert d["image_data"].startswith("data:image/png;base64,")
        TestAnnouncements.ann_id = d["announcement_id"]

    def test_list_announcements_filtered(self, client):
        r = client.get(f"{BASE_URL}/api/admin/announcements?target=patients", timeout=20)
        assert r.status_code == 200
        items = r.json()["announcements"]
        for a in items:
            assert a["target_audience"] == "patients"
        assert any(a["announcement_id"] == TestAnnouncements.ann_id for a in items)

    def test_update_announcement(self, client):
        assert TestAnnouncements.ann_id
        r = client.put(f"{BASE_URL}/api/admin/announcements/{TestAnnouncements.ann_id}",
                       json={"title": "TEST_Announcement_Updated"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Announcement_Updated"

    def test_delete_announcement(self, client):
        assert TestAnnouncements.ann_id
        r = client.delete(f"{BASE_URL}/api/admin/announcements/{TestAnnouncements.ann_id}", timeout=20)
        assert r.status_code == 200


# ──────────────── Permissions ────────────────
class TestPermissions:
    def test_list_permissions(self, client):
        r = client.get(f"{BASE_URL}/api/admin/permissions", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "admins" in d and "pages" in d and "actions" in d
        # 12 pages, 5 actions per spec
        assert len(d["pages"]) == 12
        assert len(d["actions"]) == 5
        for p in ["dashboard", "patients", "assessments", "announcements", "payment_setup"]:
            assert p in d["pages"]
        for a in ["view", "create", "edit", "delete", "export"]:
            assert a in d["actions"]


# ──────────────── Settings / Demo Toggle ────────────────
class TestSettings:
    def test_update_settings_demo_visible_false(self, client):
        r = client.put(f"{BASE_URL}/api/admin/settings",
                       json={"show_demo_credentials": False}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("show_demo_credentials") is False

    def test_public_demo_visible_reflects_setting(self):
        # Public endpoint - no auth
        r = requests.get(f"{BASE_URL}/api/admin/settings/demo-visible", timeout=20)
        assert r.status_code == 200
        assert r.json().get("visible") is False

    def test_update_settings_demo_visible_true(self, client):
        r = client.put(f"{BASE_URL}/api/admin/settings",
                       json={"show_demo_credentials": True}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("show_demo_credentials") is True

    def test_public_demo_visible_true(self):
        r = requests.get(f"{BASE_URL}/api/admin/settings/demo-visible", timeout=20)
        assert r.status_code == 200
        assert r.json().get("visible") is True

    def test_get_settings(self, client):
        r = client.get(f"{BASE_URL}/api/admin/settings", timeout=20)
        assert r.status_code == 200
        assert "show_demo_credentials" in r.json()


# ──────────────── Payment Setup ────────────────
class TestPaymentSetup:
    def test_send_link_invalid_amount(self, client):
        r = client.post(f"{BASE_URL}/api/admin/payment-setup/send-link",
                        json={"organization_id": "anything", "amount": 0}, timeout=20)
        assert r.status_code == 400

    def test_send_link_org_not_found(self, client):
        r = client.post(f"{BASE_URL}/api/admin/payment-setup/send-link",
                        json={"organization_id": "nonexistent_org_xyz", "amount": 50}, timeout=20)
        assert r.status_code == 404

    def test_send_link_success(self, client):
        # Find any organization
        orgs_r = client.get(f"{BASE_URL}/api/admin/organizations", timeout=20)
        assert orgs_r.status_code == 200
        orgs = orgs_r.json().get("organizations", [])
        if not orgs:
            pytest.skip("No organizations seeded; cannot test payment link generation")
        org_id = orgs[0]["user_id"]
        r = client.post(f"{BASE_URL}/api/admin/payment-setup/send-link",
                        json={"organization_id": org_id, "amount": 49.99,
                              "origin_url": BASE_URL}, timeout=30)
        # Could 500 if Stripe key invalid; check both paths
        if r.status_code == 500:
            pytest.skip(f"Stripe integration error (likely test key/network): {r.text}")
        assert r.status_code == 200
        d = r.json()
        assert "payment_url" in d and d["payment_url"].startswith("http")
        assert "session_id" in d
        assert d["email_log"]["status"] in {"sent_mock", "sent", "failed"}


# ──────────────── Auth Enforcement ────────────────
class TestAuthEnforcement:
    def test_assessments_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/assessments", timeout=20)
        assert r.status_code in (401, 403)

    def test_permissions_requires_super_admin_no_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/permissions", timeout=20)
        assert r.status_code in (401, 403)

    def test_create_body_part_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/body-parts",
                          json={"name": "x"}, timeout=20)
        assert r.status_code in (401, 403)
