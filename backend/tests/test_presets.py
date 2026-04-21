"""Iter13 — Client preset CRUD + bulk-upload with custom preset."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("TEST_SESSION_TOKEN", "test_session_1776772371")


@pytest.fixture(scope="module")
def ac():
    s = requests.Session()
    s.cookies.set("session_token", TOKEN)
    return s


@pytest.fixture
def custom_preset_id():
    return f"test_preset_{uuid.uuid4().hex[:8]}"


class TestPresetCRUD:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/bulk/presets")
        assert r.status_code == 401

    def test_list_builtins(self, ac):
        r = ac.get(f"{BASE_URL}/api/bulk/presets")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "builtin" in d and "custom" in d
        ids = {p["id"] for p in d["builtin"]}
        assert "default" in ids
        assert "urban_flavours_delivery" in ids
        # builtin flag on built-ins
        for p in d["builtin"]:
            assert p.get("builtin") is True
            assert "label" in p and "desc" in p

    def test_create_preset_happy(self, ac, custom_preset_id):
        payload = {
            "id": custom_preset_id,
            "label": "Test Coffee Chain",
            "desc": "Barista QA",
            "context": "Client: TEST coffee chain. Verify allergen disclosure and upsell seasonal drinks.",
        }
        r = ac.post(f"{BASE_URL}/api/bulk/presets", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == custom_preset_id
        assert d["label"] == "Test Coffee Chain"
        assert d["builtin"] is False
        # Appears in list under custom
        r2 = ac.get(f"{BASE_URL}/api/bulk/presets")
        custom_ids = {p["id"] for p in r2.json()["custom"]}
        assert custom_preset_id in custom_ids
        # cleanup
        ac.delete(f"{BASE_URL}/api/bulk/presets/{custom_preset_id}")

    def test_create_preset_reserved_id_400(self, ac):
        for reserved in ("default", "urban_flavours_delivery"):
            r = ac.post(f"{BASE_URL}/api/bulk/presets", json={
                "id": reserved, "label": "X", "desc": "", "context": "y"
            })
            assert r.status_code == 400, f"{reserved} should be reserved, got {r.status_code}"

    def test_delete_preset(self, ac):
        pid = f"test_del_{uuid.uuid4().hex[:6]}"
        ac.post(f"{BASE_URL}/api/bulk/presets", json={
            "id": pid, "label": "ToDelete", "desc": "", "context": "x"
        })
        r = ac.delete(f"{BASE_URL}/api/bulk/presets/{pid}")
        assert r.status_code == 200
        # verify gone
        listing = ac.get(f"{BASE_URL}/api/bulk/presets").json()
        ids = {p["id"] for p in listing["custom"]}
        assert pid not in ids


class TestBulkUploadWithCustomPreset:
    CSV = '''customer,agent,channel,transcript
"Bob","Cara","Chat","Customer: I have a peanut allergy, is your oat latte safe? Agent: Let me confirm with our allergen chart. Yes it is dairy-free and peanut-free. Customer: Great thanks."
'''

    def test_custom_preset_used_in_bulk(self, ac):
        pid = f"test_coffee_{uuid.uuid4().hex[:6]}"
        label = "Test Coffee QA Preset"
        ac.post(f"{BASE_URL}/api/bulk/presets", json={
            "id": pid, "label": label, "desc": "d",
            "context": "Client: Coffee chain. Hard-fail when agent misses allergen disclosure.",
        })
        try:
            r = ac.post(
                f"{BASE_URL}/api/interactions/bulk-upload",
                json={"content": self.CSV, "client_preset": pid, "agent_type": "Human"},
                timeout=180,
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["client_label"] == label, f"expected {label} got {d.get('client_label')}"
            assert d["total"] == 1
            assert d["scored"] >= 1
        finally:
            ac.delete(f"{BASE_URL}/api/bulk/presets/{pid}")
