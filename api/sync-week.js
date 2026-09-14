// Vercel serverless function: GET /api/sync-week?type=odds|score
//
// Runs server-side only, where ODDS_API_KEY is available as an env var
// that's never sent to the browser.
//
// Split by type so the Admin page's separate "Update Odds"/"Update
// Score" buttons only spend credits on the endpoint they actually need
// (2 credits each) instead of always fetching both (4 credits) regardless
// of which button was clicked.
//
// The client is responsible for the actual Supabase write — this
// endpoint's only job is to keep the Odds API key off the client bundle.

import { getSeahawksClosingLines } from "../src/lib/oddsApi.js";
import { getSeahawksResult } from "../src/lib/scoresApi.js";
import { requireSession } from "./_lib/requireAuth.js";

export default async function handler(req, res) {
  const ctx = await requireSession(req, res);
  if (!ctx) return;

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ODDS_API_KEY is not configured on the server." });
    return;
  }

  const type = req.query.type === "score" ? "score" : "odds";

  try {
    if (type === "odds") {
      const oddsResult = await getSeahawksClosingLines(apiKey);
      if (!oddsResult.game) {
        res.status(200).json({ game: null, message: "No Seahawks game found (bye week?)." });
        return;
      }
      res.status(200).json({
        opponent: oddsResult.lines.opponent,
        home: oddsResult.lines.home,
        commenceTime: oddsResult.game.commence_time,
        spread: oddsResult.lines.spread,
        total: oddsResult.lines.total,
        requestsRemaining: oddsResult.requestsRemaining,
      });
      return;
    }

    // type === "score"
    const scoresResult = await getSeahawksResult(apiKey);
    if (!scoresResult.game) {
      res.status(200).json({ game: null, message: "No Seahawks game found (bye week?)." });
      return;
    }
    res.status(200).json({
      opponent: scoresResult.result.opponent,
      home: scoresResult.result.home,
      commenceTime: scoresResult.game.commence_time,
      completed: scoresResult.result.completed,
      hawksScore: scoresResult.result.hawksScore,
      oppScore: scoresResult.result.oppScore,
      requestsRemaining: scoresResult.requestsRemaining,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
