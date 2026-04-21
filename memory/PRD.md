# RetOps — Product Requirements Document

## Original problem statement
Build RetOps — a revenue protection QA platform that QAs both human and AI support agents, flags at-risk accounts with dollar exposure, generates coaching cards + churn-save playbooks. MVP must be demo-ready. Use Emergent LLM key (pluggable to OpenAI/Anthropic/Gemini), Emergent Google social login, retops.ai brand (navy + gold + teal, Instrument Serif).

---

## Build History

### 2026-04-21 · Iter 1 — MVP scaffolding
- FastAPI + MongoDB + React scaffold
- Emergent Google Auth (cookie + Bearer)
- LLM scoring via `emergentintegrations.LlmChat` (pluggable provider, deterministic fallback)
- Interactions CRUD + /rescore, Accounts, Agents, Coaching, Playbooks per account
- Dashboard stats, Settings (BYO API key)
- `/api/seed-demo` (6 accounts · 9 agents · 6 scored interactions)
- Initial landing + QA Dashboard + sidebar (12 routes) + Interaction Detail (rubric + coaching + save playbook)
- **Tests: 18/18 ✓**

### 2026-04-21 · Iter 2 — ROI Calculator + Share Result + Exec View redesign
- Landing: Interactive **ROI Calculator** (5 sliders → recoverable revenue)
- Executive View redesigned: QA ROI / CSAT / Productivity / Cost Savings KPIs + Business Impact + Department Performance + Risk Alerts & Action Items
- **Share Result modal** — Tweet / LinkedIn / Copy / canvas-generated downloadable PNG share card
- QA Dashboard: **Recent Interactions** table with Send Alert button
- Backend: `/api/executive/overview`, `recent_interactions` added to `/api/dashboard/stats`
- **Tests: 21/21 ✓**

### 2026-04-21 · Iter 3 — Full retops.ai rebrand + AI Agent Scoring + Public Share
- Rebrand to exact retops.ai tokens — navy `#0b1f3b` / gold `#F8D210` / teal `#14B8A6`, **Instrument Serif** display font, btn-gold CTAs
- New **AI Agent Scoring** page: 4 KPIs (AI agents, Avg AI score, Hallucinations, Policy failures), AI agent roster, Quality Gate stream with **SEND / REWRITE / BLOCK** verdict pills
- **Public Share for Save Playbooks** — `POST /api/playbooks/share/{customer}` + `GET /api/shared/playbook/{token}` (public, no-auth)
- `/share/p/:token` public read-only playbook page with Book-a-demo CTA
- Login page redesigned with navy+gold glow + readable white/navy text
- **Tests: 26/26 ✓**

### 2026-04-21 · Iter 4 — Official logo + Activity History
- Replaced custom SVG logo with the **official RetOps PNG lockup** (navy-tile + `mix-blend-mode: lighten` so the black padding blends to navy and gold shield-O + Retops wordmark + "REVENUE PROTECTION PLATFORM" tagline all render crisp)
- New **Activity History** page `/dashboard/history` — unified audit trail of everything RetOps did: interactions scored, churn risk detected, AI hallucinations flagged, policy compliance fails, upsell signals, coaching cards generated, playbooks shared
- Filter pills (All / Interactions / Churn / AI / Coaching / Shared playbooks) with day grouping (Today / Yesterday / date)
- Backend: `GET /api/activity` aggregates interaction analysis into event-kind feed
- **Tests: 29/29 ✓**

### 2026-04-21 · Iter 5 — Bulletproof scoring engine per spec
- **Complete rewrite of scoring engine** (`llm_service.py`) to match the RetOps scoring spec:
  - 6-dimension weighted rubric (greeting 10 / active_listening 20 / problem_solving 25 / empathy 15 / resolution 20 / closing 10), 0–100 per criterion
  - QA bands: excellent ≥90, good ≥75, watch ≥60, below_threshold <60
  - **7 hard-fail gates** cap qa_score at 59 + compliance.has_violation
  - **12 churn signals** with spec weights, level mapping low/medium/high/critical
  - **Keyword library** (8 signal categories) for deterministic signal detection
  - Revenue-at-risk `ARR × risk_score/100`, shown when risk≥25 AND signals present
  - AI verdict SEND/REWRITE/BLOCK with BLOCK forced on violations
  - Legacy-shape derivation keeps existing UI back-compat
