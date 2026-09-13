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
    const { error } = await supabaseAdmin.from("games").upsert(
      {
        pool_id: pool.id,
        season: SEASON,
        week: body.week,
        opponent: body.opponent,
        home: body.home,
        commence_time: body.commenceTime,
        spread: body.spread,
        total: body.total,
        hawks_score: body.hawksScore,
        opp_score: body.oppScore,
        completed: body.completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pool_id,season,week" }
    );
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
