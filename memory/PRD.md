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

## What's been implemented — 2026-04-21 (iter 3)
### Branding (matched to retops.ai exactly)
- Color system: deep navy `#0b1f3b` primary, gold `#F8D210` CTA, teal `#14B8A6` accent
- Logo: shield SVG with stylized gold "O" concentric-arc fingerprint, `Ret[O]ps` wordmark + "REVENUE PROTECTION PLATFORM" tagline
- Type: **Instrument Serif** for display/headings, Inter for body, JetBrains Mono for data
- Buttons: `btn-gold` (yellow CTA) + `btn-primary` (navy) + `btn-ghost` (outline)
- Pills: pill-gold for "Soon" labels, pill-danger/warn/ok/info for status

### New pages
- **AI Agent Scoring** (`/dashboard/ai-scoring`): 4 KPIs (AI agents, Avg AI score, Hallucinations, Policy failures), AI agents list, Quality Gate stream with SEND/REWRITE/BLOCK verdict pills per response
- **Shared Playbook** (`/share/p/:token`): public read-only view of save playbook — RetOps logo, signal, numbered steps (navy), talking points (teal), recommended offer (navy+gold), Book a demo CTA, graceful 404

### New backend endpoints
- `POST /api/playbooks/share/{customer}` (auth, idempotent) → returns `{token, customer}`
- `GET /api/shared/playbook/{token}` (PUBLIC, no auth) → returns customer/arr/churn_risk/arr_at_risk/signal/save_playbook
- MongoDB collection: `playbook_shares (token, customer, created_by, created_at)`

### Other upgrades
- Landing page: retops.ai-style light hero with gold CTA + navy Command Overview preview card
- Interactive ROI Calculator with 5 sliders → recoverable revenue card (navy with gold accent)
- Executive View redesign (QA ROI, CSAT, Agent Productivity, Cost Savings + Business Impact + Department Performance + Risk Alerts) with Share Result modal (Tweet / LinkedIn / Copy / canvas-download PNG)
- QA Dashboard Recent Interactions with Send Alert
- Churn Save Playbook now has a one-click "Create public link" with Copy/Open

## Testing
- Iteration 1: 18/18 backend ✓
- Iteration 2: 21/21 backend ✓
- Iteration 3: **26/26 backend ✓**, all new-feature + regression frontend flows green, zero blocking issues

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
