# StudyFlow Phase 0 Execution Plan

Last updated: March 19, 2026

Status: Completed on March 19, 2026

## 1. Purpose

Phase 0 is the architecture-hardening cycle that must land before the next feature-heavy roadmap phases.

The goal is not to redesign the product. The goal is to make the current product easier to change safely by:

- breaking backend logic into stable domain modules
- splitting large frontend screens into feature-led units
- replacing one giant stylesheet with reusable design primitives
- adding integration coverage around the flows that already matter most

This phase exists because the current codebase has outgrown the original MVP structure.

## 2. Outcomes Required Before Phase 1

Phase 0 is complete only when all of the following are true:

- backend routes no longer depend on a single multi-thousand-line controller file
- frontend workspaces can be changed without editing several giant page/component files each time
- visual changes can be made through shared UI primitives and style tokens instead of repeated one-off selectors
- auth, parent, task, fees, marketplace, and analytics flows have integration coverage
- the repo layout and server boot process make future work on AI, payments, wallet, and social graph features safer

## 3. Backend Refactor Plan

## 3.1 Target Structure

```text
server/
  src/
    index.js
    app.js
    config/
      env.js
      constants.js
    middleware/
      auth.js
      requireRole.js
      rateLimit.js
      errorHandler.js
    shared/
      db/
      http/
      utils/
      validation/
    domains/
      identity/
        routes.js
        service.js
        repo.js
        validators.js
      learning/
        tasks.routes.js
        tasks.service.js
        tasks.repo.js
        courses.routes.js
        grading.routes.js
      collaboration/
        chat.routes.js
        meetings.routes.js
        notifications.routes.js
      community/
        feed.routes.js
        media.routes.js
        moderation.routes.js
      commerce/
        fees.routes.js
        marketplace.routes.js
        orders.routes.js
        disputes.routes.js
      governance/
        analytics.routes.js
        audit.routes.js
      parents/
        routes.js
        service.js
        repo.js
    bootstrap/
      schema.js
      routes.js
```

## 3.2 Layer Responsibilities

- `routes`: HTTP boundary only. Read request, validate input, call service, shape response.
- `service`: business workflow. Role checks, transitions, duplication rules, orchestration, audit emission.
- `repo`: SQL and persistence only.
- `validators`: input shape and normalization rules.
- `shared`: common helpers that are truly cross-domain, not random leftovers.

## 3.3 Domain Boundaries

- `identity`: register, login, reset password, profile update, school directory.
- `learning`: tasks, grading, reminders, courses, assessments, enrollment.
- `collaboration`: chat, broadcasts, meetings, transcripts, action items, notifications.
- `community`: posts, comments, reactions, media attachments, moderation.
- `commerce`: fees, invoices, payment evidence, marketplace, orders, disputes, verification.
- `governance`: scorecards, KPI aggregation, audit trail, alerts.
- `parents`: parent-child linkage and review workflows.

## 3.4 Migration Order

1. Extract config, constants, normalizers, auth middleware, and error handling from the current server entry files.
2. Introduce `createApp()` so tests can boot the API without binding a real port.
3. Move `identity` first, because all other domains depend on auth and actor context.
4. Move `parents` next, because it is already fairly isolated.
5. Move `learning` next, because task lifecycle is core product behavior.
6. Move `commerce` after that, but split fees and marketplace separately.
7. Move `collaboration` and `community` after the core CRUD domains are stable.
8. Move `governance` last, once service boundaries are already established.

## 3.5 Rules During Backend Refactor

- no route family moves without tests for its existing happy path and one permission failure
- no SQL remains embedded in JSX-driven assumptions or copied across files
- no business rule is introduced inside repository files
- all new route handlers must use the centralized error path

## 3.6 Current Backend Progress Snapshot (March 19, 2026)

- `server/app.js` now mounts domain-led backend route families instead of depending on a single multi-thousand-line commerce/feed controller
- `server/domains/commerce/bootstrap.js` now owns commerce schema bootstrap concerns
- `server/domains/commerce/feesRoutes.js` now owns fee plan, invoice, and payment routes
- `server/domains/commerce/marketplaceRoutes.js` now owns marketplace listing, order, moderation, dispute, and verification routes
- `server/domains/community/routes.js` now owns audience/feed/comment/reaction routes
- `server/commerceFeed.js` now acts as a shared commerce/community helper library for mapping, normalization, scope checks, and shared fetch helpers
- `createApp()` plus the domain route registrars now satisfy the backend modularization exit criteria for Phase 0

