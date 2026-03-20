# StudyFlow Implementation Workflow

Last updated: March 20, 2026

## 1. Delivery Method Used

StudyFlow has been delivered incrementally using a request-driven product engineering loop:

1. capture request or incident
2. classify as feature, bug, or UX refinement
3. implement backend and frontend changes in lockstep
4. verify by build/lint/runtime checks
5. keep existing flows stable while expanding scope

This approach enabled fast iteration from core task management into collaboration, governance, fees, and marketplace modules without restarting architecture.

## 2. Technical Architecture

### Frontend

- React + Vite SPA
- role-based rendering:
  - `StudentApp`
  - `SchoolDashboard` (used by school/state/federal with scope-aware behavior)
- the app shell now lazy-loads role dashboards and the heaviest non-task workspace modules so production bundles stay split by actual user flow
- workspace orchestration is being moved into dedicated hooks such as `useStudentWorkspace`, `useSchoolWorkspace`, `useCoursesWorkspace`, `useFeesWorkspace`, `useMarketplaceWorkspace`, and `useCollaborationHub`
- large task surfaces are being moved into dedicated workspace components instead of staying inside page files
- shared UI components for tasks, collaboration hub, fees, marketplace, notifications

### Backend

- Express API now boots through `server/app.js` and mounts dedicated route domains for identity, learning, collaboration, communications, governance, parents, commerce, and community
- `server/domains/commerce/` now owns the commerce route families (`feesRoutes`, `marketplaceRoutes`) plus bootstrap helpers
- `server/domains/community/` now owns feed/audience/community route registration
- `server/commerceFeed.js` now acts as a shared helper/mapping library for commerce/community instead of a multi-thousand-line route controller
- PostgreSQL persistence via `sf_*` domain tables
- auth middleware + role/scope checks on every sensitive route

### AI and Transcript Layer (Current)

- transcript capture: browser speech recognition (when supported)
- summary/todo/action extraction: backend can now call an optional openai-compatible provider, while `src/lib/meetingAi.js` remains the local deterministic fallback
- media transcription: uploaded meeting audio/video can optionally be sent through an openai-compatible transcription model before entering the summary pipeline
- provider configuration now lives in backend env settings so API keys stay off the client
- collaboration UI also exposes backend summary-provider readiness through `/ai/meeting-summary/status`, while summary requests send richer meeting context (schedule, participants, transcript source, attachment kinds)
- meeting reliability is hardened with browser-side draft snapshots, restore-on-reopen behavior, unload/offline protection, and periodic backend checkpoints for in-progress collaboration calls
- AI-extracted meeting actions now pass through an editable suggestion layer before they are synced into action items or student kanban tasks
- live meeting calls now also run through browser-side preflight checks for link readiness, network, mic, camera, and transcript support, with explicit embedded/window rejoin controls for interrupted Jitsi sessions
- uploaded meeting audio/video now supports async backend transcription jobs, and recovered meeting drafts can resume polling those jobs until transcript-driven summary suggestions are refreshed
- reviewed AI meeting actions now persist as part of the saved meeting summary, including accept/reject state, edited wording, deadline refinements, and sync markers when actions graduate into real work
- no paid external AI dependency is required for local development because the fallback path remains available

### Payment Rail Layer (Current)

- fees still support manual `transfer` and `cash` evidence + school confirmation
- `on_platform` fee payments can now use an optional provider-backed checkout flow
- backend keeps provider refs, checkout URLs, verification payloads, and reconciliation timestamps inside `sf_fee_payments`
- students can now resume checkout, verify provider status, and only mark invoices paid after server-side reconciliation succeeds
- provider webhooks can now auto-confirm matching online fee payments, while manual reconcile remains available as a fallback path
- provider configuration stays in backend env settings so secret keys are never exposed in the frontend bundle
- marketplace card orders now also create an internal escrow hold, track seller payout state, and release proceeds into the seller wallet only after buyer claim

## 3. Module-by-Module Build Workflow

## 3.1 Auth and Account

- implemented role-based registration with privileged signup keys
- added forgot/reset password API and UI flow
- added account editing and biodata profile controls
- standardized state/LGA/gender entry to dropdown-driven forms

## 3.2 Academic Operations

- built task CRUD and kanban workflow
- enforced learning summary for submitted status
- added grading and feedback flow
- added role-scoped analytics and hierarchy-aware dashboards

## 3.3 Collaboration Hub

- direct chat and broadcast messaging
- meeting scheduling and participant management
- call session handling with transcript + report persistence
- AI summary and action item extraction
- sync accepted AI todos to personal todo and calendar export
- converted collab UX from popup to module view

## 3.4 Community Layer

