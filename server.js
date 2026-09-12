const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { Server } = require("socket.io");

const { db, reputationTier, userReputation } = require("./db/queries");

const PORT = process.env.PORT || 4000;
const AVATAR_DIR = path.join(__dirname, "public", "uploads", "avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessionMiddleware = session({
  secret: "agora-dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// ---------------- helpers ----------------

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });
  next();
}

function publicUser(row) {
  if (!row) return null;
  const rep = userReputation(row.id);
  return {
    id: row.id,
    username: row.username,
    avatar_url: row.avatar_url,
    mode: row.mode,
    learning_goal: row.learning_goal,
    learning_category: row.learning_category,
    reputation: rep,
    tier: reputationTier(rep),
  };
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_RE = /^[a-zA-Z0-9]{10,20}$/;

// ---------------- avatar upload ----------------

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `u${req.session.userId}-${Date.now()}${ext}`);
  },
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/api/profile/avatar", requireAuth, uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(url, req.session.userId);
  res.json({ avatar_url: url });
});

// ---------------- auth ----------------

app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!USERNAME_RE.test(username || "")) {
    return res.status(400).json({ error: "Username must be 3-20 letters, numbers or underscores." });
  }
  if (!PASSWORD_RE.test(password || "")) {
    return res.status(400).json({ error: "Password must be 10-20 alphanumeric characters." });
  }
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
    return res.status(409).json({ error: "That username is taken." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
  req.session.userId = info.lastInsertRowid;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.json({ user: publicUser(user), needsOnboarding: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username || "");
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user), needsOnboarding: !user.mode });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: publicUser(user), needsOnboarding: !user.mode });
});

// ---------------- onboarding ----------------

app.get("/api/categories", (req, res) => {
  res.json({ categories: db.prepare("SELECT * FROM categories ORDER BY label").all() });
});

app.post("/api/onboarding", requireAuth, (req, res) => {
  const { mode, goal, category } = req.body || {};
  if (!["learning", "explore"].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'learning' or 'explore'." });
  }
  db.prepare(
    "UPDATE users SET mode = ?, learning_goal = ?, learning_category = ? WHERE id = ?"
  ).run(mode, mode === "learning" ? goal || null : null, mode === "learning" ? category || null : null, req.session.userId);
  res.json({ ok: true });
});

app.get("/api/resources", requireAuth, (req, res) => {
  const category = req.query.category;
  const rows = category
    ? db.prepare("SELECT * FROM resources WHERE category = ?").all(category)
    : db.prepare("SELECT * FROM resources").all();
  res.json({ resources: rows });
});

// ---------------- questions & answers ----------------

app.get("/api/questions", requireAuth, (req, res) => {
  const { scope = "home", category, sort = "trending" } = req.query;

  let where = "q.classroom_id IS NULL";
  const params = [];
  if (category) {
    where += " AND q.category = ?";
    params.push(category);
  }
  if (scope === "today") {
    where += " AND date(q.created_at) = date('now')";
  }

  let rows = db
    .prepare(
      `SELECT q.*, u.username, u.avatar_url,
        (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score,
        (SELECT COUNT(*) FROM answers a WHERE a.question_id=q.id) as answer_count
       FROM questions q JOIN users u ON u.id = q.user_id
       WHERE ${where}
       ORDER BY ${sort === "new" ? "q.created_at DESC" : "score DESC, q.created_at DESC"}`
    )
    .all(...params);

  // "Trending today" gracefully falls back to all-time trending if nothing was posted today yet.
  if (scope === "today" && rows.length === 0) {
    rows = db
      .prepare(
        `SELECT q.*, u.username, u.avatar_url,
          (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score,
          (SELECT COUNT(*) FROM answers a WHERE a.question_id=q.id) as answer_count
         FROM questions q JOIN users u ON u.id = q.user_id
         WHERE q.classroom_id IS NULL ${category ? "AND q.category = ?" : ""}
         ORDER BY score DESC, q.created_at DESC`
      )
      .all(...(category ? [category] : []));
  }

  res.json({ questions: rows });
});

app.post("/api/questions", requireAuth, (req, res) => {
  const { title, body, category, classroomId } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "A question needs a title." });

  const info = db
    .prepare("INSERT INTO questions (user_id, classroom_id, title, body, category) VALUES (?, ?, ?, ?, ?)")
    .run(req.session.userId, classroomId || null, title.trim(), body || null, category || null);

  const q = db
    .prepare(
      `SELECT q.*, u.username, u.avatar_url, 0 as score, 0 as answer_count
       FROM questions q JOIN users u ON u.id=q.user_id WHERE q.id = ?`
    )
    .get(info.lastInsertRowid);

  if (classroomId) io.to(`classroom:${classroomId}`).emit("classroom_question", q);
  res.json({ question: q });
});

