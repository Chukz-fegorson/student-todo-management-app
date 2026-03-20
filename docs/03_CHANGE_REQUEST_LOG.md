# StudyFlow Change Request Log

Last updated: March 20, 2026

## 1. Purpose

This log captures key requests implemented since initial MVP setup through current build.  
It is intentionally product-focused: what changed, why it changed, and where it landed.

## 2. Status Legend

- `Implemented`: delivered in current codebase
- `Partially Implemented`: foundation exists, full scope pending
- `In Progress`: accepted and currently being implemented
- `Planned`: accepted but not yet implemented

## 3. Change Requests (Chronological by Phase)

| CR ID | Phase | Request Summary | Status | Delivery Notes |
|---|---|---|---|---|
| CR-001 | Foundation | Fix blank frontend render | Implemented | App shell and mount/render stability fixes applied |
| CR-002 | Foundation | Resolve dashboard UI freeze/click lock after signup | Implemented | Overlay/pointer-event state handling hardened |
| CR-003 | Foundation | Fix login `failed to fetch` and auth reliability | Implemented | API/auth flow and error handling improved |
| CR-004 | Foundation | Fix student page overlap and responsiveness | Implemented | layout + CSS breakpoints adjusted |
| CR-005 | Foundation | Add account update after creation | Implemented | account modal + `/me` update flow |
| CR-006 | Foundation | Fix grading `internal server error` | Implemented | grading endpoint path and validation stabilized |
| CR-007 | V1 Scope | Introduce role-based governance model (student/school/state/federal) | Implemented | end-to-end role and scope controls active |
| CR-008 | V1 Scope | Add collab hub with chat/broadcast/meetings/feed | Implemented | collaboration module integrated |
| CR-009 | V1 Scope | Add meeting transcript + AI summary + todo extraction | Implemented | local summary engine + notes persistence |
| CR-010 | V1 Scope | Meeting report should remain tied to historical meeting record | Implemented | transcript/summary saved per meeting ID |
| CR-011 | V1 Scope | Add ability to sync AI todos to personal todo flow | Implemented | accepted summary todos sync to action items/tasks |
| CR-012 | V1 Scope | Add notification center for activities | Implemented | notification stream endpoints + UI |
| CR-013 | V1 Scope | Add forgot-password flow | Implemented | token request + reset endpoints and UI |
| CR-014 | V1 Scope | Restore test account access and reset strategy | Implemented | account and password reset process stabilized |
| CR-015 | V1 Scope | Add secure signup keys for school/state/federal | Implemented | environment-driven invite key enforcement |
| CR-016 | Commerce | Build fees plans/invoices/payment confirmation | Implemented | invoice + payment evidence + school confirmation |
| CR-017 | Commerce | Build marketplace with p2p cash confirmation code | Implemented | order lifecycle includes seller-confirm + buyer-claim |
| CR-018 | Commerce | Send claim code to buyer inbox and keep visible on seller side | Implemented | claim-code visibility and order states improved |
| CR-019 | Commerce | Upgrade marketplace to ecommerce card UX | Implemented | browse cards + detail modal + 4-column layout |
| CR-020 | Commerce | Add multiple images/videos per listing | Implemented | media upload/preview/detail gallery support |
| CR-021 | Commerce | Add product ratings and review feedback | Implemented | review endpoint + 5-star UI + text review |
| CR-022 | Commerce | Differentiate store labels/colors by seller context | Implemented | role-aware marketplace chips/styles added |
| CR-023 | Commerce | Allow school to add category from sell form | Implemented | school category request + approval path integrated |
| CR-024 | Commerce | Add `Others` category option without standardizing | Implemented | per-listing custom category label added |
| CR-025 | Social | Enable students to create community posts | Implemented | feed posting permissions expanded to students |
| CR-026 | Social | Broadcast/chat UX alignment with enterprise style | Implemented | sender/time/date structure and bubble style retained |
| CR-027 | UX Redesign | Move collab to top-level module tabs; avoid popup | Implemented | collab now embedded module in both dashboards |
| CR-028 | UX Redesign | Hide create-meeting form until user clicks create | Implemented | conditional form toggle implemented |
| CR-029 | UX Redesign | Keep upcoming and past meetings visible | Implemented | meeting filter/list remains always visible |
| CR-030 | Data Standardization | Standardize State/LGA/Gender inputs to dropdowns | Implemented | location data helper + auth/account dropdown conversion |
| CR-031 | Strategic | Add wallet-backed auctions and bidding | Partially Implemented | marketplace card orders now use wallet-backed escrow holds and seller wallet release states; auctions and bidding are still pending |
| CR-032 | Strategic | Integrate external ChatGPT/Whisper APIs | Partially Implemented | collaboration summaries and uploaded meeting audio/video can now use an optional OpenAI-compatible provider, while the zero-cost local fallback remains available |
| CR-033 | Strategic | Expand social graph to Slack/Twitter-like streams | Partially Implemented | community feed baseline exists and now supports media-rich posts/comments; advanced channels, threads, and moderation depth are still pending |
| CR-034 | Reliability | Add audit event trail across auth/fees/marketplace lifecycle | Implemented | `sf_audit_events` schema + route-level audit hooks + `/audit/events` |
| CR-035 | Governance | Add parent role and under-18 parent review linkage | Implemented | parent role, child link code flow, parent dashboard, parent review APIs |
| CR-036 | Fees UX | Move payment initiation to explicit student "Pay Fees" flow | Implemented | student pay-action UX, method selection, receipt handling, receipt download |
| CR-037 | Commerce | Add marketplace payment modes + 2% platform charge accounting | Implemented | order model expanded with mode + platform fee + seller net + bank details |
| CR-038 | Trust | Add disputes and verification indicators in marketplace safety pipeline | Implemented | dispute APIs/workflow + seller identity verification controls |
| CR-039 | Analytics | Add role-aware business scorecards and operations metrics | Implemented | `/analytics/scorecard` endpoint + dashboard KPI cards |
| CR-040 | Phase 0 | Replace monolithic frontend stylesheet with layered style modules | Implemented | `tokens/base/layout/utilities` plus feature layers for tasks, auth, collaboration, interaction, community, commerce, and courses; legacy `app.css` removed |
| CR-041 | Phase 0 | Split student workspace UI and orchestration into dedicated frontend units | Implemented | `StudentTasksWorkspace` owns the task surface and `useStudentWorkspace` owns student task state, reminders, and modal orchestration |
| CR-042 | Phase 0 | Split school/governance workspace orchestration and task surface into dedicated frontend units | Implemented | `SchoolTasksWorkspace` now owns assignment/review UI and `useSchoolWorkspace` owns school/state/federal task scope, filters, grading, and analytics orchestration |
| CR-043 | Phase 0 | Move course delivery orchestration into a dedicated frontend hook | Implemented | `CoursesWorkspace` now renders the course UI while `useCoursesWorkspace` owns course/bundle loading, assessments, enrollment, CGPA, and payment-selection workflows |
| CR-044 | Phase 0 | Move fees workflow orchestration into shared frontend helpers and a dedicated hook | Implemented | `FeesWorkspace` now renders the fee UI while `src/lib/fees.js` owns reusable fee helpers and `useFeesWorkspace` owns plans, invoices, payment evidence, confirmation, and navigation reactions |
| CR-045 | Phase 0 | Move marketplace orchestration into shared frontend helpers and a dedicated hook | Implemented | `MarketplaceWorkspace` now renders the commerce UI while `src/lib/marketplace.js` owns reusable marketplace helpers and `useMarketplaceWorkspace` owns filters, listings, orders, disputes, moderation, and route reactions |
| CR-046 | Phase 0 | Move collaboration hub orchestration into shared frontend helpers and a dedicated hook | Implemented | `CollaborationHubModal` now renders the collaboration UI while `src/lib/collaboration.js` owns reusable collab helpers and `useCollaborationHub` owns chat, meetings, transcript, AI summary, action-item sync, and navigation reactions |
| CR-047 | Phase 0 | Split backend commerce and community routes into dedicated domain modules | Implemented | `server/app.js` now mounts `server/domains/commerce` and `server/domains/community`; fees, marketplace, feed, and schema bootstrap no longer depend on one multi-thousand-line backend controller |
| CR-048 | Phase 0 | Add route-level integration coverage for the Phase 0 backend flows | Implemented | Node HTTP integration suites now cover auth, parent, task, fees, marketplace, community, and analytics boundaries through dedicated route-module tests in `tests/` |
| CR-049 | Post-Phase-0 | Add optional external AI provider support for meeting summaries while keeping the zero-cost fallback | Implemented | Collaboration summary generation can now call `/ai/meeting-summary` through backend env-driven provider settings, and the frontend falls back to `src/lib/meetingAi.js` whenever the external provider is unavailable |
| CR-050 | Post-Phase-0 | Surface AI summary provider diagnostics in the collaboration UI and send richer meeting context to the provider | Implemented | Collaboration now exposes `/ai/meeting-summary/status`, shows configured-vs-latest summary source in the meeting notes UI, and includes schedule/participant/transcript metadata when requesting external summaries |
| CR-051 | Post-Phase-0 | Harden real-time meeting reliability with local draft recovery and call-health signals | Implemented | Collaboration now snapshots in-progress meeting drafts into browser storage, restores recoverable notes after refresh/interruption, warns on unload, checkpoints active call notes back to the server, and shows network/transcript/sync/draft protection health inside the meeting workspace |
| CR-052 | Post-Phase-0 | Add optional OpenAI-backed meeting media transcription and editable AI task suggestions before sync | Implemented | Collaboration can now transcribe uploaded audio/video through `/ai/meeting-transcript` when the backend provider is configured, and AI-generated meeting actions become editable task drafts before users move selected items into action lists or the student task board |
| CR-053 | Post-Phase-0 | Harden live meeting sessions with device/link preflight checks and explicit rejoin controls | Implemented | Collaboration now checks join-link readiness, connection state, microphone/camera detection, and transcript support before calls, then lets users refresh the embedded call frame or open a fresh rejoin window when a Jitsi session is interrupted |
| CR-054 | Post-Phase-0 | Move meeting-media transcription onto async jobs with auto-refreshing summary suggestions | Implemented | Collaboration now queues transcription work through `/ai/meeting-transcript/jobs`, polls job status from the meeting workspace, restores in-flight job polling from recovered drafts, and automatically refreshes transcript-backed summary suggestions when the transcript result lands |
| CR-055 | Post-Phase-0 | Persist AI task review history inside each meeting record | Implemented | Collaboration now saves accepted, rejected, pending, edited, and synced task-review decisions with the meeting summary so reopening the same meeting restores review history instead of starting from a blank suggestion state |
| CR-056 | Post-Phase-0 | Replace simulated on-platform fee payment with provider-backed checkout and reconciliation | Implemented | Fees now expose provider status plus checkout/reconcile endpoints, keep manual transfer/cash confirmation unchanged, store provider refs/status in `sf_fee_payments`, let students resume/verify online fee payments before invoices are marked paid, and auto-confirm matching signed provider webhooks |
| CR-057 | Post-Phase-0 | Stabilize manual fee payment proof submission and school confirmation visibility | Implemented | The student fee card now shows receipt-readiness before submit, auto-includes a pasted receipt URL during manual submission, aligns file guidance with the secure JSON upload limits, and the transfer/cash proof flow now has dedicated end-to-end route coverage through school confirmation |
| CR-058 | Post-Phase-0 | Add marketplace wallet/escrow groundwork for card checkout orders | Implemented | Marketplace card orders now create escrow-held seller proceeds, expose `/market/wallet` plus `/market/wallet/transactions`, keep escrow/payout state visible on order records, and release seller wallet funds only after buyer claim completes the claim-code handoff |
| CR-059 | Post-Phase-0 | Expand community feed to support media-rich posts and comments | Implemented | Community feed posts/comments now accept image and video attachments, support media-only updates with derived titles, render preview grids in the UI, and carry route-level regression coverage for media persistence through thread reloads |
| CR-060 | Performance | Resolve the oversized Vite client chunk without dropping existing modules | Implemented | `src/App.jsx`, `StudentApp.jsx`, and `SchoolDashboard.jsx` now lazy-load role dashboards, account settings, and heavy non-task workspaces so the production bundle is split by role/module and the Vite chunk warning is cleared |

## 4. Key Technical Change Highlights

- schema evolution remained backward-safe through startup bootstrap + `ALTER TABLE` guards
- role/scope authorization expanded incrementally without breaking existing users
- UI redesign was delivered as module-first, keeping primary workflows accessible
- commerce and feed modules were developed with moderation and auditability in mind
- Phase 0 frontend hardening is now active in production code through layered CSS plus dedicated student, school, course, fees, marketplace, and collaboration workspace seams
- Phase 0 backend hardening is now active in production code through modular commerce/community route families and route-level integration coverage for the required high-value flows
- post-Phase-0 payment hardening is now active in production code through provider-backed fee checkout, reconciliation metadata, and route-level lifecycle coverage
- marketplace wallet/escrow groundwork is now active in production code through escrow-aware order records, seller wallet balances, wallet transaction history, and route-level claim-to-release coverage
- media-rich community groundwork is now active in production code through image/video post/comment support, media-aware feed helpers, and route-level coverage for media persistence
- frontend bundle health is now improved through lazy-loaded role dashboards and heavy workspace modules, bringing the main production chunk back below the Vite warning threshold

## 5. Audit Note

This log is based on implemented functionality present in the current codebase and delivery history from project iteration records.
