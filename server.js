const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { Server } = require("socket.io");

const { db, closeDb, reputationTier, userReputation } = require("./db/queries");

const PORT = process.env.PORT || 4000;
const USERS_DIR = path.join(__dirname, "public", "uploads", "users");
const MEDIA_DIR = path.join(__dirname, "public", "uploads", "media");
const BANNERS_DIR = path.join(__dirname, "public", "uploads", "banners");
fs.mkdirSync(USERS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(BANNERS_DIR, { recursive: true });

try {
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes("avatar_thumb")) db.exec("ALTER TABLE users ADD COLUMN avatar_thumb TEXT");
} catch (_) {}
try {
  const qcols = db.prepare("PRAGMA table_info(questions)").all().map((c) => c.name);
  if (!qcols.includes("media_type")) db.exec("ALTER TABLE questions ADD COLUMN media_type TEXT");
  if (!qcols.includes("media_url")) db.exec("ALTER TABLE questions ADD COLUMN media_url TEXT");
} catch (_) {}
try {
  const ccols = db.prepare("PRAGMA table_info(classrooms)").all().map((c) => c.name);
  if (!ccols.includes("banner_url")) db.exec("ALTER TABLE classrooms ADD COLUMN banner_url TEXT");
} catch (_) {}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessionMiddleware = session({
  secret: "curiodromia-dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

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
    avatar_thumb: row.avatar_thumb || row.avatar_url,
    mode: row.mode,
    learning_goal: row.learning_goal,
    learning_category: row.learning_category,
    reputation: rep,
    tier: reputationTier(rep),
  };
}

function safeName(username) {
  return String(username).replace(/[^a-zA-Z0-9_\-]/g, "_");
}

function ensureUserFolder(username) {
  const dir = path.join(USERS_DIR, safeName(username));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fpidPath(username) {
  return path.join(ensureUserFolder(username), "FPID");
}

function hasFpid(username) {
  try {
    return fs.existsSync(fpidPath(username));
  } catch {
    return false;
  }
}

function readFpid(username) {
  try {
    return fs.readFileSync(fpidPath(username), "utf8").trim();
  } catch {
    return null;
  }
}

function writeFpid(username, value) {
  fs.writeFileSync(fpidPath(username), String(value).trim(), "utf8");
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_MIN = 6;
const FPID_RE = /^[A-Za-z]{2,20}\d{4}$/;

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const user = db.prepare("SELECT username FROM users WHERE id = ?").get(req.session.userId);
    if (!user) return cb(new Error("User not found"));
    cb(null, ensureUserFolder(user.username));
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    cb(null, `avatar${ext}`);
  },
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/api/profile/avatar", requireAuth, uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });
  const user = db.prepare("SELECT username FROM users WHERE id = ?").get(req.session.userId);
  const base = `/uploads/users/${safeName(user.username)}`;
  const url = `${base}/${req.file.filename}`;
  const thumbName = `avatar_thumb${path.extname(req.file.filename)}`;
  const thumbPath = path.join(ensureUserFolder(user.username), thumbName);
  try { fs.copyFileSync(req.file.path, thumbPath); } catch (_) {}
  const thumbUrl = `${base}/${thumbName}`;
  db.prepare("UPDATE users SET avatar_url = ?, avatar_thumb = ? WHERE id = ?").run(url, thumbUrl, req.session.userId);
  res.json({ avatar_url: url, avatar_thumb: thumbUrl });
});

