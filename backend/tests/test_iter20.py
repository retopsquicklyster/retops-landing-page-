"""Iter-20 backend tests:
- Bulk upload 500-file limit + exact chunk count
- Sharper extraction via _heuristic_names_from_transcript + _customer_from_filename
- Brute-force lockout uses X-Forwarded-For (per-IP)
- Regression: email/password login still works
"""
import os
import sys
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://quick-launch-133.preview.emergentagent.com"

# Allow the tests to import server internals for pure-python unit tests
sys.path.insert(0, "/app/backend")

# --- Helpers ---
def _session_token():
    """Create a fresh throwaway session for authenticated requests."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from datetime import datetime, timezone, timedelta

    async def _mk():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        token = f"TEST_iter20_{uuid.uuid4().hex[:8]}"
        uid = f"TEST_iter20_user_{uuid.uuid4().hex[:6]}"
        await db.users.update_one({"user_id": uid}, {"$set": {
            "user_id": uid, "email": f"{uid}@example.com", "name": "Iter20 Tester",
            "role": "admin", "created_at": datetime.now(timezone.utc).isoformat(),
        }}, upsert=True)
        await db.user_sessions.update_one({"session_token": token}, {"$set": {
            "session_token": token, "user_id": uid, "email": f"{uid}@example.com",
            "name": "Iter20 Tester", "role": "admin",
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            "created_at": datetime.now(timezone.utc),
        }}, upsert=True)
        return token

    # read env
    if "MONGO_URL" not in os.environ or "DB_NAME" not in os.environ:
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        os.environ.setdefault("MONGO_URL", env.get("MONGO_URL", ""))
        os.environ.setdefault("DB_NAME", env.get("DB_NAME", ""))
    return asyncio.run(_mk())


@pytest.fixture(scope="session")
def token():
    return _session_token()


@pytest.fixture
def auth_client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# =========================================================
# 1. Bulk split — pure python unit tests (NO LLM calls)
# =========================================================
class TestBulkSplitUnit:
    """_split_bulk_transcripts — deterministic, no network."""

    def test_100_file_bundle_splits_to_exactly_100(self):
        from server import _split_bulk_transcripts
        bundle = "\n\n===\n\n".join(
            f"# FILE: file_{i:03d}.txt\nCustomer: hello from chat {i}\nAgent: hi there, happy to help!\nThis is transcript number {i}, long enough to pass the 30-char floor."
            for i in range(100)
        )
        chunks = _split_bulk_transcripts(bundle)
        assert len(chunks) == 100, f"expected 100 got {len(chunks)}"
        # Every chunk should carry its filename
        assert chunks[0]["filename"] == "file_000.txt"
        assert chunks[99]["filename"] == "file_099.txt"
        # Body should NOT contain the '# FILE:' header line
        assert "# FILE:" not in chunks[0]["transcript"]

    def test_3_file_bundle_splits_to_3(self):
        from server import _split_bulk_transcripts
        bundle = (
            "# FILE: acme-corp_2024.txt\nCustomer (Jenna M.): Hi, I need help with my order please.\nRep: Sarah — sure, let me look that up.\n\n===\n\n"
            "# FILE: beta-inc.txt\nTyler (Agent): Hello, how can I help you today?\nCustomer: my package never arrived, frustrated.\n\n===\n\n"
            "# FILE: gamma.txt\nHi my name is Jessica from support. Can you share your order id?\nyes it is 12345 please help.\n"
        )
        chunks = _split_bulk_transcripts(bundle)
        assert len(chunks) == 3
        assert chunks[0]["filename"] == "acme-corp_2024.txt"
        assert chunks[1]["filename"] == "beta-inc.txt"
        assert chunks[2]["filename"] == "gamma.txt"

    def test_single_blob_old_format_still_works(self):
        from server import _split_bulk_transcripts
        bundle = "Customer: A\nAgent: B, how can I help?\n===\nCustomer: C\nAgent: D, great question here!"
        chunks = _split_bulk_transcripts(bundle)
        assert len(chunks) == 2


# =========================================================
# 2. Name extraction heuristics — pure python (NO LLM)
# =========================================================
class TestHeuristicNames:
    def test_name_paren_role_customer(self):
        from server import _heuristic_names_from_transcript
        out = _heuristic_names_from_transcript(
            "Jenna M. (Customer): Hi I need help\nSarah (Agent): Happy to help!"
        )
        assert out["customer_name"].startswith("Jenna")
        assert out["rep_name"] == "Sarah"

    def test_role_paren_name_customer(self):
        from server import _heuristic_names_from_transcript
        out = _heuristic_names_from_transcript(
            "Customer (Jenna M.): Hello\nAgent (Tyler): Welcome!"
        )
        assert out["customer_name"].startswith("Jenna")
        assert out["rep_name"] == "Tyler"

    def test_rep_colon_name(self):
        from server import _heuristic_names_from_transcript
        out = _heuristic_names_from_transcript("Rep: Sarah\nCustomer: John Doe")
        assert out["rep_name"] == "Sarah"
        assert out["customer_name"] == "John Doe"

    def test_self_intro_my_name_is(self):
        from server import _heuristic_names_from_transcript
        out = _heuristic_names_from_transcript("my name is Jessica from support. How can I help?")
        assert out["rep_name"] == "Jessica"

    def test_unknown_returns_empty(self):
        from server import _heuristic_names_from_transcript
        out = _heuristic_names_from_transcript("hi hello how are you doing today?")
        assert out["rep_name"] == ""
        assert out["customer_name"] == ""


class TestFilenameCustomer:
    def test_acme_corp_date(self):
        from server import _customer_from_filename
        assert _customer_from_filename("acme-corp_2024-03-14.txt") == "Acme Corp"

    def test_transcript_suffix_stripped(self):
        from server import _customer_from_filename
        assert _customer_from_filename("beta_inc_transcript.txt") in ("Beta Inc", "Beta Inc Transcript".replace(" Transcript", ""))

    def test_empty(self):
        from server import _customer_from_filename
        assert _customer_from_filename("") == ""


# =========================================================
# 3. Bulk endpoint — HTTP-level: too-many-chunks returns 413
# =========================================================
class TestBulkEndpointLimit:
    def test_501_files_returns_413(self, auth_client):
        """Synthesize 501 files → server should reject with 413 before scoring."""
        bundle = "\n\n===\n\n".join(
            f"# FILE: f_{i:04d}.txt\nCustomer: hi {i}\nAgent: yes sir, happy to help right away."
            for i in range(501)
        )
        r = auth_client.post(
            f"{BASE_URL}/api/interactions/bulk-upload",
            json={"content": bundle, "client_preset": "default"},
            timeout=30,
        )
        assert r.status_code == 413, f"expected 413 got {r.status_code}: {r.text[:200]}"
        body = r.json().get("detail", "")
        assert "501" in body and "500" in body, f"error should mention counts: {body}"


# =========================================================
# 4. Brute-force — X-Forwarded-For is respected
# =========================================================
class TestBruteForceXFF:
    def test_xff_locks_per_ip(self):
        """6 bad logins with XFF=1.2.3.4 → 6th returns 429.
        Then 1 bad login with XFF=5.6.7.8 → NOT locked (401 not 429)."""
        # Use a unique email so we don't collide with other tests/state
        bad_email = f"iter20nolock_{uuid.uuid4().hex[:6]}@example.com"

        ip_locked = "1.2.3.4"
        last = None
        for i in range(6):
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": bad_email, "password": "wrongpass"},
                headers={"X-Forwarded-For": ip_locked, "Content-Type": "application/json"},
                timeout=15,
            )
            last = r
            if i < 5:
                # 401 expected until lockout triggers
                assert r.status_code in (401, 429), f"attempt {i+1}: got {r.status_code}"
        # The 6th (or earlier once lockout kicks in) must be 429.
        assert last.status_code == 429, f"expected 429 on final locked attempt, got {last.status_code}: {last.text[:200]}"
        assert "Too many failed attempts" in last.text

        # Now change IP — should NOT be locked
        r_new = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": bad_email, "password": "wrongpass"},
            headers={"X-Forwarded-For": "5.6.7.8", "Content-Type": "application/json"},
            timeout=15,
        )
        assert r_new.status_code == 401, (
            f"new IP should NOT be locked, got {r_new.status_code}: {r_new.text[:200]}"
        )

    def test_client_ip_helper_order(self):
        """Unit-level check that _client_ip prefers XFF leftmost."""
        from server import _client_ip
        class FakeReq:
            def __init__(self, headers, client_host="10.0.0.1"):
                self.headers = headers
                class C: host = client_host
                self.client = C()
        req = FakeReq({"x-forwarded-for": "1.2.3.4, 10.0.0.1"})
        assert _client_ip(req) == "1.2.3.4"
        req = FakeReq({"x-real-ip": "7.7.7.7"})
        assert _client_ip(req) == "7.7.7.7"
        req = FakeReq({})
        assert _client_ip(req) == "10.0.0.1"


# =========================================================
# 5. Regression — owner@urbanflavours.ca login still works
# =========================================================
class TestLoginRegression:
    def test_owner_login_ok(self):
        # Use a unique IP so we don't collide with any test-state lock
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "owner@urbanflavours.ca", "password": "CannabisSecure123!"},
            headers={"X-Forwarded-For": f"9.9.9.{uuid.uuid4().int % 250}", "Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("email") == "owner@urbanflavours.ca"
        assert data.get("session_token")


# =========================================================
# 6. Bulk sharper extraction — 3-file bundle via API (makes ~3 LLM calls)
# =========================================================
class TestBulkExtractionLive:
    """Small real-LLM test to verify extraction quality.
    Kept to 3 transcripts (<$0.01) per the reviewer's cost guidance."""

    def test_three_file_extracts_names(self, auth_client):
        bundle = (
            "# FILE: acme-corp_2024.txt\n"
            "Customer (Jenna M.): Hi, I need help resetting my password please\n"
            "Rep: Sarah — sure thing, I can help with that right away\n"
            "Customer (Jenna M.): thank you so much Sarah\n"
            "\n===\n\n"
            "# FILE: beta-inc.txt\n"
            "Tyler (Agent): Hello, how can I help you today?\n"
            "Customer: my package from order 12345 never arrived\n"
            "Tyler (Agent): I'll look into that for you right now\n"
            "\n===\n\n"
            "# FILE: gamma-foods.txt\n"
            "Hi my name is Jessica from support.\n"
            "customer: yes my subscription was charged twice this month\n"
            "Jessica: apologies for that, I'll refund the duplicate charge now\n"
        )
        r = auth_client.post(
            f"{BASE_URL}/api/interactions/bulk-upload",
            json={"content": bundle, "client_preset": "default"},
            timeout=240,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        # Response shape: {scored: <int>, total: <int>, interactions: [...]}
        assert data.get("total") == 3, f"expected total=3, got {data.get('total')}"
        scored = data.get("interactions") or []
        assert len(scored) == 3, f"expected 3 interactions, got {len(scored)}; keys={list(data.keys())}"

        reps = [(it.get("agent") or "").lower() for it in scored]
        custs = [(it.get("customer") or "").lower() for it in scored]
        joined_reps = " | ".join(reps)
        joined_custs = " | ".join(custs)

        # Expect at least 2 of the 3 reps identified correctly (allow 1 LLM miss)
        hits = sum(1 for name in ("sarah", "tyler", "jessica") if name in joined_reps)
        assert hits >= 2, f"expected >=2 rep matches, got {hits}; reps={reps}"

        # Expect at least one customer name or filename-derived guess present
        cust_hits = sum(1 for name in ("jenna", "acme", "beta", "gamma") if name in joined_custs)
        assert cust_hits >= 1, f"expected >=1 customer/filename match, got {cust_hits}; custs={custs}"

        # NONE should collapse to the legacy 'Unknown Rep' / 'Unknown' if heuristics work
        unknown_reps = [r for r in reps if r in ("unknown rep", "unknown")]
        assert len(unknown_reps) <= 1, f"too many Unknown Rep fallbacks: {reps}"
