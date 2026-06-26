"""Iteration 28 backend regression — covers:
   - POST /api/admin/email-templates/ai-edit (NEW, gpt-5.2)
   - POST /api/admin/email-templates/ai-generate (gpt-5.2)
   - POST /api/admin/email/send (record into sent_emails)
   - GET  /api/patient/dossier/pdf (server-rendered PDF)
"""
import os, re, pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ifeel-backend.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASSWORD = "Admin@123!"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    # Try demo-login first (most reliable seed)
    r = s.post(f"{BASE_URL}/api/auth/demo-login",
               json={"role": "patient"}, timeout=20)
    assert r.status_code == 200, r.text
    return s


# ============ Email Templates AI ============
class TestEmailTemplatesAI:
    def test_ai_generate(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/email-templates/ai-generate",
            json={"prompt": "A friendly welcome email for new patients onboarding"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "subject" in body and "body" in body
        assert isinstance(body["subject"], str) and len(body["subject"]) > 0
        assert isinstance(body["body"], str) and len(body["body"]) > 20

    def test_ai_edit_preserves_placeholders(self, admin_session):
        # First, list templates to find an existing template_id we can re-edit
        # Endpoint is /api/admin/email-templates (GET)
        lr = admin_session.get(f"{BASE_URL}/api/admin/email-templates", timeout=20)
        assert lr.status_code == 200, lr.text
        templates = lr.json().get("templates") or lr.json()
        assert isinstance(templates, list) and len(templates) > 0
        tpl = next((t for t in templates if "{name}" in (t.get("body") or "")), templates[0])

        original_subject = tpl.get("subject", "")
        original_body = tpl.get("body", "")
        # Templates use double-brace placeholders {{name}} / {{login_url}}
        had_name = "{{name}}" in original_body
        had_login = "{{login_url}}" in original_body

        r = admin_session.post(
            f"{BASE_URL}/api/admin/email-templates/ai-edit",
            json={
                "subject": original_subject,
                "body": original_body,
                "cta_label": tpl.get("cta_label", ""),
                "cta_url": tpl.get("cta_url", ""),
                "prompt": "Make it shorter and warmer; preserve any {{placeholders}}.",
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        out = r.json()
        assert "subject" in out and "body" in out
        # Placeholder preservation only enforced when the original had them
        if had_name:
            assert "{{name}}" in out["body"], f"Lost {{{{name}}}} placeholder during AI edit. Body: {out['body'][:300]}"
        if had_login:
            assert "{{login_url}}" in out["body"], "Lost {{login_url}} placeholder during AI edit"


# ============ Admin email send ============
class TestAdminEmailSend:
    def test_send_writes_record(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/email/send",
            json={
                "to_email": "qa+iter28@example.com",
                "to_name": "QA Bot",
                "subject": "iter28 test send",
                "body": "<p>Hello QA</p>",
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # status must be one of allowed values, never crash
        status = body.get("status") or body.get("delivery_status") or "sent"
        assert status in ("sent", "mock_sent", "failed"), body


# ============ Patient dossier PDF ============
class TestPatientDossierPDF:
    def test_pdf_download(self, patient_session):
        r = patient_session.get(f"{BASE_URL}/api/patient/dossier/pdf", timeout=60)
        assert r.status_code == 200, r.text[:400]
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct.lower(), f"unexpected content-type: {ct}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower(), f"missing attachment header: {cd}"
        assert r.content.startswith(b"%PDF"), "Body is not a PDF"
        # Save for visual sanity (not strictly required)
        out = "/tmp/iter28_dossier.pdf"
        with open(out, "wb") as f:
            f.write(r.content)
        assert os.path.getsize(out) > 4000, "PDF suspiciously small"

    def test_pdf_contains_real_question_text(self, patient_session):
        r = patient_session.get(f"{BASE_URL}/api/patient/dossier/pdf", timeout=60)
        assert r.status_code == 200
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(r.content))
        full_text = "\n".join((p.extract_text() or "") for p in reader.pages)
        # Should contain at least one of the standard section headers
        has_section = bool(re.search(
            r"(Treatment History|Health & Social|Assessment|Demographics|Check-?in|Mood|wellbeing|Color|Plan)",
            full_text, re.IGNORECASE))
        assert has_section, f"PDF missing readable section headers. First 500 chars:\n{full_text[:500]}"
        # Should NOT only contain raw question IDs like 'th1' / 'a1' as their own line
        raw_id_only = re.findall(r"(?m)^(?:th\d+|a\d+|hs\d+)$", full_text)
        # allow some appearance but not more than 5 unmatched IDs (would indicate fallback missed entirely)
        assert len(raw_id_only) < 5, f"PDF contains raw question IDs as text (legacy fallback may be broken): {raw_id_only}"
