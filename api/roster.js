import { POOL_SLUG } from "./_lib/requireAuth.js";
import { getPoolBySlug, getPoolRoster } from "./_lib/pool.js";

export default async function handler(req, res) {
  // Public — only participantId/displayName are exposed (never email),
  // and the roster itself isn't sensitive; Results/Standings need this
  // to show names without requiring a session.
  const pool = await getPoolBySlug(POOL_SLUG);
  if (!pool) {
    res.status(500).json({ error: "Pool not found." });
    return;
  }

  const roster = await getPoolRoster(pool.id);
  res.status(200).json({
    roster: roster.map((r) => ({
      participantId: r.participantId,
      displayName: r.displayName ?? r.email.split("@")[0],
    })),
  });
}
