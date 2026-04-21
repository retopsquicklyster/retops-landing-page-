# RetOps — Product Requirements Document

## Original problem statement (verbatim)
> use the attached doc to create this website https://quicklyster-ai-qa-co-akkb.bolt.host/ the handoff doc has the backend funstionality. i need a working mvp to demo
>
> Follow-up: the product is not quicklyster but actually called **RetOps** and it is a QA tool for support that will QA both human and AI agents, flag at-risk accounts and proactively show customers at risk to churn and how much that customer is worth, identify what department is causing churn, playbook to fix and address before they leave — a **revenue protection platform**. Use Emergent LLM (architected to later accept BYO OpenAI / Anthropic keys). Use Emergent Google social login. Vibe & logo and fonts from www.retops.ai.

## User personas
- **Support Ops Lead / Director** — monitors QA coverage, agent performance, quality scorecards
- **Executive (CCO / VP Success)** — one-page Monday-morning view of revenue at risk, QA posture, priorities
- **CSM / Retention Manager** — opens churn-save playbooks for at-risk accounts
- **QA Analyst / Coach** — reviews coaching cards built from real interactions

## Core requirements (static)
1. QA scoring of **every** interaction (human + AI) against a 7-dimension rubric
2. Dollar value (ARR) attached to churn risk
3. AI hallucination + policy compliance detection
4. Coaching card + churn-save playbook generation
5. Google social login (Emergent Auth)
6. Pluggable LLM provider (Emergent key by default; BYO OpenAI/Anthropic/Gemini)
7. Seed demo data for instant demo

## What's been implemented — 2026-04-21
### Backend (FastAPI + MongoDB)
- Emergent Google Auth (session exchange, httpOnly cookie, Bearer fallback) at `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`
- LLM analysis service (`llm_service.py`) using emergentintegrations `LlmChat` — pluggable provider/model + per-user BYO key; deterministic fallback if LLM errors
- Interactions CRUD + filters (`churn_risk`, `agent_type`) + `/rescore`
- Accounts (enriched with churn risk), Agents (with perf metrics), Coaching, Playbooks per account
- Dashboard stats: coverage, avg score, score distribution, AI vs human, top performers, live alerts, revenue at risk, **recent_interactions (6 rows, status Needs Coaching/Completed)**
- `/api/seed-demo` (6 accounts, 9 agents, 6 scored interactions incl. churn, upsell, hallucination)
- `/api/settings` (GET/PUT llm_provider, llm_model, custom_api_key)
- **`/api/executive/overview`** — business_impact (QA ROI, CSAT, Productivity, Cost Savings, Customer Retention, FCR, AHT, Agent Turnover, total_arr, arr_at_risk), departments sorted by avg_score, risk_alerts with severity + recommended_action

### Frontend (React + Tailwind + shadcn)
- Landing page with RetOps hero, emerald/teal brand, mock exec card, **interactive ROI Calculator (5 sliders → recoverable revenue output)**
- Emergent Google login → `/dashboard`
- Dashboard layout with sidebar across 12 routes
- **Executive View redesigned**: 4 KPI cards (QA ROI, CSAT, Agent Productivity, Cost Savings) + Business Impact + Department Performance + Risk Alerts & Action Items with Take Action; **Share Result modal (Tweet / LinkedIn / Copy / Download PNG card)**
- **QA Dashboard Recent Interactions table** with Send Alert for Needs Coaching rows
- Interaction Detail with rubric, coaching card, save playbook, rescore action
- Upload with sample presets (billing/hallucination/upsell)
- Empty state with one-click Seed demo data
- Settings for provider / model / BYO API key
- sonner toasts, lucide icons, data-testids on all interactive elements

## Testing
- Iteration 1: 18/18 backend tests passing, 100% critical frontend flows green
- Iteration 2: 21/21 backend tests (added Executive + recent_interactions coverage), 100% new-feature + regression flows green

## Prioritized backlog

### P1 (next)
- Real CSV / JSONL bulk transcript upload
- Helpdesk connectors (Zendesk, Intercom, Salesforce)
- Voice transcription (Whisper) for audio uploads
- Custom QA rubric editor (weights + pass thresholds)

### P2
- Coaching Automation: auto-assign coaching cards to managers, track completion
- Multilingual scoring (ES, PT, FR, DE, JA)
- Vertical Packs (Fintech, Healthcare, Telco rubrics)
- Slack / Email alert routing
- Team roles (Admin, Coach, Viewer) + RBAC

### P3
- Realtime quality gate (block AI response pre-send)
- Benchmarks vs industry peers
- Customer-facing portal (share playbooks with CSMs)