app.get("/api/questions/:id", requireAuth, (req, res) => {
  const q = db
    .prepare(
      `SELECT q.*, u.username, u.avatar_url,
        (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score
       FROM questions q JOIN users u ON u.id=q.user_id WHERE q.id = ?`
    )
    .get(req.params.id);
  if (!q) return res.status(404).json({ error: "Question not found." });

  const answers = db
    .prepare(
      `SELECT a.*, u.username, u.avatar_url,
        (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='answer' AND v.target_id=a.id) as score
       FROM answers a JOIN users u ON u.id=a.user_id
       WHERE a.question_id = ?
       ORDER BY score DESC, a.created_at ASC`
    )
    .all(req.params.id);

  const myVotes = db
    .prepare(
      `SELECT target_type, target_id, value FROM votes WHERE user_id = ?
       AND ((target_type='question' AND target_id=?) OR (target_type='answer' AND target_id IN (${answers
         .map(() => "?")
         .join(",") || "NULL"})))`
    )
    .all(req.session.userId, q.id, ...answers.map((a) => a.id));

  res.json({ question: q, answers, myVotes });
});

app.post("/api/questions/:id/answers", requireAuth, (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "Answer can't be empty." });
  const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
  if (!question) return res.status(404).json({ error: "Question not found." });

  const info = db
    .prepare("INSERT INTO answers (question_id, user_id, body) VALUES (?, ?, ?)")
    .run(question.id, req.session.userId, body.trim());
  const answer = db
    .prepare(
      `SELECT a.*, u.username, u.avatar_url, 0 as score FROM answers a
       JOIN users u ON u.id=a.user_id WHERE a.id = ?`
    )
    .get(info.lastInsertRowid);

  if (question.classroom_id) {
    io.to(`classroom:${question.classroom_id}`).emit("classroom_answer", { questionId: question.id, answer });
  }
  res.json({ answer });
});

// value: 1 (up), -1 (down), 0 (remove my vote)
app.post("/api/vote", requireAuth, (req, res) => {
  const { targetType, targetId, value } = req.body || {};
  if (!["question", "answer"].includes(targetType) || ![1, -1, 0].includes(value)) {
    return res.status(400).json({ error: "Invalid vote." });
  }

  const table = targetType === "question" ? "questions" : "answers";
  const target = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(targetId);
  if (!target) return res.status(404).json({ error: "Not found." });
  if (target.user_id === req.session.userId) {
    return res.status(400).json({ error: "You can't vote on your own post." });
  }

  const existing = db
    .prepare("SELECT * FROM votes WHERE target_type=? AND target_id=? AND user_id=?")
    .get(targetType, targetId, req.session.userId);

  if (value === 0) {
    if (existing) db.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
  } else if (existing) {
    db.prepare("UPDATE votes SET value = ? WHERE id = ?").run(value, existing.id);
  } else {
    db.prepare("INSERT INTO votes (target_type, target_id, user_id, value) VALUES (?, ?, ?, ?)").run(
      targetType,
      targetId,
      req.session.userId,
      value
    );
  }

  const score = db
    .prepare("SELECT COALESCE(SUM(value),0) as s FROM votes WHERE target_type=? AND target_id=?")
    .get(targetType, targetId).s;

  // If this vote happened inside a classroom question/answer, let the room know so
  // rankings and milestones can update live for everyone present.
  let classroomId = null;
  if (targetType === "question") classroomId = target.classroom_id;
  else {
    const q = db.prepare("SELECT classroom_id FROM questions WHERE id = ?").get(target.question_id);
    classroomId = q ? q.classroom_id : null;
  }
  if (classroomId) {
    io.to(`classroom:${classroomId}`).emit("classroom_vote", { targetType, targetId, score });
  }

  res.json({ score });
});

// ---------------- classrooms ----------------

app.get("/api/classrooms", requireAuth, (req, res) => {
  const { search, category } = req.query;
  let where = "1=1";
  const params = [];
  if (search) {
    where += " AND c.title LIKE ?";
    params.push(`%${search}%`);
  }
  if (category) {
    where += " AND c.category = ?";
    params.push(category);
  }
  const rows = db
    .prepare(
      `SELECT c.*, u.username as creator_name,
        (SELECT COUNT(*) FROM classroom_members m WHERE m.classroom_id = c.id) as member_count
       FROM classrooms c JOIN users u ON u.id = c.creator_id
       WHERE ${where}
       ORDER BY c.status ASC, c.created_at DESC`
    )
    .all(...params);
  res.json({ classrooms: rows });
});

