import { scoreWeek, rankWeek, inferOverUnder } from "../lib/scoring.js";
import { formatKickoff, formatLine } from "../lib/format.js";
import TeamBadge from "./TeamBadge.jsx";

const MEDAL_CLASS = { 1: "medal-gold", 2: "medal-silver", 3: "medal-bronze" };

export default function ResultsTile({ week, game, weekPicks, roster }) {
  const isComplete = Boolean(game?.completed && game.hawks_score != null && game.opp_score != null);

  let scored = null;
  let ranks = null;
  if (isComplete) {
    const picksForScoring = {};
    for (const player of roster) {
      const row = weekPicks[player.participantId];
      picksForScoring[player.participantId] = row ? { hawks: row.hawks_score, opp: row.opp_score } : null;
    }
    scored = scoreWeek(picksForScoring, { hawks: game.hawks_score, opp: game.opp_score });
    ranks = rankWeek(scored);
  }

  const home = game?.home;
  const opponent = game?.opponent ?? null;
  const homeTeamName = home === true ? "Seattle Seahawks" : home === false ? opponent : null;
  const awayTeamName = home === true ? opponent : home === false ? "Seattle Seahawks" : null;

  const lineText =
    game && (game.spread != null || game.total != null)
      ? `${formatLine(game.spread)}/${formatLine(game.total)}`
      : "—";

  const sortedRoster = [...roster].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="results-tile">
      <div className="results-tile-header">
        <span className="results-week">Week {week}</span>
        <span className="results-time">{formatKickoff(game?.commence_time)}</span>
        <span className="results-matchup">
          <TeamBadge fullName={awayTeamName} /> <span className="at-sign">@</span>{" "}
          <TeamBadge fullName={homeTeamName} />
        </span>
        <span className="results-line">{lineText}</span>
        {isComplete && (
          <span className="results-final">
            Final: SEA {game.hawks_score} – {game.opp_score}
          </span>
        )}
      </div>

      <div className="player-tiles">
        {sortedRoster.map((player) => {
          const id = player.participantId;
          const pick = weekPicks[id];
          const rank = ranks?.[id];
          const s = scored?.[id];
          const medalClass = rank ? MEDAL_CLASS[rank] ?? "" : "";
          const predictedTotal = pick ? pick.hawks_score + pick.opp_score : null;
          const predictedOu = pick ? inferOverUnder({ hawks: pick.hawks_score, opp: pick.opp_score }, game?.total ?? null) : null;

          return (
            <div className={`player-tile ${medalClass}`} key={id}>
              <div className="player-tile-name">{player.displayName}</div>
              <div className="player-tile-score-row">
                <span className="player-tile-score">
                  {pick ? `${pick.hawks_score}–${pick.opp_score}` : isComplete ? "Missed" : "No pick yet"}
                </span>
                {predictedTotal != null && (
                  <span className="player-tile-total">
                    {predictedTotal} <span className="ou-tag">{predictedOu === "Push" ? "P" : predictedOu?.charAt(0) ?? ""}</span>
                  </span>
                )}
              </div>
              {isComplete && s && (
                <div className="player-tile-diff">
                  <span className={s.correctWinner ? "check-yes" : "check-no"}>{s.correctWinner ? "✓" : "✗"}</span> Diff{" "}
                  {s.diff}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
