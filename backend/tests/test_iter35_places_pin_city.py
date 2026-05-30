"""
Iteration 35 — Patient "Pin a city" via Google Places (server-proxied).

Verifies:
  1. /api/places/autocomplete needs auth (401 unauthenticated)
  2. /api/places/autocomplete returns predictions array (authenticated)
  3. /api/places/details returns {name, lat, lng, place_id, formatted_address}
  4. PUT /api/patient/profile with search_city persists & GET returns it
  5. PUT /api/patient/profile with search_city_clear:true removes the field
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # tests rely on the FE backend URL env; if not set fall back to local
    BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"


# ----------------------------- fixtures --------------------------------------
@pytest.fixture(scope="module")
def patient_session():
    """Auth via demo-login {role:'patient'} → returns a cookie-bearing session."""
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": "patient"}, timeout=20)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    return s


# ----------------------------- 1. Auth gate ----------------------------------
def test_places_autocomplete_requires_auth():
    """Curl-without-cookie must be rejected (401/403)."""
    r = requests.get(f"{API}/places/autocomplete", params={"q": "Hyder"}, timeout=10)
    assert r.status_code in (401, 403), (
        f"Expected 401/403 unauthenticated, got {r.status_code}: {r.text[:200]}"
    )


def test_places_details_requires_auth():
    r = requests.get(f"{API}/places/details", params={"place_id": "x"}, timeout=10)
    assert r.status_code in (401, 403)


# ----------------------------- 2. Autocomplete ------------------------------
def test_places_autocomplete_returns_predictions(patient_session):
    r = patient_session.get(f"{API}/places/autocomplete", params={"q": "Hyder"}, timeout=20)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert "predictions" in data
    assert isinstance(data["predictions"], list)
    # Google should return at least 1 city for "Hyder"
    if data["predictions"]:
        p = data["predictions"][0]
        assert "place_id" in p and p["place_id"]
        assert "description" in p


def test_places_autocomplete_short_query_empty(patient_session):
    r = patient_session.get(f"{API}/places/autocomplete", params={"q": "H"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("predictions") == []


# ----------------------------- 3. Details -----------------------------------
def test_places_details_returns_lat_lng(patient_session):
    # First grab a real place_id from autocomplete
    a = patient_session.get(f"{API}/places/autocomplete", params={"q": "Hyderabad"}, timeout=20).json()
    preds = a.get("predictions") or []
    if not preds:
        pytest.skip("Autocomplete returned 0 predictions for 'Hyderabad' — Google API quota?")
    pid = preds[0]["place_id"]
    r = patient_session.get(f"{API}/places/details", params={"place_id": pid}, timeout=20)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("place_id") == pid
    assert isinstance(d.get("lat"), (int, float))
    assert isinstance(d.get("lng"), (int, float))
    assert d.get("name") or d.get("formatted_address")


# ----------------------------- 4. Persist search_city -----------------------
def test_persist_search_city_and_clear(patient_session):
    # Pick a real place
    a = patient_session.get(f"{API}/places/autocomplete", params={"q": "Hyderabad"}, timeout=20).json()
    preds = a.get("predictions") or []
    if not preds:
        pytest.skip("No predictions to test persistence with")
    det = patient_session.get(
        f"{API}/places/details", params={"place_id": preds[0]["place_id"]}, timeout=20
    ).json()

    payload = {
        "search_city": {
            "name": det.get("formatted_address") or det.get("name"),
            "place_id": det["place_id"],
            "lat": det["lat"],
            "lng": det["lng"],
        }
    }
    r = patient_session.put(f"{API}/patient/profile", json=payload, timeout=15)
    assert r.status_code == 200, r.text[:300]
    prof = r.json().get("profile") or {}
    sc = prof.get("search_city") or {}
    assert sc.get("place_id") == det["place_id"]
    assert abs(float(sc.get("lat")) - float(det["lat"])) < 1e-6
    assert abs(float(sc.get("lng")) - float(det["lng"])) < 1e-6

    # GET to verify persistence
    g = patient_session.get(f"{API}/patient/profile", timeout=10)
    assert g.status_code == 200
    gprof = g.json().get("profile") or {}
    gsc = gprof.get("search_city") or {}
    assert gsc.get("place_id") == det["place_id"]

    # Now CLEAR
    rc = patient_session.put(
        f"{API}/patient/profile", json={"search_city_clear": True}, timeout=15
    )
    assert rc.status_code == 200, rc.text[:300]
    cleared_prof = rc.json().get("profile") or {}
    assert not cleared_prof.get("search_city"), (
        f"search_city should be removed after clear, got: {cleared_prof.get('search_city')}"
    )

    # GET to confirm field is gone
    g2 = patient_session.get(f"{API}/patient/profile", timeout=10).json().get("profile") or {}
    assert not g2.get("search_city")
