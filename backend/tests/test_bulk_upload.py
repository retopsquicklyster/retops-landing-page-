"""Tests for the new bulk-upload endpoint (iteration 11)."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("TEST_SESSION_TOKEN", "test_session_1776772371")

SAMPLE_CSV = '''customer,agent,channel,transcript
"Jenna M.","Tyler","Chat","Customer: Hey my order never showed up. Agent: Sorry, let me check. I see you're outside our license area, I can refund. Customer: Ugh Eaze delivers here. This is the third time."
"Marcus T.","Sasha","Chat","Customer: Can I use this for my anxiety? Agent: Yes totally, our indica strains calm you down. Customer: Great, ordering now."
'''


@pytest.fixture(scope="module")
def ac():
    s = requests.Session()
    s.cookies.set("session_token", TOKEN)
    return s


class TestBulkUpload:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/interactions/bulk-upload", json={"content": SAMPLE_CSV})
        assert r.status_code == 401

    def test_empty_content_400(self, ac):
        r = ac.post(f"{BASE_URL}/api/interactions/bulk-upload", json={"content": "", "client_preset": "default"})
        assert r.status_code == 400

    def test_bulk_urban_flavours_happy(self, ac):
        r = ac.post(
            f"{BASE_URL}/api/interactions/bulk-upload",
            json={"content": SAMPLE_CSV, "client_preset": "urban_flavours_delivery", "agent_type": "Human"},
            timeout=180,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        def _no_id(o):
            if isinstance(o, dict):
                assert "_id" not in o
                for v in o.values(): _no_id(v)
            elif isinstance(o, list):
                for v in o: _no_id(v)
        _no_id(d)
        for k in ("batch_id", "client_label", "total", "scored", "summary",
                  "rep_leaderboard", "customer_churn", "interactions"):
            assert k in d, f"missing {k}"
        assert d["client_label"] == "Urban Flavours Delivery"
        assert d["total"] == 2
        assert d["scored"] >= 1
        s = d["summary"]
        for k in ("avg_score", "below_threshold", "at_risk_interactions", "unique_reps", "unique_customers"):
            assert k in s
        assert len(d["rep_leaderboard"]) >= 1
        assert len(d["interactions"]) == d["scored"]
        # Each interaction has qa_score and no _id
        for it in d["interactions"]:
            assert "qa_score" in it and "interaction_id" in it
            assert "_id" not in it

    def test_persistence_and_source_tag(self, ac):
        # Run bulk then verify one of the interaction_ids is fetchable and has source prefix
        r = ac.post(
            f"{BASE_URL}/api/interactions/bulk-upload",
            json={"content": SAMPLE_CSV, "client_preset": "urban_flavours_delivery"},
            timeout=180,
        )
        assert r.status_code == 200
        ints = r.json()["interactions"]
        assert ints
        iid = ints[0]["interaction_id"]
        g = ac.get(f"{BASE_URL}/api/interactions/{iid}")
        assert g.status_code == 200
        doc = g.json()
        # server stores source: 'bulk:<preset>' and client_label
        assert doc.get("source", "").startswith("bulk:"), f"source={doc.get('source')}"
        assert doc.get("client_label") == "Urban Flavours Delivery"

    def test_text_separator_split(self, ac):
        text = (
            "Customer: hi where is my order\nAgent: Let me check. It's on the way.\nCustomer: Thanks.\n"
            "===\n"
            "Customer: product was stale\nAgent: I'll ship a fresh one tomorrow on us.\nCustomer: great thanks.\n"
        )
        r = ac.post(f"{BASE_URL}/api/interactions/bulk-upload",
                    json={"content": text, "client_preset": "default"}, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 2

    def test_file_upload_multipart(self, ac):
        files = {"file": ("batch.csv", SAMPLE_CSV, "text/csv")}
        data = {"client_preset": "urban_flavours_delivery", "agent_type": "Human"}
        r = ac.post(f"{BASE_URL}/api/interactions/bulk-upload-file", files=files, data=data, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 2
        assert d["client_label"] == "Urban Flavours Delivery"

    def test_file_binary_rejected(self, ac):
        # Lots of NUL bytes triggers the unreadable-text guard (422)
        binary = bytes([0, 1, 2, 3, 0xff, 0xfe] * 200)
        files = {"file": ("bad.bin", binary, "application/octet-stream")}
        r = ac.post(f"{BASE_URL}/api/interactions/bulk-upload-file",
                    files=files, data={"client_preset": "default"})
        assert r.status_code in (422, 400), r.text
