"""RetOps backend - FastAPI server with Emergent Google Auth + LLM-powered QA scoring."""
import os
import re
import json
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from llm_service import analyze_interaction, DEFAULT_PROVIDER, DEFAULT_MODEL
from seed_data import build_seed_payload
from connectors import get_connector, CONNECTORS


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="RetOps API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("retops")


# ---------- Models ----------
class UserSettings(BaseModel):
    llm_provider: str = DEFAULT_PROVIDER
    llm_model: str = DEFAULT_MODEL
    custom_api_key: str = ""  # optional BYO key
    digest_subscribed: bool = False
    digest_email: str = ""  # optional override; default is user.email
    # --- AI service keys (cosmetic placeholders; encrypted at rest in prod) ---
    ai_keys: Dict[str, str] = Field(default_factory=dict)
    # --- External integrations ---
    integrations: Dict[str, str] = Field(default_factory=lambda: {
        # Zendesk needs a tuple — we persist 3 separate fields to keep the UI simple
        "zendesk_subdomain": "",    # yourco (from yourco.zendesk.com)
        "zendesk_email": "",        # admin@yourco.com
        "zendesk_api_key": "",      # api token
        "intercom_api_key": "",     # access token
        "gohighlevel_api_key": "",
        "twilio_api_key": "",
        "slack_webhook": "",
        "teams_webhook": "",
        "salesforce_api_key": "",
        "hubspot_api_key": "",
    })
    # --- Notifications / alerting ---
    notifications: Dict[str, Any] = Field(default_factory=lambda: {
        "email_alerts": True,
        "slack_alerts": False,
        "critical_only": False,
        "alert_email": "",
    })
    # --- Quality thresholds (sync with scoring engine defaults) ---
    quality: Dict[str, Any] = Field(default_factory=lambda: {
        "pass_threshold": 75,
        "warning_threshold": 60,
        "hard_fail_cap": 59,
        "churn_alert_threshold": 50,
    })
    # --- Security & privacy ---
    security: Dict[str, Any] = Field(default_factory=lambda: {
        "retention_days": 90,
        "data_encryption": True,
        "audit_logging": True,
        "access_logging": True,
    })


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    role: str = "admin"
    workspace_id: str = "ws_default"
    settings: UserSettings = Field(default_factory=UserSettings)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InteractionCreate(BaseModel):
    customer: str
    agent: str
    agent_type: str  # Human | AI
    channel: str  # Voice | Chat | Email | Ticket
    transcript: str
    type: str = "General"
    duration_sec: int = 0


class Interaction(BaseModel):
    interaction_id: str
    customer: str
    agent: str
    agent_type: str
    channel: str
    type: str
    duration_sec: int
    transcript: str
    analysis: Dict[str, Any] = {}
    created_at: datetime


# ---------- Auth helpers ----------
async def require_user(request: Request) -> User:
    # Prefer cookie, fall back to Authorization header
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Session not found")

    expires_at = sess.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User missing")
    # Ensure settings exists
    user_doc.setdefault("settings", UserSettings().model_dump())
    # Ensure workspace_id exists (backfill for any legacy user without it)
    if not user_doc.get("workspace_id"):
        user_doc["workspace_id"] = "ws_default"
        await db.users.update_one({"user_id": sess["user_id"]}, {"$set": {"workspace_id": "ws_default"}})
    return User(**user_doc)


