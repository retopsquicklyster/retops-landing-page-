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
