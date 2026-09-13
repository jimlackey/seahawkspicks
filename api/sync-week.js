// Vercel serverless function: GET /api/sync-week
//
// Runs server-side only, where ODDS_API_KEY is available as an env var
// that's never sent to the browser. Combines the current Seahawks
// spread/total with the latest result (if the game has finished) into one
// response the client can use to update Supabase.
//
// The client is responsible for the actual Supabase write (using the
// public anon key, same as picks) — this endpoint's only job is to keep
// the Odds API key off the client bundle.

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

  try {
    const [oddsResult, scoresResult] = await Promise.all([
      getSeahawksClosingLines(apiKey),
      getSeahawksResult(apiKey),
    ]);

    if (!oddsResult.game && !scoresResult.game) {
      res.status(200).json({ game: null, message: "No Seahawks game found (bye week?)." });
      return;
    }

    // Prefer the scores-endpoint game if it's completed (it's the more
    // recent/relevant one); otherwise use whichever game the odds endpoint
    // found (the upcoming one).
    const useScores = scoresResult.result?.completed;
    const source = useScores ? scoresResult : oddsResult;

    res.status(200).json({
      opponent: source.lines?.opponent ?? scoresResult.result?.opponent ?? oddsResult.lines?.opponent,
      home: source.lines?.home ?? scoresResult.result?.home ?? oddsResult.lines?.home,
      commenceTime: source.game.commence_time,
      spread: oddsResult.lines?.spread ?? null,
      total: oddsResult.lines?.total ?? null,
      completed: scoresResult.result?.completed ?? false,
      hawksScore: scoresResult.result?.hawksScore ?? null,
      oppScore: scoresResult.result?.oppScore ?? null,
      requestsRemaining: scoresResult.requestsRemaining ?? oddsResult.requestsRemaining,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
