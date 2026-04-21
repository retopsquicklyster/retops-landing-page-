"""RetOps scoring engine — bulletproof MVP per spec.

QA rubric (6-dim, 0–100 per criterion):
  greeting (10), active_listening (20), problem_solving (25),
  empathy (15), resolution (20), closing (10)

QA banding:
  90+ Excellent · 75–89 Good · 60–74 Watch · <60 Fail (below_threshold)

Hard-fail gates (cap qa_score at 59, set qa_status=below_threshold, create alert):
  compliance_violation, unsupported_promise, identity_verification_skipped,
  pii_exposure, threatening_abusive, hallucinated_policy

Churn risk (0–100 additive):
  cancellation_intent +35, competitor_mention +15, billing_dispute_or_refund +15,
  repeat_contact_same_issue +15, negative_sentiment_streak +10,
  high_customer_effort +10, contract_or_renewal_inquiry +10,
  escalation_tone_shift +10, resolution_failed +10, agent_policy_miss +10,
  unsupported_ai_claim +15, prior_save_attempt_failed +20

Risk levels: 0-24 Low · 25-49 Medium · 50-74 High · 75-100 Critical
Escalation: >50 team lead · >75 retention agent · >90 emergency

Revenue at risk = ARR * (churn_risk_score / 100). Only displayed when
risk_score >= 25 AND at least 1 signal matched.
"""

import os
import json
import uuid
import logging
import re
from typing import Optional, List, Dict, Any

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

DEFAULT_PROVIDER = "openai"
DEFAULT_MODEL = "gpt-4o-mini"

RUBRIC_WEIGHTS: Dict[str, int] = {
    "greeting": 10,
    "active_listening": 20,
    "problem_solving": 25,
    "empathy": 15,
    "resolution": 20,
    "closing": 10,
}
RUBRIC_LABELS: Dict[str, str] = {
    "greeting": "Greeting",
    "active_listening": "Active listening",
    "problem_solving": "Problem solving",
    "empathy": "Empathy",
    "resolution": "Resolution",
    "closing": "Closing",
}

CHURN_SIGNAL_WEIGHTS: Dict[str, int] = {
    "cancellation_intent": 35,
    "competitor_mention": 15,
    "billing_dispute_or_refund": 15,
    "repeat_contact_same_issue": 15,
    "negative_sentiment_streak": 10,
    "high_customer_effort": 10,
    "contract_or_renewal_inquiry": 10,
    "escalation_tone_shift": 10,
    "resolution_failed": 10,
    "agent_policy_miss": 10,
    "unsupported_ai_claim": 15,
    "prior_save_attempt_failed": 20,
}
CHURN_SIGNAL_LABELS: Dict[str, str] = {
    "cancellation_intent": "Cancellation intent",
    "competitor_mention": "Competitor mention",
    "billing_dispute_or_refund": "Billing dispute / refund",
    "repeat_contact_same_issue": "Repeat contact (same issue)",
    "negative_sentiment_streak": "Negative sentiment streak",
    "high_customer_effort": "High customer effort",
    "contract_or_renewal_inquiry": "Contract / renewal inquiry",
    "escalation_tone_shift": "Escalation tone shift",
    "resolution_failed": "Resolution failed",
    "agent_policy_miss": "Agent policy miss",
    "unsupported_ai_claim": "Unsupported AI claim",
    "prior_save_attempt_failed": "Prior save attempt failed",
}

