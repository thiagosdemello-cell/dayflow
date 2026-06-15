-- ============================================================
-- DayFlow — Supabase Schema
-- Execute this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Enable UUID extension (already active in most Supabase projects)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- TASKS table
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT        PRIMARY KEY,          -- client-generated (Date.now + random)
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  done        BOOLEAN     NOT NULL DEFAULT FALSE,
  date        DATE        NOT NULL,             -- YYYY-MM-DD
  priority    TEXT        NOT NULL DEFAULT 'none' CHECK (priority IN ('none','high','med','low')),
  recur       TEXT        NOT NULL DEFAULT 'none' CHECK (recur IN ('none','daily','weekdays','weekly')),
  category    TEXT        NOT NULL DEFAULT '',
  time_start  TEXT        NOT NULL DEFAULT '',  -- HH:MM or ''
  time_end    TEXT        NOT NULL DEFAULT '',  -- HH:MM or ''
  description TEXT        NOT NULL DEFAULT '',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- GARDEN table (focus seconds per user)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS garden (
  user_id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_seconds   BIGINT  NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- USER PREFERENCES (theme, etc.)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preferences (
  user_id              UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme                TEXT    NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
  pending_shown_date   DATE,   -- guarda a data em que o modal de pendentes foi exibido
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY — users only see their own data
-- ─────────────────────────────────────────
ALTER TABLE tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden      ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Garden policies
CREATE POLICY "garden_select" ON garden FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "garden_insert" ON garden FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "garden_update" ON garden FOR UPDATE USING (auth.uid() = user_id);

-- Preferences policies
CREATE POLICY "prefs_select" ON preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prefs_insert" ON preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_update" ON preferences FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at on row change
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at       BEFORE UPDATE ON tasks       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER garden_updated_at      BEFORE UPDATE ON garden      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER preferences_updated_at BEFORE UPDATE ON preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- PUSH SUBSCRIPTIONS (Web Push / VAPID)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_select" ON push_subscriptions FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "push_insert" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "push_delete" ON push_subscriptions FOR DELETE USING (auth.uid()=user_id);

-- ─────────────────────────────────────────
-- SCHEDULED PUSH NOTIFICATIONS
-- Guarda as notificações agendadas para serem
-- disparadas pelo cron job do Supabase
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id     TEXT        NOT NULL,
  task_name   TEXT        NOT NULL,
  task_body   TEXT        NOT NULL DEFAULT '',
  fire_at     TIMESTAMPTZ NOT NULL,
  sent        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id, fire_at)
);

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched_select" ON scheduled_notifications FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "sched_insert" ON scheduled_notifications FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "sched_update" ON scheduled_notifications FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "sched_delete" ON scheduled_notifications FOR DELETE USING (auth.uid()=user_id);

CREATE INDEX IF NOT EXISTS idx_sched_notif_fire ON scheduled_notifications(fire_at) WHERE NOT sent;

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_done ON tasks(user_id, done);

-- ─────────────────────────────────────────
-- MIGRATION: adiciona coluna pending_shown_date (execute se já tem o banco)
-- ─────────────────────────────────────────
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS pending_shown_date DATE;