- built role-scoped feed with post/comment/reaction
- enabled student posting capability while retaining scope control
- added image/video attachments for posts and comments, including media-only updates with derived titles
- integrated feed as first-class collab submodule

## 3.5 Fees Module

- fee plans and invoices
- student-side payment evidence upload
- optional provider-backed online checkout and reconciliation for `on_platform` payments
- school-side verification and receipt issuance
- notification and status tracking

## 3.6 Marketplace Module

- product categories and approval workflow
- listing creation with media support
- browse/detail cards with role-aware badges
- product reviews, reporting, moderation
- order flow with cash-confirm + claim-code completion
- student and school seller support in one flow

## 4. Change Implementation Sequence

When a change request arrives, this sequence is followed:

1. identify affected role(s), route(s), and UI module(s)
2. update API contract and server authorization rules first
3. update frontend forms/views/actions
4. update schema bootstrap/migration blocks where needed
5. run `npm run build` and `npm run lint` on frontend
6. run backend route/integration tests through `npm test`
7. run syntax checks and smoke validation on backend files
8. validate key paths manually or through role-aware route suites
9. document changes and residual gaps

## 5. Quality and Stability Controls

- role guardrails on route handlers
- scope checks (school/state/federal boundaries)
- normalized validation at request edges
- resilient fallback logic for media and transcript processing
- graceful fallback from external AI summary generation to the local deterministic summarizer
- compatibility-first UX changes (new module behavior without breaking prior core flows)

## 6. Implementation Principles Used

- preserve running system while adding features
- keep zero-cost tooling as default unless explicitly approved
- prioritize bug fixes that block user movement (login, dashboard interaction, grading)
- keep data model extensible for planned features (wallets, auctions, external AI)

## 7. Current Engineering Baseline

- frontend build and lint are green
- backend route modules and syntax checks are green
- auth, parent, task, fees, marketplace, community, and analytics route suites are green in the shared Node test runner
- core flows are integrated end-to-end across roles
- documentation trail now exists for onboarding contributors and stakeholders

## 8. Ordered Execution Plan (Current Cycle)

The current implementation cycle follows this strict order:

1. reliability hardening and audit event trail
2. parent/guardian access for under-18 students
3. fees UX flow refinement from student "Pay Fees" entry
4. marketplace payment-mode expansion with 2% platform charge
5. trust and safety upgrades (disputes + verification)
6. ministry/state/school scorecards and business metrics

### 8.1 Delivery Rules For This Cycle

- each phase ships backend + frontend changes together
- schema additions are backward-safe (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... IF NOT EXISTS`)
- existing role and scope boundaries remain intact
- every phase adds at least one observable UI/API signal for verification

### 8.2 Phase Targets

- phase 1 target:
  add `sf_audit_events` and log sensitive lifecycle events (implemented)
- phase 2 target:
  introduce `parent` role and parent-child linkage model (implemented)
- phase 3 target:
  student starts fees flow through explicit "Pay Fees" action and option selection (implemented)
- phase 4 target:
  support `cash`, `p2p`, `transfer` order modes with claim-code completion and platform fee accounting (implemented)
- phase 5 target:
  add dispute records and verification signals to moderation/trust workflows (implemented)
- phase 6 target:
  expose KPI endpoints/cards for operational and governance reporting (implemented)

### 8.3 March 7, 2026 Scope-Hardening Patch (Implemented)

- registration data integrity hardening:
  student signup now requires linked school and enforces school-derived state/LGA
- location quality hardening:
  state -> LGA dropdown now uses full Nigeria state/LGA reference data, not only current school rows
- guardian onboarding hardening:
  parent/guardian registration now requires relationship + state + LGA + location/address
- backend policy parity:
  server-side registration validation now mirrors frontend required-field rules
- collaboration UX pass:
  chat/broadcast message layout improved with clearer sender/date/time metadata and recipient context

## 9. Next Approved Plan (Execution Queue)

The March 6-7 implementation cycle is complete.

The next approved execution order is now:

1. external AI provider integration for higher-quality transcript + summary outputs (implemented baseline)
2. production-grade real-time call hardening and reliability controls (implemented baseline)
3. real payment rail integration for fees and transaction reconciliation (implemented baseline)
4. wallet/escrow foundation for marketplace negotiation and auction flows (implemented baseline)
5. media-rich social/community expansion (implemented baseline):
   photo/video upload is now live for posts/comments, while deeper channels, threading, and moderation intelligence remain next
6. governance intelligence expansion:
   alerts, trend analytics, intervention signals, and drill-down reporting

Detailed Phase 0 work breakdown now lives in:

- `docs/06_PHASE0_EXECUTION_PLAN.md`
