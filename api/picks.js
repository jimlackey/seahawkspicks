import { requireSession } from "../_lib/requireAuth.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

const SEASON = 2026;

export default async function handler(req, res) {
  const ctx = await requireSession(req, res);
  if (!ctx) return;
  const { pool, session } = ctx;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("picks")
      .select("*, participants(email, display_name)")
      .eq("pool_id", pool.id)
      .eq("season", SEASON)
      .order("week", { ascending: true });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ picks: data });
    return;
  }

  if (req.method === "PUT") {
    const body = req.body ?? {};
    // participantId always comes from the session, never the request body —
    // otherwise anyone logged in could overwrite someone else's pick.
    const { error } = await supabaseAdmin.from("picks").upsert(
      {
        pool_id: pool.id,
        season: SEASON,
        week: body.week,
        participant_id: session.participantId,
        hawks_score: body.hawksScore,
        opp_score: body.oppScore,
        ou_pick: body.ouPick,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "pool_id,season,week,participant_id" }
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
