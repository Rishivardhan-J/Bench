-- Bench schema. Rules the old Firestore rules enforced live here as constraints.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         citext NOT NULL UNIQUE,            -- one email, one account type
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('client', 'freelancer', 'admin')),
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE password_resets (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE TABLE client_profiles (
  user_id    text PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  name       text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  company    text NOT NULL DEFAULT '' CHECK (char_length(company) <= 80),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE freelancer_profiles (
  user_id            text PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  name               text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  headline           text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 120),
  bio                text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  skills             text[] NOT NULL DEFAULT '{}' CHECK (cardinality(skills) <= 30),
  rate_min           numeric NOT NULL DEFAULT 0 CHECK (rate_min >= 0),
  rate_max           numeric NOT NULL DEFAULT 0,
  currency           text NOT NULL DEFAULT 'USD',
  availability       text NOT NULL DEFAULT 'now' CHECK (availability IN ('now', 'this_week', 'busy', 'offline')),
  back_on            text,
  timezone           text NOT NULL DEFAULT 'UTC',
  portfolio_url      text,
  avatar_url         text,
  languages          text[] NOT NULL DEFAULT '{}',
  experience         jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_array_length(experience) <= 10),
  education          jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_array_length(education) <= 6),
  portfolio          jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_array_length(portfolio) <= 6),
  resume_path        text,
  -- Server-owned: never written from a request body.
  approved           boolean NOT NULL DEFAULT false,
  verified           boolean NOT NULL DEFAULT false,
  paused             boolean NOT NULL DEFAULT false,
  review_status      text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'pending', 'changes_requested', 'approved')),
  review_note        text,
  completeness       integer NOT NULL DEFAULT 0,
  rating_avg         numeric(2, 1),
  review_count       integer NOT NULL DEFAULT 0,
  reply_count        integer NOT NULL DEFAULT 0,
  reply_minutes_total integer NOT NULL DEFAULT 0,
  avg_response_minutes integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (rate_max >= rate_min)
);
CREATE INDEX freelancer_live_idx ON freelancer_profiles (approved, paused);
CREATE INDEX freelancer_queue_idx ON freelancer_profiles (review_status, updated_at);
CREATE INDEX freelancer_skills_idx ON freelancer_profiles USING gin (skills);

