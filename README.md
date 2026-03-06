# StudyFlow

StudyFlow is a role-based student task and learning tracking MVP with four roles:

- `student`: self-manages tasks, submits learning summaries, receives grades
- `school`: manages students in its school, assigns tasks, reviews and grades
- `state`: manages schools/students within one state, grouped by LGA
- `federal`: manages across states and can operate like school/state

## Core Features

- Student kanban board: `Todo`, `In Progress`, `Submitted`, `Done`
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

- `src/` frontend app
- `server/` backend API (separate Node project)
- `Student_Management_App.sql` optional manual schema setup
- `docs/` product + delivery trail documentation

## Project Trail Docs

- `docs/00_PROJECT_TRAIL_OVERVIEW.md`
- `docs/01_USER_STORIES.md`
- `docs/02_IMPLEMENTATION_WORKFLOW.md`
- `docs/03_CHANGE_REQUEST_LOG.md`
- `docs/04_PROCESS_FLOW_CURRENT_VS_END_GOAL.md`
- `docs/05_CODEBASE_EXPLAINED_FOR_KIDS.md`

## Local Setup

### 1) Backend

1. `cd server`
2. Copy `.env.example` to `.env`
3. Set `DATABASE_URL` and `JWT_SECRET`
4. Set privileged signup keys if you want to create governance accounts:
   - `SCHOOL_SIGNUP_KEY`
   - `STATE_SIGNUP_KEY`
   - `FEDERAL_SIGNUP_KEY`
5. Install dependencies: `npm install`
6. Start server: `npm run dev`

Backend runs at `http://localhost:4000`.

### 2) Frontend

1. From project root, install dependencies: `npm install`
2. (Optional) set `VITE_API_URL` in a root `.env` if backend URL differs
3. Start frontend: `npm run dev`

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

## Notes

- Backend auto-creates `sf_*` tables on startup.
- `server/.env` is ignored by git via `server/.gitignore`.
- Privileged role signups (`school`, `state`, `federal`) require configured signup keys.
- Login/register endpoints use lightweight rate limiting (`AUTH_RATE_WINDOW_MS`, `AUTH_RATE_MAX_ATTEMPTS`).