## 4. Frontend Refactor Plan

## 4.1 Target Structure

```text
src/
  app/
  api/
    client.js
  hooks/
  layouts/
    StudentLayout.jsx
    GovernanceLayout.jsx
  ui/
    Button/
    Panel/
    Modal/
    Tabs/
    Badge/
    EmptyState/
    Field/
    MediaUploader/
  features/
    auth/
    tasks/
    courses/
    fees/
    marketplace/
    collaboration/
    community/
    notifications/
    parents/
    governance/
```

## 4.2 What Gets Split First

- `StudentApp.jsx`
  - student shell
  - task board
  - focus/deadline/support utilities
  - module hero and stats
- `SchoolDashboard.jsx`
  - school shell
  - overview/KPI sections
  - student management panels
  - assignment/review surfaces
- `CoursesWorkspace.jsx`
  - course and bundle list shell
  - author course/module/assessment forms
  - student selection/payment and assessment attempt flow
  - CGPA and enrollment status orchestration
- `CollaborationHubModal.jsx`
  - chat panel
  - broadcast panel
  - meeting scheduler/list
  - transcript panel
  - summary/action item panel
- `FeesWorkspace.jsx`
  - student fees flow
  - school fees admin flow
  - invoice/payment detail panels
- `MarketplaceWorkspace.jsx`
  - browse grid
  - listing form
  - order flow
  - moderation/dispute flow

## 4.3 Current Frontend Progress Snapshot (March 19, 2026)

- `StudentApp.jsx` now delegates the student task surface to `src/components/StudentTasksWorkspace.jsx`
- student task data loading, reminders, modal state, and navigation reactions now live in `src/hooks/useStudentWorkspace.js`
- `SchoolDashboard.jsx` now delegates assignment/review UI to `src/components/SchoolTasksWorkspace.jsx`
- school, state, and federal task orchestration now lives in `src/hooks/useSchoolWorkspace.js`
- `CoursesWorkspace.jsx` now keeps course, bundle, CGPA, and assessment orchestration inside `src/hooks/useCoursesWorkspace.js`
- `FeesWorkspace.jsx` now keeps fee plans, invoices, payment evidence, and confirmation orchestration inside `src/hooks/useFeesWorkspace.js`
- `MarketplaceWorkspace.jsx` now keeps catalog filters, listings, orders, disputes, and moderation orchestration inside `src/hooks/useMarketplaceWorkspace.js`
- `CollaborationHubModal.jsx` now keeps chat, meetings, transcript, AI summary, and action-item orchestration inside `src/hooks/useCollaborationHub.js`
- the original large frontend target list for Phase 0 is now complete

## 4.4 Data Flow Rules

- pages and screens should compose feature sections, not own raw API logic
- API calls move into feature-level API modules
- reusable server interaction lives in hooks such as `useTasks`, `useFees`, `useMarketplace`, `useNotifications`
- shared state only goes global when more than one workspace truly depends on it

## 4.5 Target Frontend Shape By Responsibility

- `pages`: role entrypoints only
- `features`: product workflows
- `ui`: design-system primitives
- `hooks`: reusable stateful behavior
- `api`: fetch wrappers and endpoint helpers
- `layouts`: role-level page scaffolding

## 5. CSS and Component System Plan

## 5.1 Problem Being Solved

The current stylesheet centralizes too much styling in one place. This makes changes risky because unrelated selectors are easy to disturb.

## 5.2 Target Style Structure

```text
src/styles/
  tokens.css
  base.css
  layout.css
  utilities.css
  tasks.css
  auth.css
  collaboration.css
  interaction.css
  community.css
  commerce.css
  courses.css
```

Feature and UI components should then own their local styling through CSS modules or adjacent feature styles.

## 5.3 Token Categories

- color tokens
- spacing scale
- typography scale
- radius scale
- elevation/shadow tokens
- motion timings
- status colors
- role colors

## 5.4 Shared UI Primitives To Introduce

- `Button`
- `Panel`
- `StatCard`
- `SectionHeader`
- `Badge`
- `CountPill`
- `EmptyState`
- `FieldRow`
- `ModalShell`
- `Tabs`
- `MediaUploader`