CREATE TABLE blocks (
  blocker_id text NOT NULL REFERENCES users ON DELETE CASCADE,
  blocked_id text NOT NULL REFERENCES users ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE projects (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id   text NOT NULL REFERENCES users ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  skills      text[] NOT NULL DEFAULT '{}' CHECK (cardinality(skills) <= 15),
  budget_min  numeric NOT NULL DEFAULT 0,
  budget_max  numeric NOT NULL DEFAULT 0,
  timeline    text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_status_idx ON projects (status, created_at DESC);
CREATE INDEX projects_client_idx ON projects (client_id, created_at DESC);

CREATE TABLE connections (
  id                     text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id              text NOT NULL REFERENCES users ON DELETE CASCADE,
  freelancer_id          text NOT NULL REFERENCES users ON DELETE CASCADE,
  project_id             text REFERENCES projects ON DELETE SET NULL,
  brief_text             text,
  first_message          text NOT NULL,
  status                 text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked', 'expired')),
  decline_reason         text CHECK (decline_reason IN ('booked', 'budget', 'skills', 'other')),
  referred_freelancer_id text REFERENCES users ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  responded_at           timestamptz,
  UNIQUE (client_id, freelancer_id)
);
CREATE INDEX connections_freelancer_idx ON connections (freelancer_id, created_at DESC);
CREATE INDEX connections_client_idx ON connections (client_id, created_at DESC);

CREATE TABLE threads (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connection_id   text NOT NULL UNIQUE REFERENCES connections ON DELETE CASCADE,
  closed          boolean NOT NULL DEFAULT false,
  hire_id         text,
  last_message    text,
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE thread_participants (
  thread_id text NOT NULL REFERENCES threads ON DELETE CASCADE,
  user_id   text NOT NULL REFERENCES users ON DELETE CASCADE,
  unread    integer NOT NULL DEFAULT 0,
  last_read timestamptz,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX thread_participants_user_idx ON thread_participants (user_id);

ALTER TABLE connections ADD COLUMN thread_id text REFERENCES threads ON DELETE SET NULL;

CREATE TABLE messages (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  thread_id   text NOT NULL REFERENCES threads ON DELETE CASCADE,
  sender_id   text NOT NULL REFERENCES users ON DELETE CASCADE,
  text        text NOT NULL DEFAULT '' CHECK (char_length(text) <= 4000),
  attachments jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_array_length(attachments) <= 5),
  system      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(text) > 0 OR jsonb_array_length(attachments) > 0)
);
CREATE INDEX messages_thread_idx ON messages (thread_id, created_at);

CREATE TABLE hires (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id     text NOT NULL REFERENCES users ON DELETE CASCADE,
  freelancer_id text NOT NULL REFERENCES users ON DELETE CASCADE,
  project_id    text,
  marked_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hires_unique_idx ON hires (client_id, freelancer_id, coalesce(project_id, ''));

-- A deleted client's reviews stay, anonymised: client_id becomes NULL.
CREATE TABLE reviews (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  hire_id       text NOT NULL UNIQUE,                 -- one review per engagement
  client_id     text REFERENCES users ON DELETE SET NULL,
  client_name   text NOT NULL DEFAULT 'Client',
  freelancer_id text NOT NULL REFERENCES users ON DELETE CASCADE,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text          text NOT NULL CHECK (char_length(text) BETWEEN 10 AND 1500),
  reply         text CHECK (char_length(reply) <= 800),
  replied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_freelancer_idx ON reviews (freelancer_id, created_at DESC);

CREATE TABLE proposals (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id    text NOT NULL REFERENCES projects ON DELETE CASCADE,
  client_id     text NOT NULL REFERENCES users ON DELETE CASCADE,
  freelancer_id text NOT NULL REFERENCES users ON DELETE CASCADE,
  message       text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  rate          numeric NOT NULL CHECK (rate >= 0),
  status        text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'shortlisted', 'declined', 'chosen')),
  thread_id     text REFERENCES threads ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, freelancer_id)                  -- one proposal per freelancer per project
);
CREATE INDEX proposals_freelancer_idx ON proposals (freelancer_id, created_at DESC);

CREATE TABLE shortlists (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id  text NOT NULL REFERENCES users ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shortlists_client_idx ON shortlists (client_id, created_at);

CREATE TABLE shortlist_items (
  shortlist_id  text NOT NULL REFERENCES shortlists ON DELETE CASCADE,
  freelancer_id text NOT NULL REFERENCES users ON DELETE CASCADE,
  note          text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  position      integer NOT NULL DEFAULT 0,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shortlist_id, freelancer_id)
);

CREATE TABLE shortlist_shares (
  token        text PRIMARY KEY,
  shortlist_id text NOT NULL REFERENCES shortlists ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);
CREATE INDEX shortlist_shares_list_idx ON shortlist_shares (shortlist_id);

CREATE TABLE saved_searches (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id     text NOT NULL REFERENCES users ON DELETE CASCADE,
  label         text NOT NULL CHECK (char_length(label) <= 80),
  query         text NOT NULL DEFAULT '',
  filters       jsonb NOT NULL DEFAULT '{}',
  alert_enabled boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_searches_client_idx ON saved_searches (client_id);

CREATE TABLE notifications (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    text NOT NULL REFERENCES users ON DELETE CASCADE,
  type       text NOT NULL,
  ref_id     text,
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  link       text NOT NULL DEFAULT '/',
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE notification_prefs (
  user_id text PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  prefs   jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE reports (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reporter_id text REFERENCES users ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('profile', 'message')),
  target_id   text NOT NULL,
  reason      text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);

CREATE TABLE review_summaries (
  freelancer_id text PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  summary       text NOT NULL,
  review_count  integer NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_stats_daily (
  freelancer_id  text NOT NULL REFERENCES users ON DELETE CASCADE,
  day            date NOT NULL,
  views          integer NOT NULL DEFAULT 0,
  shortlist_adds integer NOT NULL DEFAULT 0,
  requests       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (freelancer_id, day)
);

CREATE TABLE profile_viewers (
  freelancer_id text NOT NULL REFERENCES users ON DELETE CASCADE,
  day           date NOT NULL,
  viewer_hash   text NOT NULL,
  PRIMARY KEY (freelancer_id, day, viewer_hash)
);

CREATE TABLE rate_limits (
  key      text PRIMARY KEY,
  count    integer NOT NULL,
  reset_at timestamptz NOT NULL
);

CREATE TABLE mail_outbox (
  id         bigserial PRIMARY KEY,
  to_email   text NOT NULL,
  subject    text NOT NULL,
  body       text NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  send_after timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_outbox_due_idx ON mail_outbox (send_after) WHERE sent_at IS NULL;
