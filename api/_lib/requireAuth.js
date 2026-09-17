import { getPoolBySlug } from "./pool.js";
import { getPoolSession } from "./session.js";

export const POOL_SLUG = "seahawks";

/**
 * Resolves the pool, writing a clean error response and returning null on
 * failure — either a genuine "not found" or a real query failure (network
 * blip, Supabase cold-starting after inactivity, etc., which now surfaces
 * its actual message instead of being misreported as "not found"; see
 * getPoolBySlug). Shared by every endpoint that needs the pool, whether
 * or not it also requires a session, so this logic lives in exactly one
 * place instead of being copy-pasted per file.
 */
export async function getPoolOrFail(res) {
  let pool;
  try {
    pool = await getPoolBySlug(POOL_SLUG);
  } catch (err) {
    res.status(502).json({ error: err.message });
    return null;
  }
  if (!pool) {
    res.status(500).json({ error: "Pool not found." });
    return null;
  }
  return pool;
}

/**
 * Resolves the pool and current session for a request. Sends a 401/500/502
 * response and returns null if any step fails, so callers can just do:
 *
 *   const ctx = await requireSession(req, res);
 *   if (!ctx) return;
 */
export async function requireSession(req, res) {
  const pool = await getPoolOrFail(res);
  if (!pool) return null;

  const session = await getPoolSession(req, pool.id, POOL_SLUG);
  if (!session) {
    res.status(401).json({ error: "Not logged in." });
    return null;
  }

  return { pool, session };
}

/** Like requireSession, but also requires the 'admin' role. */
export async function requireAdmin(req, res) {
  const ctx = await requireSession(req, res);
  if (!ctx) return null;
  if (ctx.session.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return null;
  }
  return ctx;
}
