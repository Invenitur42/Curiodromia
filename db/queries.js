// Shared helpers used across routes: DB handle, and reputation math.
// Keeping this in one place keeps the "how is a score computed" logic consistent.

const db = require("./init");

function reputationTier(score) {
  if (score >= 50) return "Luminary";
  if (score >= 20) return "Voice";
  if (score >= 5) return "Contributor";
  return "Newcomer";
}

function userReputation(userId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(v.value), 0) as rep
       FROM questions q
       LEFT JOIN votes v ON v.target_type = 'question' AND v.target_id = q.id
       WHERE q.user_id = ?`
    )
    .get(userId);
  return row.rep || 0;
}

module.exports = { db, reputationTier, userReputation };
