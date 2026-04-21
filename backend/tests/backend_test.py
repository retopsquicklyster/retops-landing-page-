"""RetOps backend regression tests.

Covers: health, auth (session exchange + me), seed-demo, interactions CRUD + filters,
rescore, dashboard stats, accounts, agents, coaching, playbooks, settings roundtrip,
auth enforcement, and _id leak guard.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("TEST_SESSION_TOKEN", "test_session_1776737641343")


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_client():
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}",
    })
    return s


def _no_mongo_id(obj):
    """Recursively ensure '_id' key never appears in JSON payloads."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"MongoDB _id leaked in: {list(obj.keys())}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_mongo_id(v)


# ---------- Health ----------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("service") == "retops-api"
        assert data.get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_session_rejects_invalid(self, client):
        r = client.post(f"{BASE_URL}/api/auth/session", json={"session_id": "bogus-session-id-xyz"})
        assert r.status_code == 401

    def test_me_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_returns_user(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        assert "user_id" in data and "email" in data and "name" in data
        assert "settings" in data
        s = data["settings"]
        for k in ("llm_provider", "llm_model", "custom_api_key"):
            assert k in s

    def test_protected_endpoints_401_without_auth(self, client):
        for ep in [
            "/api/interactions",
            "/api/dashboard/stats",
            "/api/accounts",
            "/api/agents",
            "/api/coaching",
            "/api/settings",
        ]:
            r = client.get(f"{BASE_URL}{ep}")
            assert r.status_code == 401, f"{ep} returned {r.status_code}"


# ---------- Seed ----------
class TestSeed:
    def test_seed_demo(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/seed-demo", timeout=300)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_mongo_id(data)
        assert data.get("status") in ("seeded", "already-seeded")
        # Verify interactions exist and have analysis
        r2 = auth_client.get(f"{BASE_URL}/api/interactions")
        assert r2.status_code == 200
        items = r2.json()
        _no_mongo_id(items)
        assert len(items) >= 6, f"Expected >=6 interactions, got {len(items)}"
        sample = items[0]
        analysis = sample.get("analysis") or {}
        # Required analysis fields
        assert "qa_score" in analysis
        assert "rubric" in analysis and isinstance(analysis["rubric"], list) and len(analysis["rubric"]) == 7
        assert "churn_risk" in analysis
        assert "arr_at_risk" in analysis
        assert "coaching_card" in analysis
        assert "save_playbook" in analysis


# ---------- Interactions ----------
class TestInteractions:
    def test_list(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/interactions")
        assert r.status_code == 200
        items = r.json()
        _no_mongo_id(items)
        assert isinstance(items, list) and len(items) > 0

    def test_filter_churn_risk_high(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/interactions?churn_risk=High")
        assert r.status_code == 200
        items = r.json()
        for it in items:
            assert it["analysis"].get("churn_risk") == "High"

    def test_filter_agent_type_ai(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/interactions?agent_type=AI")
        assert r.status_code == 200
        items = r.json()
        for it in items:
            assert it["agent_type"] == "AI"

    def test_get_single(self, auth_client):
        items = auth_client.get(f"{BASE_URL}/api/interactions").json()
        iid = items[0]["interaction_id"]
        r = auth_client.get(f"{BASE_URL}/api/interactions/{iid}")
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        assert data["interaction_id"] == iid
        assert "rubric" in data["analysis"]

    def test_create_and_rescore(self, auth_client):
        payload = {
            "customer": "Acme Corp",
            "agent": "TEST_Agent_QA",
            "agent_type": "Human",
            "channel": "Chat",
            "transcript": "Customer: My invoice is wrong again, third time. Agent: I'm sorry, let me fix that right now and apply a credit.",
            "type": "Billing",
            "duration_sec": 120,
        }
        r = auth_client.post(f"{BASE_URL}/api/interactions", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_mongo_id(data)
        iid = data["interaction_id"]
        assert data["customer"] == "Acme Corp"
        assert "qa_score" in data["analysis"]

        # Rescore
        r2 = auth_client.post(f"{BASE_URL}/api/interactions/{iid}/rescore", timeout=120)
        assert r2.status_code == 200
        data2 = r2.json()
        _no_mongo_id(data2)
        assert "qa_score" in data2["analysis"]


# ---------- Dashboard ----------
class TestDashboard:
    def test_stats(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        for k in [
            "coverage", "avg_score", "active_agents", "interactions_total",
            "interactions_today", "score_distribution", "ai_avg", "human_avg",
            "top_agents", "alerts", "total_arr_at_risk", "at_risk_accounts",
            "recent_interactions",
        ]:
            assert k in data, f"missing {k}"
        # Buckets shape
        for b in ("90-100", "80-89", "70-79", "<70"):
            assert b in data["score_distribution"]
        # Top agents sorted desc
        if len(data["top_agents"]) > 1:
            scores = [a["avg_score"] for a in data["top_agents"]]
            assert scores == sorted(scores, reverse=True)
        assert isinstance(data["alerts"], list)

    def test_recent_interactions(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        recent = r.json()["recent_interactions"]
        assert isinstance(recent, list)
        assert len(recent) <= 6
        for row in recent:
            for k in ("interaction_id", "agent", "customer", "qa_score", "status", "created_at"):
                assert k in row, f"missing {k} in recent row"
            # Status logic
            if row["qa_score"] < 75:
                assert row["status"] == "Needs Coaching"
            else:
                assert row["status"] == "Completed"


# ---------- Executive Overview ----------
class TestExecutive:
    def test_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/executive/overview")
        assert r.status_code == 401

    def test_overview(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/executive/overview")
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        # top-level keys
        for k in ("business_impact", "departments", "risk_alerts"):
            assert k in data, f"missing {k}"
        # business_impact keys
        bi = data["business_impact"]
        for k in (
            "qa_roi", "csat_pct", "agent_productivity_delta", "cost_savings",
            "customer_retention", "first_call_resolution", "avg_handle_time",
            "agent_turnover", "total_arr", "arr_at_risk",
        ):
            assert k in bi, f"missing business_impact.{k}"
        # nested structures
        assert "arr_gain" in bi["customer_retention"]
        assert "cost_delta" in bi["first_call_resolution"]
        assert "capacity_delta_pct" in bi["avg_handle_time"]
        assert "cost_delta" in bi["agent_turnover"]
        # departments sorted desc by avg_score
        depts = data["departments"]
        assert isinstance(depts, list)
        if len(depts) > 1:
            scores = [d["avg_score"] for d in depts]
            assert scores == sorted(scores, reverse=True)
        for d in depts:
            for k in ("department", "agents", "avg_score", "delta_pct"):
                assert k in d
        # risk_alerts
        alerts = data["risk_alerts"]
        assert isinstance(alerts, list)
        assert len(alerts) <= 6
        for ra in alerts:
            for k in ("severity", "department", "title", "note", "recommended_action", "interaction_id"):
                assert k in ra
            assert ra["severity"] in ("HIGH RISK", "MEDIUM RISK")


# ---------- Accounts / Agents / Coaching / Playbook ----------
class TestAccountsAgentsCoaching:
    def test_accounts(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/accounts")
        assert r.status_code == 200
        items = r.json()
        _no_mongo_id(items)
        assert len(items) > 0
        for a in items:
            assert "churn_risk" in a and "arr_at_risk" in a

    def test_agents(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/agents")
        assert r.status_code == 200
        items = r.json()
        _no_mongo_id(items)
        assert len(items) > 0
        for a in items:
            assert "avg_score" in a and "interactions" in a

    def test_coaching(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/coaching")
        assert r.status_code == 200
        items = r.json()
        _no_mongo_id(items)
        assert isinstance(items, list)
        # At least one card should exist after seeding
        if items:
            c = items[0]
            for k in ("interaction_id", "headline", "strengths", "growth_areas", "recommended_actions"):
                assert k in c

    def test_playbook_acme(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/playbooks/account/Acme Corp")
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        assert data["customer"] == "Acme Corp"
        assert "save_playbook" in data and "churn_risk" in data

    def test_playbook_missing_account(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/playbooks/account/NonexistentAcct_TEST")
        assert r.status_code == 404


# ---------- Settings ----------
class TestSettings:
    def test_settings_roundtrip(self, auth_client):
        # Get
        r = auth_client.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        original = r.json()
        _no_mongo_id(original)

        # Put
        new_settings = {"llm_provider": "anthropic", "llm_model": "claude-3-5-sonnet-20241022", "custom_api_key": ""}
        r2 = auth_client.put(f"{BASE_URL}/api/settings", json=new_settings)
        assert r2.status_code == 200
        assert r2.json()["llm_provider"] == "anthropic"

        # Verify persisted via /auth/me
        r3 = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r3.json()["settings"]["llm_provider"] == "anthropic"

        # Restore
        auth_client.put(f"{BASE_URL}/api/settings", json=original)


# ---------- Public Share ----------
class TestPlaybookShare:
    def test_create_share_requires_auth(self, client):
        r = client.post(f"{BASE_URL}/api/playbooks/share/Acme Corp")
        assert r.status_code == 401

    def test_create_share_returns_token(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/playbooks/share/Acme Corp")
        assert r.status_code == 200, r.text
        data = r.json()
        _no_mongo_id(data)
        assert "token" in data and isinstance(data["token"], str)
        assert len(data["token"]) == 16
        assert data["customer"] == "Acme Corp"

    def test_create_share_idempotent(self, auth_client):
        r1 = auth_client.post(f"{BASE_URL}/api/playbooks/share/Acme Corp")
        r2 = auth_client.post(f"{BASE_URL}/api/playbooks/share/Acme Corp")
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["token"] == r2.json()["token"]

    def test_shared_playbook_is_public(self, auth_client, client):
        tok = auth_client.post(f"{BASE_URL}/api/playbooks/share/Acme Corp").json()["token"]
        # Use un-authenticated client
        r = client.get(f"{BASE_URL}/api/shared/playbook/{tok}")
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        for k in ("customer", "arr", "churn_risk", "arr_at_risk", "signal", "save_playbook"):
            assert k in data, f"missing {k}"
        assert data["customer"] == "Acme Corp"
        sp = data["save_playbook"]
        assert isinstance(sp, dict)
        # save_playbook should contain steps + offer_suggestion
        assert "steps" in sp or "offer_suggestion" in sp

    def test_shared_playbook_invalid_token_404(self, client):
        r = client.get(f"{BASE_URL}/api/shared/playbook/invalid_token_xxxx")
        assert r.status_code == 404


# ---------- Activity feed ----------
class TestActivity:
    def test_activity_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/activity")
        assert r.status_code == 401

    def test_activity_returns_unified_timeline(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/activity")
        assert r.status_code == 200, r.text
        events = r.json()
        _no_mongo_id(events)
        assert isinstance(events, list)
        # Expect at least 15 events from seed (6 interactions -> 6 base + churn/ai/upsell/coaching sub-events)
        assert len(events) >= 15, f"Expected >=15 events, got {len(events)}"
        # Validate shape of each event
        allowed_kinds = {"interaction", "churn", "ai", "qa", "upsell", "coaching", "share"}
        for e in events:
            assert "id" in e
            assert "kind" in e and e["kind"] in allowed_kinds, f"bad kind: {e.get('kind')}"
            assert "at" in e
            assert "title" in e
            assert "actor" in e
        # At least 1 base interaction event
        kinds = [e["kind"] for e in events]
        assert "interaction" in kinds
        # sorted descending by at
        ats = [e.get("at") or "" for e in events]
        assert ats == sorted(ats, reverse=True), "events not sorted desc by at"

    def test_activity_share_surface(self, auth_client):
        # Create a share -> expect a share-kind event in feed
        customer = "NovaTech Ltd."
        sr = auth_client.post(f"{BASE_URL}/api/playbooks/share/{customer}")
        assert sr.status_code == 200
        r = auth_client.get(f"{BASE_URL}/api/activity")
        assert r.status_code == 200
        events = r.json()
        share_events = [e for e in events if e["kind"] == "share" and customer in e["title"]]
        assert share_events, "expected share event for NovaTech"
        assert share_events[0]["title"] == f"Save playbook shared — {customer}"

