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

### 2026-04-21 · Iter 9-10 — Live data toggles, real upload pipelines, PNG logo, investor-ready landing
**Live/Demo toggle** (keeps static mockup numbers, adds live option):
- Executive View: new 'data-mode-toggle' (demo/live). Live pulls `GET /api/executive/churn-analysis` which aggregates real seeded interactions into {tiles, top_reasons, segments, strategic}.
- Coaching Hub: new 'coaching-mode-toggle' with mode-demo/mode-live. Live pulls `GET /api/coaching/kpis` {active_learners, completion_rate_pct, avg_score_improvement, total_modules}.

**Real upload pipelines** on `/dashboard/upload`:
- **File Upload** panel — drag-drop + /interactions/upload-file, validated against binary/garbage (422)
- **Audio Recording** panel — MediaRecorder + /interactions/upload-audio + OpenAI Whisper via Emergent LLM key ("RetOps Transcription"). Errors sanitized of vendor names
- **Text Input** original form preserved as default method

**Logo** — PNG at `/brand/retops-logo.png`, `<img>` primary + CSS gradient text fallback

**Landing** — sticky nav, rotating tagline, IntersectionObserver .reveal animations, 7 new sections (Blind Spot, The Math, What Monday Morning Looks Like live alert stream, Score Output anatomy, How It Works 3-step, Comparison table, Customer placeholders trust bar, FAQ accordion)

Tests: 56/56 backend + 9/9 frontend

### 2026-04-21 · Iter 14-15 — Compact nav, mobile menu, Platform reorder, empty states, animated journey
- **KPI numbers** reduced 2× — .kpi-num 18px, .stat-num 22px (was 36/44)
- **Nav** zero padding — `h-14` container with compact `size="header"` logo (h-10/12). Primary CTA changed from "Sign in or Register" to **"Book a demo"** (yellow). Full nav: Platform / How it works / ROI / FAQ + Book-a-demo
- **Mobile hamburger** — `data-testid="mobile-menu-btn"` opens mobile-menu drawer with all nav links + Sign in
- **Customer Journey** rebuilt — 7 icon tiles (Plug/Database/ShieldCheck/DollarSign/Radio/Users/Sparkles) + SVG wavy dashed connecting line (matches retops.ai sample)
- **Platform section** — new `PlatformStack` component with scroll-pinned stacking cards ("One system. Seven jobs done.") — 7 branded cards with navy L-side + white R-side preview panels and progress dots. Moved AFTER "How it works" section per user request
- **Empty states** on Executive View + Coaching Hub with "Upload a transcript" + "Bulk score" CTAs when no data
- **Tests: 5/5 visual deltas verified**

### 2026-04-21 · Iter 12-13 — Email/password auth + white nav + preset dropdown + Customer Journey

