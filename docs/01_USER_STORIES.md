# StudyFlow User Stories and Acceptance Criteria

Last updated: March 6, 2026

## 1. Student Stories

### US-STU-001 Registration and Login
As a student, I want to create an account and sign in so that I can access my personal workspace.

Acceptance criteria:
- student can register with name, email, password, and optional school linkage
- student can log in and stay authenticated via session token
- failed auth returns a clear error message

### US-STU-002 Biodata Completion
As a student, I want to complete my biodata after login so that my profile is usable by school workflows.

Acceptance criteria:
- account modal supports bio, phone, DOB, gender, guardian, address, avatar
- biodata prompt appears for incomplete profiles
- prompt disappears once required biodata is completed

### US-STU-003 Task Self-Management
As a student, I want to create and manage tasks so that I can plan and execute my learning work.

Acceptance criteria:
- student can create/edit/delete own tasks
- task includes title, category, priority, status, deadline, progress, reminders
- task board updates without full page reload

### US-STU-004 Learning Summary on Submission
As a student, I want to submit learning evidence so that teachers can assess my work quality.

Acceptance criteria:
- when task status is submitted, learning summary is required
- summary is visible to reviewers
- summary persists after refresh

### US-STU-005 Deadline and Calendar Support
As a student, I want reminders and calendar export so that I do not miss deadlines.

Acceptance criteria:
- reminder offsets (30/10/5 minutes) can be set per task
- browser notifications can be enabled
- tasks can be exported to `.ics`

### US-STU-006 Feedback and Grading Visibility
As a student, I want to see teacher grades and feedback so that I can improve.

Acceptance criteria:
- graded status and grade chip are visible on tasks
- grade feedback is visible inside task card/view
- effective progress reflects grading impact

### US-STU-007 Collaboration Access
As a student, I want to use collaboration tools so that I can communicate with peers and educators.

Acceptance criteria:
- student can open collab module from top module bar
- student can send/receive direct chat and broadcast messages
- student can join meetings, transcripts, summaries, and feed conversations

### US-STU-008 Community Posting
As a student, I want to create community posts so that I can initiate discussions.

Acceptance criteria:
- student can publish feed posts in allowed scope
- student can comment and react to posts
- scope rules still block cross-boundary leakage

### US-STU-009 Fees Payment Evidence
As a student, I want to upload proof of payment so that school can verify my fee payment.

Acceptance criteria:
- student can mark invoice as paid with receipt media upload
- school receives item for confirmation/rejection
- student can view confirmation state and receipt details

### US-STU-010 Marketplace Participation
As a student, I want to buy and sell items so that I can transact safely inside school context.

Acceptance criteria:
- student can create listings with media, category, condition, and price
- student can browse products and place orders
- claim-code flow completes transaction after seller cash confirmation

### US-STU-011 Reviews and Trust
As a student, I want to rate products and report abuse so that marketplace quality improves.

Acceptance criteria:
- student can submit 1–5 star review with optional text
- student can report inappropriate product listings
- seller credibility and product rating are visible

## 2. School/Teacher Stories

### US-SCH-001 Student Management
As a school user, I want to view students linked to my school so that I can manage learning delivery.

Acceptance criteria:
- school can list students in scope
- student details include grade and progress indicators
- school-only scope is enforced

### US-SCH-002 Multi-Student Assignment
As a teacher, I want to assign one task to many students so that class operations are efficient.

Acceptance criteria:
- assignment form allows selecting multiple students
- one submission creates per-student task entries
- reminders, deadlines, and metadata are copied correctly

### US-SCH-003 Review and Grade
As a teacher, I want to review submitted tasks and grade with feedback so that assessment is auditable.

Acceptance criteria:
- submitted tasks are filterable and reviewable
- grade + feedback update task status and progress weighting
- re-grading is supported with updated history

### US-SCH-004 School Fees Control
As a school user, I want to issue fee plans/invoices and confirm student payments so that revenue flow is tracked.

Acceptance criteria:
- school can create fee plans and invoices
- school can confirm/reject uploaded payment evidence
- confirmation emits receipt metadata and notification

### US-SCH-005 Marketplace Moderation
As a school user, I want moderation control over listings so that unsafe content can be removed.

Acceptance criteria:
- school can hide/remove/restore listings in scope
- school reports carry higher trust weight
- moderation actions are visible in product status

### US-SCH-006 School Category Control
As a school user, I want to add school marketplace categories so that inventory can be structured.

Acceptance criteria:
- school can create category from sell form
- school category requests can be approved
- category selection is available immediately after approval

## 3. State Ministry Stories

### US-STA-001 State-Limited Oversight
As a state ministry user, I want visibility only into my state so that governance remains compliant.

Acceptance criteria:
- state user cannot access out-of-state schools/students
- dashboards filter by state and LGA
- assignments and feed actions respect state boundary

### US-STA-002 State Analytics
As a state user, I want aggregate insight across schools and LGAs so that interventions are data-driven.

Acceptance criteria:
- analytics endpoint returns state-scoped aggregates
- schools can be grouped by LGA
- task and submission metrics are available

### US-STA-003 State Communication
As a state user, I want to broadcast and post statewide updates so that schools and students receive policy guidance.

Acceptance criteria:
- state can post state-scope community updates
- state can send messages across allowed recipients
- students can respond via comments/reactions

## 4. Federal Ministry Stories

### US-FED-001 National Oversight
As a federal user, I want to access nationwide data so that national planning and intervention are possible.

Acceptance criteria:
- federal scope can query all states and schools
- federal can perform tasks available to lower governance layers
- state boundaries remain enforced for non-federal users

### US-FED-002 National Announcements
As a federal user, I want to publish high-level communication so that nationwide coordination is possible.

Acceptance criteria:
- federal-scope feed posts are supported
- users in all states can consume federal communication
- reactions/comments are captured for engagement

## 5. Cross-Cutting Platform Stories

### US-PLT-001 Notification Stream
As any authenticated user, I want activity notifications so that I can respond quickly to important events.

Acceptance criteria:
- unread counts are visible
- users can mark one/all notifications read
- major workflows emit notification records

### US-PLT-002 Password Recovery
As any user, I want a forgot-password flow so that I can regain access without admin intervention.

Acceptance criteria:
- forgot-password token can be generated
- reset token is validated before password change
- expiry is enforced by configured TTL

### US-PLT-003 Secure Role Onboarding
As platform governance, I want signup keys for privileged roles so that unauthorized role escalation is blocked.

Acceptance criteria:
- school/state/federal signup requires valid invite key
- invalid keys fail registration
- keys are environment-driven and rotatable

## 6. Pending/Future Stories (Planned)

### US-FUT-001 External AI Integration
As a collaboration user, I want ChatGPT/Whisper-backed summary/transcription so that quality is production-grade.

### US-FUT-002 Auction and Wallet
As a marketplace user, I want bidding, escrow/wallet, and refund-safe settlement so that high-value trade is secure.

### US-FUT-003 Advanced Governance Intelligence
As ministry users, I want predictive and longitudinal analytics so that policy decisions are proactive.