# Keyword library for churn signal detection (used by fallback scorer + prompt examples)
KEYWORDS: Dict[str, List[str]] = {
    "cancellation_intent": [
        "cancel my account", "want to cancel", "i'm cancelling", "i am canceling",
        "close my account", "disconnect my service", "terminate service",
        "end my contract", "stop service", "not renewing", "i'm leaving",
        "i'm switching", "port out", "moving providers", "moving to another provider",
    ],
    "competitor_mention": [
        "looking at alternatives", "exploring alternatives", "shopping around",
        "comparing providers", "competitor", "another provider", "better offer",
        "better deal elsewhere", "other company offered", "thinking of switching",
    ],
    "billing_dispute_or_refund": [
        "overcharged", "billed wrong", "bill is wrong", "charge is wrong",
        "double charged", "refund", "credit my account", "billing dispute",
        "dispute this charge", "hidden fee", "unexpected fee", "price increase",
        "too expensive", "cannot afford",
    ],
    "repeat_contact_same_issue": [
        "called before", "contacted before", "third time", "still not fixed",
        "not resolved", "same issue again", "keeps happening", "nobody helped",
        "still waiting", "issue is ongoing", "unresolved", "already explained",
    ],
    "high_customer_effort": [
        "had to repeat myself", "transferred again", "bounced around",
        "called multiple times", "nobody owns this", "had to call back",
        "wasted my time", "spent hours on this", "no callback",
        "promised callback never happened",
    ],
    "contract_or_renewal_inquiry": [
        "contract end", "renewal", "renew", "cancellation fee", "termination fee",
        "month to month", "downgrade", "reduce plan", "lower plan",
        "remove features", "cheaper plan",
    ],
    "escalation_tone_shift": [
        "supervisor", "manager", "escalate", "escalation", "complaint",
        "formal complaint", "ombudsman", "regulator", "ccts", "bbb", "lawyer",
        "lawsuit", "unacceptable", "ridiculous", "terrible", "furious",
        "done with this",
    ],
    "negative_sentiment_streak": [
        "frustrated", "upset", "angry", "disappointed", "fed up", "worst",
        "awful", "unbelievable", "never again", "enough is enough",
    ],
}


SYSTEM_PROMPT = """You are the RetOps scoring engine. You analyze ONE customer support interaction and return STRICT JSON ONLY — no markdown, no prose, no code fences.

QA RUBRIC — score each criterion 0-100:
  - greeting (weight 10)
  - active_listening (weight 20)
  - problem_solving (weight 25)
  - empathy (weight 15)
  - resolution (weight 20)
  - closing (weight 10)
Weighted qa_score = sum(criterion_score * weight) / 100.
qa_status: "excellent" (>=90), "good" (>=75), "watch" (>=60), "below_threshold" (<60).

HARD-FAIL GATES — if ANY of these are true, cap qa_score at 59, qa_status="below_threshold", set compliance.has_violation=true:
  compliance_violation, unsupported_promise, identity_verification_skipped,
  pii_exposure, threatening_abusive, hallucinated_policy.

CHURN SIGNAL WEIGHTS (0-100 additive, capped at 100):
  cancellation_intent +35, competitor_mention +15, billing_dispute_or_refund +15,
  repeat_contact_same_issue +15, negative_sentiment_streak +10,
  high_customer_effort +10, contract_or_renewal_inquiry +10,
  escalation_tone_shift +10, resolution_failed +10, agent_policy_miss +10,
  unsupported_ai_claim +15, prior_save_attempt_failed +20.
risk_level: 0-24 "low", 25-49 "medium", 50-74 "high", 75-100 "critical".

ESCALATION:
  >50 team-lead alert; >75 assign retention agent; >90 emergency escalation + save playbook.

REVENUE AT RISK: if ARR provided, revenue_at_risk = round(ARR * risk_score/100); else 0. Only non-zero if risk_score>=25 AND signals non-empty.

AI VERDICT (only when agent is AI; else null):
  BLOCK — unsupported claim, policy mismatch, hallucinated feature, PII leak, profanity, omitted compliance disclosure.
  REWRITE — technically correct but unclear, lacks empathy, vague, missing next steps, partially answered.
  SEND — accurate, policy-aligned, safe, complete, empathetic.

Return this EXACT JSON schema:
{
  "interaction_id": "",
  "channel": "",
  "customer_name": "",
  "agent_name": "",
  "qa_score": 0,
  "qa_status": "",
  "qa_breakdown": {
    "greeting":         {"score": 0, "weight": 10, "reason": ""},
    "active_listening": {"score": 0, "weight": 20, "reason": ""},
    "problem_solving":  {"score": 0, "weight": 25, "reason": ""},
    "empathy":          {"score": 0, "weight": 15, "reason": ""},
    "resolution":       {"score": 0, "weight": 20, "reason": ""},
    "closing":          {"score": 0, "weight": 10, "reason": ""}
  },
  "compliance": {"has_violation": false, "violation_types": []},
  "sentiment": {"overall": "negative|neutral|positive", "trajectory": "declining|stable|improving"},
  "interaction_tags": [],
  "churn": {
    "risk_score": 0,
    "risk_level": "low|medium|high|critical",
    "signals": [],
    "keywords_matched": [],
    "revenue_at_risk": 0,
    "recommended_action": ""
  },
  "ai_verdict": null,
  "coaching": {"strengths": [], "improvements": []},
  "playbook": {"triggered": false, "trigger_type": null},
  "summary": ""
}
"""


