"""Iteration 18 — settings nested-keys + executive churn + video assets regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
EMAIL = "owner@urbanflavours.ca"
PASSWORD = "CannabisSecure123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return s


# ---------- Settings nested keys ----------
class TestSettings:
    def test_get_settings_returns_nested_keys(self, session):
        r = session.get(f"{BASE_URL}/api/settings", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("ai_keys", "integrations", "notifications", "quality", "security"):
            assert k in d, f"missing key: {k}"
        assert isinstance(d["quality"].get("pass_threshold"), (int, float))
        assert "retention_days" in d["security"]

    def test_put_settings_persists_all_nested(self, session):
        payload = {
            "llm_provider": "openai",
            "llm_model": "gpt-4o-mini",
            "custom_api_key": "",
            "digest_subscribed": False,
            "digest_email": "",
            "ai_keys": {"openai": "sk-iter18-test", "elevenlabs": "ek-18"},
            "integrations": {"slack_webhook": "https://hooks.slack.com/iter18"},
            "notifications": {
                "email_alerts": True, "slack_alerts": False,
                "critical_only": True, "alert_email": "TEST_iter18@example.com",
            },
            "quality": {"pass_threshold": 78, "warning_threshold": 63, "hard_fail_cap": 55, "churn_alert_threshold": 52},
            "security": {"retention_days": 270, "data_encryption": True, "audit_logging": True, "access_logging": False},
        }
        put = session.put(f"{BASE_URL}/api/settings", json=payload, timeout=10)
        assert put.status_code == 200, put.text

        get = session.get(f"{BASE_URL}/api/settings", timeout=10).json()
        assert get["ai_keys"]["openai"] == "sk-iter18-test"
        assert get["quality"]["pass_threshold"] == 78
        assert get["security"]["retention_days"] == 270
        assert get["notifications"]["alert_email"] == "TEST_iter18@example.com"
        assert get["integrations"]["slack_webhook"] == "https://hooks.slack.com/iter18"

    def test_put_rejects_missing_required(self, session):
        r = session.put(f"{BASE_URL}/api/settings", json={"ai_keys": {}}, timeout=10)
        assert r.status_code == 422  # llm_provider + llm_model required


# ---------- Executive churn analysis (live DB-backed) ----------
class TestChurnAnalysis:
    def test_churn_analysis_has_tiles_reasons_segments(self, session):
        r = session.get(f"{BASE_URL}/api/executive/churn-analysis", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "tiles" in d and "top_reasons" in d and "segments" in d
        assert "churn_rate_pct" in d["tiles"]
        assert isinstance(d["top_reasons"], list)
        assert isinstance(d["segments"], list)


# ---------- Video static assets ----------
class TestVideoAssets:
    @pytest.mark.parametrize("path,ctype", [
        ("/video/retops-demo.mp4", "video/mp4"),
        ("/video/retops-demo.webm", "video/webm"),
        ("/video/retops-demo-poster.jpg", "image/jpeg"),
    ])
    def test_video_served(self, path, ctype):
        r = requests.head(f"{BASE_URL}{path}", timeout=10, allow_redirects=True)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        assert ctype in r.headers.get("Content-Type", "")


# ---------- Bulk upload regression (single & multi) ----------
class TestBulkRegression:
    def test_bulk_upload_single_txt(self, session):
        txt = (
            "Customer: hi my order never arrived\n"
            "Agent: sorry let me check that\n"
            "Customer: i've been waiting three days, thinking of switching to Eaze\n"
        )
        r = session.post(
            f"{BASE_URL}/api/interactions/bulk-upload",
            json={"content": txt, "client_preset": "urban_flavours_delivery",
                  "default_customer": "TEST_Alice", "default_agent": "TEST_Bob", "agent_type": "Human"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] >= 1 and d["scored"] >= 1

    def test_bulk_upload_multi_concat_with_separator(self, session):
        combined = (
            "# FILE: a.txt\nCustomer: refund please\nAgent: sure\n\n===\n\n"
            "# FILE: b.txt\nCustomer: product was stale\nAgent: sending replacement"
        )
        r = session.post(
            f"{BASE_URL}/api/interactions/bulk-upload",
            json={"content": combined, "client_preset": "urban_flavours_delivery",
                  "default_customer": "TEST_Multi", "default_agent": "TEST_Agent", "agent_type": "Human"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] >= 2, f"expected >=2 interactions from ===-separated content, got {d}"
