# StudyFlow Change Request Log

Last updated: March 19, 2026

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
| CR-031 | Strategic | Add wallet-backed auctions and bidding | Planned | not yet in backend domain model |
| CR-032 | Strategic | Integrate external ChatGPT/Whisper APIs | Planned | current version uses local, zero-cost summarizer |
| CR-033 | Strategic | Expand social graph to Slack/Twitter-like streams | Partially Implemented | community feed baseline exists; advanced threads pending |
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

## 4. Key Technical Change Highlights

- schema evolution remained backward-safe through startup bootstrap + `ALTER TABLE` guards
- role/scope authorization expanded incrementally without breaking existing users
- UI redesign was delivered as module-first, keeping primary workflows accessible
- commerce and feed modules were developed with moderation and auditability in mind
- Phase 0 frontend hardening is now active in production code through layered CSS plus dedicated student, school, course, fees, marketplace, and collaboration workspace seams
- Phase 0 backend hardening is now active in production code through modular commerce/community route families and route-level integration coverage for the required high-value flows

## 5. Audit Note

This log is based on implemented functionality present in the current codebase and delivery history from project iteration records.
