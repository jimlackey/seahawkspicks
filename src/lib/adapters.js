/**
 * Builds the { picks, actual, week } list that scoring.js's
 * computeSeasonStandings expects, from raw completed `games` rows and a
 * { week: { participantId: pickRow } } lookup of submitted picks.
 *
 * Scoring keys are participantId (a stable identity) rather than a name,
 * since the roster is now dynamic (driven by pool_memberships) instead of
 * a fixed 3-name constant.
 */
export function buildScoringWeeks(games, picksByWeekMap, roster) {
  return games
    .filter((g) => g.completed && g.hawks_score != null && g.opp_score != null)
    .map((g) => {
      const weekPicks = picksByWeekMap[g.week] ?? {};
      const picks = {};
      for (const player of roster) {
        const row = weekPicks[player.participantId];
        picks[player.participantId] = row
          ? { hawks: row.hawks_score, opp: row.opp_score }
          : null;
      }
      return {
        week: g.week,
        actual: { hawks: g.hawks_score, opp: g.opp_score },
        picks,
      };
    })
    .sort((a, b) => a.week - b.week);
}
