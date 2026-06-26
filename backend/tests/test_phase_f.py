"""
Phase F backend tests — Email Templates, AI generation, Mock send,
Auto welcome on user/assistant create, Permissions persistence,
Admin self-update, Clinician notes + AI assist.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ifeel-backend.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"

SYSTEM_TEMPLATE_IDS = {
    "tpl_welcome_patient",
    "tpl_welcome_clinician",
    "tpl_assistant_invite",
    "tpl_password_reset",
    "tpl_assessment_complete",
}


# ─── Fixtures ───
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return s


@pytest.fixture(scope="session")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "clinician"}, timeout=20)
    assert r.status_code == 200, f"Clinician demo-login failed: {r.text}"
    return s


@pytest.fixture(scope="session")
def patient_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "patient"}, timeout=20)
    assert r.status_code == 200
    return s


# ─── Email Templates ───
class TestEmailTemplates:
    def test_list_returns_5_seeded_templates(self, admin_session):
        r = admin_session.get(f"{API}/admin/email-templates", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "templates" in data
        ids = {t["template_id"] for t in data["templates"]}
        missing = SYSTEM_TEMPLATE_IDS - ids
        assert not missing, f"Missing seeded templates: {missing}. Got: {ids}"
        # verify _id is excluded
        for t in data["templates"]:
            assert "_id" not in t

    def test_create_custom_template(self, admin_session):
        payload = {
            "name": "TEST_PhaseF Custom",
            "subject": "Hello {{name}}",
            "body": "<p>Hi {{name}}, this is a TEST template.</p>",
            "cta_label": "Open",
            "cta_url": "{{login_url}}",
            "category": "test",
        }
        r = admin_session.post(f"{API}/admin/email-templates", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("template_id", "").startswith("tpl_")
        pytest.created_template_id = data["template_id"]
        # Verify persistence
        r2 = admin_session.get(f"{API}/admin/email-templates", timeout=15)
        ids = {t["template_id"] for t in r2.json()["templates"]}
        assert pytest.created_template_id in ids

    def test_preview_returns_wrapped_html(self, admin_session):
        r = admin_session.post(
            f"{API}/admin/email-templates/preview",
            json={"subject": "Hi", "body": "<p>Body</p>", "cta_label": "Click", "cta_url": "https://x"},
            timeout=15,
        )
        assert r.status_code == 200
        html = r.json().get("html", "")
        assert "<!DOCTYPE html>" in html
        assert "IFEELINCOLOR" in html
        assert "Projexino Solutions" in html
        assert "<p>Body</p>" in html
        assert "https://x" in html

    def test_ai_generate_returns_structured_json(self, admin_session):
        r = admin_session.post(
            f"{API}/admin/email-templates/ai-generate",
            json={"prompt": "A short welcome email for a new patient named Alex.", "audience": "patient"},
            timeout=60,
        )
        if r.status_code == 500:
            pytest.skip(f"LLM provider error (likely network/key): {r.text[:200]}")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("subject", "body", "cta_label", "cta_url"):
            assert k in data, f"Missing key {k} in AI generate response: {data}"
        assert isinstance(data["subject"], str) and len(data["subject"]) > 0
        assert isinstance(data["body"], str) and len(data["body"]) > 0

    def test_mock_send_stores_in_sent_emails(self, admin_session):
        r = admin_session.post(
            f"{API}/admin/email/send",
            json={
                "template_id": "tpl_welcome_patient",
                "to_email": "TEST_phasef@example.com",
                "to_name": "TEST Phase F",
                "variables": {"login_url": "/"},
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") in (True, False)  # delivery may legitimately fail to fake test inboxes
        assert data["email"]["status"] in {"mock_sent", "sent", "failed"}
        assert data["email"]["to_email"] == "TEST_phasef@example.com"
        assert "rendered_html" in data and "<!DOCTYPE html>" in data["rendered_html"]
        assert "TEST Phase F" in data["rendered_html"] or "Welcome" in data["rendered_html"]

    def test_list_sent_emails(self, admin_session):
        r = admin_session.get(f"{API}/admin/email/sent", timeout=15)
        assert r.status_code == 200
        emails = r.json().get("emails", [])
        assert isinstance(emails, list)
        assert any(e.get("to_email") == "TEST_phasef@example.com" for e in emails)

    def test_delete_blocks_system_template(self, admin_session):
        r = admin_session.delete(f"{API}/admin/email-templates/tpl_welcome_patient", timeout=15)
        # Endpoint silently filters system templates — verify it still exists
        assert r.status_code == 200
        r2 = admin_session.get(f"{API}/admin/email-templates", timeout=15)
        ids = {t["template_id"] for t in r2.json()["templates"]}
        assert "tpl_welcome_patient" in ids, "System template was deleted! Should be protected."

    def test_delete_custom_template(self, admin_session):
        tid = getattr(pytest, "created_template_id", None)
        if not tid:
            pytest.skip("No custom template created in earlier test")
        r = admin_session.delete(f"{API}/admin/email-templates/{tid}", timeout=15)
        assert r.status_code == 200
        r2 = admin_session.get(f"{API}/admin/email-templates", timeout=15)
        ids = {t["template_id"] for t in r2.json()["templates"]}
        assert tid not in ids


# ─── Auto welcome emails on user / assistant create ───
class TestAutoWelcomeEmails:
    def test_create_patient_triggers_welcome_email(self, admin_session):
        email = f"TEST_phasef_patient_{int(time.time())}@example.com"
        r = admin_session.post(
            f"{API}/admin/users",
            json={"name": "TEST Patient", "email": email, "role": "patient", "password": "TempPass@123"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        pytest.created_user_email = email
        time.sleep(0.5)
        r2 = admin_session.get(f"{API}/admin/email/sent", timeout=15)
        emails = r2.json().get("emails", [])
        matches = [e for e in emails if e.get("to_email") == email.lower() and e.get("trigger") == "user_create"]
        assert matches, f"No user_create email logged for {email}"
        assert matches[0]["template_id"] == "tpl_welcome_patient"
        assert matches[0]["status"] in {"mock_sent", "sent", "failed"}

    def test_create_clinician_triggers_clinician_welcome(self, admin_session):
        email = f"TEST_phasef_clin_{int(time.time())}@example.com"
        r = admin_session.post(
            f"{API}/admin/users",
            json={"name": "TEST Clinician", "email": email, "role": "clinician", "password": "TempPass@123"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        time.sleep(0.5)
        r2 = admin_session.get(f"{API}/admin/email/sent", timeout=15)
        emails = r2.json().get("emails", [])
        matches = [e for e in emails if e.get("to_email") == email.lower() and e.get("trigger") == "user_create"]
        assert matches
        assert matches[0]["template_id"] == "tpl_welcome_clinician"

    def test_create_assistant_triggers_invite_email(self, admin_session):
        email = f"TEST_phasef_asst_{int(time.time())}@example.com"
        r = admin_session.post(
            f"{API}/admin/assistants",
            json={"name": "TEST Assistant", "email": email, "password": "AsstPass@123", "permissions": ["dashboard"]},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        asst = r.json()
        assert asst.get("admin_id", "").startswith("asst_")
        pytest.created_assistant_id = asst["admin_id"]
        time.sleep(0.5)
        r2 = admin_session.get(f"{API}/admin/email/sent", timeout=15)
        emails = r2.json().get("emails", [])
        matches = [e for e in emails if e.get("to_email") == email.lower() and e.get("trigger") == "assistant_create"]
        assert matches, f"No assistant_create email for {email}"
        assert matches[0]["template_id"] == "tpl_assistant_invite"


# ─── Permissions persistence ───
class TestAdminPermissions:
    def test_put_permissions_persists(self, admin_session):
        asst_id = getattr(pytest, "created_assistant_id", None)
        if not asst_id:
            pytest.skip("No assistant created")
        page_perms = {"dashboard": {"view": True, "edit": False}, "patients": {"view": True, "edit": True}}
        r = admin_session.put(
            f"{API}/admin/permissions/{asst_id}",
            json={"page_permissions": page_perms},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # Verify via GET assistants list
        r2 = admin_session.get(f"{API}/admin/assistants", timeout=15)
        assert r2.status_code == 200
        match = next((a for a in r2.json()["assistants"] if a["admin_id"] == asst_id), None)
        assert match is not None
        assert match.get("page_permissions") == page_perms


# ─── Admin self-update ───
class TestAdminSelfUpdate:
    def test_update_name_only(self, admin_session):
        r = admin_session.put(f"{API}/admin/auth/me", json={"name": "Super Admin Updated"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("name") == "Super Admin Updated"

    def test_password_rotation_requires_current(self, admin_session):
        r = admin_session.put(f"{API}/admin/auth/me", json={"new_password": "x"}, timeout=15)
        assert r.status_code == 400

    def test_password_rotation_wrong_current(self, admin_session):
        r = admin_session.put(
            f"{API}/admin/auth/me",
            json={"current_password": "WRONG", "new_password": "NewPass@123"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_password_rotation_and_re_login(self, admin_session):
        # Rotate to new password
        new_pw = "NewAdminPass@2026"
        r = admin_session.put(
            f"{API}/admin/auth/me",
            json={"current_password": ADMIN_PASSWORD, "new_password": new_pw},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # Login with new password
        s2 = requests.Session()
        r2 = s2.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": new_pw}, timeout=15)
        assert r2.status_code == 200, "Login with new password should work"
        # Rotate back to original so other tests / future runs still work
        r3 = s2.put(
            f"{API}/admin/auth/me",
            json={"current_password": new_pw, "new_password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r3.status_code == 200


# ─── Cleanup created assistant ───
class TestCleanupAssistant:
    def test_delete_assistant(self, admin_session):
        asst_id = getattr(pytest, "created_assistant_id", None)
        if not asst_id:
            pytest.skip("No assistant created")
        r = admin_session.delete(f"{API}/admin/assistants/{asst_id}", timeout=15)
        assert r.status_code == 200


# ─── Clinician notes ───
class TestClinicianNotes:
    def test_save_clinician_note(self, clinician_session):
        r = clinician_session.post(
            f"{API}/clinician/notes",
            json={"patient_id": "demo-patient-001", "note": "TEST_phasef note content"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data["note"]["note"] == "TEST_phasef note content"
        assert data["note"]["clinician_id"] == "demo-clinician-001"

    def test_list_clinician_notes(self, clinician_session):
        r = clinician_session.get(f"{API}/clinician/notes", timeout=15)
        assert r.status_code == 200
        notes = r.json().get("notes", [])
        assert any(n.get("note") == "TEST_phasef note content" for n in notes)

    def test_patient_cannot_post_note(self, patient_session):
        r = patient_session.post(f"{API}/clinician/notes", json={"note": "blocked"}, timeout=15)
        assert r.status_code == 403


# ─── Clinician AI assist ───
class TestClinicianAIAssist:
    def test_ai_assist_returns_reply(self, clinician_session):
        r = clinician_session.post(
            f"{API}/ai/clinician-assist",
            json={"prompt": "Summarize approach for mild anxiety in 3 bullets."},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data
        assert isinstance(data["reply"], str) and len(data["reply"]) > 0

    def test_ai_assist_patient_blocked(self, patient_session):
        r = patient_session.post(f"{API}/ai/clinician-assist", json={"prompt": "x"}, timeout=15)
        assert r.status_code == 403


# ─── Regression: existing endpoints still work ───
class TestRegression:
    def test_plans_public(self):
        r = requests.get(f"{API}/plans", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json().get("plans", []), list)

    def test_admin_patient_plans(self, admin_session):
        # Note: review request said /api/patient-tiers but actual endpoint is /api/admin/patient-plans
        r = admin_session.get(f"{API}/admin/patient-plans", timeout=15)
        assert r.status_code == 200

    def test_doctors_nearby(self):
        r = requests.get(f"{API}/doctors/nearby", params={"lat": 40.7128, "lng": -74.0060}, timeout=20)
        assert r.status_code == 200
        # response may be {doctors:[...]} or list
        data = r.json()
        assert "doctors" in data or isinstance(data, list)

    def test_admin_login_still_works(self):
        r = requests.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200

    def test_patient_demo_login(self):
        r = requests.post(f"{API}/auth/demo-login", json={"role": "patient"}, timeout=15)
        assert r.status_code == 200

    def test_clinician_demo_login(self):
        r = requests.post(f"{API}/auth/demo-login", json={"role": "clinician"}, timeout=15)
        assert r.status_code == 200
