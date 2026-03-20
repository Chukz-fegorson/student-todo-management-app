# Changelog

All notable changes to StudyFlow are documented here.

This release log complements the deeper engineering trail in `docs/03_CHANGE_REQUEST_LOG.md`.

## [Unreleased]

### Added

- optional server-backed external AI summary integration for meeting transcripts through `/ai/meeting-summary`
- environment-based provider configuration for openai-compatible summary providers
- collaboration route and provider tests covering the new AI summary path
- backend AI status endpoint at `/ai/meeting-summary/status` for collaboration diagnostics
- local collaboration call-draft recovery helpers and test coverage for meeting interruption protection
- optional backend AI transcription endpoint at `/ai/meeting-transcript` for uploaded meeting audio/video attachments
- editable AI task suggestion drafts in the collaboration workspace before action-item or kanban sync
- collaboration call preflight checks for join-link readiness, connection state, microphone detection, camera detection, and browser transcript readiness
- embedded call rejoin controls for refreshing the in-app meeting frame or opening a fresh recovery window
- async meeting-media transcription jobs through `/ai/meeting-transcript/jobs` with polling-friendly job status responses
- persisted meeting-level AI task review history covering accepted, rejected, pending, edited, and synced suggestion states
- optional provider-backed online fee checkout through `/fees/payment-provider/status`, `/fees/invoices/:id/checkout`, and `/fees/payments/:id/reconcile`
- fee-route integration coverage for provider status, checkout creation, legacy on-platform guardrails, and successful reconciliation
- signed payment-provider webhook support at `/fees/payment-provider/webhook` for automatic online fee confirmation
- fee-route integration coverage for the manual `transfer`/`cash` payment proof flow through school confirmation
- marketplace wallet summary and wallet transaction endpoints through `/market/wallet` and `/market/wallet/transactions`
- marketplace route coverage for card-order escrow funding and seller wallet release after buyer claim
- reusable community feed media helpers for post/comment drafts, file limits, and title derivation
- community route coverage for media-only posts and media-only comments across the feed lifecycle

### Changed

- collaboration summary generation now prefers the external provider when configured and falls back to the local deterministic summarizer when unavailable
- AI meeting-summary requests now include richer meeting context such as schedule, participants, transcript source, and attachment types
- collaboration UI now shows configured AI engine health plus the source of the latest saved summary
- collaboration call UX now protects in-progress transcript/summary drafts across refresh/offline interruptions, periodically checkpoints active-call notes back to the server, and surfaces live network/transcript/sync/draft-health status
- collaboration meeting media can now be transcribed through a configured OpenAI-compatible audio provider, while accepted AI task suggestions now support per-task description and deadline review before they become real tasks
- active collaboration meetings now run through a reusable preflight report and can explicitly rejoin the embedded Jitsi session after interruption without losing the current meeting draft
- collaboration now queues uploaded media transcription in the backend, resumes polling from recovered local meeting drafts, and refreshes transcript-driven summary suggestions automatically when a job completes
- collaboration meeting summaries now keep task-review history as a first-class record, so reopening a meeting restores prior accept/reject decisions, edited descriptions/deadlines, and sync markers before anything is pushed again
- fees now keep manual `transfer` and `cash` confirmation unchanged, but `on_platform` payments run through a real provider checkout lifecycle with stored provider refs, checkout resume support, and server-side verification before an invoice is marked paid
- provider-backed online fees can now auto-confirm from signed webhook events, while the manual `Verify Payment` action remains as a safe fallback when webhook delivery is delayed
- manual fee payment cards now show receipt-readiness before submit, auto-include a pasted receipt URL during submission, and align file guidance with the current secure JSON upload limits
- marketplace card orders now fund a wallet-backed escrow hold, keep seller payout status on the order record, and release seller wallet proceeds only after buyer claim completes the handoff
- community feed posts and comments can now carry image/video media, including media-only updates with derived titles, preview grids, and route-level persistence across thread reloads
- the app shell now lazy-loads role dashboards, account settings, and heavy student/school workspace modules so the production build is split by role/module instead of shipping one oversized client chunk

### Fixed

- resolved the Vite oversized-chunk warning by moving the largest dashboard and module surfaces onto on-demand bundles

## [2.0.0] - 2026-03-19

### Added

- dedicated frontend workspace hooks for student, school, courses, fees, marketplace, and collaboration flows
- dedicated frontend task workspace components for student and school/governance task surfaces
- layered CSS modules for tokens, base, layout, utilities, tasks, auth, collaboration, interaction, community, commerce, and courses
- backend domain route modules for commerce and community under `server/domains/`
- route-level integration coverage for auth, parents, tasks, fees, marketplace, community, and analytics flows
- Phase 0 architecture plan and release comparison documentation

### Changed

- `StudentApp.jsx` and `SchoolDashboard.jsx` now act as thin page composers instead of carrying most workflow logic directly
- `CoursesWorkspace.jsx`, `FeesWorkspace.jsx`, `MarketplaceWorkspace.jsx`, and `CollaborationHubModal.jsx` now delegate orchestration to dedicated hooks and shared helpers
- `server/app.js` now mounts backend route families through domain modules instead of depending on a single multi-thousand-line commerce/feed controller
- `server/commerceFeed.js` now serves as a shared helper/mapping library for commerce and community concerns
- project documentation now distinguishes the latest release view from the deeper implementation trail

### Fixed

- Phase 0 reduced coupling across frontend workspaces, backend route families, and shared styling layers
- high-value backend flows now have regression coverage for happy-path and permission-boundary behavior

### Removed

- legacy monolithic `src/styles/app.css`
- backend dependence on one multi-thousand-line commerce/community route controller

## Version Trail

- `docs/V1_TO_V2.md`: high-level comparison between the pre-Phase-0 app shape and the current v2 release
- `docs/03_CHANGE_REQUEST_LOG.md`: detailed request-by-request delivery history
