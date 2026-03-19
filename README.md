# StudyFlow

StudyFlow is a role-based student task and learning tracking MVP with four roles:

- `student`: self-manages tasks, submits learning summaries, receives grades
- `school`: manages students in its school, assigns tasks, reviews and grades
- `state`: manages schools/students within one state, grouped by LGA
- `federal`: manages across states and can operate like school/state

## Current Release

- current release line: `v2`
- release summary: `CHANGELOG.md`
- version comparison: `docs/V1_TO_V2.md`
- detailed engineering trail: `docs/03_CHANGE_REQUEST_LOG.md`

## Core Features

- Student kanban board: `Todo`, `In Progress`, `Submitted`, `Done`
- Courses workspace with CGPA overview, assessment tracking, and course deadlines
- Learning Summary required for submitted tasks
- Grade + feedback workflow with grade-weighted progress
- Multi-student task assignment for governance roles
- Calendar export (`.ics`) with 30/10/5 minute reminder alarms
- Browser deadline reminders (5/10/30 minutes before deadlines)
- Scoped access control by role (school, state, federal)

## Tech Stack

- Frontend: React + Vite
- Backend: Express + PostgreSQL
- Auth: JWT + bcrypt

## Project Structure

- `src/pages/` role entrypoints
- `src/components/` workspace sections and shared UI components
- `src/hooks/` workspace state and side-effect orchestration (`useStudentWorkspace`, `useSchoolWorkspace`, `useCoursesWorkspace`, `useFeesWorkspace`, `useMarketplaceWorkspace`, `useCollaborationHub`)
- `src/styles/` layered foundation plus feature CSS files
- `server/` backend API (separate Node project with `app.js`, shared helpers, and domain route modules under `server/domains/`)
- `tests/` node-based route and helper coverage, including Phase 0 integration suites for auth, parents, tasks, fees, marketplace, community, and analytics
- `Student_Management_App.sql` optional manual schema setup
- `docs/` product + delivery trail documentation

## Project Trail Docs

- `CHANGELOG.md`
- `docs/00_PROJECT_TRAIL_OVERVIEW.md`
- `docs/01_USER_STORIES.md`
- `docs/02_IMPLEMENTATION_WORKFLOW.md`
- `docs/03_CHANGE_REQUEST_LOG.md`
- `docs/04_PROCESS_FLOW_CURRENT_VS_END_GOAL.md`
- `docs/05_CODEBASE_EXPLAINED_FOR_KIDS.md`
- `docs/06_PHASE0_EXECUTION_PLAN.md`
- `docs/V1_TO_V2.md`

## Local Setup

### 1) Recommended dev start

1. From project root, run `npm run dev`
2. The root dev runner will check `http://localhost:4000/health`
3. If the backend is not already running, it starts `server/` automatically
4. Once the backend is healthy, it starts the Vite frontend

If PowerShell blocks `npm`, use `npm.cmd run dev` instead.

### 2) Backend only

1. Copy `server/.env.example` to `server/.env`
2. Set `DATABASE_URL` and `JWT_SECRET`
3. Set privileged signup keys if you want to create governance accounts:
   - `SCHOOL_SIGNUP_KEY`
   - `STATE_SIGNUP_KEY`
   - `FEDERAL_SIGNUP_KEY`
4. Install dependencies: `npm install`
5. Start the backend from project root: `npm run backend`
6. If you want auto-restart while editing backend files, run `npm run backend:watch`

Optional external AI summary provider:
- `AI_PROVIDER_MODE=openai_compatible`
- `AI_API_KEY=...`
- `AI_API_BASE_URL=https://api.openai.com/v1`
- `AI_CHAT_COMPLETIONS_PATH=/chat/completions`
- `AI_MODEL=...`
- `AI_TIMEOUT_MS=35000`

Backend runs at `http://localhost:4000`.

### 3) Frontend only

1. From project root, install dependencies: `npm install`
2. (Optional) set `VITE_API_URL` in a root `.env` if backend URL differs
3. Start only the Vite frontend: `npm run frontend`

Frontend defaults to `http://localhost:5173`.

## API Highlights

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `GET /directory/schools`
- `GET /students`
- `GET /schools`
- `GET /tasks`
- `POST /tasks`
- `PUT /tasks/:id`
- `DELETE /tasks/:id`
- `POST /tasks/:id/grade`
- `GET /analytics/overview`
- `GET /fees/plans`
- `POST /market/orders`
- `GET /feed/posts`
- `POST /ai/meeting-summary`

## Notes

- Backend auto-creates `sf_*` tables on startup.
- `server/app.js` now mounts commerce and community through dedicated domain route modules instead of one monolithic backend controller.
- Meeting summaries can now use an optional external AI provider via backend env settings, with the existing local summarizer kept as fallback.
- `server/.env` is ignored by git via `server/.gitignore`.
- Privileged role signups (`school`, `state`, `federal`) require configured signup keys.
- Login/register endpoints use lightweight rate limiting (`AUTH_RATE_WINDOW_MS`, `AUTH_RATE_MAX_ATTEMPTS`).
- Current repo validation baseline: `npm test`, `npm run lint`, and `npm run build`.
