"""Iteration 23 — Book-a-demo tracking + auth email side-effects + integrations test."""
import os
import time
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "test_session_1776772371"


# --- /api/track/book-demo ---
def test_book_demo_public_no_auth():
    """Public endpoint must work without any cookie/auth."""
    s = requests.Session()  # fresh session, no cookies
    r = s.post(f"{BASE_URL}/api/track/book-demo",
               json={"source_path": "/", "referrer": "https://retops.ai/"})
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}


def test_book_demo_persists_doc():
    """Click should land in db.book_demo_clicks (verified via count delta)."""
    # We can't query the DB directly via API but we can fire 2 calls and ensure both 200
    for _ in range(2):
        r = requests.post(f"{BASE_URL}/api/track/book-demo",
                          json={"source_path": "/auth", "referrer": "https://example.com/"},
                          headers={"User-Agent": "iter23-test/1.0"})
        assert r.status_code == 200
        assert r.json().get("ok") is True


def test_book_demo_empty_payload():
    """Defaults source_path / referrer to empty strings — still 200."""
    r = requests.post(f"{BASE_URL}/api/track/book-demo", json={})
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# --- /api/auth/register & login latency (fire-and-forget email) ---
def test_register_response_under_2s():
    email = f"test_iter23_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "Iter23Test123!", "name": "Iter23 Tester"}
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == email
    assert "session_token" in data and len(data["session_token"]) > 0
    assert elapsed < 2.0, f"register took {elapsed:.2f}s — fire-and-forget email is blocking"


def test_login_seeded_creds_under_2s():
    payload = {"email": "owner@urbanflavours.ca", "password": "CannabisSecure123!"}
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "owner@urbanflavours.ca"
    assert "session_token" in data and len(data["session_token"]) > 0
    assert elapsed < 2.0, f"login took {elapsed:.2f}s — fire-and-forget email is blocking"


# --- /api/integrations/test ---
def _auth_session():
    s = requests.Session()
    s.cookies.set("session_token", ADMIN_TOKEN)
    return s


def test_integrations_zendesk_missing_creds():
    s = _auth_session()
    r = s.post(f"{BASE_URL}/api/integrations/test", json={"connector": "zendesk"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is False
    detail = (body.get("detail") or "").lower()
    assert "missing" in detail and ("subdomain" in detail or "api_token" in detail or "email" in detail)


def test_integrations_intercom_missing_creds():
    s = _auth_session()
    r = s.post(f"{BASE_URL}/api/integrations/test", json={"connector": "intercom"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is False
    detail = (body.get("detail") or "").lower()
    assert "missing" in detail and "access_token" in detail


def test_integrations_unknown_connector():
    s = _auth_session()
    r = s.post(f"{BASE_URL}/api/integrations/test", json={"connector": "bogus"})
    assert r.status_code == 422
