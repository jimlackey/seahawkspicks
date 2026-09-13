import { requireSession } from "./_lib/requireAuth.js";
import { getPoolRoster } from "./_lib/pool.js";

export default async function handler(req, res) {
  const ctx = await requireSession(req, res);
  if (!ctx) return;

  const roster = await getPoolRoster(ctx.pool.id);
  res.status(200).json({
    roster: roster.map((r) => ({
      participantId: r.participantId,
      displayName: r.displayName ?? r.email.split("@")[0],
    })),
  });
}
