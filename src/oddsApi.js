/**
 * Odds API integration (The Odds API — https://the-odds-api.com)
 *
 * Fetches NFL spreads/totals and extracts the Seahawks-relative line,
 * matching the convention used in the original sheet:
 *   - spread: negative = Seahawks favored by that many points
 *             positive = Seahawks underdogs by that many points
 *   - total:  the over/under line (same number for both sides)
 *
 * Confirmed against real sheet data (see README): Week 13 (Hawks -7.0 @
 * Rams, won by 4, did not cover) and Week 1 (Hawks +6.5 vs Broncos, won
 * outright, covered) both match this sign convention exactly.
 */

const SEAHAWKS_NAME = "Seattle Seahawks";
const BASE_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds";

/**
 * Fetches raw NFL odds events from The Odds API.
 * Quota cost: markets x regions (2 markets x 1 region = 2 credits per call).
 *
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl] - injectable for testing
 * @returns {Promise<Array>} raw event list from the API
 */
export async function fetchNflOdds(apiKey, fetchImpl = fetch) {
  const url = `${BASE_URL}?regions=us&markets=spreads,totals&oddsFormat=american&apiKey=${apiKey}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Odds API request failed: ${res.status} ${res.statusText} ${body}`);
  }
  const remaining = res.headers.get("x-requests-remaining");
  const events = await res.json();
  return { events, requestsRemaining: remaining != null ? Number(remaining) : null };
}

/**
 * Finds the Seahawks' next/current game in a list of raw events.
 * @param {Array} events
 * @returns {Object|null}
 */
export function findSeahawksGame(events) {
  return (
    events.find(
      (e) => e.home_team === SEAHAWKS_NAME || e.away_team === SEAHAWKS_NAME
    ) ?? null
  );
}

/**
 * Extracts a Seahawks-relative spread and total from a raw event, averaged
 * across whichever bookmakers reported both markets (a simple consensus
 * line rather than depending on any single book).
 *
 * @param {Object} event - raw event object from the Odds API
 * @returns {{ spread: number|null, total: number|null, opponent: string|null, home: boolean|null, commenceTime: string }}
 */
export function extractSeahawksLines(event) {
  const isHome = event.home_team === SEAHAWKS_NAME;
  const opponent = isHome ? event.away_team : event.home_team;

  const spreadPoints = [];
  const totalPoints = [];

  for (const book of event.bookmakers ?? []) {
    const spreadMarket = book.markets.find((m) => m.key === "spreads");
    const totalMarket = book.markets.find((m) => m.key === "totals");

    const hawksSpread = spreadMarket?.outcomes.find((o) => o.name === SEAHAWKS_NAME);
    if (hawksSpread) spreadPoints.push(hawksSpread.point);

    const anyTotalOutcome = totalMarket?.outcomes?.[0];
    if (anyTotalOutcome) totalPoints.push(anyTotalOutcome.point);
  }

  const average = (arr) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    spread: average(spreadPoints),
    total: average(totalPoints),
    opponent,
    home: isHome,
    commenceTime: event.commence_time,
  };
}

/**
 * Convenience: fetch and extract the Seahawks' current closing lines in one call.
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl]
 */
export async function getSeahawksClosingLines(apiKey, fetchImpl = fetch) {
  const { events, requestsRemaining } = await fetchNflOdds(apiKey, fetchImpl);
  const game = findSeahawksGame(events);
  if (!game) return { game: null, lines: null, requestsRemaining };
  return { game, lines: extractSeahawksLines(game), requestsRemaining };
}
