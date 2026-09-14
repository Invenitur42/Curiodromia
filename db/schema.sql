-- Curiodromia schema (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  avatar_url     TEXT DEFAULT NULL,
  avatar_thumb   TEXT DEFAULT NULL,
  mode           TEXT DEFAULT NULL,
  learning_goal  TEXT DEFAULT NULL,
  learning_category TEXT DEFAULT NULL,
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

CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  classroom_id  INTEGER DEFAULT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  category      TEXT,
  media_type    TEXT DEFAULT NULL,
  media_url     TEXT DEFAULT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  body        TEXT NOT NULL,
  media_type  TEXT DEFAULT NULL,
  media_url   TEXT DEFAULT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  value       INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(target_type, target_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS classrooms (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  category         TEXT,
  creator_id       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  banner_url       TEXT DEFAULT NULL,
  conclusion       TEXT DEFAULT NULL,
  conclusion_type  TEXT DEFAULT NULL,
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

-- Track (follow) other users
CREATE TABLE IF NOT EXISTS tracks (
  tracker_id  INTEGER NOT NULL,
  tracked_id  INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tracker_id, tracked_id),
  FOREIGN KEY (tracker_id) REFERENCES users(id),
  FOREIGN KEY (tracked_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_questions_classroom ON questions(classroom_id);
CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_tracks_tracked ON tracks(tracked_id);
