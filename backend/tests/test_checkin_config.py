"""Tests for dynamic check-in content (body parts + emotion families).
Covers public endpoints, admin CRUD, auth gating, and end-to-end visibility."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ifeel-backend.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@ifeelincolor.com"
ADMIN_PASS = "Admin@123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


# ────────── Public endpoints ──────────
class TestPublicEndpoints:
    def test_public_body_parts_returns_seed(self):
        r = requests.get(f"{BASE_URL}/api/checkin/body-parts", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "body_parts" in data
        bps = data["body_parts"]
        assert len(bps) >= 12, f"expected >=12 default body parts, got {len(bps)}"
        names = {bp["name"] for bp in bps}
        for required in ["Head", "Eyes/Face", "Chest/Heart", "Stomach/Gut"]:
            assert required in names, f"missing default body part: {required}"
        # validate shape
        sample = bps[0]
        for k in ("body_part_id", "name", "position_x", "position_y", "sensations", "active"):
            assert k in sample, f"missing key {k} in body part"
        assert isinstance(sample["sensations"], list)

    def test_public_emotion_families_returns_seed(self):
        r = requests.get(f"{BASE_URL}/api/checkin/emotion-families", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "families" in data
        fams = data["families"]
        assert len(fams) >= 7, f"expected >=7 default emotion families, got {len(fams)}"
        keys = {f["key"] for f in fams}
        for required in ["happy", "sad", "angry", "fearful", "disgusted", "bad", "surprised"]:
            assert required in keys, f"missing default emotion family: {required}"
        sample = next(f for f in fams if f["key"] == "angry")
        assert sample["color_hex"].startswith("#")
        assert isinstance(sample.get("level2"), list) and len(sample["level2"]) >= 1
        assert isinstance(sample.get("regulation_activities"), list) and len(sample["regulation_activities"]) >= 1


# ────────── Auth gating ──────────
class TestAdminAuthGate:
    def test_admin_body_parts_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/checkin/body-parts", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_admin_emotion_families_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/checkin/emotion-families", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_post_body_part_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                          json={"name": "TEST_should_fail"}, timeout=15)
        assert r.status_code in (401, 403)


# ────────── Admin Body Parts CRUD ──────────
class TestAdminBodyPartsCRUD:
    def test_admin_list_body_parts(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/checkin/body-parts", timeout=15)
        assert r.status_code == 200
        bps = r.json()["body_parts"]
        assert len(bps) >= 12

    def test_create_update_delete_body_part(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        # CREATE
        payload = {
            "name": f"TEST_zone_{unique}",
            "position_x": 33,
            "position_y": 44,
            "sensations": ["Tingling", "Warm"],
            "order": 99,
            "active": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json=payload, timeout=15)
        assert r.status_code in (200, 201), f"create failed {r.status_code} {r.text}"
        created = r.json()
        assert created["name"] == payload["name"]
        assert created["sensations"] == payload["sensations"]
        bp_id = created["body_part_id"]
        assert bp_id.startswith("bp_")

        # Verify it appears in public endpoint (active=True)
        pub = requests.get(f"{BASE_URL}/api/checkin/body-parts", timeout=15).json()
        assert any(b["body_part_id"] == bp_id for b in pub["body_parts"]), \
            "new active body part should appear in public endpoint"

        # UPDATE
        upd_payload = {**payload, "name": f"TEST_zone_{unique}_upd", "position_x": 11.5}
        r = admin_session.patch(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}",
                                json=upd_payload, timeout=15)
        assert r.status_code == 200, f"update failed {r.status_code} {r.text}"
        listed = admin_session.get(f"{BASE_URL}/api/admin/checkin/body-parts", timeout=15).json()["body_parts"]
        found = next((b for b in listed if b["body_part_id"] == bp_id), None)
        assert found is not None
        assert found["name"] == f"TEST_zone_{unique}_upd"
        assert abs(found["position_x"] - 11.5) < 0.01

        # DELETE
        r = admin_session.delete(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}", timeout=15)
        assert r.status_code == 200
        # Verify removed
        listed = admin_session.get(f"{BASE_URL}/api/admin/checkin/body-parts", timeout=15).json()["body_parts"]
        assert not any(b["body_part_id"] == bp_id for b in listed)

    def test_inactive_body_part_hidden_from_public(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        payload = {"name": f"TEST_hidden_{unique}", "active": False, "sensations": ["x"]}
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/body-parts",
                               json=payload, timeout=15)
        assert r.status_code in (200, 201)
        bp_id = r.json()["body_part_id"]
        pub = requests.get(f"{BASE_URL}/api/checkin/body-parts", timeout=15).json()
        assert not any(b["body_part_id"] == bp_id for b in pub["body_parts"]), \
            "inactive body parts must be hidden from public endpoint"
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/admin/checkin/body-parts/{bp_id}", timeout=15)


# ────────── Admin Emotion Families CRUD ──────────
class TestAdminEmotionsCRUD:
    def test_admin_list_emotions(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/checkin/emotion-families", timeout=15)
        assert r.status_code == 200
        fams = r.json()["families"]
        assert len(fams) >= 7

    def test_create_update_delete_emotion(self, admin_session):
        unique = uuid.uuid4().hex[:6]
        key = f"test_emo_{unique}"
        payload = {
            "key": key,
            "label": f"Test Emotion {unique}",
            "color_hex": "#123456",
            "regulation_message": "test reg msg",
            "level2": [{"label": "Mild", "level3": ["A", "B"]}],
            "regulation_activities": [{"title": "Breathe", "steps": ["in", "out"]}],
            "order": 999,
            "active": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/checkin/emotion-families",
                               json=payload, timeout=15)
        assert r.status_code in (200, 201), f"create failed {r.status_code} {r.text}"
        created = r.json()
        em_id = created["emotion_id"]
        assert em_id.startswith("em_")
        assert created["color_hex"] == "#123456"
        assert created["level2"][0]["label"] == "Mild"

        # Public should include it
        pub = requests.get(f"{BASE_URL}/api/checkin/emotion-families", timeout=15).json()
        assert any(f["key"] == key for f in pub["families"])

        # UPDATE
        upd_payload = {**payload, "label": f"Test Emotion {unique} Updated", "color_hex": "#abcdef"}
        r = admin_session.patch(f"{BASE_URL}/api/admin/checkin/emotion-families/{em_id}",
                                json=upd_payload, timeout=15)
        assert r.status_code == 200
        lst = admin_session.get(f"{BASE_URL}/api/admin/checkin/emotion-families", timeout=15).json()["families"]
        found = next((f for f in lst if f["emotion_id"] == em_id), None)
        assert found is not None
        assert found["label"].endswith("Updated")
        assert found["color_hex"] == "#abcdef"

        # DELETE
        r = admin_session.delete(f"{BASE_URL}/api/admin/checkin/emotion-families/{em_id}", timeout=15)
        assert r.status_code == 200
        lst = admin_session.get(f"{BASE_URL}/api/admin/checkin/emotion-families", timeout=15).json()["families"]
        assert not any(f["emotion_id"] == em_id for f in lst)

    def test_delete_nonexistent_returns_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/checkin/body-parts/bp_does_not_exist", timeout=15)
        assert r.status_code == 404
        r = admin_session.delete(f"{BASE_URL}/api/admin/checkin/emotion-families/em_does_not_exist", timeout=15)
        assert r.status_code == 404