app.post("/api/classrooms", requireAuth, (req, res) => {
  const { title, category } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "Give your classroom a topic/title." });
  const info = db
    .prepare("INSERT INTO classrooms (title, category, creator_id, status) VALUES (?, ?, ?, 'open')")
    .run(title.trim(), category || null, req.session.userId);
  db.prepare("INSERT INTO classroom_members (classroom_id, user_id) VALUES (?, ?)").run(
    info.lastInsertRowid,
    req.session.userId
  );
  res.json({ id: info.lastInsertRowid });
});

app.get("/api/classrooms/:id", requireAuth, (req, res) => {
  const c = db
    .prepare(
      `SELECT c.*, u.username as creator_name FROM classrooms c JOIN users u ON u.id=c.creator_id WHERE c.id = ?`
    )
    .get(req.params.id);
  if (!c) return res.status(404).json({ error: "Classroom not found." });

  const isMember = !!db
    .prepare("SELECT 1 FROM classroom_members WHERE classroom_id=? AND user_id=?")
    .get(c.id, req.session.userId);
  const members = db
    .prepare(
      `SELECT u.id, u.username, u.avatar_url FROM classroom_members m
       JOIN users u ON u.id = m.user_id WHERE m.classroom_id = ?`
    )
    .all(c.id);

  const questions = db
    .prepare(
      `SELECT q.*, u.username, u.avatar_url,
        (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score,
        (SELECT COUNT(*) FROM answers a WHERE a.question_id=q.id) as answer_count
       FROM questions q JOIN users u ON u.id=q.user_id
       WHERE q.classroom_id = ?
       ORDER BY score DESC, q.created_at ASC`
    )
    .all(c.id);

  // Milestones: the 3 highest-rated answers anywhere in this classroom.
  const milestones = db
    .prepare(
      `SELECT a.*, u.username, u.avatar_url, q.title as question_title, q.id as question_id,
        (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='answer' AND v.target_id=a.id) as score
       FROM answers a
       JOIN users u ON u.id = a.user_id
       JOIN questions q ON q.id = a.question_id
       WHERE q.classroom_id = ?
       ORDER BY score DESC, a.created_at ASC
       LIMIT 3`
    )
    .all(c.id)
    .filter((m) => m.score > 0);

  res.json({ classroom: c, isMember, members, questions, milestones });
});

app.post("/api/classrooms/:id/join", requireAuth, (req, res) => {
  const c = db.prepare("SELECT * FROM classrooms WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Classroom not found." });
  if (c.status === "ended") return res.status(400).json({ error: "This classroom has ended." });
  db.prepare("INSERT OR IGNORE INTO classroom_members (classroom_id, user_id) VALUES (?, ?)").run(
    c.id,
    req.session.userId
  );
  const member = db.prepare("SELECT username, avatar_url FROM users WHERE id = ?").get(req.session.userId);
  io.to(`classroom:${c.id}`).emit("classroom_member_joined", { userId: req.session.userId, ...member });
  res.json({ ok: true });
});

app.post("/api/classrooms/:id/end", requireAuth, (req, res) => {
  const c = db.prepare("SELECT * FROM classrooms WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Classroom not found." });
  if (c.creator_id !== req.session.userId) return res.status(403).json({ error: "Only the creator can end this classroom." });

  const { conclusion } = req.body || {};
  db.prepare(
    "UPDATE classrooms SET status='ended', ended_at = datetime('now'), conclusion = ?, conclusion_type = ? WHERE id = ?"
  ).run(conclusion || null, conclusion ? "manual" : null, c.id);

  io.to(`classroom:${c.id}`).emit("classroom_ended", { conclusion: conclusion || null });
  res.json({ ok: true });
});

// Reserved for future work — see README. Always returns 501 so the UI can
// show "under development" instead of silently failing.
app.post("/api/classrooms/:id/generate-conclusion", requireAuth, (req, res) => {
  res.status(501).json({ error: "AI-generated conclusions are still under development. Please write one manually for now." });
});

// ---------------- profile ----------------

app.get("/api/profile/:id", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const questions = db
    .prepare(
      `SELECT q.*, (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score
       FROM questions q WHERE q.user_id = ? ORDER BY score DESC, q.created_at DESC`
    )
    .all(user.id);

  res.json({ user: publicUser(user), questions });
});

// ---------------- realtime: classroom rooms ----------------

io.on("connection", (socket) => {
  const userId = socket.request.session && socket.request.session.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  socket.on("join_classroom", (classroomId) => {
    const isMember = db
      .prepare("SELECT 1 FROM classroom_members WHERE classroom_id=? AND user_id=?")
      .get(classroomId, userId);
    if (isMember) socket.join(`classroom:${classroomId}`);
  });

  socket.on("leave_classroom", (classroomId) => socket.leave(`classroom:${classroomId}`));
});

server.listen(PORT, () => {
  console.log(`Agora running at http://localhost:${PORT}`);
});