app.post("/api/login", (req, res) => {
  const { username, password, mode } = req.body || {};
  if (!USERNAME_RE.test(username || "")) {
    return res.status(400).json({ error: "Username must be 3–20 letters, numbers or underscores." });
  }
  if (!password || password.length < PASSWORD_MIN) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters.` });
  }
  const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (mode === "enter") {
    if (existing) return res.status(409).json({ error: "Username already taken. Use Return to log in." });
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
    ensureUserFolder(username);
    req.session.userId = info.lastInsertRowid;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    return res.json({ user: publicUser(user), needsOnboarding: true, needsFpid: true, isNew: true });
  }
  if (!existing) return res.status(401).json({ error: "Incorrect username." });
  if (!bcrypt.compareSync(password, existing.password_hash)) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  ensureUserFolder(existing.username);
  req.session.userId = existing.id;
  res.json({ user: publicUser(existing), needsOnboarding: !existing.mode, needsFpid: !hasFpid(existing.username), isNew: false });
});

app.post("/api/fpid", requireAuth, (req, res) => {
  const { fpid } = req.body || {};
  if (!FPID_RE.test(fpid || "")) return res.status(400).json({ error: "FPID must be pet name (letters) + exactly 4 digits." });
  const user = db.prepare("SELECT username FROM users WHERE id = ?").get(req.session.userId);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  writeFpid(user.username, fpid);
  res.json({ ok: true });
});

app.post("/api/recover", (req, res) => {
  const { username, fpid } = req.body || {};
  if (!username || !fpid) return res.status(400).json({ error: "Username and First Pet ID required." });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(401).json({ error: "Incorrect username." });
  const stored = readFpid(username);
  if (!stored || stored.toLowerCase() !== String(fpid).trim().toLowerCase()) {
    return res.status(401).json({ error: "Incorrect First Pet ID." });
  }
  req.session.recoveryUserId = user.id;
  req.session.recoveryUsername = username;
  res.json({ ok: true });
});

app.post("/api/reset-password", (req, res) => {
  const { username, password } = req.body || {};
  if (!req.session.recoveryUserId || req.session.recoveryUsername !== username) {
    return res.status(403).json({ error: "Recovery session expired. Start over." });
  }
  if (!password || password.length < PASSWORD_MIN) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters.` });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), req.session.recoveryUserId);
  req.session.userId = req.session.recoveryUserId;
  delete req.session.recoveryUserId;
  delete req.session.recoveryUsername;
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: publicUser(user), needsOnboarding: !user.mode });
});

app.post("/api/account/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!bcrypt.compareSync(currentPassword || "", user.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  if (!newPassword || newPassword.length < PASSWORD_MIN) {
    return res.status(400).json({ error: `New password must be at least ${PASSWORD_MIN} characters.` });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(newPassword, 10), user.id);
  res.json({ ok: true });
});

app.post("/api/account/username", requireAuth, (req, res) => {
  const { newUsername, password } = req.body || {};
  if (!USERNAME_RE.test(newUsername || "")) {
    return res.status(400).json({ error: "Username must be 3–20 letters, numbers or underscores." });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Password is incorrect." });
  }
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(newUsername)) {
    return res.status(409).json({ error: "That username is taken." });
  }
  const oldDir = path.join(USERS_DIR, safeName(user.username));
  const newDir = path.join(USERS_DIR, safeName(newUsername));
  try { if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) fs.renameSync(oldDir, newDir); } catch (_) {}
  db.prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername, user.id);
  if (user.avatar_url && user.avatar_url.includes(`/users/${safeName(user.username)}/`)) {
    const newUrl = user.avatar_url.replace(`/users/${safeName(user.username)}/`, `/users/${safeName(newUsername)}/`);
    const newThumb = (user.avatar_thumb || "").replace(`/users/${safeName(user.username)}/`, `/users/${safeName(newUsername)}/`);
    db.prepare("UPDATE users SET avatar_url = ?, avatar_thumb = ? WHERE id = ?").run(newUrl, newThumb || null, user.id);
  }
  res.json({ ok: true, username: newUsername });
});

app.get("/api/categories", (req, res) => {
  const rows = db.prepare(
    `SELECT c.slug, c.label,
      (SELECT COUNT(*) FROM questions q WHERE q.category = c.slug) +
      (SELECT COUNT(*) FROM classrooms cl WHERE cl.category = c.slug) as usage
     FROM categories c ORDER BY usage DESC, c.label ASC`
  ).all();
  res.json({ categories: rows });
});

app.post("/api/categories", requireAuth, (req, res) => {
  const { label } = req.body || {};
  if (!label || !String(label).trim()) return res.status(400).json({ error: "Category name required." });
  const clean = String(label).trim().slice(0, 40);
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `cat-${Date.now()}`;
  const existing = db.prepare("SELECT * FROM categories WHERE slug = ? OR label = ?").get(slug, clean);
  if (existing) return res.json({ category: existing });
  db.prepare("INSERT INTO categories (slug, label) VALUES (?, ?)").run(slug, clean);
  res.json({ category: { slug, label: clean } });
});

app.post("/api/onboarding", requireAuth, (req, res) => {
  const { mode, goal, category } = req.body || {};
  if (!["learning", "explore"].includes(mode)) return res.status(400).json({ error: "mode must be 'learning' or 'explore'." });
  db.prepare("UPDATE users SET mode = ?, learning_goal = ?, learning_category = ? WHERE id = ?").run(
    mode, mode === "learning" ? goal || null : null, mode === "learning" ? category || null : null, req.session.userId
  );
  res.json({ ok: true });
});