def _make_chat(session_id: str, provider: str, model: str, api_key: Optional[str]):
    key = api_key or EMERGENT_LLM_KEY
    if not key:
        raise RuntimeError("No LLM API key configured")
    chat = LlmChat(api_key=key, session_id=session_id, system_message=SYSTEM_PROMPT)
    chat.with_model(provider, model)
    return chat


def _derive_legacy_shape(analysis: Dict[str, Any], agent_type: str) -> Dict[str, Any]:
    """Augment the new schema with legacy keys so existing UI components keep rendering.

    This preserves: rubric[], churn_risk, arr_at_risk, churn_signal, ai_hallucination,
    policy_compliance, expansion_signal, expansion_value_monthly, coaching_card, save_playbook.
    """
    qb = analysis.get("qa_breakdown") or {}
    # rubric[] (0-10 scale) derived from qa_breakdown (0-100)
    rubric = []
    for key, weights in RUBRIC_WEIGHTS.items():
        item = qb.get(key) or {}
        s100 = int(item.get("score", 0))
        s10 = round(s100 / 10)
        verdict = "Pass" if s100 >= 75 else ("Marginal" if s100 >= 60 else "Fail")
        rubric.append({
            "key": key,
            "label": RUBRIC_LABELS[key],
            "score": s10,
            "score_100": s100,
            "verdict": verdict,
            "note": item.get("reason", ""),
        })

    churn = analysis.get("churn") or {}
    level_raw = (churn.get("risk_level") or "low").lower()
    # map critical -> High in legacy 3-level enum used by filters
    legacy_risk = "High" if level_raw in ("high", "critical") else (
        "Medium" if level_raw == "medium" else "Low"
    )
    signals = churn.get("signals") or []
    signal_labels = [CHURN_SIGNAL_LABELS.get(s, s) for s in signals]

    compliance = analysis.get("compliance") or {}
    has_viol = bool(compliance.get("has_violation"))
    viol_types = compliance.get("violation_types") or []
    ai_hallucination = agent_type.lower() == "ai" and any(
        v in viol_types for v in ("hallucinated_policy", "unsupported_promise", "unsupported_ai_claim")
    )

    coaching = analysis.get("coaching") or {}
    strengths = coaching.get("strengths") or []
    improvements = coaching.get("improvements") or []
    coaching_card = {
        "headline": improvements[0] if improvements else "Solid interaction",
        "strengths": strengths,
        "growth_areas": improvements,
        "recommended_actions": improvements,
    }

    # save_playbook for legacy UI — minimal but contextual
    save_playbook = {
        "steps": [
            "CSM calls account within 24h to acknowledge issue",
            churn.get("recommended_action") or "Trigger save flow + retention specialist assignment",
            "Schedule 30-day check-in",
        ] if churn.get("risk_score", 0) >= 50 else [
            "Monitor next interaction",
        ],
        "talking_points": strengths[:1] + improvements[:2],
        "offer_suggestion": (
            "Waive next month + dedicated CSM" if level_raw == "critical" else
            "Credit + priority support" if level_raw == "high" else
            "Follow-up call within 48h"
        ),
    }

    # Expansion heuristic (kept from previous behavior)
    summary = (analysis.get("summary") or "").lower()
    tags = [t.lower() for t in analysis.get("interaction_tags") or []]
    expansion_signal = "None"
    expansion_value = 0
    if any(t in ("upsell", "expansion", "pre-sales") for t in tags) or "expansion" in summary or "additional offices" in summary:
        expansion_signal = analysis.get("summary") or "Expansion opportunity detected"
        expansion_value = 2400

    return {
        **analysis,
        "rubric": rubric,
        "churn_risk": legacy_risk,
        "churn_risk_level": level_raw,
        "churn_risk_score": churn.get("risk_score", 0),
        "arr_at_risk": churn.get("revenue_at_risk", 0),
        "churn_signal": ", ".join(signal_labels[:3]) if signal_labels else (churn.get("recommended_action") or "None detected"),
        "churn_signals_labels": signal_labels,
        "churn_keywords": churn.get("keywords_matched") or [],
        "recommended_action": churn.get("recommended_action") or "",
        "ai_hallucination": ai_hallucination,
        "hallucination_note": (
            "Unsupported or hallucinated claim in response" if ai_hallucination else ""
        ),
        "policy_compliance": "Fail" if has_viol else "Pass",
        "compliance_violations": viol_types,
        "sentiment": analysis.get("sentiment", {}).get("overall", "neutral").capitalize() if isinstance(analysis.get("sentiment"), dict) else analysis.get("sentiment", "Neutral"),
        "sentiment_detail": analysis.get("sentiment", {}) if isinstance(analysis.get("sentiment"), dict) else {},
        "expansion_signal": expansion_signal,
        "expansion_value_monthly": expansion_value,
        "coaching_card": coaching_card,
        "save_playbook": save_playbook,
    }


