# Changelog

All notable changes to StudyFlow are documented here.

This release log complements the deeper engineering trail in `docs/03_CHANGE_REQUEST_LOG.md`.

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
