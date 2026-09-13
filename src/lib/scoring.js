/**
 * Seahawks Score Picks — scoring engine
 *
 * Pure, framework-free functions so this can be unit tested in isolation
 * and later imported directly into the React app.
 *
 * League rules (as documented in the original "Hawks Picks" sheet):
 *  - Diff = |actualHawks - pickedHawks| + |actualOpp - pickedOpp|
 *  - The weekly winner (1st place) must have correctly picked the game winner.
 *    Among players who did, the lowest Diff wins. If nobody picked the
 *    correct winner that week, 1st place falls back to the lowest Diff
 *    overall.
 *  - 2nd/3rd place are the remaining players ordered by Diff.
 *  - A missed pick (no submission) is scored as the worst Diff of the week
 *    among the other players, plus 1 — effectively guaranteeing last place.
 *  - Standings points: 1st = 3, 2nd = 1, 3rd = 0.
 */

/**
 * Infers Over/Under from a picked score against the game's total line —
 * this was previously a separate manual toggle, but it's fully determined
 * by the predicted score plus the line, so there's no independent
 * decision for the player to make.
 *
 * @param {{hawks:number, opp:number}} picked
 * @param {number|null|undefined} lineTotal - the game's total line (e.g. 44.5)
 * @returns {"Over"|"Under"|"Push"|null} null if no line is available yet
 */
export function inferOverUnder(picked, lineTotal) {
  if (lineTotal == null) return null;
  const predictedTotal = picked.hawks + picked.opp;
  if (predictedTotal === lineTotal) return "Push"; // only possible with a whole-number line
  return predictedTotal > lineTotal ? "Over" : "Under";
}

export const STANDINGS_POINTS = { 1: 3, 2: 1, 3: 0 };

/**
 * @param {{hawks:number, opp:number}} actual
 * @param {{hawks:number, opp:number}} picked
 * @returns {number} sum of absolute score errors
 */
export function computeDiff(actual, picked) {
  return Math.abs(actual.hawks - picked.hawks) + Math.abs(actual.opp - picked.opp);
}

/**
 * Did the pick correctly identify which team would win?
 * Ties (a pushed/tied game) are treated as neither team winning, so a
 * picked winner never "matches" a tie.
 */
export function pickedCorrectWinner(actual, picked) {
  const actualWinner = Math.sign(actual.hawks - actual.opp); // 1, -1, or 0
  const pickedWinner = Math.sign(picked.hawks - picked.opp);
  if (actualWinner === 0) return false;
  return actualWinner === pickedWinner;
}

/**
 * Applies the "missed pick" penalty in place: any player with pick === null
 * is assigned a diff of (max diff among submitted picks that week) + 1, and
 * is treated as not having picked the correct winner.
 *
 * @param {Object} weekPicks - { playerName: {hawks, opp} | null }
 * @param {Object} actual - { hawks, opp }
 * @returns {Object} { playerName: { diff, correctWinner, missed } }
 */
export function scoreWeek(weekPicks, actual) {
  const scored = {};
  const submitted = [];

  for (const [player, picked] of Object.entries(weekPicks)) {
    if (picked == null) continue;
    const diff = computeDiff(actual, picked);
    const correctWinner = pickedCorrectWinner(actual, picked);
    scored[player] = { diff, correctWinner, missed: false };
    submitted.push(diff);
  }

  const worstDiff = submitted.length > 0 ? Math.max(...submitted) : 0;

  for (const [player, picked] of Object.entries(weekPicks)) {
    if (picked != null) continue;
    scored[player] = { diff: worstDiff + 1, correctWinner: false, missed: true };
  }

  return scored;
}

/**
 * Ranks a scored week and returns { playerName: rank } where rank is 1, 2, or 3.
 * @param {Object} scored - output of scoreWeek()
 */
export function rankWeek(scored) {
  const players = Object.keys(scored);
  const correctPickers = players.filter((p) => scored[p].correctWinner);

  const pool = correctPickers.length > 0 ? correctPickers : players;
  const first = pool.reduce((best, p) =>
    scored[p].diff < scored[best].diff ? p : best
  , pool[0]);

  const remaining = players.filter((p) => p !== first)
    .sort((a, b) => scored[a].diff - scored[b].diff);

  const ranks = { [first]: 1 };
  remaining.forEach((p, i) => {
    ranks[p] = i + 2; // 2nd, 3rd, ...
  });
  return ranks;
}

/**
 * Computes full-season standings.
 * @param {Array<{picks: Object, actual: Object}>} weeks - one entry per played week (skip byes)
 * @returns {Object} { playerName: { points, firsts, seconds, thirds } }
 */
export function computeSeasonStandings(weeks) {
  const standings = {};

  for (const { picks, actual } of weeks) {
    const scored = scoreWeek(picks, actual);
    const ranks = rankWeek(scored);

    for (const [player, rank] of Object.entries(ranks)) {
      if (!standings[player]) {
        standings[player] = { points: 0, firsts: 0, seconds: 0, thirds: 0 };
      }
      standings[player].points += STANDINGS_POINTS[rank] ?? 0;
      if (rank === 1) standings[player].firsts += 1;
      else if (rank === 2) standings[player].seconds += 1;
      else standings[player].thirds += 1;
    }
  }

  return standings;
}
