# StudyFlow V1 To V2

Last updated: March 19, 2026

## 1. Purpose

This document explains the difference between the earlier v1 app shape and the current v2 release in a fast, readable format.

Use it when you want:

- a simple upgrade summary
- a product-facing explanation of what changed
- a release overview without reading the full engineering log

## 2. Release Summary

| Area | V1 | V2 |
|---|---|---|
| Frontend page structure | Large pages and workspaces carried both UI and orchestration together | Pages are thinner and major workspaces delegate orchestration to dedicated hooks and helper modules |
| Styling system | One large shared stylesheet with growing selector coupling | Layered CSS foundation plus feature styles (`tokens`, `base`, `layout`, `utilities`, and feature files) |
| Backend route structure | Commerce and community behavior relied on a very large mixed controller file | `server/app.js` mounts dedicated domain route modules for commerce and community |
| Testing baseline | Mostly helper-level tests and limited backend route smoke coverage | Route-level integration coverage for auth, parent, task, fees, marketplace, community, and analytics flows |
| Documentation | Strong implementation trail, but less release-oriented navigation | Release-oriented docs now include `CHANGELOG.md` and this v1-to-v2 comparison guide |

## 3. What Stayed The Same

- the product still centers on student productivity, school operations, governance oversight, collaboration, fees, and marketplace workflows
- the role model is still `student`, `parent`, `school`, `state`, and `federal`
- the stack is still React + Vite on the frontend and Express + PostgreSQL on the backend
- the app still uses the same broad product model rather than a redesign from scratch

## 4. What Improved In V2

### Frontend

- student, school, courses, fees, marketplace, and collaboration surfaces are easier to change because orchestration is no longer packed into one giant component each
- task-heavy screens now use focused workspace components instead of forcing edits through oversized page files
- shared visual behavior moved into reusable CSS layers, making styling changes safer

### Backend

- commerce and community route families now have dedicated domain entry points
- server boot flow is clearer because `server/app.js` composes the route families explicitly
- commerce/community shared logic now lives in a reusable helper layer instead of being buried inside one massive controller

### Quality

- backend flow coverage now tests real HTTP route behavior for the high-value modules called out in Phase 0
- repo documentation now separates latest-release guidance from the deep engineering history

## 5. Why V2 Matters

V2 is mainly an architecture-hardening release.

It does not reinvent the product. It makes the current product safer to extend by:

- reducing coupling
- clarifying domain boundaries
- improving test coverage
- making release history easier to understand

That means future work on AI providers, real payments, richer social features, and governance intelligence can land on a cleaner base.

## 6. Where To Read More

- `CHANGELOG.md`
- `docs/03_CHANGE_REQUEST_LOG.md`
- `docs/06_PHASE0_EXECUTION_PLAN.md`
- `README.md`
