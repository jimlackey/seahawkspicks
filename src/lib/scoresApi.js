/**
 * Scores integration (The Odds API — same provider/key as oddsApi.js)
 *
 * GET /v4/sports/{sport}/scores
 *   - Without daysFrom: only live games have scores. Cost: 1 credit.
 *   - With daysFrom=N (1-3): completed games from the last N days are
 *     included too, each with `completed: true`. Cost: 2 credits.
 * We always pass daysFrom=3 since a weekly pick pool only needs to check
 * in once a week and 2 credits/week is negligible against the 500/month
 * free allowance (same budget already used by oddsApi.js).
 */

import { findSeahawksGame } from "./oddsApi.js";

const SEAHAWKS_NAME = "Seattle Seahawks";
const BASE_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores";

/**
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl] - injectable for testing
 * @returns {Promise<{events: Array, requestsRemaining: number|null}>}
 */
export async function fetchNflScores(apiKey, fetchImpl = fetch) {
  const url = `${BASE_URL}?daysFrom=3&apiKey=${apiKey}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scores API request failed: ${res.status} ${res.statusText} ${body}`);
  }
  const remaining = res.headers.get("x-requests-remaining");
  const events = await res.json();
  return { events, requestsRemaining: remaining != null ? Number(remaining) : null };
}

/**
 * Extracts the Seahawks' final score from a raw scores-endpoint event.
 * Returns null scores if the game hasn't finished (or hasn't started) yet.
 *
 * @param {Object} event - raw event from the /scores endpoint
 * @returns {{ completed: boolean, hawksScore: number|null, oppScore: number|null, opponent: string, home: boolean, commenceTime: string }}
 */
export function extractSeahawksResult(event) {
  const isHome = event.home_team === SEAHAWKS_NAME;
  const opponent = isHome ? event.away_team : event.home_team;

  let hawksScore = null;
  let oppScore = null;

  if (event.completed && Array.isArray(event.scores)) {
    for (const s of event.scores) {
      if (s.name === SEAHAWKS_NAME) hawksScore = Number(s.score);
      else oppScore = Number(s.score);
    }
  }

  return {
    completed: Boolean(event.completed),
    hawksScore,
    oppScore,
    opponent,
    home: isHome,
    commenceTime: event.commence_time,
  };
}

/**
 * Convenience: fetch and extract the Seahawks' most recent result in one call.
 * Returns { game: null, result: null, requestsRemaining } if no Seahawks
 * game is found in the lookback window (e.g. during a bye week).
 *
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl]
 */
export async function getSeahawksResult(apiKey, fetchImpl = fetch) {
  const { events, requestsRemaining } = await fetchNflScores(apiKey, fetchImpl);
  const game = findSeahawksGame(events);
  if (!game) return { game: null, result: null, requestsRemaining };
  return { game, result: extractSeahawksResult(game), requestsRemaining };
}
