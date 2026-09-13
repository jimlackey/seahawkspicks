import { requireAdmin } from "../_lib/requireAuth.js";
import { getPoolRoster } from "../_lib/pool.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { pool } = ctx;

  if (req.method === "GET") {
    const roster = await getPoolRoster(pool.id);
    res.status(200).json({ roster });
    return;
  }

  if (req.method === "PATCH") {
    const { participantId, role } = req.body ?? {};
    if (!participantId || !["admin", "player"].includes(role)) {
      res.status(400).json({ error: "participantId and a valid role are required." });
      return;
    }
    const { error } = await supabaseAdmin
      .from("pool_memberships")
      .update({ role })
      .eq("pool_id", pool.id)
      .eq("participant_id", participantId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