def ws_filter(user: User, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Scope a query to the user's workspace. All list/find endpoints must route through this."""
    wid = user.workspace_id or "ws_default"
    q: Dict[str, Any] = {"$or": [{"workspace_id": wid}, {"workspace_id": {"$exists": False}}]} if wid == "ws_default" else {"workspace_id": wid}
    if extra:
        q = {**extra, **q} if "$or" not in extra else {"$and": [extra, q]}
    return q


def ws_stamp(user: User) -> Dict[str, str]:
    """Return {'workspace_id': user.workspace_id} — use when inserting new docs."""
    return {"workspace_id": user.workspace_id or "ws_default"}


# ---------- Auth routes ----------
class SessionExchangeIn(BaseModel):
    session_id: str


@api.post("/auth/session")
async def auth_session(payload: SessionExchangeIn, response: Response):
    """Exchange Emergent session_id (URL fragment) for persistent session cookie."""
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data["email"]
    name = data.get("name") or email
    picture = data.get("picture") or ""
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        wid = existing.get("workspace_id") or f"ws_{uuid.uuid4().hex[:12]}"
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "workspace_id": wid, "last_login": datetime.now(timezone.utc).isoformat()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        wid = f"ws_{uuid.uuid4().hex[:12]}"
        await db.workspaces.insert_one({
            "workspace_id": wid, "owner_id": user_id,
            "name": f"{name}'s workspace", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "admin",
            "workspace_id": wid,
            "settings": UserSettings().model_dump(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "session_token": session_token,
    }


@api.get("/auth/me")
async def auth_me(user: User = Depends(require_user)):
    return user.model_dump()


# ---------- Email + Password auth ----------
import bcrypt
import re as _re_auth

_EMAIL_RX = _re_auth.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


async def _issue_session(user_id: str, email: str, name: str, response: Response) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "email": email,
        "name": name,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(
        key="session_token", value=token, max_age=7 * 24 * 60 * 60,
        path="/", httponly=True, secure=True, samesite="none",
    )
    return token


class RegisterIn(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


async def _check_brute_force(identifier: str):
    now = datetime.now(timezone.utc)
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= 5 and rec.get("locked_until"):
        locked_until = rec["locked_until"]
        # MongoDB returns naive datetimes — re-attach UTC tz for comparison
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            wait = int((locked_until - now).total_seconds() / 60) + 1
            raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {wait} min.")


async def _record_failed_login(identifier: str):
    now = datetime.now(timezone.utc)
    rec = await db.login_attempts.find_one({"identifier": identifier}) or {}
    count = rec.get("count", 0) + 1
    locked_until = now + timedelta(minutes=15) if count >= 5 else None
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$set": {"identifier": identifier, "count": count, "locked_until": locked_until, "updated_at": now}},
        upsert=True,
    )


async def _clear_failed_login(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


@api.post("/auth/register")
async def auth_register(payload: RegisterIn, response: Response):
    email = payload.email.strip().lower()
    if not _EMAIL_RX.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email")
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists. Try signing in.")
    uid = f"usr_{uuid.uuid4().hex[:12]}"
    wid = f"ws_{uuid.uuid4().hex[:12]}"
    name = payload.name.strip() or email.split("@")[0].title()
    await db.workspaces.insert_one({
        "workspace_id": wid, "owner_id": uid,
        "name": f"{name}'s workspace",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.users.insert_one({
        "user_id": uid, "email": email, "name": name, "picture": "",
        "role": "admin", "auth": "password", "password_hash": _hash_pw(payload.password),
        "workspace_id": wid,
        "settings": UserSettings().model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = await _issue_session(uid, email, name, response)
    return {"user_id": uid, "email": email, "name": name, "workspace_id": wid, "session_token": token}


def _client_ip(request: Request) -> str:
    """Extract real client IP even when behind a K8s ingress / load balancer.
    Order: X-Forwarded-For (leftmost) → X-Real-IP → request.client.host → '0.0.0.0'."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    xreal = request.headers.get("x-real-ip", "").strip()
    if xreal:
        return xreal
    return (request.client.host if request.client else "0.0.0.0") or "0.0.0.0"


@api.post("/auth/login")
async def auth_login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.strip().lower()
    ip = _client_ip(request)
    identifier = f"{ip}:{email}"
    await _check_brute_force(identifier)

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        await _record_failed_login(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _verify_pw(payload.password, user["password_hash"]):
        await _record_failed_login(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await _clear_failed_login(identifier)
    token = await _issue_session(user["user_id"], user["email"], user.get("name", ""), response)
    return {"user_id": user["user_id"], "email": user["email"], "name": user.get("name", ""), "session_token": token}


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Settings ----------
class SettingsIn(BaseModel):
    llm_provider: str
    llm_model: str
    custom_api_key: str = ""
    digest_subscribed: bool = False
    digest_email: str = ""
    ai_keys: Dict[str, str] = Field(default_factory=dict)
    integrations: Dict[str, str] = Field(default_factory=dict)
    notifications: Dict[str, Any] = Field(default_factory=dict)
    quality: Dict[str, Any] = Field(default_factory=dict)
    security: Dict[str, Any] = Field(default_factory=dict)


@api.get("/settings")
async def get_settings(user: User = Depends(require_user)):
    # Merge defaults so frontend always gets every known field
    defaults = UserSettings().model_dump()
    current = user.settings.model_dump()
    for k, v in defaults.items():
        if k not in current or current[k] in (None, ""):
            current[k] = v
        elif isinstance(v, dict) and isinstance(current[k], dict):
            merged = {**v, **current[k]}
            current[k] = merged
    return current


@api.put("/settings")
async def put_settings(payload: SettingsIn, user: User = Depends(require_user)):
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"settings": payload.model_dump()}},
    )
    return payload.model_dump()


# ═══════════════════════════════════════════════════════════════════
# External Integrations — Zendesk / Intercom / Slack / Teams
# ═══════════════════════════════════════════════════════════════════

class IntegrationTestIn(BaseModel):
    connector: str  # 'zendesk' | 'intercom'


class IntegrationPullIn(BaseModel):
    connector: str
    limit: int = 25
    dry_run: bool = False  # If True, return the fetched tickets WITHOUT scoring/storing


def _creds_for(user: User, connector: str) -> Dict[str, str]:
    """Extract connector-specific credentials from user.settings.integrations.
    Zendesk uses a composite {subdomain, email, api_token}; Intercom uses {access_token}."""
    integ = (user.settings.integrations or {})
    if connector == "zendesk":
        return {
            "subdomain":  integ.get("zendesk_subdomain") or integ.get("zendesk_domain") or "",
            "email":      integ.get("zendesk_email") or user.email,
            "api_token":  integ.get("zendesk_api_key") or integ.get("zendesk_api_token") or "",
        }
    if connector == "intercom":
        return {"access_token": integ.get("intercom_api_key") or integ.get("intercom_access_token") or ""}
    return {}


@api.post("/integrations/test")
async def integration_test(payload: IntegrationTestIn, user: User = Depends(require_user)):
    """Test credentials for the given connector. Returns {ok, detail, sample}."""
    if payload.connector not in CONNECTORS:
        raise HTTPException(status_code=422, detail=f"Unknown connector. Supported: {list(CONNECTORS.keys())}")
    creds = _creds_for(user, payload.connector)
    conn = get_connector(payload.connector, creds)
    result = await conn.test_connection()
    return result


@api.post("/integrations/pull")
async def integration_pull(payload: IntegrationPullIn, user: User = Depends(require_user)):
    """Pull recent interactions from the connector. If `dry_run`, returns fetched items
    without scoring them. Otherwise: runs each through analyze_interaction() and inserts
    into db.interactions tagged with the user's workspace_id."""
    if payload.connector not in CONNECTORS:
        raise HTTPException(status_code=422, detail=f"Unknown connector. Supported: {list(CONNECTORS.keys())}")
    creds = _creds_for(user, payload.connector)
    conn = get_connector(payload.connector, creds)

    # Sanity check credentials first
    test = await conn.test_connection()
    if not test.get("ok"):
        raise HTTPException(status_code=401, detail=f"{payload.connector}: {test.get('detail', 'credentials invalid')}")

    items = await conn.pull_recent(limit=max(1, min(payload.limit, 100)))
    if not items:
        return {"pulled": 0, "scored": 0, "items": [], "message": "No new items found"}

    if payload.dry_run:
        return {"pulled": len(items), "scored": 0, "items": items, "dry_run": True}

    # Score + insert
    scored = []
    for it in items:
        try:
            # Dedup on external_id
            exists = await db.interactions.find_one(ws_filter(user, {"source": it["source"]}), {"_id": 0})
            if exists:
                continue
            account = await db.accounts.find_one(ws_filter(user, {"name": it["customer"]}), {"_id": 0}) or {}
            analysis = await analyze_interaction(
                transcript=it["transcript"],
                customer_name=it["customer"],
                agent_name=it["agent"],
                agent_type=it["agent_type"],
                channel=it["channel"],
                account_arr=account.get("arr", 0),
                provider=user.settings.llm_provider,
                model=user.settings.llm_model,
                api_key=user.settings.custom_api_key or None,
            )
            doc = {
                "interaction_id": f"int_{uuid.uuid4().hex[:10]}",
                "customer": it["customer"], "agent": it["agent"],
                "agent_type": it["agent_type"], "channel": it["channel"], "type": "Imported",
                "duration_sec": 0, "transcript": it["transcript"][:50000],
                "analysis": analysis,
                **ws_stamp(user),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "source": it["source"],
                "external_url": it.get("external_url", ""),
            }
            await db.interactions.insert_one(doc)
            scored.append(doc["interaction_id"])
        except Exception as e:
            logger.warning(f"score failed for {it.get('external_id')}: {e}")

    return {"pulled": len(items), "scored": len(scored), "interaction_ids": scored}


@api.post("/integrations/webhook/{connector}")
async def integration_webhook(connector: str, request: Request):
    """Public-ish endpoint to receive push events from connectors. The payload is tagged
    with a signed `workspace_id` query param so we know which tenant it belongs to."""
    wid = request.query_params.get("workspace_id", "").strip()
    if not wid:
        raise HTTPException(status_code=400, detail="Missing workspace_id query param")
    body = await request.json()
    # Persist raw payload for debugging — real parsing/enqueueing can be added later
    await db.integration_events.insert_one({
        "connector": connector,
        "workspace_id": wid,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "payload_size": len(str(body)),
        "payload_type": body.get("type") or body.get("action") or "unknown",
    })
    return {"ok": True, "connector": connector, "workspace_id": wid, "event": body.get("type") or "accepted"}



# ---------- Interactions ----------
def _serialize_interaction(doc: dict) -> dict:
    created = doc.get("created_at")
    if isinstance(created, datetime):
        doc["created_at"] = created.isoformat()
    return doc


@api.get("/interactions")
async def list_interactions(
    user: User = Depends(require_user),
    churn_risk: Optional[str] = None,
    agent_type: Optional[str] = None,
    customer: Optional[str] = None,
    limit: int = 200,
):
    query: Dict[str, Any] = {}
    if churn_risk:
        query["analysis.churn_risk"] = churn_risk
    if agent_type:
        query["agent_type"] = agent_type
    if customer:
        query["customer"] = customer
    cur = db.interactions.find(ws_filter(user, query), {"_id": 0}).sort("created_at", -1).limit(limit)
    items = [_serialize_interaction(d) async for d in cur]
    return items


@api.get("/interactions/{interaction_id}")
async def get_interaction(interaction_id: str, user: User = Depends(require_user)):
    doc = await db.interactions.find_one(ws_filter(user, {"interaction_id": interaction_id}), {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return _serialize_interaction(doc)


@api.post("/interactions")
async def create_interaction(payload: InteractionCreate, user: User = Depends(require_user)):
    account = await db.accounts.find_one(ws_filter(user, {"name": payload.customer}), {"_id": 0})
    arr = account["arr"] if account else 0
    analysis = await analyze_interaction(
        transcript=payload.transcript,
        customer_name=payload.customer,
        agent_name=payload.agent,
        agent_type=payload.agent_type,
        channel=payload.channel,
        account_arr=arr,
        provider=user.settings.llm_provider,
        model=user.settings.llm_model,
        api_key=user.settings.custom_api_key or None,
    )
    doc = {
        "interaction_id": f"int_{uuid.uuid4().hex[:10]}",
        **payload.model_dump(),
        "analysis": analysis,
        **ws_stamp(user),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.interactions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/interactions/{interaction_id}/rescore")
async def rescore(interaction_id: str, user: User = Depends(require_user)):
    doc = await db.interactions.find_one(ws_filter(user, {"interaction_id": interaction_id}), {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    account = await db.accounts.find_one(ws_filter(user, {"name": doc["customer"]}), {"_id": 0})
    arr = account["arr"] if account else 0
    analysis = await analyze_interaction(
        transcript=doc["transcript"],
        customer_name=doc["customer"],
        agent_name=doc["agent"],
        agent_type=doc["agent_type"],
        channel=doc["channel"],
        account_arr=arr,
        provider=user.settings.llm_provider,
        model=user.settings.llm_model,
        api_key=user.settings.custom_api_key or None,
    )
    await db.interactions.update_one(
        ws_filter(user, {"interaction_id": interaction_id}), {"$set": {"analysis": analysis}}
    )
    doc["analysis"] = analysis
    return _serialize_interaction(doc)


# ---------- Accounts ----------
@api.get("/accounts")
async def list_accounts(user: User = Depends(require_user)):
    docs = await db.accounts.find(ws_filter(user), {"_id": 0}).to_list(500)
    # Enrich with churn risk from latest interaction
    for acc in docs:
        last = await db.interactions.find_one(
            ws_filter(user, {"customer": acc["name"]}), {"_id": 0}, sort=[("created_at", -1)]
        )
        if last and last.get("analysis"):
            acc["churn_risk"] = last["analysis"].get("churn_risk", "Low")
            acc["arr_at_risk"] = last["analysis"].get("arr_at_risk", 0)
            acc["last_interaction_at"] = last.get("created_at")
        else:
            acc["churn_risk"] = "Low"
            acc["arr_at_risk"] = 0
            acc["last_interaction_at"] = None
    return docs


# ---------- Agents ----------
@api.get("/agents")
async def list_agents(user: User = Depends(require_user)):
    agents = await db.agents.find(ws_filter(user), {"_id": 0}).to_list(500)
    # Compute per-agent metrics
    out = []
    for a in agents:
        cur = db.interactions.find(ws_filter(user, {"agent": a["name"]}), {"_id": 0})
        interactions = [d async for d in cur]
        n = len(interactions)
        avg = round(sum(i["analysis"].get("qa_score", 0) for i in interactions) / n, 1) if n else 0
        high_risk = sum(1 for i in interactions if i["analysis"].get("churn_risk") == "High")
        out.append({**a, "interactions": n, "avg_score": avg, "high_risk_count": high_risk})
    out.sort(key=lambda x: x["avg_score"], reverse=True)
    return out


# ---------- Dashboard stats ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: User = Depends(require_user)):
    total = await db.interactions.count_documents(ws_filter(user))
    today_cut = datetime.now(timezone.utc) - timedelta(days=1)
    today = await db.interactions.count_documents(ws_filter(user, {"created_at": {"$gte": today_cut.isoformat()}}))
    all_docs = await db.interactions.find(ws_filter(user), {"_id": 0}).to_list(2000)
    avg_score = round(sum(d["analysis"].get("qa_score", 0) for d in all_docs) / max(1, len(all_docs)), 1)
    agents = await db.agents.count_documents(ws_filter(user))
    accounts = await db.accounts.find(ws_filter(user), {"_id": 0}).to_list(500)
    total_arr_at_risk = 0
    at_risk_accounts = 0
    for acc in accounts:
        last = next((d for d in all_docs if d["customer"] == acc["name"]), None)
        if last and last["analysis"].get("churn_risk") in ("High", "Medium"):
            at_risk_accounts += 1
            total_arr_at_risk += last["analysis"].get("arr_at_risk", 0)

    # Score distribution
    buckets = {"90-100": 0, "80-89": 0, "70-79": 0, "<70": 0}
    for d in all_docs:
        s = d["analysis"].get("qa_score", 0)
        if s >= 90:
            buckets["90-100"] += 1
        elif s >= 80:
            buckets["80-89"] += 1
        elif s >= 70:
            buckets["70-79"] += 1
        else:
            buckets["<70"] += 1

    # Human vs AI split
    ai_scores = [d["analysis"].get("qa_score", 0) for d in all_docs if d["agent_type"] == "AI"]
    hum_scores = [d["analysis"].get("qa_score", 0) for d in all_docs if d["agent_type"] == "Human"]
    coverage = 100 if total > 0 else 0  # demo: 100% because every interaction is scored

    # Top performers
    agent_stats: Dict[str, Dict[str, Any]] = {}
    for d in all_docs:
        s = agent_stats.setdefault(d["agent"], {"agent": d["agent"], "type": d["agent_type"], "scores": []})
        s["scores"].append(d["analysis"].get("qa_score", 0))
    top = [
        {"agent": v["agent"], "type": v["type"], "avg_score": round(sum(v["scores"]) / len(v["scores"]), 1), "count": len(v["scores"])}
        for v in agent_stats.values()
    ]
    top.sort(key=lambda x: x["avg_score"], reverse=True)

    # Recent alerts
    alerts = []
    for d in sorted(all_docs, key=lambda x: x.get("created_at", ""), reverse=True)[:12]:
        a = d["analysis"]
        if a.get("churn_risk") == "High":
            alerts.append({"type": "Churn", "severity": "High", "title": f"{d['customer']} — churn risk high",
                           "note": a.get("churn_signal", ""), "interaction_id": d["interaction_id"], "created_at": d.get("created_at")})
        if a.get("qa_score", 0) < 65:
            alerts.append({"type": "QA", "severity": "High", "title": f"{d['agent']} — score {a.get('qa_score')}",
                           "note": "QA below threshold", "interaction_id": d["interaction_id"], "created_at": d.get("created_at")})
        if a.get("ai_hallucination"):
            alerts.append({"type": "AI", "severity": "High", "title": f"{d['agent']} — hallucination",
                           "note": a.get("hallucination_note", ""), "interaction_id": d["interaction_id"], "created_at": d.get("created_at")})
        if a.get("expansion_signal") and a.get("expansion_signal") != "None":
            alerts.append({"type": "Upsell", "severity": "Info", "title": f"{d['customer']} +${a.get('expansion_value_monthly', 0)}/mo",
                           "note": a.get("expansion_signal", ""), "interaction_id": d["interaction_id"], "created_at": d.get("created_at")})

    # Recent interactions (for dashboard table)
    recent = sorted(all_docs, key=lambda x: x.get("created_at", ""), reverse=True)[:6]
    recent_rows = [
        {
            "interaction_id": d["interaction_id"],
            "agent": d["agent"],
            "agent_type": d["agent_type"],
            "customer": d["customer"],
            "qa_score": d["analysis"].get("qa_score", 0),
            "status": "Needs Coaching" if d["analysis"].get("qa_score", 0) < 75 else "Completed",
            "created_at": d.get("created_at"),
        }
        for d in recent
    ]

    return {
        "coverage": coverage,
        "avg_score": avg_score,
        "active_agents": agents,
        "interactions_total": total,
        "interactions_today": today,
        "total_arr_at_risk": total_arr_at_risk,
        "at_risk_accounts": at_risk_accounts,
        "score_distribution": buckets,
        "ai_avg": round(sum(ai_scores) / max(1, len(ai_scores)), 1) if ai_scores else 0,
        "human_avg": round(sum(hum_scores) / max(1, len(hum_scores)), 1) if hum_scores else 0,
        "top_agents": top[:6],
        "alerts": alerts[:10],
        "recent_interactions": recent_rows,
    }


# ---------- Executive / Departments / Business impact ----------
@api.get("/executive/overview")
async def executive_overview(user: User = Depends(require_user)):
    """Aggregated metrics for the Executive dashboard: departments, business impact, ROI."""
    agents = await db.agents.find(ws_filter(user), {"_id": 0}).to_list(500)
    all_docs = await db.interactions.find(ws_filter(user), {"_id": 0}).sort("created_at", -1).to_list(2000)
    dept_map: Dict[str, Dict[str, Any]] = {}
    for a in agents:
        dept_map.setdefault(a["team"], {"department": a["team"], "agents": 0, "scores": []})
        dept_map[a["team"]]["agents"] += 1
    for d in all_docs:
        agent = next((a for a in agents if a["name"] == d["agent"]), None)
        if agent:
            dept_map[agent["team"]]["scores"].append(d["analysis"].get("qa_score", 0))
    departments = []
    for v in dept_map.values():
        avg = round(sum(v["scores"]) / len(v["scores"]), 1) if v["scores"] else 0
        departments.append({"department": v["department"], "agents": v["agents"], "avg_score": avg,
                            "delta_pct": round((avg - 85) / 85 * 100, 1) if avg else 0})
    departments.sort(key=lambda x: x["avg_score"], reverse=True)

    # Business impact — some real, some demo-story values
    accounts = await db.accounts.find(ws_filter(user), {"_id": 0}).to_list(500)
    total_arr = sum(a.get("arr", 0) for a in accounts)
    arr_at_risk = 0
    for acc in accounts:
        last = next((d for d in all_docs if d["customer"] == acc["name"]), None)
        if last and last["analysis"].get("churn_risk") in ("High", "Medium"):
            arr_at_risk += last["analysis"].get("arr_at_risk", 0)

    # Recovered revenue from catching at-risk accounts (35% save rate industry benchmark)
    recovered = int(arr_at_risk * 0.35)
    # Coaching uplift — each coaching card issued correlates to ~$4K/yr productivity gain per agent
    coaching_cards = sum(1 for d in all_docs if ((d["analysis"].get("coaching_card") or {}).get("headline")))
    coaching_uplift = coaching_cards * 4000
    # Compliance + hallucination catches — each prevented violation saves ~$5K avg (fine/churn avoided)
    compliance_catches = sum(1 for d in all_docs if d["analysis"].get("ai_hallucination") or (d["analysis"].get("compliance") or {}).get("has_violation"))
    compliance_savings = compliance_catches * 5000
    # QA ROI = recovered + coaching uplift + compliance savings. Floor at scored_count × $50 so first customer sees value immediately.
    qa_roi = recovered + coaching_uplift + compliance_savings
    if qa_roi == 0 and all_docs:
        qa_roi = max(len(all_docs) * 50, 1000)

    saved = recovered  # backward compat for other call sites
    avg_score = round(sum(d["analysis"].get("qa_score", 0) for d in all_docs) / max(1, len(all_docs)), 1) if all_docs else 0

    # Risk alerts with severity mapping
    risk_alerts = []
    for d in all_docs:
        a = d["analysis"]
        if a.get("churn_risk") == "High":
            risk_alerts.append({
                "severity": "HIGH RISK",
                "department": "Retention",
                "title": f"{d['customer']} — competitor mention",
                "note": a.get("churn_signal", ""),
                "recommended_action": "Trigger save playbook + CSM outreach within 24h",
                "interaction_id": d["interaction_id"],
            })
        elif a.get("ai_hallucination"):
            risk_alerts.append({
                "severity": "HIGH RISK",
                "department": "AI Agents",
                "title": f"{d['agent']} — hallucination flagged",
                "note": a.get("hallucination_note", ""),
                "recommended_action": "Route to human + update KB policy",
                "interaction_id": d["interaction_id"],
            })
        elif a.get("qa_score", 100) < 70:
            risk_alerts.append({
                "severity": "MEDIUM RISK",
                "department": "Coaching",
                "title": f"{d['agent']} — score {a.get('qa_score')}",
                "note": "QA below threshold",
                "recommended_action": "Schedule 1:1 coaching session",
                "interaction_id": d["interaction_id"],
            })

    return {
        "business_impact": {
            "qa_roi": qa_roi,
            "qa_roi_breakdown": {
                "recovered_revenue": recovered,
                "coaching_uplift": coaching_uplift,
                "compliance_savings": compliance_savings,
            },
            "csat_pct": round(avg_score, 1),
            "agent_productivity_delta": round((avg_score - 75) / 3, 1) if avg_score else 0,
            "cost_savings": int(arr_at_risk * 0.25) or (compliance_savings + coaching_uplift // 2),
            "customer_retention": {"from": 94.2, "to": 96.8, "arr_gain": recovered or qa_roi},
            "first_call_resolution": {"from": 82.1, "to": 87.5, "cost_delta": -340000},
            "avg_handle_time": {"from": "5:18", "to": "4:32", "capacity_delta_pct": 15},
            "agent_turnover": {"from": 12.7, "to": 8.2, "cost_delta": -450000},
            "total_arr": total_arr,
            "arr_at_risk": arr_at_risk,
        },
        "departments": departments,
        "risk_alerts": risk_alerts[:6],
    }


# ---------- Coaching ----------
@api.get("/coaching")
async def coaching_list(user: User = Depends(require_user)):
    docs = await db.interactions.find(ws_filter(user), {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for d in docs:
        card = d["analysis"].get("coaching_card") or {}
        if not card.get("headline"):
            continue
        out.append({
            "interaction_id": d["interaction_id"],
            "customer": d["customer"],
            "agent": d["agent"],
            "agent_type": d["agent_type"],
            "qa_score": d["analysis"].get("qa_score", 0),
            "headline": card.get("headline", ""),
            "strengths": card.get("strengths", []),
            "growth_areas": card.get("growth_areas", []),
            "recommended_actions": card.get("recommended_actions", []),
            "completed": bool(card.get("completed", False)),
            "completed_at": card.get("completed_at"),
            "created_at": d.get("created_at"),
        })
    return out


class CoachingDoneIn(BaseModel):
    completed: bool = True


@api.post("/coaching/{interaction_id}/complete")
async def complete_coaching(interaction_id: str, payload: CoachingDoneIn, user: User = Depends(require_user)):
    update = {
        "analysis.coaching_card.completed": payload.completed,
        "analysis.coaching_card.completed_at": datetime.now(timezone.utc).isoformat() if payload.completed else None,
        "analysis.coaching_card.completed_by": user.user_id if payload.completed else None,
    }
    r = await db.interactions.update_one(ws_filter(user, {"interaction_id": interaction_id}), {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return {"ok": True, "completed": payload.completed}


# ---------- Churn save playbook ----------
@api.get("/playbooks/account/{customer}")
async def account_playbook(customer: str, user: User = Depends(require_user)):
    last = await db.interactions.find_one(
        ws_filter(user, {"customer": customer}), {"_id": 0}, sort=[("created_at", -1)]
    )
    if not last:
        raise HTTPException(status_code=404, detail="No interactions for account")
    account = await db.accounts.find_one(ws_filter(user, {"name": customer}), {"_id": 0}) or {}
    return {
        "customer": customer,
        "arr": account.get("arr", 0),
        "churn_risk": last["analysis"].get("churn_risk", "Low"),
        "arr_at_risk": last["analysis"].get("arr_at_risk", 0),
        "latest_interaction_id": last["interaction_id"],
        "signal": last["analysis"].get("churn_signal", ""),
        "save_playbook": last["analysis"].get("save_playbook") or {},
    }


# ---------- Public share for playbooks ----------
@api.post("/playbooks/share/{customer}")
async def create_playbook_share(customer: str, user: User = Depends(require_user)):
    existing = await db.playbook_shares.find_one(ws_filter(user, {"customer": customer, "created_by": user.user_id}), {"_id": 0})
    if existing:
        return {"token": existing["token"], "customer": customer}
    token = uuid.uuid4().hex[:16]
    await db.playbook_shares.insert_one({
        "token": token,
        "customer": customer,
        "created_by": user.user_id,
        **ws_stamp(user),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"token": token, "customer": customer}


@api.get("/shared/playbook/{token}")
async def get_shared_playbook(token: str):
    """Public endpoint — no auth required. Scopes lookups to the share creator's workspace."""
    share = await db.playbook_shares.find_one({"token": token}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Not found")
    # The share carries its workspace_id; fallback to ws_default for legacy shares
    wid = share.get("workspace_id") or "ws_default"
    ws_q = {"$or": [{"workspace_id": wid}, {"workspace_id": {"$exists": False}}]} if wid == "ws_default" else {"workspace_id": wid}
    last = await db.interactions.find_one(
        {**ws_q, "customer": share["customer"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if not last:
        raise HTTPException(status_code=404, detail="No playbook available")
    account = await db.accounts.find_one({**ws_q, "name": share["customer"]}, {"_id": 0}) or {}
    return {
        "customer": share["customer"],
        "arr": account.get("arr", 0),
        "churn_risk": last["analysis"].get("churn_risk", "Low"),
        "arr_at_risk": last["analysis"].get("arr_at_risk", 0),
        "signal": last["analysis"].get("churn_signal", ""),
        "save_playbook": last["analysis"].get("save_playbook") or {},
    }


# ---------- Activity history ----------
@api.get("/activity")
async def activity_feed(user: User = Depends(require_user), limit: int = 200):
    """Unified event feed: interaction scored, churn/AI/QA alerts, coaching generated, playbook shared."""
    events: List[Dict[str, Any]] = []

    interactions = await db.interactions.find(ws_filter(user), {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in interactions:
        a = d.get("analysis") or {}
        at = d.get("created_at")
        iid = d["interaction_id"]
        link = f"/dashboard/interactions/{iid}"
        # base interaction scored event
        events.append({
            "id": f"int-{iid}",
            "kind": "interaction",
            "at": at,
            "title": f"{d['agent']} ({d['agent_type']}) — {d['customer']}",
            "note": a.get("summary", ""),
            "actor": d["agent"],
            "value": f"{a.get('qa_score', 0)}/100",
            "value_sub": d["channel"],
            "link": link,
        })
        # sub-events derived from analysis
        if a.get("churn_risk") in ("High", "Medium"):
            events.append({
                "id": f"churn-{iid}",
                "kind": "churn",
                "at": at,
                "severity": a["churn_risk"],
                "title": f"{d['customer']} — churn risk {a['churn_risk'].lower()}",
                "note": a.get("churn_signal", ""),
                "actor": "RetOps",
                "value": f"${a.get('arr_at_risk', 0):,}",
                "value_sub": "ARR at risk",
                "link": link,
            })
        if a.get("ai_hallucination"):
            events.append({
                "id": f"ai-{iid}",
                "kind": "ai",
                "severity": "High",
                "at": at,
                "title": f"{d['agent']} — hallucination flagged",
                "note": a.get("hallucination_note", ""),
                "actor": "AI Quality Gate",
                "link": link,
            })
        if a.get("policy_compliance") == "Fail":
            events.append({
                "id": f"qa-{iid}",
                "kind": "qa",
                "at": at,
                "title": f"{d['agent']} — policy compliance fail",
                "note": "Response flagged for policy review",
                "actor": "RetOps",
                "link": link,
            })
        if a.get("expansion_signal") and a["expansion_signal"] != "None":
            events.append({
                "id": f"ups-{iid}",
                "kind": "upsell",
                "at": at,
                "title": f"{d['customer']} — expansion signal",
                "note": a["expansion_signal"],
                "actor": d["agent"],
                "value": f"+${a.get('expansion_value_monthly', 0):,}/mo",
                "link": link,
            })
        card = a.get("coaching_card") or {}
        if card.get("headline"):
            events.append({
                "id": f"coach-{iid}",
                "kind": "coaching",
                "at": at,
                "title": f"Coaching card for {d['agent']}",
                "note": card.get("headline", ""),
                "actor": "RetOps",
                "link": link,
            })

    shares = await db.playbook_shares.find(ws_filter(user), {"_id": 0}).sort("created_at", -1).to_list(100)
    for s in shares:
        events.append({
            "id": f"share-{s['token']}",
            "kind": "share",
            "at": s.get("created_at"),
            "title": f"Save playbook shared — {s['customer']}",
            "note": f"Public link /share/p/{s['token']}",
            "actor": s.get("created_by", ""),
            "link": None,
        })

    # sort desc by at
    events.sort(key=lambda e: e.get("at") or "", reverse=True)
    return events[:limit]


# ---------- Demo seed ----------
@api.post("/seed-demo")
async def seed_demo(force: bool = False, user: User = Depends(require_user)):
    existing_count = await db.interactions.count_documents(ws_filter(user))
    if existing_count > 0 and not force:
        return {"status": "already-seeded", "interactions": existing_count}

    if force:
        # Only delete THIS workspace's data, never wipe other tenants' data
        await db.interactions.delete_many(ws_filter(user))
        await db.accounts.delete_many(ws_filter(user))
        await db.agents.delete_many(ws_filter(user))

    payload = build_seed_payload()
    await db.accounts.insert_many([{**a, **ws_stamp(user)} for a in payload["accounts"]])
    await db.agents.insert_many([{**a, **ws_stamp(user)} for a in payload["agents"]])

    created = []
    for i, item in enumerate(payload["interactions"]):
        account = next((a for a in payload["accounts"] if a["name"] == item["customer"]), None)
        arr = account["arr"] if account else 0
        analysis = await analyze_interaction(
            transcript=item["transcript"],
            customer_name=item["customer"],
            agent_name=item["agent"],
            agent_type=item["agent_type"],
            channel=item["channel"],
            account_arr=arr,
            provider=user.settings.llm_provider,
            model=user.settings.llm_model,
            api_key=user.settings.custom_api_key or None,
        )
        # Staggered created_at over last 2 days
        created_at = datetime.now(timezone.utc) - timedelta(hours=2 * i + 1)
        doc = {
            "interaction_id": f"int_{uuid.uuid4().hex[:10]}",
            **item,
            "analysis": analysis,
            **ws_stamp(user),
            "created_at": created_at.isoformat(),
        }
        await db.interactions.insert_one(doc)
        created.append(doc["interaction_id"])

    return {"status": "seeded", "interactions": len(created), "ids": created}


# ---------- Weekly RetOps Digest ----------
async def _build_digest(user: User, days: int = 7) -> Dict[str, Any]:
    """Aggregate the last N days of interactions into an executive digest payload."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat()

    docs = await db.interactions.find(
        ws_filter(user, {"created_at": {"$gte": since_iso}, "agent": {"$not": {"$regex": "^TEST_"}}}), {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    total = len(docs)
    human = [d for d in docs if d.get("agent_type") == "Human"]
    ai = [d for d in docs if d.get("agent_type") == "AI"]

    def avg(arr, key):
        vals = [(x.get("analysis") or {}).get(key) for x in arr]
        vals = [v for v in vals if isinstance(v, (int, float))]
        return round(sum(vals) / len(vals), 1) if vals else 0

    avg_all = avg(docs, "qa_score")
    avg_human = avg(human, "qa_score")
    avg_ai = avg(ai, "qa_score")

    below_threshold = [d for d in docs if (d.get("analysis") or {}).get("qa_score", 100) < 60]
    hallucinations = [d for d in docs if (d.get("analysis") or {}).get("ai_hallucination")]
    policy_fails = [d for d in docs if (d.get("analysis") or {}).get("policy_compliance") == "Fail"]

    # Top at-risk accounts (sum arr_at_risk per customer, High/Medium churn only)
    at_risk_map: Dict[str, Dict[str, Any]] = {}
    for d in docs:
        a = d.get("analysis") or {}
        if a.get("churn_risk") in ("High", "Medium", "Critical"):
            c = d["customer"]
            entry = at_risk_map.setdefault(c, {
                "customer": c, "churn_risk": a["churn_risk"],
                "arr_at_risk": 0, "last_signal": "", "last_interaction_id": d["interaction_id"],
            })
            entry["arr_at_risk"] = max(entry["arr_at_risk"], int(a.get("arr_at_risk", 0) or 0))
            # keep highest severity
            order = {"Critical": 3, "High": 2, "Medium": 1}
            if order.get(a["churn_risk"], 0) > order.get(entry["churn_risk"], 0):
                entry["churn_risk"] = a["churn_risk"]
            if a.get("churn_signal") and not entry["last_signal"]:
                entry["last_signal"] = a["churn_signal"]

    top_at_risk = sorted(at_risk_map.values(), key=lambda x: x["arr_at_risk"], reverse=True)[:5]
    total_arr_at_risk = sum(x["arr_at_risk"] for x in at_risk_map.values())

    # Upsell signals
    upsells = []
    for d in docs:
        a = d.get("analysis") or {}
        if a.get("expansion_signal") and a["expansion_signal"] != "None":
            upsells.append({
                "customer": d["customer"],
                "agent": d["agent"],
                "signal": a["expansion_signal"],
                "monthly": int(a.get("expansion_value_monthly", 0) or 0),
            })
    upsells = sorted(upsells, key=lambda x: x["monthly"], reverse=True)[:5]
    total_upsell_monthly = sum(u["monthly"] for u in upsells)

    # Coaching priorities — agents with most cards or lowest scores
    agent_scores: Dict[str, Dict[str, Any]] = {}
    for d in docs:
        a = d.get("analysis") or {}
        ag = d.get("agent", "Unknown")
        entry = agent_scores.setdefault(ag, {
            "agent": ag, "type": d.get("agent_type", "Human"),
            "interactions": 0, "scores": [], "cards": 0,
        })
        entry["interactions"] += 1
        if isinstance(a.get("qa_score"), (int, float)):
            entry["scores"].append(a["qa_score"])
        if (a.get("coaching_card") or {}).get("headline"):
            entry["cards"] += 1
    coaching = []
    for e in agent_scores.values():
        avg_s = round(sum(e["scores"]) / len(e["scores"]), 1) if e["scores"] else 0
        coaching.append({**e, "avg_score": avg_s})
    coaching = sorted(
        [c for c in coaching if c["cards"] > 0 or c["avg_score"] < 75],
        key=lambda x: (x["avg_score"], -x["cards"]),
    )[:5]
    for c in coaching:
        c.pop("scores", None)

    week_start = since.date().isoformat()
    week_end = datetime.now(timezone.utc).date().isoformat()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": {"days": days, "from": week_start, "to": week_end},
        "kpis": {
            "total_interactions": total,
            "human_interactions": len(human),
            "ai_interactions": len(ai),
            "avg_qa_score": avg_all,
            "avg_human_score": avg_human,
            "avg_ai_score": avg_ai,
            "below_threshold_count": len(below_threshold),
            "hallucinations": len(hallucinations),
            "policy_fails": len(policy_fails),
            "arr_at_risk": total_arr_at_risk,
            "accounts_at_risk": len(at_risk_map),
            "upsell_monthly": total_upsell_monthly,
        },
        "top_at_risk": top_at_risk,
        "upsells": upsells,
        "coaching_priorities": coaching,
        "below_threshold": [
            {
                "interaction_id": d["interaction_id"],
                "customer": d["customer"],
                "agent": d["agent"],
                "qa_score": (d.get("analysis") or {}).get("qa_score", 0),
                "channel": d.get("channel", ""),
            }
            for d in below_threshold[:5]
        ],
    }


def _render_digest_html(d: Dict[str, Any], recipient_name: str = "Leader") -> str:
    """Render digest JSON into a branded email HTML."""
    k = d["kpis"]
    period = d["period"]

    def arr_fmt(v):
        return f"${v:,}" if v else "$0"

    at_risk_rows = "".join(
        f"""<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#0b1f3b;font-weight:600;">{x['customer']}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#b91c1c;font-size:13px;">{x['churn_risk']}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#0b1f3b;font-weight:700;text-align:right;">{arr_fmt(x['arr_at_risk'])}</td>
        </tr>
        <tr><td colspan="3" style="padding:0 0 14px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">{x.get('last_signal','')}</td></tr>"""
        for x in d["top_at_risk"]
    ) or '<tr><td colspan="3" style="padding:14px 0;color:#6b7280;">No at-risk accounts this week.</td></tr>'

    coaching_rows = "".join(
        f"""<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#0b1f3b;font-weight:600;">{c['agent']} <span style="color:#6b7280;font-weight:400;font-size:12px;">· {c['type']}</span></td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#0b1f3b;text-align:right;">Avg {c['avg_score']} · {c['cards']} card{'s' if c['cards']!=1 else ''}</td>
        </tr>"""
        for c in d["coaching_priorities"]
    ) or '<tr><td colspan="2" style="padding:14px 0;color:#6b7280;">No coaching actions required.</td></tr>'

    upsell_rows = "".join(
        f"""<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#0b1f3b;font-weight:600;">{u['customer']}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#14B8A6;font-weight:700;text-align:right;">+${u['monthly']:,}/mo</td>
        </tr>
        <tr><td colspan="2" style="padding:0 0 14px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">{u['signal']}</td></tr>"""
        for u in d["upsells"]
    ) or '<tr><td colspan="2" style="padding:14px 0;color:#6b7280;">No expansion signals detected.</td></tr>'

    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" style="width:100%;background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" style="width:640px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(11,31,59,0.08);">
        <tr>
          <td style="background:#0b1f3b;padding:24px 32px;">
            <div style="font-size:13px;letter-spacing:0.2em;color:#F8D210;text-transform:uppercase;font-weight:700;">RetOps · Weekly Digest</div>
            <div style="font-size:13px;color:#ffffffcc;margin-top:4px;">{period['from']} → {period['to']}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="font-family:Georgia,serif;font-size:28px;color:#0b1f3b;margin:0 0 8px 0;line-height:1.2;">Hi {recipient_name}, here's what RetOps caught this week.</h1>
            <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px 0;">
              {k['total_interactions']} interactions scored · {k['accounts_at_risk']} accounts flagged at risk ·
              <strong style="color:#b91c1c;">{arr_fmt(k['arr_at_risk'])}</strong> ARR exposure.
            </p>

            <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:12px 0;margin:0 -12px;">
              <tr>
                <td style="background:#f8fafc;border-radius:12px;padding:16px;width:33%;">
                  <div style="font-size:11px;letter-spacing:0.15em;color:#6b7280;text-transform:uppercase;font-weight:600;">Revenue at risk</div>
                  <div style="font-size:24px;color:#b91c1c;font-weight:700;margin-top:6px;">{arr_fmt(k['arr_at_risk'])}</div>
                </td>
                <td style="background:#f8fafc;border-radius:12px;padding:16px;width:33%;">
                  <div style="font-size:11px;letter-spacing:0.15em;color:#6b7280;text-transform:uppercase;font-weight:600;">Avg QA score</div>
                  <div style="font-size:24px;color:#0b1f3b;font-weight:700;margin-top:6px;">{k['avg_qa_score']}</div>
                </td>
                <td style="background:#f8fafc;border-radius:12px;padding:16px;width:33%;">
                  <div style="font-size:11px;letter-spacing:0.15em;color:#6b7280;text-transform:uppercase;font-weight:600;">AI issues</div>
                  <div style="font-size:24px;color:#0b1f3b;font-weight:700;margin-top:6px;">{k['hallucinations'] + k['policy_fails']}</div>
                </td>
              </tr>
            </table>

            <h2 style="font-family:Georgia,serif;font-size:19px;color:#0b1f3b;margin:32px 0 12px 0;">Top at-risk accounts</h2>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">{at_risk_rows}</table>

            <h2 style="font-family:Georgia,serif;font-size:19px;color:#0b1f3b;margin:32px 0 12px 0;">Coaching priorities</h2>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">{coaching_rows}</table>

            <h2 style="font-family:Georgia,serif;font-size:19px;color:#0b1f3b;margin:32px 0 12px 0;">Expansion signals <span style="color:#14B8A6;">+${k['upsell_monthly']:,}/mo</span></h2>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">{upsell_rows}</table>

            <div style="margin-top:32px;padding:20px;background:#0b1f3b;border-radius:12px;text-align:center;">
              <div style="color:#ffffffcc;font-size:14px;margin-bottom:12px;">See the full Activity History in your dashboard.</div>
              <a href="#" style="display:inline-block;background:#F8D210;color:#0b1f3b;font-weight:700;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;">Open RetOps</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
            RetOps · Revenue intelligence · <a href="#" style="color:#14B8A6;text-decoration:none;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


@api.get("/digest/preview")
async def digest_preview(user: User = Depends(require_user), days: int = 7):
    return await _build_digest(user, days=days)


@api.get("/digest/preview.html")
async def digest_preview_html(user: User = Depends(require_user), days: int = 7):
    d = await _build_digest(user, days=days)
    html = _render_digest_html(d, recipient_name=user.name.split()[0] if user.name else "Leader")
    return Response(content=html, media_type="text/html")


class DigestSubscribeIn(BaseModel):
    subscribed: bool
    email: str = ""


@api.post("/digest/subscribe")
async def digest_subscribe(payload: DigestSubscribeIn, user: User = Depends(require_user)):
    new_settings = user.settings.model_dump()
    new_settings["digest_subscribed"] = payload.subscribed
    if payload.email:
        new_settings["digest_email"] = payload.email
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"settings": new_settings}})
    return {"subscribed": payload.subscribed, "email": new_settings.get("digest_email") or user.email}


@api.post("/digest/send-now")
async def digest_send_now(user: User = Depends(require_user), days: int = 7):
    """Render the digest and record a send event. If RESEND_API_KEY is set, actually emails it."""
    d = await _build_digest(user, days=days)
    recipient_email = user.settings.digest_email or user.email
    html = _render_digest_html(d, recipient_name=user.name.split()[0] if user.name else "Leader")

    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    from_addr = os.environ.get("RESEND_FROM", "RetOps <onboarding@resend.dev>")
    subject = f"RetOps Weekly Digest — {d['period']['from']} to {d['period']['to']}"

    delivery: Dict[str, Any] = {"provider": "none", "status": "logged"}
    if resend_key:
        try:
            async with httpx.AsyncClient(timeout=15) as hc:
                r = await hc.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                    json={"from": from_addr, "to": [recipient_email], "subject": subject, "html": html},
                )
                if r.status_code < 300:
                    delivery = {"provider": "resend", "status": "sent", "id": r.json().get("id")}
                else:
                    delivery = {"provider": "resend", "status": "failed", "error": r.text[:200]}
        except Exception as e:
            delivery = {"provider": "resend", "status": "failed", "error": str(e)[:200]}

    # Always record the event
    await db.digest_sends.insert_one({
        "user_id": user.user_id,
        "email": recipient_email,
        "subject": subject,
        "period": d["period"],
        "kpis": d["kpis"],
        "delivery": delivery,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "status": delivery["status"],
        "delivery": delivery,
        "recipient": recipient_email,
        "subject": subject,
        "kpis": d["kpis"],
    }


@api.get("/digest/history")
async def digest_history(user: User = Depends(require_user), limit: int = 20):
    cur = db.digest_sends.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cur.to_list(limit)


# ---------- Live Executive / Coaching aggregates (for real-data toggle) ----------
@api.get("/executive/churn-analysis")
async def executive_churn_analysis(user: User = Depends(require_user)):
    """Aggregate overall churn stats from real interactions for the Executive View toggle."""
    docs = await db.interactions.find(
        ws_filter(user, {"agent": {"$not": {"$regex": "^TEST_"}}}), {"_id": 0}
    ).to_list(2000)
    accounts = await db.accounts.find(ws_filter(user), {"_id": 0}).to_list(500)

    # Build per-customer latest snapshot
    latest_by_cust: Dict[str, Dict[str, Any]] = {}
    for d in docs:
        c = d["customer"]
        if c not in latest_by_cust or d.get("created_at", "") > latest_by_cust[c].get("created_at", ""):
            latest_by_cust[c] = d

    at_risk = [v for v in latest_by_cust.values() if (v.get("analysis") or {}).get("churn_risk") in ("High", "Medium", "Critical")]
    arr_at_risk = sum(int((v.get("analysis") or {}).get("arr_at_risk", 0) or 0) for v in at_risk)
    total_arr = sum(int(a.get("arr", 0) or 0) for a in accounts) or 1

    churn_count = len([v for v in latest_by_cust.values() if (v.get("analysis") or {}).get("churn_risk") in ("High", "Critical")])
    total_customers = max(len(accounts), len(latest_by_cust)) or 1
    churn_rate = round((churn_count / total_customers) * 100, 1)
    retention_rate = round(100 - churn_rate, 1)

    # Top churn reasons — tally keyword hits across churned interactions
    reasons_map = {"Pricing & Billing Issues": 0, "Poor Customer Support": 0, "Product Limitations": 0, "Competitor Switching": 0, "Technical Issues": 0}
    for d in docs:
        a = d.get("analysis") or {}
        if a.get("churn_risk") not in ("High", "Medium", "Critical"):
            continue
        kws = [k.lower() for k in (a.get("churn_keywords") or []) + [a.get("churn_signal", "")]]
        text = " ".join(kws)
        if any(w in text for w in ("billing", "price", "pricing", "charge", "refund")): reasons_map["Pricing & Billing Issues"] += 1
        if any(w in text for w in ("support", "response", "service")):                   reasons_map["Poor Customer Support"] += 1
        if any(w in text for w in ("feature", "limit", "missing", "slow")):              reasons_map["Product Limitations"] += 1
        if any(w in text for w in ("competitor", "alternative", "switch")):              reasons_map["Competitor Switching"] += 1
        if any(w in text for w in ("bug", "outage", "downtime", "error", "broken")):     reasons_map["Technical Issues"] += 1
    total_reasons = sum(reasons_map.values()) or 1
    top_reasons = [
        {"label": k, "count": v, "pct": round(v / total_reasons * 100)}
        for k, v in sorted(reasons_map.items(), key=lambda x: x[1], reverse=True)
    ]

    # Segments — synthesize from account size buckets on ARR
    segments = {"Enterprise": [], "Mid-Market": [], "Small Business": [], "Startup": []}
    for a in accounts:
        arr = int(a.get("arr", 0) or 0)
        if arr >= 250_000:   segments["Enterprise"].append(a)
        elif arr >= 50_000:  segments["Mid-Market"].append(a)
        elif arr >= 10_000:  segments["Small Business"].append(a)
        else:                segments["Startup"].append(a)
    seg_rows = []
    for name, accs in segments.items():
        if not accs: continue
        risky = sum(1 for a in accs if (latest_by_cust.get(a["name"], {}).get("analysis") or {}).get("churn_risk") in ("High", "Critical"))
        rate = round((risky / len(accs)) * 100, 1)
        seg_rows.append({"segment": name, "total": len(accs), "rate": rate, "delta": round(rate - churn_rate, 1)})

    # Strategic insights derived
    avg_score = 0
    if docs:
        scores = [(d.get("analysis") or {}).get("qa_score", 0) for d in docs]
        avg_score = round(sum(scores) / len(scores), 1)

    return {
        "tiles": {
            "churn_rate_pct": churn_rate,
            "at_risk_customers": len(at_risk),
            "revenue_at_risk": arr_at_risk,
            "retention_rate_pct": retention_rate,
            "arr_exposure_pct": round((arr_at_risk / total_arr) * 100, 1),
        },
        "top_reasons": top_reasons,
        "segments": seg_rows,
        "strategic": {
            "coaching_roi_pct": 340,  # static — needs historical cost data we don't track
            "quality_trend_pct": round(avg_score - 75, 1) if avg_score else 0,
            "efficiency_gain_pct": 28,
        },
    }


@api.get("/coaching/kpis")
async def coaching_kpis(user: User = Depends(require_user)):
    """Live KPIs for the Coaching Hub overview: learners, completion, avg score delta, modules count."""
    agents = await db.agents.find(ws_filter(user), {"_id": 0}).to_list(500)
    interactions = await db.interactions.find(ws_filter(user, {"agent": {"$not": {"$regex": "^TEST_"}}}), {"_id": 0}).to_list(2000)

    active_learners = len(agents)
    # Completion rate — agents with any coaching_card triggered / total agents
    coached = set()
    for d in interactions:
        if ((d.get("analysis") or {}).get("coaching_card") or {}).get("headline"):
            coached.add(d["agent"])
    completion_rate = round((len(coached) / max(active_learners, 1)) * 100)

    # Avg score improvement — compare newest-half vs oldest-half per agent
    by_agent: Dict[str, List[int]] = {}
    for d in sorted(interactions, key=lambda x: x.get("created_at", "")):
        s = (d.get("analysis") or {}).get("qa_score")
        if isinstance(s, (int, float)):
            by_agent.setdefault(d["agent"], []).append(s)
    deltas = []
    for scores in by_agent.values():
        if len(scores) >= 2:
            mid = len(scores) // 2
            deltas.append((sum(scores[mid:]) / max(len(scores) - mid, 1)) - (sum(scores[:mid]) / mid))
    improvement = round(sum(deltas) / len(deltas), 1) if deltas else 0

    modules = max(len({c.get("headline") for d in interactions for c in [(d.get("analysis") or {}).get("coaching_card") or {}] if c.get("headline")}), 0)

    return {
        "active_learners": active_learners,
        "completion_rate_pct": completion_rate,
        "avg_score_improvement": improvement,
        "total_modules": modules,
    }


# ---------- File / Audio upload for interactions ----------
def _extract_text_from_upload(filename: str, content: bytes) -> str:
    """Best-effort transcript extraction from common file types. Raises on binary/garbage."""
    lower = filename.lower()

    def _validate_text(text: str) -> str:
        """Reject garbage: too many null/control chars or UTF-8 replacement chars."""
        if not text:
            raise HTTPException(status_code=422, detail="File appears empty after parsing")
        null_ctrl = sum(1 for c in text if c == "\x00" or (ord(c) < 32 and c not in "\t\r\n"))
        replacements = text.count("\ufffd")
        if len(text) > 0 and (null_ctrl / len(text) > 0.05 or replacements / len(text) > 0.10):
            raise HTTPException(status_code=422, detail="File is not a readable text transcript — please upload a .txt, .md, .csv, .docx, or .pdf")
        return text

    if lower.endswith((".txt", ".md", ".csv", ".json")):
        return _validate_text(content.decode("utf-8", errors="replace"))
    if lower.endswith(".docx"):
        try:
            from io import BytesIO
            from zipfile import ZipFile
            import re as _re
            with ZipFile(BytesIO(content)) as z:
                xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
            return _validate_text(_re.sub(r"<[^>]+>", " ", xml))
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=422, detail="Could not parse .docx file")
    if lower.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            from io import BytesIO
            rdr = PdfReader(BytesIO(content))
            return _validate_text("\n".join((p.extract_text() or "") for p in rdr.pages))
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")
    # Unknown extension — try UTF-8 strict; reject if binary
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File is not a readable text transcript — please upload a .txt, .md, .csv, .docx, or .pdf")
    return _validate_text(text)


@api.post("/interactions/upload-file")
async def upload_interaction_file(
    file: UploadFile = File(...),
    customer: str = Form(""),
    agent: str = Form(""),
    agent_type: str = Form("Human"),
    channel: str = Form("Email"),
    type: str = Form("General"),
    user: User = Depends(require_user),
):
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 25MB)")
    transcript = _extract_text_from_upload(file.filename or "upload.txt", content).strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Could not extract text from file")

    account = await db.accounts.find_one(ws_filter(user, {"name": customer or "Unknown"}), {"_id": 0}) or {}
    arr = account.get("arr", 0)
    analysis = await analyze_interaction(
        transcript=transcript,
        customer_name=customer or "Unknown",
        agent_name=agent or "Unknown",
        agent_type=agent_type,
        channel=channel,
        account_arr=arr,
        provider=user.settings.llm_provider,
        model=user.settings.llm_model,
        api_key=user.settings.custom_api_key or None,
    )
    doc = {
        "interaction_id": f"int_{uuid.uuid4().hex[:10]}",
        "customer": customer or "Unknown", "agent": agent or "Unknown",
        "agent_type": agent_type, "channel": channel, "type": type,
        "duration_sec": 0, "transcript": transcript[:50000],
        "analysis": analysis, **ws_stamp(user),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": f"file:{file.filename}",
    }
    await db.interactions.insert_one(doc)
    doc.pop("_id", None)
    return _serialize_interaction(doc)


@api.post("/interactions/upload-audio")
async def upload_interaction_audio(
    file: UploadFile = File(...),
    customer: str = Form(""),
    agent: str = Form(""),
    agent_type: str = Form("Human"),
    channel: str = Form("Voice"),
    user: User = Depends(require_user),
):
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio too large (max 25MB)")

    # RetOps-managed transcription (OpenAI Whisper via universal key — product-facing: "RetOps Transcription")
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        from io import BytesIO
        stt = OpenAISpeechToText(api_key=os.environ["EMERGENT_LLM_KEY"])
        buf = BytesIO(content)
        buf.name = file.filename or "audio.webm"
        resp = await stt.transcribe(file=buf, model="whisper-1", response_format="text")
        transcript = str(resp).strip() if not hasattr(resp, "text") else resp.text.strip()
    except Exception as e:
        logger.exception("Transcription failed")
        # Sanitize vendor/upstream noise — never leak provider names
        msg = str(e)
        for leak in ("OpenAI", "openai", "litellm", "LiteLLM", "Emergent", "emergent", "Anthropic", "Gemini"):
            msg = msg.replace(leak, "provider")
        # Keep only a short tail
        tail = msg.split(":")[-1].strip()[:120] or "audio could not be transcribed"
        raise HTTPException(status_code=502, detail=f"RetOps transcription failed: {tail}")

    if not transcript:
        raise HTTPException(status_code=422, detail="Transcription returned empty text")

    account = await db.accounts.find_one(ws_filter(user, {"name": customer or "Unknown"}), {"_id": 0}) or {}
    arr = account.get("arr", 0)
    analysis = await analyze_interaction(
        transcript=transcript,
        customer_name=customer or "Unknown",
        agent_name=agent or "Unknown",
        agent_type=agent_type,
        channel=channel,
        account_arr=arr,
        provider=user.settings.llm_provider,
        model=user.settings.llm_model,
        api_key=user.settings.custom_api_key or None,
    )
    doc = {
        "interaction_id": f"int_{uuid.uuid4().hex[:10]}",
        "customer": customer or "Unknown", "agent": agent or "Unknown",
        "agent_type": agent_type, "channel": channel, "type": "Voice call",
        "duration_sec": 0, "transcript": transcript[:50000],
        "analysis": analysis, **ws_stamp(user),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "audio:whisper-1",
    }
    await db.interactions.insert_one(doc)
    doc.pop("_id", None)
    return _serialize_interaction(doc)


# ---------- Bulk upload / scoring ----------
CLIENT_PRESETS = {
    "urban_flavours_delivery": (
        "Client: Urban Flavours Delivery — licensed cannabis delivery (flower, vapes, edibles, concentrates, pre-rolls). "
        "Regulated adult-use market. Agents are dispatchers, budtenders, or support reps. "
        "Compliance is critical — score a HARD FAIL when the agent: "
        "(a) does not verify the customer is 21+ or medical-card status, "
        "(b) delivers without confirming a government-issued ID at door, "
        "(c) recommends cannabis for a specific medical condition (prohibited health claim), "
        "(d) ships out of license area, "
        "(e) offers 'first-time' discount without confirming eligibility. "
        "Churn signals: slow delivery, wrong order, stale product, missing freebies, competitor mentions like 'Eaze', 'Grassdoor', 'SaveOnCannabis'. "
        "Revenue at risk is per-customer LTV, not enterprise ARR."
    ),
    "default": "",
}


@api.get("/bulk/presets")
async def list_presets(user: User = Depends(require_user)):
    """Returns built-in + user-defined presets scoped to the user's workspace."""
    custom = await db.client_presets.find(ws_filter(user), {"_id": 0}).to_list(100)
    builtin = [
        {"id": "default", "label": "General support", "desc": "Standard QA rubric — any industry", "builtin": True},
        {"id": "urban_flavours_delivery", "label": "Urban Flavours Delivery", "desc": "Cannabis delivery · 21+ verification · compliance-first", "builtin": True},
    ]
    return {"builtin": builtin, "custom": custom}


class PresetIn(BaseModel):
    id: str
    label: str
    desc: str = ""
    context: str


@api.post("/bulk/presets")
async def create_preset(payload: PresetIn, user: User = Depends(require_user)):
    pid = payload.id.strip().lower().replace(" ", "_")
    if not pid or pid in CLIENT_PRESETS:
        raise HTTPException(status_code=400, detail="Preset ID is reserved or invalid")
    existing = await db.client_presets.find_one(ws_filter(user, {"id": pid}))
    doc = {
        "id": pid, "label": payload.label.strip(), "desc": payload.desc.strip(),
        "context": payload.context.strip(), "builtin": False,
        "created_by": user.user_id,
        **ws_stamp(user),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if existing:
        await db.client_presets.update_one(ws_filter(user, {"id": pid}), {"$set": doc})
    else:
        await db.client_presets.insert_one(doc)
    return {"id": pid, "label": doc["label"], "desc": doc["desc"], "builtin": False}


@api.delete("/bulk/presets/{pid}")
async def delete_preset(pid: str, user: User = Depends(require_user)):
    await db.client_presets.delete_one(ws_filter(user, {"id": pid}))
    return {"ok": True}


async def _resolve_preset_context(preset_id: str, user: Optional[User] = None) -> str:
    if preset_id in CLIENT_PRESETS:
        return CLIENT_PRESETS[preset_id]
    q = ws_filter(user, {"id": preset_id}) if user else {"id": preset_id}
    custom = await db.client_presets.find_one(q, {"_id": 0})
    return (custom or {}).get("context", "")


def _split_bulk_transcripts(raw: str) -> List[Dict[str, str]]:
    """Split a blob of transcripts. Supports:
       - Multi-file uploads (frontend joins files with `# FILE: <name>\n...\n===\n`)
       - CSV with columns transcript/customer/agent/channel (or text)
       - JSONL { transcript, customer?, agent?, channel? }
       - Plain text separated by markers like '===', '---', '### ', 'Transcript N:'
    """
    raw = raw.strip()
    if not raw:
        return []

    # Multi-file bundle — split ONLY on `===` boundaries to respect file edges.
    # Frontend uses `# FILE: <name>\n<content>\n\n===\n\n# FILE: <name>\n...`
    if "# FILE:" in raw and "\n===\n" in raw:
        import re as _re
        chunks = _re.split(r"\n\s*===\s*\n", raw)
        out = []
        for ch in chunks:
            ch = ch.strip()
            if not ch or len(ch) < 30:
                continue
            # Pull filename (often contains customer name) so the LLM extractor can use it
            m = _re.match(r"#\s*FILE:\s*([^\n]+)\n(.*)", ch, _re.DOTALL)
            if m:
                fname, body = m.group(1).strip(), m.group(2).strip()
                out.append({"transcript": body, "customer": "", "agent": "", "channel": "Chat", "filename": fname})
            else:
                out.append({"transcript": ch, "customer": "", "agent": "", "channel": "Chat"})
        if out:
            return out

    # JSONL
    if raw.startswith("{") or "\n{" in raw[:200]:
        out = []
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict) and (obj.get("transcript") or obj.get("text")):
                    out.append({
                        "transcript": obj.get("transcript") or obj.get("text"),
                        "customer": obj.get("customer", ""),
                        "agent": obj.get("agent", ""),
                        "channel": obj.get("channel", "Chat"),
                    })
            except Exception:
                pass
        if out:
            return out

    # CSV
    if "," in raw.splitlines()[0] and "\n" in raw:
        try:
            import csv
            from io import StringIO
            reader = csv.DictReader(StringIO(raw))
            out = []
            for row in reader:
                t = row.get("transcript") or row.get("text") or row.get("message") or ""
                if t:
                    out.append({
                        "transcript": t,
                        "customer": row.get("customer", "") or row.get("client", ""),
                        "agent": row.get("agent", "") or row.get("rep", ""),
                        "channel": row.get("channel", "Chat"),
                    })
            if out:
                return out
        except Exception:
            pass

    # Text — split on common separators
    import re as _re
    parts = _re.split(r"\n\s*(?:===+|---+|\*\*\*+|###\s+|Transcript\s*\d*[:\-]|Chat\s*\d*[:\-]|Conversation\s*\d*[:\-])\s*\n", raw, flags=_re.IGNORECASE)
    parts = [p.strip() for p in parts if p.strip() and len(p.strip()) > 30]
    return [{"transcript": p, "customer": "", "agent": "", "channel": "Chat"} for p in parts]


_SPEAKER_LINE_RX = re.compile(
    r"^\s*(?P<role>customer|client|caller|user|member|patient|guest|buyer|agent|rep|advisor|support|csr|associate|bot|assistant)\s*"
    r"(?:\(([^)]+)\))?\s*[:\-]\s*",
    re.IGNORECASE | re.MULTILINE,
)

_NAME_IN_LABEL_RX = re.compile(
    r"^\s*(?P<name>[A-Z][a-zA-Z\-\.']{1,24}(?:\s+[A-Z][a-zA-Z\-\.']{1,24})?)\s*\((?P<role>customer|client|caller|user|agent|rep|advisor|support)\)\s*[:\-]",
    re.IGNORECASE | re.MULTILINE,
)

_ROLE_THEN_NAME_RX = re.compile(
    r"^\s*(?P<role>customer|client|caller|user|agent|rep|advisor|support|csr|associate)\s*\(\s*(?P<name>[A-Z][a-zA-Z\-\.']{1,24}(?:\s+[A-Z][a-zA-Z\-\.']{1,24})?(?:\s+[A-Z]\.?)?)\s*\)\s*[:\-]",
    re.IGNORECASE | re.MULTILINE,
)


def _heuristic_names_from_transcript(transcript: str) -> Dict[str, str]:
    """Cheap regex fallback that catches speaker labels like `John (Customer):` / `Customer (Jenna M.):` /
    `Agent: Sarah` / `Rep: Tyler —`. Returns best-effort rep_name + customer_name (empty if not found)."""
    rep, cust = "", ""
    text = transcript[:6000]
    # Pattern A: "Name (Role):"
    for m in _NAME_IN_LABEL_RX.finditer(text):
        role = m.group("role").lower()
        name = m.group("name").strip()
        if role in ("customer", "client", "caller", "user") and not cust:
            cust = name
        if role in ("agent", "rep", "advisor", "support") and not rep:
            rep = name
        if rep and cust:
            break
    # Pattern A': "Role (Name):" — inverted
    if not (rep and cust):
        for m in _ROLE_THEN_NAME_RX.finditer(text):
            role = m.group("role").lower()
            name = m.group("name").strip()
            if role in ("customer", "client", "caller", "user") and not cust:
                cust = name
            if role in ("agent", "rep", "advisor", "support", "csr", "associate") and not rep:
                rep = name
            if rep and cust:
                break
    # Pattern B: "Rep: Tyler" / "Agent: Sarah"  — restrict to same-line match (space/tab between 2 words, not newlines)
    if not rep:
        m = re.search(r"(?:^|\n)[ \t]*(?:agent|rep|advisor|support|csr|associate)[ \t]*[:\-][ \t]*([A-Z][a-zA-Z\-\.']{1,24}(?:[ \t]+[A-Z][a-zA-Z\-\.']{1,24})?)[ \t]*(?=$|\n|[.,\-—|])", text, re.IGNORECASE | re.MULTILINE)
        if m: rep = m.group(1).strip()
    if not cust:
        m = re.search(r"(?:^|\n)[ \t]*(?:customer|client|caller|user|member)[ \t]*[:\-][ \t]*([A-Z][a-zA-Z\-\.']{1,24}(?:[ \t]+[A-Z][a-zA-Z\-\.']{1,24})?)[ \t]*(?=$|\n|[.,\-—|])", text, re.IGNORECASE | re.MULTILINE)
        if m: cust = m.group(1).strip()
    # Pattern C: "This is Sarah from support" / "my name is Tyler"
    if not rep:
        m = re.search(r"(?:this is|my name is|i['']?m)\s+([A-Z][a-zA-Z\-\.']{1,24})(?:\s+(?:from|with|at|on))?", text)
        if m: rep = m.group(1).strip()
    return {"rep_name": rep, "customer_name": cust}


def _customer_from_filename(fname: str) -> str:
    """Derive a customer/account guess from the uploaded transcript filename.
    Example: 'acme-corp_2024-03-14.txt' → 'Acme Corp'."""
    if not fname:
        return ""
    import os as _os
    base = _os.path.splitext(_os.path.basename(fname))[0]
    # Strip common date / number tails
    base = re.sub(r"[_\- ](?:\d{1,4}[\-_]?){2,}.*$", "", base)
    base = re.sub(r"[_\- ]?(?:transcript|chat|call|ticket|interaction|convo)s?$", "", base, flags=re.IGNORECASE)
    base = re.sub(r"[_\-]+", " ", base).strip()
    if not base or len(base) < 2:
        return ""
    return " ".join(w.capitalize() if w.islower() else w for w in base.split())


async def _infer_rep_and_customer(transcript: str, filename: str = "") -> Dict[str, str]:
    """Extract rep + customer + channel + 1-line summary from a transcript.
    Strategy (best → fallback):
      1. Cheap regex heuristics on speaker labels / name mentions.
      2. LLM call (gpt-4o — upgraded from gpt-4o-mini for sharper accuracy) with
         richer prompt including filename context.
      3. Filename-derived customer guess if LLM still returns 'Unknown'.
    """
    # Start with regex heuristics (free + fast)
    heur = _heuristic_names_from_transcript(transcript)
    file_cust_guess = _customer_from_filename(filename)

    llm_result = {}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"extract-{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are an expert at parsing support conversation transcripts. "
                "You identify the exact speaker names (agent/rep vs customer/caller), "
                "the communication channel, and summarize the interaction in one sentence. "
                "Return STRICT JSON only — no prose, no markdown fences."
            ),
        ).with_model("openai", "gpt-4o")  # upgraded for sharper extraction
        hint_lines = []
        if filename:
            hint_lines.append(f"Source filename: {filename}")
            if file_cust_guess:
                hint_lines.append(f"Possible customer/account from filename: {file_cust_guess}")
        if heur.get("rep_name"):
            hint_lines.append(f"Regex detected possible REP: {heur['rep_name']}")
        if heur.get("customer_name"):
            hint_lines.append(f"Regex detected possible CUSTOMER: {heur['customer_name']}")
        hints = ("\n".join(hint_lines) + "\n\n") if hint_lines else ""
        prompt = (
            f"{hints}From the transcript below, extract:\n"
            "• rep_name — the support AGENT/REP's full name. Look for speaker labels like "
            "'Agent:', 'Rep: Tyler', 'Sarah (Support):', or intros like 'This is Jessica from …'. "
            "If multiple candidates exist, pick the one who SENDS answers to the customer. "
            "If genuinely not named, use 'Unknown Rep'.\n"
            "• customer_name — the END-CUSTOMER's name or account. Look for 'Customer:', 'Jenna M.:', "
            "an email signature, an account label, or the filename hint. "
            "If genuinely anonymous, use 'Customer-<2-digit-hash>'.\n"
            "• channel — one of 'Chat' / 'Voice' / 'Email' / 'Ticket' (infer from format — timestamps + turns = Chat, "
            "'Subject:' header = Email, ticket IDs = Ticket, otherwise Chat).\n"
            "• one_line_summary — <18 words, describe the customer's ask and the outcome.\n\n"
            'Return ONLY: {"rep_name":"…","customer_name":"…","channel":"…","one_line_summary":"…"}\n\n'
            f"Transcript:\n---\n{transcript[:6000]}\n---"
        )
        raw = (await chat.send_message(UserMessage(text=prompt))).strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"): raw = raw[4:]
            raw = raw.strip()
        start, end = raw.find("{"), raw.rfind("}")
        if start >= 0 and end > start:
            raw = raw[start:end+1]
        llm_result = json.loads(raw)
    except Exception as e:
        logger.warning(f"LLM extraction failed, falling back to heuristics: {e}")

    # Merge: prefer regex if LLM returned the generic 'Unknown'
    rep_llm = (llm_result.get("rep_name") or "").strip()
    cust_llm = (llm_result.get("customer_name") or "").strip()
    rep_final = rep_llm if rep_llm and rep_llm.lower() not in ("unknown", "unknown rep", "agent", "rep", "n/a") else (heur.get("rep_name") or "Unknown Rep")
    cust_final = cust_llm if cust_llm and cust_llm.lower() not in ("unknown", "customer", "n/a") else (heur.get("customer_name") or file_cust_guess or f"Customer-{uuid.uuid4().hex[:2].upper()}")

    return {
        "rep_name": rep_final[:60],
        "customer_name": cust_final[:60],
        "channel": (llm_result.get("channel") or "Chat")[:20],
        "summary": (llm_result.get("one_line_summary") or "")[:200],
    }


class BulkUploadIn(BaseModel):
    content: str = ""
    client_preset: str = "default"
    default_customer: str = ""
    default_agent: str = ""
    agent_type: str = "Human"


@api.post("/interactions/bulk-upload")
async def bulk_upload(payload: BulkUploadIn, user: User = Depends(require_user)):
    """Accepts JSON {content, client_preset, ...}. Splits, identifies rep + customer via LLM,
    scores each, returns per-rep and per-customer aggregates."""
    content = payload.content
    client_preset = payload.client_preset
    default_customer = payload.default_customer
    default_agent = payload.default_agent
    agent_type = payload.agent_type
    if not content.strip():
        raise HTTPException(status_code=400, detail="No content provided")
    return await _run_bulk(content, client_preset, default_customer, default_agent, agent_type, user)


@api.post("/interactions/bulk-upload-file")
async def bulk_upload_file(
    file: UploadFile = File(...),
    client_preset: str = Form("default"),
    default_customer: str = Form(""),
    default_agent: str = Form(""),
    agent_type: str = Form("Human"),
    user: User = Depends(require_user),
):
    raw_bytes = await file.read()
    if len(raw_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Bulk file too large (max 10MB)")
    content = raw_bytes.decode("utf-8", errors="replace")
    if "\ufffd" in content and content.count("\ufffd") / max(len(content), 1) > 0.1:
        raise HTTPException(status_code=422, detail="File is not readable text — please upload .csv, .jsonl, or .txt")
    return await _run_bulk(content, client_preset, default_customer, default_agent, agent_type, user)


async def _run_bulk(content: str, client_preset: str, default_customer: str, default_agent: str, agent_type: str, user: User):
    chunks = _split_bulk_transcripts(content)
    if not chunks:
        raise HTTPException(status_code=422, detail="Could not split content into transcripts — check your format")
    if len(chunks) > 500:
        raise HTTPException(status_code=413, detail=f"Too many transcripts in one upload ({len(chunks)} detected, max 500). Split into multiple batches.")

    ctx = await _resolve_preset_context(client_preset)
    # Label: built-in override, custom preset label, or fallback
    if client_preset == "urban_flavours_delivery":
        client_label = "Urban Flavours Delivery"
    elif client_preset != "default":
        p = await db.client_presets.find_one(ws_filter(user, {"id": client_preset}), {"_id": 0})
        client_label = (p or {}).get("label", default_customer or "Bulk Upload")
    else:
        client_label = default_customer or "Bulk Upload"

    # Process in parallel (bounded)
    import asyncio as _aio

    async def _score_one(i: int, chunk: Dict[str, str]) -> Dict[str, Any]:
        try:
            extracted = await _infer_rep_and_customer(chunk["transcript"], chunk.get("filename", ""))
            rep = chunk.get("agent") or extracted["rep_name"] or default_agent or "Unknown Rep"
            cust = chunk.get("customer") or extracted["customer_name"] or default_customer or f"Customer-{i+1:02d}"
            channel = chunk.get("channel") or extracted["channel"] or "Chat"

            analysis = await analyze_interaction(
                transcript=chunk["transcript"],
                customer_name=cust,
                agent_name=rep,
                agent_type=agent_type,
                channel=channel,
                account_arr=0,
                provider=user.settings.llm_provider,
                model=user.settings.llm_model,
                api_key=user.settings.custom_api_key or None,
                client_context=ctx,
            )
            doc = {
                "interaction_id": f"int_{uuid.uuid4().hex[:10]}",
                "customer": cust, "agent": rep, "agent_type": agent_type,
                "channel": channel, "type": "Bulk upload",
                "duration_sec": 0, "transcript": chunk["transcript"][:50000],
                "analysis": analysis,
                **ws_stamp(user),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "source": f"bulk:{client_preset}",
                "client_label": client_label,
                "bulk_summary": extracted.get("summary", ""),
            }
            await db.interactions.insert_one(doc)
            doc.pop("_id", None)
            return doc
        except Exception as e:
            logger.exception("bulk score failed")
            return {"error": str(e)[:200], "index": i}

    # Bounded concurrency so we don't hammer the LLM
    sem = _aio.Semaphore(5)
    async def _bounded(i, c):
        async with sem:
            return await _score_one(i, c)

    results = await _aio.gather(*[_bounded(i, c) for i, c in enumerate(chunks)])
    scored = [r for r in results if "error" not in r]
    errors = [r for r in results if "error" in r]

    batch_id = f"bulk_{uuid.uuid4().hex[:8]}"
    # Persist the batch so it can be shared
    await db.bulk_batches.insert_one({
        "batch_id": batch_id,
        "client_label": client_label,
        "client_preset": client_preset,
        "total": len(chunks),
        "scored": len(scored),
        "interaction_ids": [r["interaction_id"] for r in scored],
        "created_by": user.user_id,
        **ws_stamp(user),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Aggregate per rep
    rep_map: Dict[str, Dict[str, Any]] = {}
    for r in scored:
        rep = r["agent"]
        s = (r.get("analysis") or {}).get("qa_score", 0)
        e = rep_map.setdefault(rep, {"rep": rep, "count": 0, "sum": 0, "fails": 0, "avg": 0, "cards": 0})
        e["count"] += 1
        e["sum"] += float(s) if isinstance(s, (int, float)) else 0
        if (r["analysis"] or {}).get("qa_status") == "below_threshold": e["fails"] += 1
        if ((r["analysis"] or {}).get("coaching_card") or {}).get("headline"): e["cards"] += 1
    for e in rep_map.values():
        e["avg"] = round(e["sum"] / max(e["count"], 1), 1)
        e.pop("sum", None)
    rep_leaderboard = sorted(rep_map.values(), key=lambda x: x["avg"])

    # Aggregate per customer (churn risk)
    cust_map: Dict[str, Dict[str, Any]] = {}
    for r in scored:
        c = r["customer"]
        a = r.get("analysis") or {}
        e = cust_map.setdefault(c, {
            "customer": c, "interactions": 0, "avg_score": 0, "sum": 0,
            "churn_risk": "Low", "max_risk_level": 0, "signals": [], "last_interaction": r["interaction_id"],
        })
        e["interactions"] += 1
        e["sum"] += float(a.get("qa_score", 0) or 0)
        order = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
        cur = order.get(a.get("churn_risk", "Low"), 0)
        if cur >= e["max_risk_level"]:
            e["max_risk_level"] = cur
            e["churn_risk"] = a.get("churn_risk", "Low")
        if a.get("churn_signal"): e["signals"].append(a["churn_signal"])
    for e in cust_map.values():
        e["avg_score"] = round(e["sum"] / max(e["interactions"], 1), 1)
        e["signals"] = list(set(e["signals"]))[:3]
        e.pop("sum", None)
        e.pop("max_risk_level", None)
    cust_churn = sorted(cust_map.values(), key=lambda x: (-{"Low":0,"Medium":1,"High":2,"Critical":3}[x["churn_risk"]], x["avg_score"]))

    total_fails = sum(1 for r in scored if (r["analysis"] or {}).get("qa_status") == "below_threshold")
    total_at_risk = sum(1 for r in scored if (r["analysis"] or {}).get("churn_risk") in ("High", "Critical"))

    return {
        "batch_id": batch_id,
        "client_label": client_label,
        "client_preset": client_preset,
        "total": len(chunks),
        "scored": len(scored),
        "errors": errors,
        "summary": {
            "avg_score": round(sum((r["analysis"] or {}).get("qa_score", 0) for r in scored) / max(len(scored), 1), 1),
            "below_threshold": total_fails,
            "at_risk_interactions": total_at_risk,
            "unique_reps": len(rep_map),
            "unique_customers": len(cust_map),
        },
        "rep_leaderboard": rep_leaderboard,
        "customer_churn": cust_churn,
        "interactions": [
            {"interaction_id": r["interaction_id"], "agent": r["agent"], "customer": r["customer"],
             "qa_score": (r["analysis"] or {}).get("qa_score"), "churn_risk": (r["analysis"] or {}).get("churn_risk"),
             "summary": r.get("bulk_summary", "")}
            for r in scored
        ],
    }


# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "retops-api", "status": "ok"}


# ---------- Attach ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup_backfill_workspace():
    """Backfill legacy documents without workspace_id into the default workspace.
    Safe to run on every boot — only touches docs where `workspace_id` is missing."""
    for coll in ("interactions", "accounts", "agents", "client_presets", "bulk_batches", "playbook_shares", "users"):
        try:
            res = await db[coll].update_many(
                {"workspace_id": {"$exists": False}},
                {"$set": {"workspace_id": "ws_default"}},
            )
            if res.modified_count:
                logger.info(f"[ws-backfill] {coll}: backfilled {res.modified_count} docs → ws_default")
        except Exception as e:
            logger.warning(f"[ws-backfill] {coll} failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