async def analyze_interaction(
    transcript: str,
    customer_name: str,
    agent_name: str,
    agent_type: str,
    channel: str,
    account_arr: int = 0,
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    api_key: Optional[str] = None,
    client_context: str = "",
) -> dict:
    session_id = f"qa-{uuid.uuid4().hex[:10]}"
    ctx_block = f"\n\nClient context (industry/business-specific rules to apply when scoring):\n{client_context}\n" if client_context else ""
    prompt = f"""Analyze this support interaction.

Customer: {customer_name} (ARR estimate: ${account_arr}/yr)
Agent: {agent_name} ({agent_type})
Channel: {channel}{ctx_block}

Transcript:
---
{transcript}
---

Score it per the RetOps rubric. Detect churn signals from the list above. Apply hard-fail gates. If agent is AI, populate ai_verdict. Return the JSON object as instructed (STRICT JSON only).
"""
    try:
        chat = _make_chat(session_id, provider, model, api_key)
        raw = await chat.send_message(UserMessage(text=prompt))
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        start, end = raw.find("{"), raw.rfind("}")
        if start >= 0 and end > start:
            raw = raw[start : end + 1]
        data = json.loads(raw)
        data = _normalize_and_enforce(data, account_arr, agent_type)
    except Exception as e:
        logger.exception("LLM analyze failed, using fallback: %s", e)
        data = _fallback_analysis(transcript, customer_name, agent_name, agent_type, channel, account_arr)

    # Always augment with legacy keys for back-compat UI
    return _derive_legacy_shape(data, agent_type)


# ---------- Normalization + enforcement ----------
HARD_FAIL_GATES = {
    "compliance_violation", "unsupported_promise", "identity_verification_skipped",
    "pii_exposure", "threatening_abusive", "hallucinated_policy",
    "unsupported_ai_claim", "hallucinated_feature",
}


