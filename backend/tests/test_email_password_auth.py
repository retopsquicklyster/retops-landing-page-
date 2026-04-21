"""Email+Password auth flow: /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/me.

Covers:
- register 200 + cookie + returns session_token
- register 409 on duplicate, 422 on invalid email or short password
- login 200 with correct creds (pre-seeded admin + freshly registered)
- login 401 on wrong password
- brute force lock 429 after 5 failed attempts / 15min
- logout clears cookie -> /me 401
- /me works with Bearer header for both pwd-session and legacy test-session
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://quick-launch-133.preview.emergentagent.com",
).rstrip("/")

SEED_EMAIL = "owner@urbanflavours.ca"
SEED_PASSWORD = "CannabisSecure123!"
LEGACY_TOKEN = "test_session_1776772371"


def _new_email() -> str:
    # Server lowercases emails on register/login
    return f"test_pw_{uuid.uuid4().hex[:10]}@example.com"


# ---- Registration ----
class TestRegister:
    def test_register_happy_path_sets_cookie(self):
        s = requests.Session()
        payload = {"email": _new_email(), "password": "StrongPass123", "name": "Test PW User"}
        r = s.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "_id" not in data
        assert data["email"] == payload["email"]
        assert data.get("name") == "Test PW User"
        assert "user_id" in data and "session_token" in data
        # cookie set
        cookie = s.cookies.get("session_token")
        assert cookie and len(cookie) > 10
        # /me works with the cookie
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me.status_code == 200, me.text
        assert me.json()["email"] == payload["email"]

    def test_register_duplicate_returns_409(self):
        email = _new_email()
        s = requests.Session()
        r1 = s.post(f"{BASE_URL}/api/auth/register",
                    json={"email": email, "password": "StrongPass123", "name": "D1"}, timeout=15)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{BASE_URL}/api/auth/register",
                           json={"email": email, "password": "StrongPass123", "name": "D2"}, timeout=15)
        assert r2.status_code == 409, r2.text

    def test_register_invalid_email_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": "not-an-email", "password": "StrongPass123"}, timeout=15)
        assert r.status_code == 422, r.text

    def test_register_short_password_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": _new_email(), "password": "short"}, timeout=15)
        assert r.status_code == 422, r.text


# ---- Login ----
class TestLogin:
    def test_login_seeded_admin(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == SEED_EMAIL
        assert "session_token" in data
        assert s.cookies.get("session_token")
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == SEED_EMAIL

    def test_login_wrong_password_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": SEED_EMAIL, "password": "WrongPwxxxx"}, timeout=15)
        assert r.status_code == 401, r.text

    def test_login_after_fresh_register(self):
        email = _new_email()
        pwd = "FreshPass12345"
        # register
        r1 = requests.post(f"{BASE_URL}/api/auth/register",
                           json={"email": email, "password": pwd, "name": "Fresh"}, timeout=15)
        assert r1.status_code == 200
        # login with brand new session
        s = requests.Session()
        r2 = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": email, "password": pwd}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert s.cookies.get("session_token")
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == email


# ---- Brute force ----
class TestBruteForce:
    def test_lockout_after_5_failed_attempts(self):
        # Use a unique email so we don't lock the seeded admin
        email = _new_email()
        # First register the email so user exists (brute-force guard triggers regardless)
        requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": "CorrectPass999", "name": "BF"}, timeout=15)
        last_code = None
        for i in range(6):
            r = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": email, "password": f"badpw{i}xx"}, timeout=15)
            last_code = r.status_code
            if last_code == 429:
                break
        assert last_code == 429, f"expected 429 after 5 fails, got {last_code}"


# ---- Logout + /me ----
class TestLogout:
    def test_logout_invalidates_session(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=15)
        assert r.status_code == 200
        assert s.get(f"{BASE_URL}/api/auth/me", timeout=15).status_code == 200
        # logout
        lo = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert lo.status_code == 200
        # /me should now 401 (cookie cleared or session deleted)
        me2 = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me2.status_code == 401, me2.text


# ---- Bearer compatibility ----
class TestBearerCompat:
    def test_me_with_legacy_bearer_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {LEGACY_TOKEN}"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("role") == "admin"

    def test_me_with_pwd_session_bearer(self):
        # Login to get a token string
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=15)
        assert r.status_code == 200
        tok = r.json().get("session_token")
        assert tok
        me = requests.get(f"{BASE_URL}/api/auth/me",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == SEED_EMAIL
