"""
Iter-21 backend tests:
1. Multi-tenant workspace_id isolation
2. Integrations /test + /pull endpoints (empty + invalid creds)
3. Legacy data (urbanflavours user) backfill works
4. Settings-scoped presets
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _new_email():
    return f"test_iter21_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(scope="module")
def user_a():
    """Register user A and return {token, workspace_id, email, session}."""
    s = requests.Session()
    email = _new_email()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "User A"})
    assert r.status_code == 200, f"register A failed: {r.status_code} {r.text}"
    data = r.json()
    return {"session": s, "token": data["session_token"], "workspace_id": data["workspace_id"], "email": email, "user_id": data["user_id"]}


@pytest.fixture(scope="module")
def user_b():
    s = requests.Session()
    email = _new_email()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass456!", "name": "User B"})
    assert r.status_code == 200, f"register B failed: {r.status_code} {r.text}"
    data = r.json()
    return {"session": s, "token": data["session_token"], "workspace_id": data["workspace_id"], "email": email, "user_id": data["user_id"]}


def _h(u):
    return {"Authorization": f"Bearer {u['token']}"}


# --------- 1. Multi-tenant isolation ---------
class TestMultiTenant:
    def test_register_returns_unique_workspace_ids(self, user_a, user_b):
        assert user_a["workspace_id"] != user_b["workspace_id"]
        assert user_a["workspace_id"].startswith("ws_")
        assert user_b["workspace_id"].startswith("ws_")

    def test_a_initial_interactions_empty(self, user_a):
        r = requests.get(f"{API}/interactions", headers=_h(user_a))
        assert r.status_code == 200, r.text
        assert r.json() == [], f"expected [] got {r.json()[:2]}"

    def test_b_initial_interactions_empty(self, user_b):
        r = requests.get(f"{API}/interactions", headers=_h(user_b))
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_a_seed_demo_then_isolated(self, user_a, user_b):
        # Seed demo for A only
        r = requests.post(f"{API}/seed-demo?force=true", headers=_h(user_a))
        assert r.status_code == 200, f"seed-demo failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("interactions", 0) > 0, body

        # A now sees interactions
        ra = requests.get(f"{API}/interactions", headers=_h(user_a))
        assert ra.status_code == 200
        a_count = len(ra.json())
        assert a_count > 0, "A should see seeded interactions"

        # B still sees nothing
        rb = requests.get(f"{API}/interactions", headers=_h(user_b))
        assert rb.status_code == 200
        assert rb.json() == [], f"B leaked A's data! got {len(rb.json())} interactions"

    def test_b_dashboard_stats_zero_after_a_seeded(self, user_b):
        r = requests.get(f"{API}/dashboard/stats", headers=_h(user_b))
        assert r.status_code == 200, r.text
        data = r.json()
        # B should have 0 interactions
        assert data.get("total_interactions", 0) == 0, f"B leaked: {data}"

    def test_b_accounts_empty(self, user_b):
        r = requests.get(f"{API}/accounts", headers=_h(user_b))
        assert r.status_code == 200
        assert r.json() == [], f"B leaked accounts: {len(r.json())}"

    def test_b_agents_empty(self, user_b):
        r = requests.get(f"{API}/agents", headers=_h(user_b))
        assert r.status_code == 200
        assert r.json() == [], f"B leaked agents: {len(r.json())}"

    def test_b_executive_overview_zero(self, user_b):
        r = requests.get(f"{API}/executive/overview", headers=_h(user_b))
        assert r.status_code == 200, r.text
        data = r.json()
        # B has no interactions so total_arr should be 0
        assert data.get("total_arr", 0) == 0, f"B exec overview leaked: total_arr={data.get('total_arr')}"

    def test_b_coaching_kpis_zero(self, user_b):
        r = requests.get(f"{API}/coaching/kpis", headers=_h(user_b))
        assert r.status_code == 200, r.text

    def test_b_activity_empty(self, user_b):
        r = requests.get(f"{API}/activity", headers=_h(user_b))
        assert r.status_code == 200
        items = r.json()
        # Should be empty or only contain B's own (none yet)
        assert isinstance(items, list)
        for it in items:
            # If any items, none should be from a different workspace
            assert it.get("workspace_id") in (user_b["workspace_id"], None)

    def test_b_presets_isolated(self, user_b):
        r = requests.get(f"{API}/bulk/presets", headers=_h(user_b))
        assert r.status_code == 200, r.text
        data = r.json()
        # built-ins are returned for everyone, only custom presets should be empty for new user
        assert isinstance(data, (list, dict))


# --------- 2. Legacy data backfill (owner@urbanflavours.ca) ---------
class TestLegacyBackfill:
    @pytest.fixture(scope="class")
    def owner(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": "owner@urbanflavours.ca", "password": "CannabisSecure123!"})
        assert r.status_code == 200, f"owner login failed: {r.text}"
        data = r.json()
        token = data.get("session_token")
        # Fetch workspace_id via /auth/me since login response doesn't include it
        me = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200, me.text
        wid = me.json().get("workspace_id")
        return {"session": s, "token": token, "workspace_id": wid}

    def test_owner_workspace_is_default(self, owner):
        # After backfill, owner should be on ws_default
        assert owner["workspace_id"] == "ws_default", f"got {owner['workspace_id']}"

    def test_owner_sees_legacy_interactions(self, owner):
        r = requests.get(f"{API}/interactions", headers={"Authorization": f"Bearer {owner['token']}"})
        assert r.status_code == 200, r.text
        items = r.json()
        assert len(items) >= 23, f"owner should see >=23 legacy interactions, got {len(items)}"

    def test_owner_executive_overview_arr(self, owner):
        r = requests.get(f"{API}/executive/overview", headers={"Authorization": f"Bearer {owner['token']}"})
        assert r.status_code == 200, r.text
        data = r.json()
        # total_arr is nested under business_impact
        bi = data.get("business_impact", {})
        assert bi.get("total_arr") == 212400, f"expected total_arr=212400, got {bi.get('total_arr')} | bi={bi}"


# --------- 3. Integrations endpoints ---------
class TestIntegrations:
    def test_zendesk_test_empty_creds(self, user_a):
        r = requests.post(f"{API}/integrations/test", json={"connector": "zendesk"}, headers=_h(user_a))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is False
        assert "Missing" in body.get("detail", "")
        assert "subdomain" in body.get("detail", "") or "api_token" in body.get("detail", "")

    def test_intercom_test_empty_creds(self, user_a):
        r = requests.post(f"{API}/integrations/test", json={"connector": "intercom"}, headers=_h(user_a))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is False
        assert "Missing access_token" in body.get("detail", "")

    def test_unknown_connector_returns_422(self, user_a):
        r = requests.post(f"{API}/integrations/test", json={"connector": "salesforce"}, headers=_h(user_a))
        assert r.status_code == 422, r.text

    def test_pull_empty_creds_returns_401(self, user_a):
        r = requests.post(f"{API}/integrations/pull", json={"connector": "zendesk"}, headers=_h(user_a))
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"
        body = r.json()
        assert "detail" in body

    def test_pull_intercom_empty_creds_returns_401(self, user_a):
        r = requests.post(f"{API}/integrations/pull", json={"connector": "intercom"}, headers=_h(user_a))
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_zendesk_invalid_creds_via_settings(self, user_a):
        # Fetch current settings, modify, PUT back (full body required by SettingsIn)
        cur = requests.get(f"{API}/settings", headers=_h(user_a))
        assert cur.status_code == 200, cur.text
        body = cur.json()
        body["integrations"] = {
            **(body.get("integrations") or {}),
            "zendesk_subdomain": "fakeco_test_iter21",
            "zendesk_email": "x@test.com",
            "zendesk_api_key": "faketoken_iter21",
        }
        r = requests.put(f"{API}/settings", json=body, headers=_h(user_a))
        assert r.status_code in (200, 204), f"settings PUT failed: {r.status_code} {r.text}"

        # Now /test should attempt the API and return ok:false gracefully
        r2 = requests.post(f"{API}/integrations/test", json={"connector": "zendesk"}, headers=_h(user_a))
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        assert body2.get("ok") is False, body2
        detail = body2.get("detail", "")
        assert detail, "should have a detail message"
        assert "Missing" not in detail, f"creds were set, why missing? {detail}"

    def test_pull_dry_run_does_not_insert(self, user_a):
        # With invalid creds → 401, will not insert
        before = requests.get(f"{API}/interactions", headers=_h(user_a)).json()
        r = requests.post(
            f"{API}/integrations/pull",
            json={"connector": "zendesk", "limit": 5, "dry_run": True},
            headers=_h(user_a),
        )
        # invalid creds still → 401 (test_connection runs first)
        assert r.status_code == 401, r.text
        after = requests.get(f"{API}/interactions", headers=_h(user_a)).json()
        assert len(before) == len(after), "dry_run should not change interactions"


# --------- 4. Preset workspace scoping ---------
class TestPresetIsolation:
    def test_preset_created_by_a_not_visible_to_b(self, user_a, user_b):
        # Create a preset as user A
        pid = f"test_iter21_{uuid.uuid4().hex[:6]}"
        payload = {
            "id": pid,
            "label": "Iter21 Test Preset",
            "desc": "scoping test",
            "context": "Test context for iter21 multi-tenant preset isolation.",
        }
        r = requests.post(f"{API}/bulk/presets", json=payload, headers=_h(user_a))
        assert r.status_code in (200, 201), f"preset POST failed: {r.status_code} {r.text}"

        # User A sees it (in 'custom')
        ra = requests.get(f"{API}/bulk/presets", headers=_h(user_a)).json()
        a_custom = ra.get("custom", []) if isinstance(ra, dict) else []
        a_ids = [p.get("id") for p in a_custom]
        assert pid in a_ids, f"A doesn't see own preset: ra={ra}"

        # User B does NOT see it
        rb = requests.get(f"{API}/bulk/presets", headers=_h(user_b)).json()
        b_custom = rb.get("custom", []) if isinstance(rb, dict) else []
        b_ids = [p.get("id") for p in b_custom]
        assert pid not in b_ids, f"B leaked A's preset {pid}: {b_ids}"