def _normalize_and_enforce(d: Dict[str, Any], arr: int, agent_type: str) -> Dict[str, Any]:
    """Apply banding, hard-fail gating, revenue-at-risk floor, ai_verdict sanity."""
    qb = d.get("qa_breakdown") or {}
    # ensure weights
    for k, w in RUBRIC_WEIGHTS.items():
        item = qb.get(k) or {"score": 0, "reason": ""}
        try:
            item["score"] = max(0, min(100, int(item.get("score", 0))))
        except Exception:
            item["score"] = 0
        item["weight"] = w
        item.setdefault("reason", "")
        qb[k] = item
    d["qa_breakdown"] = qb
    # compute/trust qa_score
    computed = round(sum(qb[k]["score"] * w for k, w in RUBRIC_WEIGHTS.items()) / 100, 1)
    try:
        given = float(d.get("qa_score", computed))
        d["qa_score"] = given if abs(given - computed) <= 1 else computed
    except Exception:
        d["qa_score"] = computed

    # hard-fail gating
    comp = d.get("compliance") or {"has_violation": False, "violation_types": []}
    violations = set(v.strip().lower() for v in (comp.get("violation_types") or []))
    if violations & HARD_FAIL_GATES:
        comp["has_violation"] = True
        d["qa_score"] = min(d["qa_score"], 59)
    d["compliance"] = comp

    # banding
    s = d["qa_score"]
    d["qa_status"] = (
        "excellent" if s >= 90 else "good" if s >= 75 else "watch" if s >= 60 else "below_threshold"
    )

    # churn normalization
    churn = d.get("churn") or {}
    signals = churn.get("signals") or []
    # recompute risk_score from signals to guarantee consistency
    score = sum(CHURN_SIGNAL_WEIGHTS.get(sig, 0) for sig in signals)
    score = min(100, max(0, int(churn.get("risk_score", score))))
    # trust larger of signal-sum and model-given score, capped
    score = min(100, max(score, sum(CHURN_SIGNAL_WEIGHTS.get(sig, 0) for sig in signals)))
    churn["risk_score"] = score
    churn["risk_level"] = (
        "critical" if score >= 75 else "high" if score >= 50 else "medium" if score >= 25 else "low"
    )
    # revenue at risk
    if arr and score >= 25 and signals:
        churn["revenue_at_risk"] = int(round(arr * score / 100))
    else:
        churn["revenue_at_risk"] = 0
    churn.setdefault("keywords_matched", [])
    churn.setdefault("recommended_action", _default_action(churn["risk_level"]))
    d["churn"] = churn

    # playbook trigger
    pb = d.get("playbook") or {}
    if score > 90 or comp.get("has_violation"):
        pb["triggered"] = True
        pb["trigger_type"] = "emergency_retention_escalation" if score > 90 else "compliance_alert"
    elif score > 75:
        pb["triggered"] = True
        pb.setdefault("trigger_type", "retention_assignment")
    d["playbook"] = pb

    # ai_verdict sanity: only for AI agents
    if agent_type.lower() != "ai":
        d["ai_verdict"] = None
    else:
        v = (d.get("ai_verdict") or "").upper() if d.get("ai_verdict") else ""
        if comp.get("has_violation") or any(
            t in violations for t in ("pii_exposure", "hallucinated_policy", "unsupported_ai_claim", "threatening_abusive")
        ):
            v = "BLOCK"
        elif d["qa_status"] == "watch" or d["qa_score"] < 75:
            v = v or "REWRITE"
        else:
            v = v or "SEND"
        d["ai_verdict"] = v

    return d


def _default_action(level: str) -> str:
    return {
        "critical": "Emergency escalation — call supervisor, trigger save playbook today",
        "high": "Assign retention specialist + callback within 24h",
        "medium": "Alert team lead for review",
        "low": "Monitor next interaction",
    }.get(level, "Monitor next interaction")


# ---------- Fallback scorer (keyword + rule based) ----------
def _detect_signals(text: str, agent_type: str) -> Dict[str, Any]:
    t = text.lower()
    matched_signals: List[str] = []
    matched_keywords: List[str] = []
    for sig, words in KEYWORDS.items():
        for w in words:
            if w in t:
                if sig not in matched_signals:
                    matched_signals.append(sig)
                matched_keywords.append(w)
                break
    # derived signals
    if "not resolved" in t or "still not fixed" in t or "issue is ongoing" in t:
        if "resolution_failed" not in matched_signals:
            matched_signals.append("resolution_failed")
    if agent_type.lower() == "ai" and re.search(r"\b(unlimited|free forever|always|every plan|100% (?:guaranteed|free))\b", t):
        if "unsupported_ai_claim" not in matched_signals:
            matched_signals.append("unsupported_ai_claim")
            matched_keywords.append("unsupported AI claim")
    return {"signals": matched_signals, "keywords_matched": matched_keywords}


