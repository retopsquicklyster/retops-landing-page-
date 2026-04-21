"""RetOps backend - FastAPI server with Emergent Google Auth + LLM-powered QA scoring."""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from llm_service import analyze_interaction, DEFAULT_PROVIDER, DEFAULT_MODEL
from seed_data import build_seed_payload


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


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    role: str = "admin"
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
    return User(**user_doc)


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
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": datetime.now(timezone.utc).isoformat()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "admin",
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


@api.get("/settings")
async def get_settings(user: User = Depends(require_user)):
    return user.settings.model_dump()


@api.put("/settings")
async def put_settings(payload: SettingsIn, user: User = Depends(require_user)):
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"settings": payload.model_dump()}},
    )
    return payload.model_dump()


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
    limit: int = 200,
):
    query: Dict[str, Any] = {}
    if churn_risk:
        query["analysis.churn_risk"] = churn_risk
    if agent_type:
        query["agent_type"] = agent_type
    cur = db.interactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = [_serialize_interaction(d) async for d in cur]
    return items


@api.get("/interactions/{interaction_id}")
async def get_interaction(interaction_id: str, user: User = Depends(require_user)):
    doc = await db.interactions.find_one({"interaction_id": interaction_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return _serialize_interaction(doc)


@api.post("/interactions")
async def create_interaction(payload: InteractionCreate, user: User = Depends(require_user)):
    account = await db.accounts.find_one({"name": payload.customer}, {"_id": 0})
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.interactions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/interactions/{interaction_id}/rescore")
async def rescore(interaction_id: str, user: User = Depends(require_user)):
    doc = await db.interactions.find_one({"interaction_id": interaction_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    account = await db.accounts.find_one({"name": doc["customer"]}, {"_id": 0})
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
        {"interaction_id": interaction_id}, {"$set": {"analysis": analysis}}
    )
    doc["analysis"] = analysis
    return _serialize_interaction(doc)


# ---------- Accounts ----------
@api.get("/accounts")
async def list_accounts(user: User = Depends(require_user)):
    docs = await db.accounts.find({}, {"_id": 0}).to_list(500)
    # Enrich with churn risk from latest interaction
    for acc in docs:
        last = await db.interactions.find_one(
            {"customer": acc["name"]}, {"_id": 0}, sort=[("created_at", -1)]
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
    agents = await db.agents.find({}, {"_id": 0}).to_list(500)
    # Compute per-agent metrics
    out = []
    for a in agents:
        cur = db.interactions.find({"agent": a["name"]}, {"_id": 0})
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
    total = await db.interactions.count_documents({})
    today_cut = datetime.now(timezone.utc) - timedelta(days=1)
    today = await db.interactions.count_documents({"created_at": {"$gte": today_cut.isoformat()}})
    all_docs = await db.interactions.find({}, {"_id": 0}).to_list(2000)
    avg_score = round(sum(d["analysis"].get("qa_score", 0) for d in all_docs) / max(1, len(all_docs)), 1)
    agents = await db.agents.count_documents({})
    accounts = await db.accounts.find({}, {"_id": 0}).to_list(500)
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
    }


# ---------- Coaching ----------
@api.get("/coaching")
async def coaching_list(user: User = Depends(require_user)):
    docs = await db.interactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
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
            "created_at": d.get("created_at"),
        })
    return out


# ---------- Churn save playbook ----------
@api.get("/playbooks/account/{customer}")
async def account_playbook(customer: str, user: User = Depends(require_user)):
    last = await db.interactions.find_one(
        {"customer": customer}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if not last:
        raise HTTPException(status_code=404, detail="No interactions for account")
    account = await db.accounts.find_one({"name": customer}, {"_id": 0}) or {}
    return {
        "customer": customer,
        "arr": account.get("arr", 0),
        "churn_risk": last["analysis"].get("churn_risk", "Low"),
        "arr_at_risk": last["analysis"].get("arr_at_risk", 0),
        "latest_interaction_id": last["interaction_id"],
        "signal": last["analysis"].get("churn_signal", ""),
        "save_playbook": last["analysis"].get("save_playbook") or {},
    }


# ---------- Demo seed ----------
@api.post("/seed-demo")
async def seed_demo(force: bool = False, user: User = Depends(require_user)):
    existing_count = await db.interactions.count_documents({})
    if existing_count > 0 and not force:
        return {"status": "already-seeded", "interactions": existing_count}

    if force:
        await db.interactions.delete_many({})
        await db.accounts.delete_many({})
        await db.agents.delete_many({})

    payload = build_seed_payload()
    await db.accounts.insert_many([{**a} for a in payload["accounts"]])
    await db.agents.insert_many([{**a} for a in payload["agents"]])

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
            "created_at": created_at.isoformat(),
        }
        await db.interactions.insert_one(doc)
        created.append(doc["interaction_id"])

    return {"status": "seeded", "interactions": len(created), "ids": created}


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