**Iter 12 — Email/password auth + nav + KPI consistency:**
- Email/password auth alongside Emergent Google Login
  - `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
  - bcrypt password hashing, brute-force lock (5 fails / 15min), 8+ char validation, 409 on duplicate
  - Same `session_token` cookie scheme as Google flow — ONE `require_user` works for both
- New `/auth` page with Sign in / Register toggle + Continue with Google + Book-a-Demo link
- Landing CTA updated to "Sign in or Register" + "Book a Demo" (https://link.quicklyster.ca/widget/booking/Uqx8qFGVds9HVLl42Bij)
- Nav always-white (no transparent-to-white scroll swap — fixes logo blend issue)
- Grid overlay removed from hero · 3 floating decorative orbs added
- Footer logo sized h-36 to match header
- Test account: `owner@urbanflavours.ca` / `CannabisSecure123!`

**Iter 13 — Customer Journey + custom presets + Inter KPIs:**
- Landing: hero reduced to 2 CTAs (yellow "Book a demo" + "See your ROI") · nav padding py-2
- New "Customer Journey" 7-step roadmap section (Connect → Normalize → Score → Detect risk → Trigger action → Coach & improve → Protect revenue), mirrors retops.ai
- KPI number typography: Inter weight 800 tabular-nums (was Instrument Serif) for all dashboards — Executive, Coaching, AI Scoring, Digest, Bulk
- BulkUpload client-preset UX: replaced 2-button picker with dropdown + "Add preset" modal
- Backend preset CRUD: `GET /api/bulk/presets`, `POST /api/bulk/presets`, `DELETE /api/bulk/presets/{id}` — stored in `db.client_presets`; custom context threaded through `_resolve_preset_context()` into scoring
- Fixed: Agent Productivity KPI no longer renders `+-0.4%` double-sign
- **Tests: 59/59 backend + full frontend 5/5 after fixes**

### 2026-04-21 · Iter 11 — Bulk upload (Urban Flavours cannabis preset) + polish
- **Removed** `Trusted by revenue-critical support teams` trust-bar from Landing (MVP has 1 customer)
- **Logo 3×** bigger — header 144px, footer 96px (from 40px / 28px)
- **Bulk Upload feature** — `/dashboard/bulk` route:
  - Backend: `POST /api/interactions/bulk-upload` (JSON) + `POST /api/interactions/bulk-upload-file` (multipart) accept CSV/JSONL/`===`-separated text
  - `_split_bulk_transcripts()` handles CSV/JSONL/plain-text auto
  - `_infer_rep_and_customer()` uses gpt-4o-mini to extract rep + customer + channel + 1-line summary per transcript
  - `CLIENT_PRESETS` dict with `urban_flavours_delivery` preset (21+ ID verify, no medical claims, license area, SLA, cannabis competitors)
  - `analyze_interaction()` gained `client_context` param which is embedded in the QA prompt
  - Parallelized at 5 concurrent LLM calls
  - Returns `{batch_id, client_label, total, scored, summary, rep_leaderboard[], customer_churn[], interactions[]}`
  - Each interaction persists to `db.interactions` with `source: "bulk:<preset>"` and `client_label`
- **Frontend BulkUpload.jsx** — preset picker, drag-drop/paste, sample CSV loader, live results dashboard (per-rep avg/fails/cards + per-customer churn risk), clickable drill-down to interaction detail
- **Landing motion** — animated `::before` orb drift on hero (22s), grid mask overlay, `.glow-card` hover, marquee util. No Emergent leaks anywhere.
- **Tests: 63/63 backend + 19/19 frontend = 100%**
**Live/Demo toggle** (keeps static mockup numbers, adds live option):
- Executive View: new 'data-mode-toggle' (demo/live). Live pulls `GET /api/executive/churn-analysis` which aggregates real seeded interactions into {tiles, top_reasons, segments, strategic}.
- Coaching Hub: new 'coaching-mode-toggle' with mode-demo/mode-live. Live pulls `GET /api/coaching/kpis` {active_learners, completion_rate_pct, avg_score_improvement, total_modules}.

**Real upload pipelines** on `/dashboard/upload`:
- **File Upload** panel — drag-drop or click; .txt/.md/.csv/.json/.docx/.pdf supported; validated against binary/garbage (422 on null bytes >5% or replacement chars >10%); calls `POST /api/interactions/upload-file` (multipart); parsed → scored; navigates to the new interaction detail.
- **Audio Recording** panel — browser MediaRecorder (WebM/opus); `POST /api/interactions/upload-audio` calls OpenAI Whisper via Emergent LLM key (product-facing label: 'RetOps Transcription'). Error message sanitized to strip OpenAI/openai/litellm/Emergent/Anthropic/Gemini names.
- **Text Input** original form preserved as default method.

**Logo** — PNG served at `/brand/retops-logo.png` (103KB), `<img>` primary, CSS gradient text as automatic onError fallback.

**Landing page revamp** — investor/customer ready:
- Sticky nav with scroll state (Platform, How it works, ROI, FAQ)
- Rotating hero tagline: every conversation/complaint/interaction
- IntersectionObserver-driven `.reveal` scroll animations
- 8 new sections: Blind Spot, The Math (ARR leak), What Monday Morning Looks Like (live alert stream), Score Output anatomy, How It Works 3-step, Comparison table (vs Sampling QA/Analytics/CS tools), Customer placeholders trust bar, FAQ accordion
- Existing ROI Calculator + Founding 50 CTA preserved

**Backend health:** 56/56 tests green (46 regression + 10 new iter-9/10). Frontend: 9/9 retest + 34/35 iter-9. Zero 'Emergent' strings in any user-facing UI or error message.

### 2026-04-21 · Iter 7-8 — Dashboard mockup alignment (ADD WHAT'S MISSING)
User provided 5 mockup images. Main agent ADDED missing sections without removing existing functionality:
- **Executive View**: added 'Overall Churn Analysis' (4 tiles: Churn Rate 8.2%, At-Risk 156, Revenue at Risk $2.4M, Retention 91.8%), 'Top Churn Reasons' (5 progress bars), 'Churn by Customer Segment' (4 rows), 'Recommended Churn Prevention Actions' (6 cards with High/Medium/Low priority), 'Strategic Insights' (Coaching ROI 340% / Quality Trend +12.5% / Efficiency Gain 28%)
- **Coaching Hub**: full page rebuild — 'Create Module' + 'Assign Training' actions, 4 KPIs (Active Learners 156, Completion 87%, Score Improvement +8.3, Total Modules 24), tabs (Overview / Training Modules / Leaderboard / Recent Activity), Learning Progress + Recommended for You panels. Existing coaching cards preserved under Training Modules tab
- **AI Agent Scoring**: KPI strip expanded from 4 → 6 cards (added 'AI Interactions Today' + 'AI vs Human Score +2.4%'), added 'Same Standards, Fair Comparison' info card, added 'Upload AI Agent Interaction' CTA (routes to /dashboard/upload)
- **Upload Interaction**: added 'Choose Upload Method' picker with 3 cards (File Upload / Text Input / Audio Recording). method-audio triggers 'coming soon' toast. Existing form preserved.
- Fixed 2 critical bugs iter 7 flagged: missing `FileText, Mic` imports caused UploadInteraction crash; AI Scoring KPI strip was stale at 4 cards
- **Tests: 13/13 ✓ (frontend only iter 8 — backend unchanged from iter 6 46/46 green)**

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
