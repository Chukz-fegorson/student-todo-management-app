-- StudyFlow PostgreSQL schema (MVP)
-- Run this script once if you prefer manual DB setup instead of auto-bootstrap.

CREATE TABLE IF NOT EXISTS sf_schools (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  state_name TEXT NOT NULL,
  lga_name TEXT NOT NULL,
  owner_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sf_schools_unique_name_scope
  ON sf_schools ((LOWER(name)), (LOWER(state_name)), (LOWER(lga_name)));

CREATE TABLE IF NOT EXISTS sf_users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'school', 'state', 'federal')),
  school_id UUID REFERENCES sf_schools(id) ON DELETE SET NULL,
  state_name TEXT,
  lga_name TEXT,
  grade_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_users_role ON sf_users(role);
CREATE INDEX IF NOT EXISTS idx_sf_users_school_id ON sf_users(school_id);
CREATE INDEX IF NOT EXISTS idx_sf_users_state_name ON sf_users(state_name);

CREATE TABLE IF NOT EXISTS sf_tasks (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES sf_users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Assignment',
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL CHECK (status IN ('Todo', 'In Progress', 'Submitted', 'Graded', 'Done')),
  deadline TIMESTAMPTZ,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  learning_summary TEXT,
  grade TEXT,
  grade_feedback TEXT,
  graded_at TIMESTAMPTZ,
  graded_by_user_id UUID REFERENCES sf_users(id) ON DELETE SET NULL,
  reminder_offsets INTEGER[] NOT NULL DEFAULT ARRAY[30,10,5],
  source TEXT NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'assigned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_tasks_student_id ON sf_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_sf_tasks_status ON sf_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sf_tasks_deadline ON sf_tasks(deadline);

CREATE TABLE IF NOT EXISTS sf_messages (
  id UUID PRIMARY KEY,
  sender_user_id UUID NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_broadcast BOOLEAN NOT NULL DEFAULT FALSE,
  meeting_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sf_messages_sender ON sf_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_sf_messages_recipient ON sf_messages(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_sf_messages_created_at ON sf_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS sf_meetings (
  id UUID PRIMARY KEY,
  room_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  host_user_id UUID NOT NULL REFERENCES sf_users(id) ON DELETE RESTRICT,
  scheduled_for TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (duration_minutes >= 15 AND duration_minutes <= 480),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sf_meeting_participants (
  meeting_id UUID NOT NULL REFERENCES sf_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'participant')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sf_meeting_participants_user ON sf_meeting_participants(user_id);

CREATE TABLE IF NOT EXISTS sf_meeting_notes (
  meeting_id UUID PRIMARY KEY REFERENCES sf_meetings(id) ON DELETE CASCADE,
  transcript TEXT,
  summary_json JSONB,
  updated_by_user_id UUID REFERENCES sf_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sf_action_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES sf_users(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES sf_meetings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  details TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Todo' CHECK (status IN ('Todo', 'Done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_action_items_user_id ON sf_action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_sf_action_items_status ON sf_action_items(status);
CREATE INDEX IF NOT EXISTS idx_sf_action_items_due_at ON sf_action_items(due_at);

-- Useful sanity checks
SELECT role, COUNT(*) AS users_per_role FROM sf_users GROUP BY role ORDER BY role;
SELECT status, COUNT(*) AS tasks_per_status FROM sf_tasks GROUP BY status ORDER BY status;