- **InteractionDetail page** upgraded with alert banner, 6-row rubric 0–100 progress bars with per-row reasons, churn signal + keyword pills, Save playbook navy card
- **Tests: 37/37 ✓**

### 2026-04-21 · Iter 6 — White-label polish + Weekly RetOps Digest
- Removed the "Made with Emergent" badge from `public/index.html` (full white-label for demo)
- `GET /api/interactions?customer=<name>` filter verified working end-to-end
- Logo finalized as CSS gradient text — teal→gold on "RetOps" + "REVENUE INTELLIGENCE" caption — matches retops.ai
- New **Weekly RetOps Digest** feature:
  - Backend: `_build_digest(days=7)` aggregates interactions into kpis (arr_at_risk, accounts_at_risk, avg score, hallucinations, policy_fails, upsell_monthly), top_at_risk[], coaching_priorities[], upsells[], below_threshold[]
  - Email HTML renderer with navy/gold/teal tokens and Georgia-serif headlines (email-client safe tables)
  - Endpoints: `GET /api/digest/preview`, `GET /api/digest/preview.html`, `POST /api/digest/subscribe`, `POST /api/digest/send-now`, `GET /api/digest/history`
  - Resend integration: if `RESEND_API_KEY` is set in backend/.env it sends real emails; otherwise renders & logs to `db.digest_sends`
  - UserSettings extended with `digest_subscribed` + `digest_email`
  - Filters `TEST_*` agents out of aggregation so test runs don't pollute executive email
- Frontend: new `/dashboard/digest` page — KPI strip, subscribe toggle, top at-risk, coaching priorities, upsells, live email-preview iframe, send-history card, "Send to my email" button
- Settings: new "Weekly digest" card with toggle + optional delivery email
- Nav sidebar: "Weekly Digest" between Activity History and Settings
- **Tests: 46/46 ✓**

---

---

## Implemented features (cumulative)

### Backend endpoints
- `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET/POST /api/interactions`, `GET /api/interactions/{id}`, `POST /api/interactions/{id}/rescore`
- `GET /api/accounts`, `GET /api/agents`, `GET /api/coaching`
- `GET /api/dashboard/stats` (coverage, avg score, distribution, AI-vs-human, top agents, alerts, recent_interactions)
- `GET /api/executive/overview` (business_impact, departments, risk_alerts)
- `GET /api/playbooks/account/{customer}`, `POST /api/playbooks/share/{customer}`, `GET /api/shared/playbook/{token}` (public)
- `GET /api/activity` (unified event feed)
- `GET/PUT /api/settings` (llm_provider, llm_model, custom_api_key)
- `POST /api/seed-demo[?force=true]`

### Frontend routes (13 routes)
- `/` landing · `/login` · `/share/p/:token` public
- `/dashboard` · `/executive` · `/upload` · `/interactions` · `/interactions/:id`
- `/ai-scoring` · `/coaching` · `/risk` · `/churn` · `/playbook` · `/history` · `/settings`
- `/automation`, `/multilingual`, `/packs` (Coming Soon stubs with gold pills)

---

## Prioritized backlog

### P1 (next)
- Bulk CSV / JSONL transcript upload
- Zendesk / Intercom / Salesforce connectors
- Whisper audio ingest
- Custom QA rubric editor
- Public-share analytics (`?utm=`) + Slack notifier on Book-a-demo
- Snapshot `interaction_id` at share-creation (prevent drift)

### P2
- Coaching Automation (auto-assign + completion tracking)
- Multilingual scoring (ES/PT/FR/DE/JA)
- Vertical rubric packs (Fintech, Healthcare, Telco)
- Slack / Email alert routing, RBAC, share-token expiry

### P3 / Tech debt
- Split `server.py` into routers (auth, interactions, executive, activity, playbook_share)
- Paginated `/api/activity` + MongoDB aggregation
- A11y: keyboard-navigable activity event cards (button role)
- Loading/error skeletons on ActivityHistory
