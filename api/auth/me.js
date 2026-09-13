import { getPoolBySlug } from "../_lib/pool.js";
import { getPoolSession } from "../_lib/session.js";

const POOL_SLUG = "seahawks";

export default async function handler(req, res) {
  const pool = await getPoolBySlug(POOL_SLUG);
  if (!pool) {
    res.status(500).json({ error: "Pool not found." });
    return;
  }

  const session = await getPoolSession(req, pool.id, POOL_SLUG);
  if (!session) {
    res.status(200).json({ participant: null });
    return;
  }

  res.status(200).json({
    participant: {
      id: session.participantId,
      email: session.email,
      displayName: session.displayName,
      role: session.role,
    },
  });
}
