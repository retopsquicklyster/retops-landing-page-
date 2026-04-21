"""
RetOps — external connector scaffolding (Zendesk, Intercom).
Provides:
  • Connection test
  • Pull (import tickets / conversations as normalized RetOps interactions)
  • Webhook receiver (real-time push)

All connectors follow the same interface:
  test_connection(creds)       → {ok: bool, detail: str, sample: dict}
  pull_recent(creds, limit)    → [normalized_interaction]
  parse_webhook(payload, creds) → [normalized_interaction]

Normalized interaction shape:
  { external_id, customer, agent, agent_type, channel, transcript, source, external_url }

The actual analyze_interaction() + DB insert happens in server.py, so connectors stay
dumb + testable + can be swapped out for mocks in unit tests.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
import httpx
import logging

logger = logging.getLogger("retops.connectors")


# ───────────────────────────── ZENDESK ─────────────────────────────
class ZendeskConnector:
    """
    Credentials required:
      subdomain     — yourco  (from yourco.zendesk.com)
      email         — admin@yourco.com
      api_token     — Zendesk API token (Admin → Apps → Zendesk API)
    """
    name = "zendesk"

    def __init__(self, creds: Dict[str, str]):
        self.subdomain = (creds.get("subdomain") or "").strip().replace("https://", "").replace(".zendesk.com", "")
        self.email = (creds.get("email") or "").strip()
        self.api_token = (creds.get("api_token") or creds.get("zendesk_api_key") or "").strip()

    @property
    def base(self) -> str:
        return f"https://{self.subdomain}.zendesk.com/api/v2"

    @property
    def auth(self):
        return (f"{self.email}/token", self.api_token)

    async def test_connection(self) -> Dict[str, Any]:
        if not (self.subdomain and self.email and self.api_token):
            return {"ok": False, "detail": "Missing subdomain, email, or api_token"}
        try:
            async with httpx.AsyncClient(timeout=12) as c:
                r = await c.get(f"{self.base}/users/me.json", auth=self.auth)
            if r.status_code == 200:
                u = r.json().get("user", {})
                return {"ok": True, "detail": f"Connected as {u.get('email')} ({u.get('role')})", "sample": {"subdomain": self.subdomain, "user_id": u.get("id")}}
            return {"ok": False, "detail": f"Zendesk returned {r.status_code}: {r.text[:140]}"}
        except httpx.HTTPError as e:
            return {"ok": False, "detail": f"Network error: {e!s}"}

    async def pull_recent(self, limit: int = 25) -> List[Dict[str, Any]]:
        """Pull N most recent tickets with their comments concatenated as a single transcript."""
        if not (self.subdomain and self.email and self.api_token):
            return []
        out: List[Dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.get(f"{self.base}/tickets.json?sort_by=updated_at&sort_order=desc&per_page={min(limit, 100)}", auth=self.auth)
                tickets = (r.json() or {}).get("tickets", [])
                for t in tickets[:limit]:
                    tid = t["id"]
                    # Fetch comments to build transcript
                    rc = await c.get(f"{self.base}/tickets/{tid}/comments.json?sort_order=asc", auth=self.auth)
                    comments = (rc.json() or {}).get("comments", [])
                    transcript = _join_zendesk_comments(comments)
                    # Fetch requester (customer) name
                    customer = t.get("requester_id", "Unknown")
                    out.append({
                        "external_id": f"zd-{tid}",
                        "customer": f"Zendesk Customer #{customer}",
                        "agent": f"Assignee #{t.get('assignee_id', 'unassigned')}",
                        "agent_type": "Human",
                        "channel": "Ticket",
                        "transcript": transcript,
                        "source": f"zendesk:ticket/{tid}",
                        "external_url": f"https://{self.subdomain}.zendesk.com/agent/tickets/{tid}",
                    })
        except httpx.HTTPError as e:
            logger.warning(f"Zendesk pull failed: {e}")
        return out


def _join_zendesk_comments(comments: List[Dict[str, Any]]) -> str:
    lines = []
    for c in comments:
        author = "Agent" if c.get("via", {}).get("source", {}).get("from", {}).get("address") else "Customer"
        body = (c.get("plain_body") or c.get("body") or "").strip()
        if body:
            lines.append(f"{author}: {body}")
    return "\n".join(lines)[:20000]


# ───────────────────────────── INTERCOM ─────────────────────────────
class IntercomConnector:
    """
    Credentials required:
      access_token — Intercom access token (Settings → Developers → Access tokens)
    """
    name = "intercom"
    API = "https://api.intercom.io"

    def __init__(self, creds: Dict[str, str]):
        self.token = (creds.get("access_token") or creds.get("intercom_api_key") or "").strip()

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "Intercom-Version": "2.11",
        }

    async def test_connection(self) -> Dict[str, Any]:
        if not self.token:
            return {"ok": False, "detail": "Missing access_token"}
        try:
            async with httpx.AsyncClient(timeout=12) as c:
                r = await c.get(f"{self.API}/me", headers=self.headers)
            if r.status_code == 200:
                data = r.json()
                return {"ok": True, "detail": f"Connected to {data.get('app', {}).get('name', 'Intercom')}", "sample": {"workspace_id": data.get("app", {}).get("id_code")}}
            return {"ok": False, "detail": f"Intercom returned {r.status_code}: {r.text[:140]}"}
        except httpx.HTTPError as e:
            return {"ok": False, "detail": f"Network error: {e!s}"}

    async def pull_recent(self, limit: int = 25) -> List[Dict[str, Any]]:
        """Pull N most recent closed conversations + flatten into transcripts."""
        if not self.token:
            return []
        out: List[Dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post(
                    f"{self.API}/conversations/search",
                    headers=self.headers,
                    json={
                        "query": {"field": "open", "operator": "=", "value": False},
                        "pagination": {"per_page": min(limit, 50)},
                    },
                )
                convos = (r.json() or {}).get("conversations", [])
                for conv in convos[:limit]:
                    cid = conv["id"]
                    # Re-fetch with parts
                    rc = await c.get(f"{self.API}/conversations/{cid}?display_as=plaintext", headers=self.headers)
                    full = rc.json()
                    transcript = _join_intercom_parts(full)
                    contact = ((conv.get("contacts") or {}).get("contacts") or [{}])[0]
                    out.append({
                        "external_id": f"ic-{cid}",
                        "customer": contact.get("name") or f"Contact {contact.get('id', 'unknown')}",
                        "agent": "Intercom Team",
                        "agent_type": "Human",
                        "channel": "Chat",
                        "transcript": transcript,
                        "source": f"intercom:conversation/{cid}",
                        "external_url": f"https://app.intercom.com/a/apps/{full.get('app_id','_')}/inbox/conversation/{cid}",
                    })
        except httpx.HTTPError as e:
            logger.warning(f"Intercom pull failed: {e}")
        return out


def _join_intercom_parts(full: Dict[str, Any]) -> str:
    lines = []
    source = full.get("source") or {}
    if source.get("body"):
        author = (source.get("author") or {}).get("type", "user").title()
        lines.append(f"{author}: {_strip_html(source['body'])}")
    for part in ((full.get("conversation_parts") or {}).get("conversation_parts") or []):
        body = part.get("body") or ""
        if not body:
            continue
        author = (part.get("author") or {}).get("type", "user").title()
        lines.append(f"{author}: {_strip_html(body)}")
    return "\n".join(lines)[:20000]


def _strip_html(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", s or "").strip()


# ───────────────────────────── Dispatcher ─────────────────────────────
CONNECTORS = {
    "zendesk": ZendeskConnector,
    "intercom": IntercomConnector,
}


def get_connector(name: str, creds: Dict[str, str]):
    cls = CONNECTORS.get(name)
    if not cls:
        raise ValueError(f"Unknown connector: {name}")
    return cls(creds)
