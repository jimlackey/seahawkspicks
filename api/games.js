import { requireSession, getPoolOrFail } from "./_lib/requireAuth.js";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";

const SEASON = 2026;

export default async function handler(req, res) {
  // GET is public — schedule/scores are meant to be viewable by anyone,
  // logged in or not. Only writes require a session (checked below,
  // scoped to the PUT branch only).
  const pool = await getPoolOrFail(res);
  if (!pool) return;

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
    const ctx = await requireSession(req, res);
    if (!ctx) return;

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
    const fields = {};
    if (body.opponent !== undefined) fields.opponent = body.opponent;
    if (body.home !== undefined) fields.home = body.home;
    if (body.commenceTime !== undefined) fields.commence_time = body.commenceTime;
    if (body.spread !== undefined) fields.spread = body.spread;
    if (body.total !== undefined) fields.total = body.total;
    if (body.hawksScore !== undefined) fields.hawks_score = body.hawksScore;
    if (body.oppScore !== undefined) fields.opp_score = body.oppScore;
    if (body.completed !== undefined) fields.completed = body.completed;
    fields.updated_at = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("pool_id", pool.id)
      .eq("season", SEASON)
      .eq("week", body.week)
      .maybeSingle();

    if (existing) {
      // Plain UPDATE — only ever touches the columns present in `fields`.
      // Deliberately NOT an upsert here: Postgres validates NOT NULL
      // constraints on the proposed row of INSERT ... ON CONFLICT DO
      // UPDATE before it even checks for a conflict, so omitting
      // opponent/home/commence_time from that kind of call fails even
      // when the row already exists and would only take the UPDATE path.
      // A plain UPDATE has no such issue since it never constructs a
      // candidate insert row.
      const { error } = await supabaseAdmin.from("games").update(fields).eq("id", existing.id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
    } else {
      // Genuinely new row — this really is an INSERT, so the NOT NULL
      // columns must actually be present.
      if (fields.opponent == null || fields.home == null || fields.commence_time == null) {
        res.status(400).json({
          error: "This week has no schedule yet — opponent, home/away, and kickoff time are required to create it.",
        });
        return;
      }
      const { error } = await supabaseAdmin
        .from("games")
        .insert({ pool_id: pool.id, season: SEASON, week: body.week, ...fields });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
    }

    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
