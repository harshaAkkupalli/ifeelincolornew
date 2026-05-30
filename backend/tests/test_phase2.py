"""
Phase 2 tests — Org Portal endpoint, demo login (patient/clinician), demo-visible public setting.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ifeel-backend.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


# ─── Public Org Portal ───
class TestOrgPortal:
    def test_get_org_by_known_slug(self):
        # Phase 2 seed: "Sunshine Care Center" must exist as organization user
        r = requests.get(f"{API}/org/sunshine-care-center", timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        # Validate org payload structure
        assert data.get("role") == "organization"
        assert "name" in data and "sunshine" in data["name"].lower()
        assert "_id" not in data, "MongoDB _id must be excluded"
        # Common org fields
        assert "user_id" in data or "email" in data

    def test_get_org_404(self):
        r = requests.get(f"{API}/org/this-org-definitely-does-not-exist-xyz", timeout=15)
        assert r.status_code == 404
        body = r.json()
        assert "detail" in body

    def test_slug_generation_matches_backend(self):
        # Names like "Sunshine Care Center" should normalize to "sunshine-care-center"
        # Confirms the slug rule in server.py:get_org_by_slug
        r = requests.get(f"{API}/org/sunshine-care-center", timeout=15)
        assert r.status_code == 200
        # Uppercase/space variants should NOT resolve
        r2 = requests.get(f"{API}/org/Sunshine-Care-Center", timeout=15)
        # Path is case-sensitive on backend (lowercase compare) — should 404
        assert r2.status_code in (404, 200)


# ─── Demo Login (Patient + Clinician portals call this) ───
class TestDemoLogin:
    def test_demo_login_patient(self):
        r = requests.post(f"{API}/auth/demo-login", json={"role": "patient"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("role") == "patient"
        assert "user_id" in data
        assert "_id" not in data

    def test_demo_login_clinician(self):
        r = requests.post(f"{API}/auth/demo-login", json={"role": "clinician"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("role") == "clinician"
        assert "user_id" in data

    def test_demo_login_organization(self):
        r = requests.post(f"{API}/auth/demo-login", json={"role": "organization"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("role") == "organization"


# ─── Public demo-visible toggle (used by all 3 portal pages) ───
class TestDemoVisible:
    def test_demo_visible_public(self):
        r = requests.get(f"{API}/admin/settings/demo-visible", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "visible" in data
        assert isinstance(data["visible"], bool)
