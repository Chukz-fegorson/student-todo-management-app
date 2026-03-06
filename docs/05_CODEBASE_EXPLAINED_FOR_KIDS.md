# StudyFlow Codebase Explained (Like You Are 5)

Last updated: March 6, 2026

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
- Collab Hub
- My Fees
- Marketplace

It also:
- loads student tasks
- checks reminders every 30 seconds
- allows task create/edit/delete

## 2.4 `src/pages/SchoolDashboard.jsx`

This is the teacher/school/governance control room.

It:
- loads students, tasks, schools, analytics
- lets role users assign tasks to many students
- lets role users review and grade
- switches between Tasks/Collab/Fees/Marketplace tabs

## 2.5 `src/components/CollaborationHubModal.jsx`

This is the collaboration playground.

It includes:
- chat
- broadcast
- meetings
- transcript and summary
- action items
- community feed panel

Meeting flow:
1. create/open meeting
2. start call
3. collect transcript
4. generate summary
5. accept todos
6. sync todos to action list/tasks/calendar

## 2.6 `src/components/MarketplaceWorkspace.jsx`

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

## 2.7 `src/components/CommunityFeedPanel.jsx`

This is the school social wall.

Users can:
- create posts (including students now)
- comment
- react

Scope rules decide who can see which posts.

## 2.8 `src/components/AccountModal.jsx`

This is profile settings.

Users can update:
- identity fields
- biodata
- location
- avatar
- password

## 2.9 `src/lib/meetingAi.js`

This is the local helper brain.

It:
- reads transcript text
- picks important sentences
- extracts todo-like lines
- returns summary, key points, and action plan

## 3. Backend Rooms (Main Files)

## 3.1 `server/index.js`

This is the main backend principal office.

It handles:
- auth (register/login/reset)
- profile (`/me`)
- tasks + grading
- students/schools directory
- meetings + notes + calendar files
- chat
- notifications
- analytics

## 3.2 `server/commerceFeed.js`

This is commerce + social backend office.

It handles:
- fees plans/invoices/payments
- marketplace categories/listings/orders/reviews/moderation
- community feed posts/comments/reactions

It also enforces role scope checks so users only do what they are allowed to do.

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
6. `src/components/MarketplaceWorkspace.jsx`
7. `server/index.js`
8. `server/commerceFeed.js`

