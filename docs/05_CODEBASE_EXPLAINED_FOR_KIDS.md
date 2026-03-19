# StudyFlow Codebase Explained (Like You Are 5)

Last updated: March 19, 2026

## 1. Big Picture

Imagine StudyFlow is a big school building:

- the **frontend** is what people see and click
- the **backend** is the office room where records are stored and checked
- the **database** is the big notebook where all school information is written

When someone clicks a button, frontend asks backend for help.  
Backend checks rules, reads/writes the notebook, then sends an answer back.

## 2. Frontend Rooms (Main Files)

## 2.1 `src/App.jsx`

This is the main gate.

It:
- checks if someone is already logged in
- decides whether to show login page or dashboard
- shows top bar (name, role, notifications)
- opens account settings

## 2.2 `src/pages/AuthPage.jsx`

This is the login/register/reset room.

It:
- lets users sign in
- lets new users register by role
- lets users reset password
- loads school/state/LGA options for forms

## 2.3 `src/pages/StudentApp.jsx`

This is the student home classroom.

It has tabs:
- My Tasks
- Courses
- Collab Hub
- My Fees
- Marketplace

It also:
- uses a helper hook to load student data and manage reminders
- uses a task workspace component to show the task board, deadlines, and support views
- allows task create/edit/delete

## 2.4 `src/pages/SchoolDashboard.jsx`

This is the teacher/school/governance control room.

It:
- uses a helper hook to load students, tasks, schools, analytics, and scorecards
- uses a task workspace component for assigning, filtering, reviewing, and grading
- lets role users assign tasks to many students
- switches between Tasks/Courses/Collab/Fees/Marketplace tabs

## 2.5 `src/components/CollaborationHubModal.jsx`

This is the collaboration playground.

It includes:
- chat
- broadcast
- meetings
- transcript and summary
- action items
- community feed panel
- uses a helper hook to manage people lists, chat refresh, meeting state, live transcript, summary sync, optional external AI summary requests, and follow-up actions

Meeting flow:
1. create/open meeting
2. start call
3. collect transcript
4. generate summary
5. accept todos
6. sync todos to action list/tasks/calendar

## 2.6 `src/components/CoursesWorkspace.jsx`

This is the learning delivery room.

It:
- shows course cards and CGPA progress
- lets schools/governance users create courses, modules, assessments, and bundles
- lets students unlock courses and attempt assessments
- uses a helper hook to manage course data loading, enrollment flow, payment draft state, and assessment actions

## 2.7 `src/components/FeesWorkspace.jsx`

This is the school cashier room.

It:
- shows available fee plans and generated invoices
- lets students upload payment proof and download invoices/receipts
- lets schools confirm payments and issue school receipt notes
- uses a helper hook plus shared fee helpers to manage invoice state, payment drafts, and confirmation queues

## 2.8 `src/components/MarketplaceWorkspace.jsx`

This is the mini shop.

It supports:
- browse products
- sell products
- orders
- moderation (for privileged roles)

Important pieces:
- multi-media listing (images/videos)
- category + custom category (`Others`)
- school category add flow
- claim-code order completion flow
- 5-star review UI
- helper hook manages catalog filters, listing drafts, orders, disputes, and moderation actions

## 2.9 `src/components/CommunityFeedPanel.jsx`

This is the school social wall.

Users can:
- create posts (including students now)
- comment
- react

Scope rules decide who can see which posts.

## 2.10 `src/components/AccountModal.jsx`

This is profile settings.

Users can update:
- identity fields
- biodata
- location
- avatar
- password

## 2.11 `src/lib/meetingAi.js`

This is the local helper brain.

It:
- reads transcript text
- picks important sentences
- extracts todo-like lines
- returns summary, key points, and action plan

## 3. Backend Rooms (Main Files)

## 3.1 `server/app.js`

This is the main backend principal office.

It handles:
- building the Express app
- connecting the big backend rooms together
- mounting auth, tasks, courses, collaboration, parents, analytics, commerce, and community routes
- starting the health checks and startup bootstrap work

It also wires optional external AI summary settings into the collaboration backend.

## 3.2 `server/domains/commerce/`

This is the school shop office.

It handles:
- fees plans/invoices/payments
- marketplace categories/listings/orders/reviews/moderation
- startup bootstrap for commerce tables and seed categories

Important files:
- `server/domains/commerce/feesRoutes.js`
- `server/domains/commerce/marketplaceRoutes.js`
- `server/domains/commerce/bootstrap.js`

## 3.3 `server/domains/community/routes.js`

This is the school social wall office.

It handles:
- audience lookup
- feed posts
- comments
- reactions

## 3.4 `server/commerceFeed.js`

This is now the shared helper toolbox for commerce + community.

It stores:
- mapper helpers
- normalization helpers
- scope helpers
- reusable fetch helpers used by the commerce/community route files

## 4. How Frontend and Backend Talk

Example: student creates a task

1. student clicks **New Task**
2. frontend sends `POST /tasks`
3. backend checks token and role
4. backend saves task in DB
5. backend returns created task
6. frontend updates board immediately

Same pattern is used across almost all features.

## 5. Roles and Permissions (Simple)

- `student`: manage own learning, join collab, use fees/marketplace
- `school`: manage school students/tasks/fees, moderate in school scope
- `state`: manage across schools in one state
- `federal`: manage across all states

## 6. Why Comments Were Added

Comments were added in core files to explain:
- what each state block stores
- what each helper function does
- why effects run
- how modules connect

Goal: make the code easier for new developers and non-technical reviewers to understand.

## 7. If You Are Reading This for the First Time

Read in this order:

1. `src/App.jsx`
2. `src/pages/AuthPage.jsx`
3. `src/pages/StudentApp.jsx`
4. `src/pages/SchoolDashboard.jsx`
5. `src/components/CollaborationHubModal.jsx`
6. `src/components/FeesWorkspace.jsx`
7. `src/components/MarketplaceWorkspace.jsx`
8. `server/app.js`
9. `server/domains/commerce/feesRoutes.js`
10. `server/domains/commerce/marketplaceRoutes.js`
11. `server/domains/community/routes.js`
