import { getPoolBySlug } from "./pool.js";
import { getPoolSession } from "./session.js";

export const POOL_SLUG = "seahawks";

/**
 * Resolves the pool and current session for a request. Sends a 401/500
 * response and returns null if either step fails, so callers can just do:
 *
 *   const ctx = await requireSession(req, res);
 *   if (!ctx) return;
 */
export async function requireSession(req, res) {
  const pool = await getPoolBySlug(POOL_SLUG);
  if (!pool) {
    res.status(500).json({ error: "Pool not found." });
    return null;
  }

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
