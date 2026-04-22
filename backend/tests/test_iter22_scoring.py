"""
Iter-22 backend tests:
1. Bulk scoring realism fix — good transcripts >= 70, bad transcripts < 60 with High/Critical churn
2. Urban Flavours sample CSV avg > 40, Dana K transcript >= 70
3. /interactions/upload-file returns analysis.qa_score as a number
4. Dashboard / executive / coaching / preset endpoints return 200 with seeded session
5. /api/auth/login owner@urbanflavours.ca / CannabisSecure123! returns 200 + cookie
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-launch-133.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
SEED_TOKEN = "test_session_1776772371"


def _seed_headers():
    return {"Authorization": f"Bearer {SEED_TOKEN}"}


def _seed_cookies():
    return {"session_token": SEED_TOKEN}


# ---------- 1. Authentication ----------
class TestAuth:
    def test_login_owner_returns_200_and_session_cookie(self):
        s = requests.Session()
        r = s.post(
            f"{API}/auth/login",
            json={"email": "owner@urbanflavours.ca", "password": "CannabisSecure123!"},
            timeout=30,
        )
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
        body = r.json()
        assert "session_token" in body or s.cookies.get("session_token"), \
            f"no session_token in body or cookies. body={body} cookies={dict(s.cookies)}"
        # cookie should be set
        sess = s.cookies.get("session_token")
        assert sess, "session_token cookie not set"


# ---------- 2. Read endpoints with seeded session ----------
class TestSeededReadEndpoints:
    @pytest.mark.parametrize("path", [
        "/dashboard/stats",
        "/executive/overview",
        "/executive/churn-analysis",
        "/coaching/kpis",
    ])
    def test_endpoint_returns_200(self, path):
        r = requests.get(f"{API}{path}", headers=_seed_headers(), timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"
        # validate JSON structure (non-empty dict)
        data = r.json()
        assert isinstance(data, (dict, list)), f"{path} returned non-json: {data}"

    def test_bulk_presets_shape(self):
        r = requests.get(f"{API}/bulk/presets", headers=_seed_headers(), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict), f"expected dict, got {type(data)}"
        assert "builtin" in data and "custom" in data, f"missing keys: {list(data.keys())}"
        assert isinstance(data["builtin"], list)
        assert isinstance(data["custom"], list)
        # Built-ins should include urban_flavours_delivery
        ids = [p.get("id") for p in data["builtin"]]
        assert "urban_flavours_delivery" in ids, f"missing built-in: {ids}"


# ---------- 3. Bulk scoring realism ----------
class TestBulkScoringRealism:
    def test_good_transcript_scores_at_least_70(self):
        good = (
            "Customer: Hi, my last order was perfect, just wanted to say thanks! "
            "Agent: That's wonderful to hear, Sara! I'm so glad you enjoyed it. Is there anything else I can help with today? "
            "Customer: No that's all, you guys are great. "
            "Agent: Thank you so much, have a great day and please reach out anytime!"
        )
        payload = {
            "content": good,
            "client_preset": "default",
            "default_customer": "Sara",
            "default_agent": "Alex",
        }
        r = requests.post(f"{API}/interactions/bulk-upload", json=payload,
                          headers=_seed_headers(), timeout=120)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        body = r.json()
        assert body.get("scored", 0) >= 1, body
        interactions = body.get("interactions", [])
        assert len(interactions) >= 1
        score = interactions[0].get("qa_score")
        assert isinstance(score, (int, float)), f"qa_score not numeric: {score}"
        assert score >= 70, f"GOOD transcript scored {score} (expected >= 70). full: {interactions[0]}"
        # Rep / customer should be passed through (LLM may pull from transcript or default)
        agent = interactions[0].get("agent")
        customer = interactions[0].get("customer")
        assert agent and isinstance(agent, str), f"agent missing: {interactions[0]}"
        assert customer and isinstance(customer, str), f"customer missing: {interactions[0]}"

    def test_bad_transcript_scores_below_60_and_high_churn(self):
        bad = (
            "Customer: This is the third time my delivery never showed up. I've had it. "
            "I'm switching to your competitor Eaze tomorrow, they actually deliver. "
            "Agent: Uh, sorry I guess. Not much I can do. "
            "Customer: Just cancel my account."
        )
        payload = {
            "content": bad,
            "client_preset": "default",
            "default_customer": "Marcus",
            "default_agent": "Jamie",
        }
        r = requests.post(f"{API}/interactions/bulk-upload", json=payload,
                          headers=_seed_headers(), timeout=120)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        body = r.json()
        assert body.get("scored", 0) >= 1, body
        item = body["interactions"][0]
        score = item.get("qa_score")
        churn = item.get("churn_risk")
        assert isinstance(score, (int, float)), f"qa_score not numeric: {score}"
        assert score < 60, f"BAD transcript scored {score} (expected < 60). full: {item}"
        assert churn in ("High", "Critical"), f"churn_risk={churn} (expected High/Critical). full: {item}"

    def test_urban_flavours_csv_batch_metrics(self):
        sample_csv = (
            'customer,agent,channel,transcript\n'
            '"Jenna M.","Tyler","Chat","Customer: Hey my order never showed up. Agent: Sorry, let me check. I see you\'re outside our license area, I can refund. Customer: Ugh Eaze delivers here. This is the third time."\n'
            '"Marcus T.","Sasha","Chat","Customer: Can I use this for my anxiety? Agent: Yes totally, our indica strains calm you down. Customer: Great, ordering now."\n'
            '"Riley P.","Tyler","Chat","Customer: Never received ID check at door. Agent: Oh, driver was in a rush, sorry. Customer: That\'s sketch, I want a refund."\n'
            '"Dana K.","Sasha","Chat","Customer: Product was dry/stale. Agent: I\'ll ship a fresh batch tomorrow on us. Customer: Thanks, appreciate it."'
        )
        payload = {
            "content": sample_csv,
            "client_preset": "urban_flavours_delivery",
            "default_customer": "",
            "default_agent": "",
        }
        r = requests.post(f"{API}/interactions/bulk-upload", json=payload,
                          headers=_seed_headers(), timeout=240)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        body = r.json()
        assert body.get("total") == 4, f"expected total=4, got {body.get('total')}"
        assert body.get("scored") == 4, f"expected scored=4, got {body.get('scored')} errors={body.get('errors')}"
        summary = body.get("summary", {})
        avg = summary.get("avg_score", 0)
        assert avg > 40, f"avg_score={avg} (expected > 40 — scoring fix)"
        assert summary.get("unique_reps") == 2, f"unique_reps={summary.get('unique_reps')}"
        assert summary.get("unique_customers") == 4, f"unique_customers={summary.get('unique_customers')}"
        # Dana K transcript (positive resolution) should score >=70
        dana = next((i for i in body["interactions"] if "Dana" in (i.get("customer") or "")), None)
        assert dana is not None, f"Dana K not found: {[i.get('customer') for i in body['interactions']]}"
        dana_score = dana.get("qa_score")
        assert isinstance(dana_score, (int, float))
        assert dana_score >= 70, f"Dana K (positive resolution) scored {dana_score} (expected >= 70). full: {dana}"


# ---------- 4. /interactions/upload-file with .txt ----------
class TestUploadFile:
    def test_upload_txt_file_returns_qa_score(self):
        content = (
            "Customer: I had a small issue with my order, can you help? "
            "Agent: Of course! Let me look into that right away. I see the issue — I'll send a replacement out today free of charge. "
            "Customer: Wow thank you so much! "
            "Agent: My pleasure, have a wonderful day!"
        )
        files = {"file": ("test_transcript.txt", content, "text/plain")}
        r = requests.post(
            f"{API}/interactions/upload-file",
            files=files,
            cookies=_seed_cookies(),
            timeout=90,
        )
        assert r.status_code == 200, f"upload-file -> {r.status_code} {r.text[:400]}"
        body = r.json()
        analysis = body.get("analysis") or body.get("interaction", {}).get("analysis")
        assert analysis, f"no analysis in response: {body}"
        score = analysis.get("qa_score")
        assert score is not None, f"qa_score is None: {analysis}"
        assert isinstance(score, (int, float)), f"qa_score not numeric: {score}"
