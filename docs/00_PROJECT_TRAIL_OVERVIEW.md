# StudyFlow Project Trail Overview

Last updated: March 6, 2026

## 1. Product Vision

StudyFlow is being built as a one-stop education operations platform that unifies:

- student productivity and learning evidence
- teacher/school academic operations
- state and federal education oversight
- collaboration and social interaction
- school fee and marketplace transaction workflows

The long-term end state is a unified app for student/student, student/teacher, school/ministry, and education-linked social + transaction flows.

## 2. What Has Been Delivered So Far (MVP+)

### Core Role-Based Platform

- multi-role authentication (`student`, `school`, `state`, `federal`)
- scoped access and governance boundaries
- privileged signup key protection for governance roles
- account editing, biodata support, password reset flow

### Academic Workflows

- task creation, update, delete, grading, and feedback
- student kanban and progress tracking
- learning summary capture for submitted work
- role-based dashboards and analytics
- calendar export (`.ics`) for tasks and meetings
- browser reminder support

### Collaboration & Social

- direct chat
- broadcast messaging
- meetings with call session support
- live transcript (browser speech recognition)
- in-app AI-like summary and auto todo extraction
- action-item sync to personal todo and calendar export
- community feed with post/comment/reaction

### Financial + Commerce

- school fee plans and invoices
- student upload of payment evidence
- school confirmation and receipt flow
- marketplace listing (images/videos), browsing, purchase flow
- p2p cash confirmation and claim-code completion flow
- moderation and trust signals (reports/credibility)
- product reviews (5-star + text)

## 3. Current Platform Shape

- Frontend: React + Vite (single app, role-driven UI)
- Backend: Express + PostgreSQL
- Data model: `sf_*` tables auto-bootstrapped by backend
- Security: JWT auth + bcrypt + scoped authorization checks

## 4. End Goal Alignment

Current implementation already covers major foundations for:

- education workflow operations
- role-governed collaboration
- transaction lifecycle building blocks

Remaining expansions to reach full end goal:

- external AI provider integration (ChatGPT/Whisper)
- real-time communication hardening (production RTC stack)
- wallet/escrow and auction/negotiation economics
- broader community graph and moderation automation
- production-grade reporting and governance intelligence

## 5. Document Map

- `docs/01_USER_STORIES.md`
- `docs/02_IMPLEMENTATION_WORKFLOW.md`
- `docs/03_CHANGE_REQUEST_LOG.md`
- `docs/04_PROCESS_FLOW_CURRENT_VS_END_GOAL.md`

