"""Iteration 9 tests: churn-analysis, coaching/kpis, upload-file, upload-audio."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("TEST_SESSION_TOKEN", "test_session_1776772371")


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {TOKEN}"})
    return s


@pytest.fixture(scope="module", autouse=True)
def seed(auth_client):
    auth_client.post(f"{BASE_URL}/api/seed-demo?force=true", timeout=300)


def _no_id(o):
    if isinstance(o, dict):
        assert "_id" not in o
        for v in o.values():
            _no_id(v)
    elif isinstance(o, list):
        for v in o:
            _no_id(v)


# --- Executive churn-analysis ---
class TestChurnAnalysis:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/executive/churn-analysis")
        assert r.status_code == 401

    def test_shape(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/executive/churn-analysis")
        assert r.status_code == 200, r.text
        data = r.json()
        _no_id(data)
        assert "tiles" in data
        t = data["tiles"]
        for k in ("churn_rate_pct", "at_risk_customers", "revenue_at_risk", "retention_rate_pct", "arr_exposure_pct"):
            assert k in t, f"missing tiles.{k}"
        assert "top_reasons" in data and isinstance(data["top_reasons"], list)
        assert "segments" in data and isinstance(data["segments"], list)
        assert "strategic" in data
        s = data["strategic"]
        for k in ("coaching_roi_pct", "quality_trend_pct", "efficiency_gain_pct"):
            assert k in s


# --- Coaching KPIs ---
class TestCoachingKpis:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/coaching/kpis")
        assert r.status_code == 401

    def test_shape(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/coaching/kpis")
        assert r.status_code == 200, r.text
        d = r.json()
        _no_id(d)
        for k in ("active_learners", "completion_rate_pct", "avg_score_improvement", "total_modules"):
            assert k in d, f"missing {k}"


# --- File upload ---
class TestUploadFile:
    def test_txt_scored(self, auth_client):
        content = (
            b"Customer: Third billing issue this month, I am seriously considering switching to a competitor. "
            b"Agent: I'm sorry to hear that, let me check your account right away and fix this."
        )
        files = {"file": ("sample.txt", io.BytesIO(content), "text/plain")}
        data = {
            "customer": "Acme Corp",
            "agent": "TEST_FileAgent",
            "agent_type": "Human",
            "channel": "Email",
            "type": "Billing",
        }
        r = auth_client.post(f"{BASE_URL}/api/interactions/upload-file", files=files, data=data, timeout=180)
        assert r.status_code == 200, r.text
        body = r.json()
        _no_id(body)
        assert "interaction_id" in body
        assert "analysis" in body and "qa_score" in body["analysis"]

    def test_md_scored(self, auth_client):
        content = b"# Transcript\n\nCustomer: Everything is fine, thanks.\nAgent: Great to hear!"
        files = {"file": ("note.md", io.BytesIO(content), "text/markdown")}
        data = {"customer": "NovaTech Ltd.", "agent": "TEST_MdAgent", "agent_type": "Human", "channel": "Chat", "type": "General"}
        r = auth_client.post(f"{BASE_URL}/api/interactions/upload-file", files=files, data=data, timeout=180)
        assert r.status_code == 200, r.text

    def test_binary_rejected(self, auth_client):
        # random non-text binary bytes
        content = bytes([0x00, 0xFF, 0x42, 0xAA] * 200)
        files = {"file": ("bad.bin", io.BytesIO(content), "application/octet-stream")}
        data = {"customer": "Acme Corp", "agent": "TEST_BinAgent", "agent_type": "Human", "channel": "Email", "type": "General"}
        r = auth_client.post(f"{BASE_URL}/api/interactions/upload-file", files=files, data=data, timeout=60)
        # Acceptable: 400/415/422 for binary
        assert r.status_code in (400, 415, 422), f"unexpected {r.status_code}: {r.text[:300]}"

    def test_oversize_rejected(self, auth_client):
        big = b"A" * (26 * 1024 * 1024)
        files = {"file": ("big.txt", io.BytesIO(big), "text/plain")}
        data = {"customer": "Acme Corp", "agent": "TEST_BigAgent", "agent_type": "Human", "channel": "Email", "type": "General"}
        r = auth_client.post(f"{BASE_URL}/api/interactions/upload-file", files=files, data=data, timeout=180)
        assert r.status_code in (413, 400, 422), f"expected 413-ish got {r.status_code}"


# --- Audio upload (Whisper) ---
class TestUploadAudio:
    def test_audio_endpoint_exists(self, auth_client):
        # Send a tiny junk webm chunk — we only care endpoint responds with 200 or 502
        fake_webm = b"\x1A\x45\xDF\xA3" + b"\x00" * 256
        files = {"file": ("sample.webm", io.BytesIO(fake_webm), "audio/webm")}
        data = {"customer": "Acme Corp", "agent": "TEST_AudioAgent", "agent_type": "Human", "channel": "Voice"}
        r = auth_client.post(f"{BASE_URL}/api/interactions/upload-audio", files=files, data=data, timeout=180)
        # Valid outcomes: 200 (transcribed) or 502 (RetOps transcription failed)
        assert r.status_code in (200, 502, 400, 422), f"unexpected {r.status_code}: {r.text[:300]}"
        if r.status_code == 502:
            body = r.json()
            detail = (body.get("detail") or "").lower()
            # Must NOT leak vendor names
            assert "emergent" not in detail, f"vendor leak in 502: {body}"
            assert "openai" not in detail, f"vendor leak in 502: {body}"
            assert "retops" in detail or "transcription" in detail, f"unexpected 502 detail: {body}"
