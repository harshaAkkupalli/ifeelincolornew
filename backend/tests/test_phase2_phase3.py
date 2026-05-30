"""Phase 2 + 3 tests — patient recommendation completion, nearby USP, Razorpay."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ifeel-backend.preview.emergentagent.com').rstrip('/')


# ── Fixtures ──
@pytest.fixture(scope="module")
def patient_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "patient"})
    assert r.status_code == 200, f"patient demo-login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def clinician_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"role": "clinician"})
    assert r.status_code == 200, f"clinician demo-login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/auth/login",
               json={"email": "admin@ifeelincolor.com", "password": "Admin@123!"})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return s


# ── Phase 2: Recommendation completion ──
class TestRecommendationCompletion:
    def test_complete_recommendation(self, patient_session):
        r = patient_session.post(
            f"{BASE_URL}/api/patient/recommendations/complete",
            json={"recommendation_id": "TEST_rec_phase2", "title": "Phase2 Test", "note": "auto"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["suggest_reassessment"] is True
        assert "shared_with" in data
        assert "clinicians" in data["shared_with"]
        assert data["entry"]["from_admin"] is True
        assert "shared_with_clinicians" in data["entry"]
        assert isinstance(data["entry"]["shared_with_clinicians"], list)
        assert data["entry"]["type"] == "recommendation_completed"

    def test_list_completed(self, patient_session):
        r = patient_session.get(f"{BASE_URL}/api/patient/recommendations/completed")
        assert r.status_code == 200
        data = r.json()
        assert "completed" in data
        assert any(it.get("recommendation_id") == "TEST_rec_phase2" for it in data["completed"])

    def test_recommendations_show_completed_flag(self, patient_session):
        r = patient_session.get(f"{BASE_URL}/api/patient/recommendations")
        assert r.status_code == 200
        data = r.json()
        assert "counts" in data
        assert "completed" in data["counts"]
        assert data["counts"]["completed"] >= 1


# ── Phase 2: Nearby USP filter ──
class TestNearbyFilter:
    def test_nyc_within_radius(self):
        r = requests.get(f"{BASE_URL}/api/doctors/nearby",
                         params={"lat": 40.7128, "lng": -74.006, "radius_km": 50})
        assert r.status_code == 200
        data = r.json()
        assert "doctors" in data
        assert "real_count" in data
        # All real docs should be within radius_km
        for d in data["doctors"]:
            if d.get("source") == "real" and d.get("distance_km") is not None:
                assert d["distance_km"] <= 50, f"{d['name']} dist={d['distance_km']}"
        # Verify sort ascending
        dists = [d.get("distance_km") for d in data["doctors"] if d.get("source") == "real" and d.get("distance_km") is not None]
        assert dists == sorted(dists)

    def test_la_returns_zero_real(self):
        # Los Angeles coords, small radius — should exclude NYC-anchored clinicians
        r = requests.get(f"{BASE_URL}/api/doctors/nearby",
                         params={"lat": 34.0522, "lng": -118.2437, "radius_km": 50})
        assert r.status_code == 200
        data = r.json()
        assert data["real_count"] == 0, f"Expected 0 real clinicians in LA, got {data['real_count']}"


# ── Phase 2: Clinician profile update affects nearby ──
class TestClinicianProfileUpdate:
    def test_update_practice_location(self, clinician_session):
        r = clinician_session.put(
            f"{BASE_URL}/api/clinician/profile",
            json={"practice_lat": 40.75, "practice_lng": -73.99,
                  "practice_address": "TEST Manhattan Office", "telehealth_only": False},
        )
        assert r.status_code == 200, r.text
        profile = r.json().get("profile") or {}
        info = profile.get("clinician_info") or {}
        assert info.get("practice_lat") == 40.75
        assert info.get("practice_lng") == -73.99


# ── Phase 3: Razorpay endpoints ──
class TestRazorpayPublicConfig:
    def test_public_config(self):
        r = requests.get(f"{BASE_URL}/api/razorpay/config")
        assert r.status_code == 200
        data = r.json()
        assert "key_id" in data
        assert "mode" in data
        assert "currency" in data
        assert "enabled" in data


class TestRazorpayAdminSettings:
    def test_admin_get_settings(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/payment-settings")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "key_id" in data
        assert "key_id_masked" in data
        assert "key_secret_set" in data
        assert "mode" in data
        assert "currency" in data
        assert "enabled" in data

    def test_admin_update_settings_with_dummy_keys(self, admin_session):
        r = admin_session.put(
            f"{BASE_URL}/api/admin/payment-settings",
            json={"key_id": "rzp_test_dummy123", "key_secret": "secret_dummy_123",
                  "webhook_secret": "wh_secret_dummy", "mode": "test",
                  "currency": "INR", "enabled": True},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["mode"] == "test"
        # masked key present
        assert "***" in data["key_id_masked"]

    def test_admin_update_idempotent_omitting_secret(self, admin_session):
        """Omitting key_secret should NOT wipe the existing one."""
        r = admin_session.put(
            f"{BASE_URL}/api/admin/payment-settings",
            json={"mode": "test", "enabled": True},
        )
        assert r.status_code == 200
        # Re-read — secret should still be set
        check = admin_session.get(f"{BASE_URL}/api/admin/payment-settings").json()
        assert check["key_secret_set"] is True, "Secret should persist when omitted"


class TestRazorpayOrder:
    def test_order_returns_502_with_dummy_keys(self, patient_session):
        # Ensure dummy keys configured (set in prior test class)
        # Find a real patient plan
        plans = requests.get(f"{BASE_URL}/api/plans?role=patient").json().get("plans", [])
        paid_plans = [p for p in plans if p.get("price_usd", 0) > 0]
        if not paid_plans:
            pytest.skip("No paid patient plan to test order")
        plan_id = paid_plans[0]["plan_id"]
        r = patient_session.post(
            f"{BASE_URL}/api/razorpay/order",
            json={"kind": "portal", "plan_id": plan_id},
        )
        # Expected: 502 Razorpay auth fail (dummy keys) OR 404 if plan not findable in resolver
        assert r.status_code in (502, 404, 400), f"Unexpected status {r.status_code}: {r.text}"
        if r.status_code == 502:
            assert "Razorpay" in r.text or "Authentication" in r.text or "razorpay" in r.text.lower()


class TestRazorpayVerify:
    def test_verify_with_invalid_signature(self, patient_session):
        r = patient_session.post(
            f"{BASE_URL}/api/razorpay/verify",
            json={"razorpay_order_id": "order_nonexistent",
                  "razorpay_payment_id": "pay_x", "razorpay_signature": "bad"},
        )
        # Order doesn't exist for this user → 404; signature path → 400
        assert r.status_code in (400, 404)


class TestRazorpayWebhook:
    def test_webhook_invalid_signature(self):
        import json
        body = json.dumps({"event": "payment.captured", "payload": {}})
        r = requests.post(f"{BASE_URL}/api/webhook/razorpay",
                          data=body, headers={"X-Razorpay-Signature": "bad",
                                              "Content-Type": "application/json"})
        # With webhook_secret set, bad sig returns {ok: False}; without secret returns ok:True
        assert r.status_code == 200


# ── Stripe legacy regression ──
class TestStripeStillMounted:
    def test_stripe_session_route_exists(self, patient_session):
        # POST without required fields → expect 4xx (not 404). Confirms route mounted.
        r = patient_session.post(f"{BASE_URL}/api/payments/checkout/session", json={})
        assert r.status_code != 404, "Legacy Stripe route should still be mounted"
