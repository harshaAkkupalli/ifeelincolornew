"""Tests for new patient/clinician registration endpoints (iteration 5)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"


def _uniq(prefix="testuser"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@ifeel.test"


# ─── Patient Registration ───
class TestPatientRegister:
    def test_register_adult_success(self):
        email = _uniq("adult")
        payload = {
            "full_name": "TEST Adult Patient",
            "email": email,
            "password": "TestPass123!",
            "date_of_birth": "1995-05-15",
            "phone": "555-0100",
            "address": "1 Main St",
            "is_minor": False,
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/auth/register/patient", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        assert data["name"] == "TEST Adult Patient"
        assert data["role"] == "patient"
        assert "user_id" in data
        assert "password_hash" not in data
        assert data.get("is_minor") is False
        # Cookie should be set
        assert "session_token" in r.cookies, f"session_token cookie missing. cookies={dict(r.cookies)}"

    def test_register_minor_with_consent(self):
        email = _uniq("minor")
        payload = {
            "full_name": "TEST Minor Patient",
            "email": email,
            "password": "TestPass123!",
            "date_of_birth": "2015-01-01",
            "phone": "555-0101",
            "is_minor": True,
            "guardian_name": "Test Parent",
            "guardian_relationship": "Parent",
            "guardian_email": "parent@test.com",
            "guardian_phone": "555-0102",
            "guardian_address": "1 Parent Rd",
            "guardian_consent": True,
            "guardian_signature": "Test Parent",
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/auth/register/patient", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_minor"] is True
        assert data["guardian_info"]["consent"] is True
        assert data["guardian_info"]["name"] == "Test Parent"

    def test_register_minor_without_consent_rejected(self):
        email = _uniq("minor_noconsent")
        payload = {
            "full_name": "TEST Minor NoConsent",
            "email": email,
            "password": "TestPass123!",
            "date_of_birth": "2015-01-01",
            "is_minor": True,
            "guardian_consent": False,
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/auth/register/patient", json=payload)
        assert r.status_code == 400
        assert "guardian" in r.text.lower() or "consent" in r.text.lower()

    def test_register_terms_not_accepted_rejected(self):
        email = _uniq("noterms")
        payload = {
            "full_name": "TEST NoTerms",
            "email": email,
            "password": "TestPass123!",
            "date_of_birth": "1990-01-01",
            "terms_accepted": False,
        }
        r = requests.post(f"{API}/auth/register/patient", json=payload)
        assert r.status_code == 400
        assert "terms" in r.text.lower()

    def test_register_duplicate_email_rejected(self):
        email = _uniq("dup")
        payload = {
            "full_name": "TEST Dup1",
            "email": email,
            "password": "TestPass123!",
            "date_of_birth": "1990-01-01",
            "terms_accepted": True,
        }
        r1 = requests.post(f"{API}/auth/register/patient", json=payload)
        assert r1.status_code == 200, r1.text
        # Same email again
        r2 = requests.post(f"{API}/auth/register/patient", json=payload)
        assert r2.status_code == 400
        assert "already" in r2.text.lower() or "registered" in r2.text.lower()


# ─── Clinician Registration ───
class TestClinicianRegister:
    def test_register_clinician_success(self):
        email = _uniq("clin")
        payload = {
            "full_name": "TEST Dr. Test",
            "email": email,
            "password": "ClinPass123!",
            "phone": "555-0200",
            "npi_number": "1234567890",
            "license_type": "MD",
            "license_number": "LIC-12345",
            "state_of_practice": "CA",
            "dea_number": "AB1234567",
            "specialization": "Psychiatry",
            "practice_name": "TEST Wellness Clinic",
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/auth/register/clinician", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        assert data["role"] == "clinician"
        assert data["clinician_info"]["npi_number"] == "1234567890"
        assert data["clinician_info"]["license_type"] == "MD"
        assert data["clinician_info"]["state_of_practice"] == "CA"
        assert data["clinician_info"]["specialization"] == "Psychiatry"
        assert "password_hash" not in data
        assert "session_token" in r.cookies

    def test_register_clinician_missing_required_field(self):
        # Missing npi_number -> Pydantic 422
        payload = {
            "full_name": "TEST Missing",
            "email": _uniq("missing"),
            "password": "ClinPass123!",
            "phone": "555-0200",
            "license_type": "MD",
            "license_number": "LIC-1",
            "state_of_practice": "CA",
            "specialization": "Psychiatry",
            "practice_name": "X",
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/auth/register/clinician", json=payload)
        assert r.status_code == 422

    def test_register_clinician_terms_required(self):
        payload = {
            "full_name": "TEST NoTermsClin",
            "email": _uniq("noterms_clin"),
            "password": "ClinPass123!",
            "phone": "555-0200",
            "npi_number": "1234567890",
            "license_type": "MD",
            "license_number": "LIC-1",
            "state_of_practice": "CA",
            "specialization": "Psychiatry",
            "practice_name": "X",
            "terms_accepted": False,
        }
        r = requests.post(f"{API}/auth/register/clinician", json=payload)
        assert r.status_code == 400

    def test_register_clinician_duplicate_email(self):
        email = _uniq("clindup")
        payload = {
            "full_name": "TEST ClinDup",
            "email": email,
            "password": "ClinPass123!",
            "phone": "555-0200",
            "npi_number": "1234567890",
            "license_type": "PhD",
            "license_number": "LIC-1",
            "state_of_practice": "NY",
            "specialization": "Psychology",
            "practice_name": "X",
            "terms_accepted": True,
        }
        r1 = requests.post(f"{API}/auth/register/clinician", json=payload)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/auth/register/clinician", json=payload)
        assert r2.status_code == 400


# ─── Cleanup ───
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_users():
    yield
    # Best-effort cleanup via direct mongo
    try:
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = None
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("MONGO_URL="):
                    mongo_url = line.split("=", 1)[1].strip().strip('"')
                if line.startswith("DB_NAME="):
                    db_name = line.split("=", 1)[1].strip().strip('"')
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]

        async def _clean():
            await db.users.delete_many({"email": {"$regex": "^test_"}})
        asyncio.get_event_loop().run_until_complete(_clean())
    except Exception as e:
        print(f"cleanup skipped: {e}")
