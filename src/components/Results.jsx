import { scoreWeek, rankWeek } from "../lib/scoring.js";

export default function Results({ weeks, roster }) {
  if (weeks.length === 0) {
    return <div className="empty-state">No completed weeks yet. Check back after the first game.</div>;
  }

  return (
    <div>
      {[...weeks].reverse().map(({ week, actual, picks }) => {
        const scored = scoreWeek(picks, actual);
        const ranks = rankWeek(scored);

        return (
          <div className="week-result" key={week}>
            <div className="week-result-head">
              <span className="week-label">Week {week}</span>
              <span className="final-score">
                Hawks {actual.hawks} – {actual.opp}
              </span>
            </div>
            <div className="pick-rows">
              {roster.map((player) => {
                const id = player.participantId;
                const s = scored[id];
                const rank = ranks[id];
                if (!s) return null;
                return (
                  <div
                    className={`pick-row ${rank === 1 ? "winner" : ""} ${s.missed ? "missed" : ""}`}
                    key={id}
                  >
                    <span className="player-name">{player.displayName}</span>
                    <span className="picked-score">
                      {s.missed ? "Missed pick" : `Picked ${describePick(picks[id])}`}
                    </span>
                    <span className="diff-badge">
                      {rank === 1 ? "★ " : ""}Diff {s.diff}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function describePick(pick) {
  return pick ? `${pick.hawks}–${pick.opp}` : "—";
}