## 5.5 CSS Migration Order

1. Move global tokens and resets out of `app.css`.
2. Extract layout primitives used across dashboards.
3. Extract shared components used in multiple workspaces.
4. Convert feature-specific styles one workspace at a time.
5. Retire `app.css` once remaining legacy selectors have been absorbed by foundation and feature layers.

## 6. Integration Test Expansion Plan

## 6.1 Backend Test Strategy

Target stack:

- Node test runner
- lightweight HTTP harness using ephemeral ports plus `fetch`
- dependency-injected route doubles or focused in-memory pool stubs where a live database is unnecessary

Required suites:

- auth
  - register success/failure
  - login success/failure
  - protected `/me`
  - reset-password workflow
- parents
  - link child
  - fetch linked child data
  - create parent review
  - invalid/forbidden link attempts
- tasks
  - CRUD
  - submit with required learning summary
  - grading flow
  - role/scope authorization failures
- fees
  - create fee plan
  - create invoice
  - generate invoice from plan selection
  - upload/submit payment evidence
  - approve/reject payment
- marketplace
  - create listing
  - create order
  - confirm cash/p2p/transfer flow
  - claim-code completion
  - dispute submission and moderation
- analytics
  - role-aware visibility and scoped summaries

## 6.2 Current Backend Coverage Snapshot (March 19, 2026)

- auth route integration suite now covers register, login failure, forgot/reset password, and protected `/me`
- parent route integration suite now covers child-linking, parent review writes, and role failure
- task route integration suite now covers task creation, grading, and grading permission failure
- fees route integration suite now covers fee-plan creation, scoped listing, and permission failure
- marketplace route integration suite now covers order creation and listing-write permission failure
- community route integration suite now covers audience lookup and auth protection for the extracted community router
- governance route integration suite now covers analytics overview success and forbidden student access

## 6.3 Frontend Test Strategy

Target stack:

- Vitest
- React Testing Library
- MSW

Required suites:

- auth page registration/login/reset flow
- student task board interactions
- school grading flow
- student pay-fees flow
- marketplace order flow
- parent link/review flow

This frontend harness remains the next test-system enhancement, but the Phase 0 exit criteria in Section 2 were satisfied once the backend flow coverage and smoke checks were green.

## 6.4 Test Rules

- integration tests should validate behavior, not implementation details
- every refactored domain must gain at least one integration suite before the next domain moves
- regressions in role/scope permissions are treated as release blockers

## 7. Repo and Delivery Cleanup During Phase 0

- normalize repo boundaries between root app and nested `server` repo
- confirm secret-handling rules and stop tracking environment secrets
- make root and server boot commands predictable for local and CI usage
- standardize lint/build/test checks across both app surfaces

## 8. Ordered Execution Sequence For Phase 0

1. repo and secret handling cleanup
2. backend app bootstrap extraction
3. backend modularization by domain
4. frontend feature/module split
5. CSS token and component-system extraction
6. backend integration coverage expansion
7. frontend integration coverage expansion
8. final smoke pass across student, parent, school, state, and federal roles

## 8.1 Phase 0 Closeout Snapshot (March 19, 2026)

- repo/app bootstrap is stable through `createApp()` and predictable root commands
- backend modularization is complete for the major route families called out in the Phase 0 goals
- frontend workspace and CSS modularization goals are complete
- required backend flow coverage is now present in the shared Node test runner
- final smoke checks are green through `npm test`, `npm run lint`, and `npm run build`

## 9. Post-Phase-0 Roadmap

Once Phase 0 is complete, the next execution order becomes:

1. external AI provider integration for higher-quality transcript and summary outputs
2. production-grade real-time call hardening and reliability controls
3. real payment rail integration for fees and transaction reconciliation
4. wallet/escrow foundation for marketplace negotiation and auction flows
5. media-rich social/community expansion:
   channel model, threads, richer moderation, and photo/video upload for posts and related community surfaces
6. governance intelligence expansion:
   alerts, trend analytics, intervention signals, and deeper drill-down reporting

## 10. Scope Guardrails

The following are explicitly out of scope for Phase 0:

- changing role definitions
- redesigning the end-user product model from scratch
- replacing PostgreSQL or React
- introducing paid infrastructure before the architecture seams are ready

Phase 0 is a system-shaping cycle. It should reduce future delivery risk, not create a second MVP.
