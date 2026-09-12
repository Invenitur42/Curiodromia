-- Agora schema (SQLite)
-- Applied automatically by db/init.js on first run.

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  avatar_url     TEXT DEFAULT NULL,
  mode           TEXT DEFAULT NULL,        -- 'learning' | 'explore' (set once onboarding completes)
  learning_goal  TEXT DEFAULT NULL,        -- free-text topic entered at onboarding
  learning_category TEXT DEFAULT NULL,     -- matched category for resource lookup
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  slug  TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  url         TEXT,
  FOREIGN KEY (category) REFERENCES categories(slug)
);

-- A question posted either on the public homepage (classroom_id IS NULL)
-- or inside a classroom's content section (classroom_id set).
CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  classroom_id  INTEGER DEFAULT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  category      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- target_type: 'question' | 'answer'
CREATE TABLE IF NOT EXISTS votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  value       INTEGER NOT NULL,  -- 1 or -1
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(target_type, target_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- status: 'open' | 'ended'
CREATE TABLE IF NOT EXISTS classrooms (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,        -- the "intro": topic/question being explored
  category         TEXT,
  creator_id       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  conclusion       TEXT DEFAULT NULL,
  conclusion_type  TEXT DEFAULT NULL,    -- 'manual' | 'ai' (ai reserved for future use)
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at         TEXT DEFAULT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS classroom_members (
  classroom_id INTEGER NOT NULL,
  user_id      INTEGER NOT NULL,
  joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (classroom_id, user_id),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_questions_classroom ON questions(classroom_id);
CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