app.get("/api/resources", requireAuth, (req, res) => {
  const category = req.query.category;
  const rows = category
    ? db.prepare("SELECT * FROM resources WHERE category = ?").all(category)
    : db.prepare("SELECT * FROM resources").all();
  res.json({ resources: rows });
});

app.get("/api/questions", requireAuth, (req, res) => {
  const { scope = "home", category, sort = "trending" } = req.query;
  let where = "q.classroom_id IS NULL";
  const params = [];
  if (category) { where += " AND q.category = ?"; params.push(category); }
  if (scope === "today") where += " AND date(q.created_at) = date('now')";
  let rows = db.prepare(
    `SELECT q.*, u.username, u.avatar_url, u.avatar_thumb,
      (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score,
      (SELECT COUNT(*) FROM answers a WHERE a.question_id=q.id) as answer_count
     FROM questions q JOIN users u ON u.id = q.user_id WHERE ${where}
     ORDER BY ${sort === "new" ? "q.created_at DESC" : "score DESC, q.created_at DESC"}`
  ).all(...params);
  if (scope === "today" && rows.length === 0) {
    rows = db.prepare(
      `SELECT q.*, u.username, u.avatar_url, u.avatar_thumb,
        (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score,
        (SELECT COUNT(*) FROM answers a WHERE a.question_id=q.id) as answer_count
       FROM questions q JOIN users u ON u.id = q.user_id
       WHERE q.classroom_id IS NULL ${category ? "AND q.category = ?" : ""}
       ORDER BY score DESC, q.created_at DESC`
    ).all(...(category ? [category] : []));
  }
  res.json({ questions: rows });
});

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => cb(null, `m${req.session.userId}-${Date.now()}${path.extname(file.originalname) || ""}`),
});
const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/") || file.mimetype.startsWith("audio/");
    cb(ok ? null : new Error("Only image, video or audio allowed"), ok);
  },
});

app.post("/api/questions", requireAuth, uploadMedia.single("media"), (req, res) => {
  const title = (req.body.title || "").trim();
  const body = req.body.body || null;
  const category = req.body.category || null;
  const classroomId = req.body.classroomId ? Number(req.body.classroomId) : null;
  if (!title) return res.status(400).json({ error: "A question needs a title." });
  let media_type = null, media_url = null;
  if (req.file) {
    if (req.file.mimetype.startsWith("image/")) media_type = "image";
    else if (req.file.mimetype.startsWith("video/")) media_type = "video";
    else if (req.file.mimetype.startsWith("audio/")) media_type = "audio";
    media_url = `/uploads/media/${req.file.filename}`;
  }
  const info = db.prepare(
    "INSERT INTO questions (user_id, classroom_id, title, body, category, media_type, media_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(req.session.userId, classroomId, title, body, category, media_type, media_url);
  const q = db.prepare(
    `SELECT q.*, u.username, u.avatar_url, u.avatar_thumb, 0 as score, 0 as answer_count FROM questions q JOIN users u ON u.id=q.user_id WHERE q.id = ?`
  ).get(info.lastInsertRowid);
  if (classroomId) io.to(`classroom:${classroomId}`).emit("classroom_question", q);
  res.json({ question: q });
});

app.get("/api/questions/:id", requireAuth, (req, res) => {
  const q = db.prepare(
    `SELECT q.*, u.username, u.avatar_url, u.avatar_thumb,
      (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score
     FROM questions q JOIN users u ON u.id=q.user_id WHERE q.id = ?`
  ).get(req.params.id);
  if (!q) return res.status(404).json({ error: "Question not found." });
  const answers = db.prepare(
    `SELECT a.*, u.username, u.avatar_url, u.avatar_thumb,
      (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='answer' AND v.target_id=a.id) as score
     FROM answers a JOIN users u ON u.id=a.user_id WHERE a.question_id = ? ORDER BY score DESC, a.created_at ASC`
  ).all(req.params.id);
  const myVotes = db.prepare(
    `SELECT target_type, target_id, value FROM votes WHERE user_id = ?
     AND ((target_type='question' AND target_id=?) OR (target_type='answer' AND target_id IN (${answers.map(() => "?").join(",") || "NULL"})))`
  ).all(req.session.userId, q.id, ...answers.map((a) => a.id));
  res.json({ question: q, answers, myVotes });
});

app.post("/api/questions/:id/answers", requireAuth, (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "Answer can't be empty." });
  const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
  if (!question) return res.status(404).json({ error: "Question not found." });
  const info = db.prepare("INSERT INTO answers (question_id, user_id, body) VALUES (?, ?, ?)").run(question.id, req.session.userId, body.trim());
  const answer = db.prepare(
    `SELECT a.*, u.username, u.avatar_url, u.avatar_thumb, 0 as score FROM answers a JOIN users u ON u.id=a.user_id WHERE a.id = ?`
  ).get(info.lastInsertRowid);
  if (question.classroom_id) io.to(`classroom:${question.classroom_id}`).emit("classroom_answer", { questionId: question.id, answer });
  res.json({ answer });
});

