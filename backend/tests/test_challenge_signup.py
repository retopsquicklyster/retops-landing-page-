"""Unit tests for Revenue Leak Challenge signup endpoints (/api/challenge-signup)."""
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Set dummy Mongo env vars before importing backend.server so module import succeeds
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "retops_test")

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Provide stub for optional private emergentintegrations package if not installed
if "emergentintegrations" not in sys.modules:
    emergent_stub = MagicMock()
    sys.modules["emergentintegrations"] = emergent_stub
    sys.modules["emergentintegrations.llm"] = emergent_stub
    sys.modules["emergentintegrations.llm.chat"] = emergent_stub

import server  # noqa: E402


@pytest.fixture(autouse=True)
def reset_challenge_state(monkeypatch):
    """Reset in-memory duplicate/rate-limit state and mock Mongo collection between tests."""
    server._challenge_seen_emails.clear()
    server._challenge_ip_timestamps.clear()
    mock_collection = MagicMock()
    mock_collection.find_one = AsyncMock(return_value=None)
    mock_collection.insert_one = AsyncMock(return_value=MagicMock())
    monkeypatch.setattr(server.db, "challenge_signups", mock_collection, raising=False)
    monkeypatch.delenv("GOOGLE_SHEETS_WEBHOOK_URL", raising=False)


client = TestClient(server.app)


def test_challenge_signup_status_unconfigured():
    r = client.get("/api/challenge-signup/status")
    assert r.status_code == 200
    assert r.json() == {"configured": False}


def test_challenge_signup_status_configured(monkeypatch):
    monkeypatch.setenv("GOOGLE_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/test/exec")
    r = client.get("/api/challenge-signup/status")
    assert r.status_code == 200
    assert r.json() == {"configured": True}


def test_challenge_signup_fails_when_unconfigured():
    r = client.post(
        "/api/challenge-signup",
        json={
            "email": "alex@company.com",
            "score": 4,
            "source": "Web Summit Lisbon QR",
            "consent": True,
        },
    )
    assert r.status_code == 503
    assert "temporarily unavailable" in r.json()["detail"].lower()


def test_challenge_signup_requires_consent(monkeypatch):
    monkeypatch.setenv("GOOGLE_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/test/exec")
    r = client.post(
        "/api/challenge-signup",
        json={
            "email": "alex@company.com",
            "score": 4,
            "source": "Web Summit Lisbon QR",
            "consent": False,
        },
    )
    assert r.status_code == 400
    assert "opt-in" in r.json()["detail"].lower()


@pytest.mark.parametrize("bad_score", [-1, 6, 99])
def test_challenge_signup_validates_score_bounds(monkeypatch, bad_score):
    monkeypatch.setenv("GOOGLE_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/test/exec")
    r = client.post(
        "/api/challenge-signup",
        json={
            "email": "alex@company.com",
            "score": bad_score,
            "source": "Web Summit Lisbon QR",
            "consent": True,
        },
    )
    assert r.status_code == 400
    assert "between 0 and 5" in r.json()["detail"].lower()


@pytest.mark.parametrize("bad_email", ["", "not-an-email", "user@tempmail.com", "user@.com"])
def test_challenge_signup_validates_email(monkeypatch, bad_email):
    monkeypatch.setenv("GOOGLE_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/test/exec")
    r = client.post(
        "/api/challenge-signup",
        json={
            "email": bad_email,
            "score": 3,
            "source": "Web Summit Lisbon QR",
            "consent": True,
        },
    )
    assert r.status_code == 400
    assert "email" in r.json()["detail"].lower()


def test_challenge_signup_rejects_honeypot(monkeypatch):
    monkeypatch.setenv("GOOGLE_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/test/exec")
    r = client.post(
        "/api/challenge-signup",
        json={
            "email": "alex@company.com",
            "score": 5,
            "source": "Web Summit Lisbon QR",
            "consent": True,
            "website": "https://spam.example.com",
        },
    )
    assert r.status_code == 400


def test_challenge_signup_success_and_duplicate_rejection(monkeypatch):
    webhook_url = "https://script.google.com/macros/s/test/exec"
    monkeypatch.setenv("GOOGLE_SHEETS_WEBHOOK_URL", webhook_url)

    captured_calls = []

    class DummyResponse:
        status_code = 200
        text = '{"ok": true, "saved": true}'

        def json(self):
            return {"ok": True, "saved": True}

    async def fake_post(self, url, json=None, **kwargs):
        captured_calls.append((url, json))
        return DummyResponse()

    with patch.object(server.httpx.AsyncClient, "post", new=fake_post):
        r1 = client.post(
            "/api/challenge-signup",
            json={
                "email": "  Alex.Tester@Company.com ",
                "score": 5,
                "source": "Web Summit Lisbon QR",
                "consent": True,
            },
        )
        assert r1.status_code == 200, r1.text
        body = r1.json()
        assert body["ok"] is True
        assert body["saved"] is True
        assert body["email"] == "alex.tester@company.com"
        assert body["score"] == 5
        assert body["source"] == "Web Summit Lisbon QR"
        assert body["opt_in"] == "Yes"

        assert len(captured_calls) == 1
        sent_url, sent_payload = captured_calls[0]
        assert sent_url == webhook_url
        assert sent_payload["row"] == [
            body["submitted_at"],
            "alex.tester@company.com",
            5,
            "Web Summit Lisbon QR",
            "Yes",
        ]

        # Duplicate submission with same email must be rejected with 409
        r2 = client.post(
            "/api/challenge-signup",
            json={
                "email": "alex.tester@company.com",
                "score": 5,
                "source": "Web Summit Lisbon QR",
                "consent": True,
            },
        )
        assert r2.status_code == 409
