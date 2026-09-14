import { requireSession } from "./_lib/requireAuth.js";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";

const SEASON = 2026;

export default async function handler(req, res) {
  const ctx = await requireSession(req, res);
  if (!ctx) return;
  const { pool } = ctx;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("pool_id", pool.id)
      .eq("season", SEASON)
      .order("week", { ascending: true });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ games: data });
    return;
  }

  if (req.method === "PUT") {
    const body = req.body ?? {};
    if (body.week == null) {
      res.status(400).json({ error: "week is required." });
      return;
    }

    // Built explicitly so a partial update (e.g. only spread/total from
    // "Update Odds", or only hawks_score/opp_score/completed from
    // "Update Score") only ever touches the columns actually provided —
    // never overwrites an unrelated field with null just because this
    // particular caller didn't send it.
    const fields = { pool_id: pool.id, season: SEASON, week: body.week };
    if (body.opponent !== undefined) fields.opponent = body.opponent;
    if (body.home !== undefined) fields.home = body.home;
    if (body.commenceTime !== undefined) fields.commence_time = body.commenceTime;
    if (body.spread !== undefined) fields.spread = body.spread;
    if (body.total !== undefined) fields.total = body.total;
    if (body.hawksScore !== undefined) fields.hawks_score = body.hawksScore;
    if (body.oppScore !== undefined) fields.opp_score = body.oppScore;
    if (body.completed !== undefined) fields.completed = body.completed;
    fields.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("games")
      .upsert(fields, { onConflict: "pool_id,season,week" });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
