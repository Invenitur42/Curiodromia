const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "curiodromia.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

// ---------------------------------------------------------------
// Seed categories + curated resources + a little demo content so
// the homepage isn't empty on a fresh clone. Runs once, guarded by
// checking whether the categories table is already populated.
// ---------------------------------------------------------------

const CATEGORIES = [
  ["web-dev", "Web Development"],
  ["data-science", "Data Science"],
  ["design", "Design"],
  ["business", "Business & Startups"],
  ["languages", "Languages"],
  ["mathematics", "Mathematics"],
  ["career", "Career Growth"],
  ["general", "General Knowledge"],
];

const RESOURCES = {
  "web-dev": [
    ["MDN Web Docs", "The definitive reference for HTML, CSS and JavaScript.", "https://developer.mozilla.org"],
    ["freeCodeCamp", "Free, project-based curriculum covering the full web stack.", "https://www.freecodecamp.org"],
    ["The Odin Project", "A full free-software curriculum for full-stack web dev.", "https://www.theodinproject.com"],
  ],
  "data-science": [
    ["Kaggle Learn", "Short, hands-on courses in Python, ML and data visualization.", "https://www.kaggle.com/learn"],
    ["fast.ai", "Practical deep learning for coders, taught top-down.", "https://www.fast.ai"],
    ["StatQuest (YouTube)", "Statistics and ML concepts explained visually and simply.", "https://www.youtube.com/@statquest"],
  ],
  design: [
    ["Refactoring UI", "Practical visual design tips for developers.", "https://www.refactoringui.com"],
    ["Laws of UX", "A catalogue of psychology principles behind good design.", "https://lawsofux.com"],
  ],
  business: [
    ["Y Combinator's Startup School", "Free lessons on building and launching a startup.", "https://www.startupschool.org"],
    ["Indie Hackers", "Real stories and revenue numbers from bootstrapped founders.", "https://www.indiehackers.com"],
  ],
  languages: [
    ["Duolingo", "Bite-sized daily lessons in dozens of languages.", "https://www.duolingo.com"],
    ["Tandem", "Practice a language by chatting with native speakers.", "https://www.tandem.net"],
  ],
  mathematics: [
    ["3Blue1Brown (YouTube)", "Visual, intuition-first explanations of core math ideas.", "https://www.youtube.com/@3blue1brown"],
    ["Khan Academy Math", "Structured courses from arithmetic through calculus.", "https://www.khanacademy.org/math"],
  ],
  career: [
    ["Ask a Manager", "Straight-talking advice on workplace situations.", "https://www.askamanager.org"],
    ["LeetCode", "Practice technical interview questions.", "https://leetcode.com"],
  ],
  general: [
    ["Wikipedia", "Free encyclopedia — a good first stop on any topic.", "https://www.wikipedia.org"],
    ["Khan Academy", "Free courses spanning science, humanities and more.", "https://www.khanacademy.org"],
  ],
};

const categoryCount = db.prepare("SELECT COUNT(*) as n FROM categories").get().n;

if (categoryCount === 0) {
  const insertCategory = db.prepare("INSERT INTO categories (slug, label) VALUES (?, ?)");
  const insertResource = db.prepare(
    "INSERT INTO resources (category, title, description, url) VALUES (?, ?, ?, ?)"
  );

  const seedAll = db.transaction(() => {
    for (const [slug, label] of CATEGORIES) insertCategory.run(slug, label);
    for (const [category, items] of Object.entries(RESOURCES)) {
      for (const [title, description, url] of items) {
        insertResource.run(category, title, description, url);
      }
    }

    // Demo account + a few seed questions so the homepage has content
    // the first time someone clones the repo. Credentials are in the README.
    const demoHash = bcrypt.hashSync("DemoPass123", 10);
    const demoId = db
      .prepare(
        "INSERT INTO users (username, password_hash, mode, learning_category) VALUES (?, ?, 'explore', NULL)"
      )
      .run("demo", demoHash).lastInsertRowid;

    const q1 = db
      .prepare(
        "INSERT INTO questions (user_id, title, body, category) VALUES (?, ?, ?, ?)"
      )
      .run(
        demoId,
        "What's the actual difference between let, const and var?",
        "I understand var is function-scoped, but I keep seeing style guides ban it entirely. What breaks if I just use var everywhere?",
        "web-dev"
      ).lastInsertRowid;
    db.prepare("INSERT INTO answers (question_id, user_id, body) VALUES (?, ?, ?)").run(
      q1,
      demoId,
      "var is hoisted and function-scoped, so it leaks out of if/for blocks and can be re-declared silently, which causes hard-to-trace bugs. let/const are block-scoped and const won't let you reassign — that combination catches a whole class of mistakes at write-time instead of runtime."
    );
    db.prepare(
      "INSERT INTO votes (target_type, target_id, user_id, value) VALUES ('question', ?, ?, 1)"
    ).run(q1, demoId);

    const q2 = db
      .prepare("INSERT INTO questions (user_id, title, body, category) VALUES (?, ?, ?, ?)")
      .run(
        demoId,
        "How do I know when a dataset needs normalization before modeling?",
        "Every tutorial normalizes features 'just in case'. Is there a rule of thumb for when it actually matters?",
        "data-science"
      ).lastInsertRowid;
    db.prepare("INSERT INTO votes (target_type, target_id, user_id, value) VALUES ('question', ?, ?, 1)").run(
      q2,
      demoId
    );

    const c1 = db
      .prepare(
        "INSERT INTO classrooms (title, category, creator_id, status) VALUES (?, ?, ?, 'open')"
      )
      .run("Demystifying async JavaScript", "web-dev", demoId).lastInsertRowid;
    db.prepare("INSERT INTO classroom_members (classroom_id, user_id) VALUES (?, ?)").run(c1, demoId);
  });

  seedAll();
  console.log("Seeded categories, resources and demo content (user: demo / DemoPass123).");
}

module.exports = db;