app.post("/api/vote", requireAuth, (req, res) => {
  const { targetType, targetId, value } = req.body || {};
  if (!["question", "answer"].includes(targetType) || ![1, -1, 0].includes(value)) {
    return res.status(400).json({ error: "Invalid vote." });
  }
  const table = targetType === "question" ? "questions" : "answers";
  const target = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(targetId);
  if (!target) return res.status(404).json({ error: "Not found." });
  if (target.user_id === req.session.userId) return res.status(400).json({ error: "You can't vote on your own post." });
  const existing = db.prepare("SELECT * FROM votes WHERE target_type=? AND target_id=? AND user_id=?").get(targetType, targetId, req.session.userId);
  if (value === 0) {
    if (existing) db.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
  } else if (existing) {
    db.prepare("UPDATE votes SET value = ? WHERE id = ?").run(value, existing.id);
  } else {
    db.prepare("INSERT INTO votes (target_type, target_id, user_id, value) VALUES (?, ?, ?, ?)").run(targetType, targetId, req.session.userId, value);
  }
  const score = db.prepare("SELECT COALESCE(SUM(value),0) as s FROM votes WHERE target_type=? AND target_id=?").get(targetType, targetId).s;
  let classroomId = null;
  if (targetType === "question") classroomId = target.classroom_id;
  else {
    const q = db.prepare("SELECT classroom_id FROM questions WHERE id = ?").get(target.question_id);
    classroomId = q ? q.classroom_id : null;
  }
  if (classroomId) io.to(`classroom:${classroomId}`).emit("classroom_vote", { targetType, targetId, score });
  res.json({ score });
});

app.get("/api/classrooms", requireAuth, (req, res) => {
  const { search, category } = req.query;
  let where = "1=1";
  const params = [];
  if (search) { where += " AND c.title LIKE ?"; params.push(`%${search}%`); }
  if (category) { where += " AND c.category = ?"; params.push(category); }
  const rows = db.prepare(
    `SELECT c.*, u.username as creator_name,
      (SELECT COUNT(*) FROM classroom_members m WHERE m.classroom_id = c.id) as member_count
     FROM classrooms c JOIN users u ON u.id = c.creator_id WHERE ${where}
     ORDER BY c.status ASC, c.created_at DESC`
  ).all(...params);
  res.json({ classrooms: rows });
});