def _fallback_analysis(transcript: str, customer: str, agent: str, agent_type: str, channel: str, arr: int) -> Dict[str, Any]:
    t = (transcript or "")
    det = _detect_signals(t, agent_type)
    signals = det["signals"]
    keywords = det["keywords_matched"]

    # base rubric scores (0-100)
    pos = sum(1 for w in ("thank", "appreciate", "resolved", "great", "happy") if w in t.lower())
    neg_count = len(signals)
    base = max(30, min(95, 82 - neg_count * 8 + pos * 3))
    rng_jitter = {
        "greeting": +3,
        "active_listening": -2 if neg_count >= 2 else +1,
        "problem_solving": -8 if "resolution_failed" in signals else 0,
        "empathy": -5 if any(s in signals for s in ("escalation_tone_shift", "negative_sentiment_streak")) else +2,
        "resolution": -10 if "resolution_failed" in signals else (+3 if pos >= 1 else 0),
        "closing": -3 if neg_count >= 2 else +2,
    }
    qa_breakdown = {}
    for k, w in RUBRIC_WEIGHTS.items():
        s = max(15, min(100, base + rng_jitter.get(k, 0)))
        reasons = {
            "greeting": "Opening was polite and professional." if s >= 70 else "Opening was generic.",
            "active_listening": "Agent acknowledged concern directly." if s >= 70 else "Agent missed customer's restated concern.",
            "problem_solving": "Agent drove toward resolution." if s >= 70 else "Did not resolve root cause; cited policy without alternative.",
            "empathy": "Agent acknowledged customer frustration." if s >= 70 else "Limited acknowledgment of repeated issue.",
            "resolution": "Clear resolution confirmed." if s >= 70 else "No confirmed resolution achieved.",
            "closing": "Close was polite with next steps." if s >= 70 else "Call ended politely but follow-up unclear.",
        }
        qa_breakdown[k] = {"score": s, "weight": w, "reason": reasons[k]}

    # compliance
    violations: List[str] = []
    if re.search(r"\bssn\b|\bsocial security\b|credit card number|\bdob\b", t.lower()):
        violations.append("pii_exposure")
    if agent_type.lower() == "ai" and "unsupported_ai_claim" in signals:
        violations.append("unsupported_ai_claim")
    has_viol = bool(violations)

    churn_score = min(100, sum(CHURN_SIGNAL_WEIGHTS.get(s, 0) for s in signals))
    level = "critical" if churn_score >= 75 else "high" if churn_score >= 50 else "medium" if churn_score >= 25 else "low"
    rar = int(round(arr * churn_score / 100)) if arr and churn_score >= 25 and signals else 0

    sentiment_overall = "negative" if neg_count > pos else "positive" if pos > neg_count else "neutral"
    sentiment_traj = "declining" if neg_count >= 2 else "stable"

    tags: List[str] = []
    if "billing_dispute_or_refund" in signals:
        tags.append("billing")
    if "cancellation_intent" in signals or "competitor_mention" in signals:
        tags.append("retention_risk")
    if "escalation_tone_shift" in signals:
        tags.append("complaint")
    if "contract_or_renewal_inquiry" in signals:
        tags.append("renewal")

    strengths = []
    improvements = []
    if qa_breakdown["greeting"]["score"] >= 70:
        strengths.append("Professional tone and clear identification")
    if qa_breakdown["empathy"]["score"] < 70:
        improvements.append("Acknowledge customer frustration earlier in the call")
    if qa_breakdown["problem_solving"]["score"] < 70:
        improvements.append("Probe for root cause before citing policy")
    if qa_breakdown["resolution"]["score"] < 70:
        improvements.append("Confirm resolution and next steps before closing")
    if has_viol:
        improvements.append("Follow verification/compliance process every time")
    if not improvements:
        improvements.append("Maintain current standard; share best-practice snippets with the team")

    data = {
        "qa_score": round(sum(qa_breakdown[k]["score"] * w for k, w in RUBRIC_WEIGHTS.items()) / 100, 1),
        "qa_breakdown": qa_breakdown,
        "qa_status": "",
        "compliance": {"has_violation": has_viol, "violation_types": violations},
        "sentiment": {"overall": sentiment_overall, "trajectory": sentiment_traj},
        "interaction_tags": tags,
        "churn": {
            "risk_score": churn_score,
            "risk_level": level,
            "signals": signals,
            "keywords_matched": keywords,
            "revenue_at_risk": rar,
            "recommended_action": _default_action(level),
        },
        "ai_verdict": None,
        "coaching": {"strengths": strengths, "improvements": improvements},
        "playbook": {"triggered": False, "trigger_type": None},
        "summary": (
            f"{customer} interaction on {channel}: "
            + (f"{len(signals)} churn signal(s) detected — " if signals else "")
            + (f"score {round(sum(qa_breakdown[k]['score'] * w for k, w in RUBRIC_WEIGHTS.items()) / 100)}/100. ")
            + (f"Recommended action: {_default_action(level)}." if signals else "No action required.")
        ),
    }
    return _normalize_and_enforce(data, arr, agent_type)