const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BANNERS_DIR),
  filename: (req, file, cb) => cb(null, `b${req.session.userId}-${Date.now()}${path.extname(file.originalname) || ".jpg"}`),
});
const uploadBanner = multer({ storage: bannerStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")) });

app.post("/api/classrooms", requireAuth, uploadBanner.single("banner"), (req, res) => {
  const title = (req.body.title || "").trim();
  const category = req.body.category || null;
  if (!title) return res.status(400).json({ error: "Give your class a topic/title." });
  const banner_url = req.file ? `/uploads/banners/${req.file.filename}` : null;
  const info = db.prepare("INSERT INTO classrooms (title, category, creator_id, status, banner_url) VALUES (?, ?, ?, 'open', ?)").run(title, category, req.session.userId, banner_url);
  db.prepare("INSERT INTO classroom_members (classroom_id, user_id) VALUES (?, ?)").run(info.lastInsertRowid, req.session.userId);
  res.json({ id: info.lastInsertRowid });
});

app.get("/api/classrooms/:id", requireAuth, (req, res) => {
  const c = db.prepare(`SELECT c.*, u.username as creator_name FROM classrooms c JOIN users u ON u.id=c.creator_id WHERE c.id = ?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: "Class not found." });
  const isMember = !!db.prepare("SELECT 1 FROM classroom_members WHERE classroom_id=? AND user_id=?").get(c.id, req.session.userId);
  const members = db.prepare(`SELECT u.id, u.username, u.avatar_url, u.avatar_thumb FROM classroom_members m JOIN users u ON u.id = m.user_id WHERE m.classroom_id = ?`).all(c.id);
  const questions = db.prepare(
    `SELECT q.*, u.username, u.avatar_url, u.avatar_thumb,
      (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score,
      (SELECT COUNT(*) FROM answers a WHERE a.question_id=q.id) as answer_count
     FROM questions q JOIN users u ON u.id=q.user_id WHERE q.classroom_id = ? ORDER BY score DESC, q.created_at ASC`
  ).all(c.id);
  const milestones = db.prepare(
    `SELECT a.*, u.username, u.avatar_url, q.title as question_title, q.id as question_id,
      (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='answer' AND v.target_id=a.id) as score
     FROM answers a JOIN users u ON u.id = a.user_id JOIN questions q ON q.id = a.question_id
     WHERE q.classroom_id = ? ORDER BY score DESC, a.created_at ASC LIMIT 3`
  ).all(c.id).filter((m) => m.score > 0);
  res.json({ classroom: c, isMember, members, questions, milestones });
});

app.post("/api/classrooms/:id/join", requireAuth, (req, res) => {
  const c = db.prepare("SELECT * FROM classrooms WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Class not found." });
  if (c.status === "ended") return res.status(400).json({ error: "This class has ended." });
  db.prepare("INSERT OR IGNORE INTO classroom_members (classroom_id, user_id) VALUES (?, ?)").run(c.id, req.session.userId);
  const member = db.prepare("SELECT username, avatar_url, avatar_thumb FROM users WHERE id = ?").get(req.session.userId);
  io.to(`classroom:${c.id}`).emit("classroom_member_joined", { userId: req.session.userId, ...member });
  res.json({ ok: true });
});

app.post("/api/classrooms/:id/end", requireAuth, (req, res) => {
  const c = db.prepare("SELECT * FROM classrooms WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Class not found." });
  if (c.creator_id !== req.session.userId) return res.status(403).json({ error: "Only the creator can end this class." });
  const { conclusion } = req.body || {};
  db.prepare("UPDATE classrooms SET status='ended', ended_at = datetime('now'), conclusion = ?, conclusion_type = ? WHERE id = ?").run(conclusion || null, conclusion ? "manual" : null, c.id);
  io.to(`classroom:${c.id}`).emit("classroom_ended", { conclusion: conclusion || null });
  res.json({ ok: true });
});

app.post("/api/classrooms/:id/generate-conclusion", requireAuth, (req, res) => {
  res.status(501).json({ error: "AI-generated conclusions are still under development." });
});

app.get("/api/profile/:id", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const questions = db.prepare(
    `SELECT q.*, (SELECT COALESCE(SUM(v.value),0) FROM votes v WHERE v.target_type='question' AND v.target_id=q.id) as score
     FROM questions q WHERE q.user_id = ? ORDER BY score DESC, q.created_at DESC`
  ).all(user.id);
  res.json({ user: publicUser(user), questions });
});

io.on("connection", (socket) => {
  const userId = socket.request.session && socket.request.session.userId;
  if (!userId) { socket.disconnect(true); return; }
  socket.on("join_classroom", (classroomId) => {
    const isMember = db.prepare("SELECT 1 FROM classroom_members WHERE classroom_id=? AND user_id=?").get(classroomId, userId);
    if (isMember) socket.join(`classroom:${classroomId}`);
  });
  socket.on("leave_classroom", (classroomId) => socket.leave(`classroom:${classroomId}`));
});

server.listen(PORT, () => {
  console.log(`Curiodromia running at http://localhost:${PORT}`);
});

// Graceful shutdown — close SQLite before V8 tears down, otherwise better-sqlite3
// Statement destructors hit "Assertion failed: (env) != nullptr" on deploy/restart.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down…`);
  try { io.close(); } catch (_) {}
  server.close(() => {
    try { closeDb(); } catch (_) {}
    process.exit(0);
  });
  setTimeout(() => {
    try { closeDb(); } catch (_) {}
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("beforeExit", () => {
  try { closeDb(); } catch (_) {}
});
