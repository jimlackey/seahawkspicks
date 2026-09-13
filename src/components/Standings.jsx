import { computeSeasonStandings } from "../lib/scoring.js";

export default function Standings({ weeks, roster }) {
  if (weeks.length === 0) {
    return <div className="empty-state">Standings will appear once a week's game is final.</div>;
  }

  const standings = computeSeasonStandings(weeks);
  const ranked = roster
    .map((player) => ({
      player,
      ...(standings[player.participantId] ?? { points: 0, firsts: 0, seconds: 0, thirds: 0 }),
    }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="standings-list">
      {ranked.map((row, i) => (
        <div className="standings-row" key={row.player.participantId}>
          <span className="place">{i + 1}</span>
          <span>
            <span className="name">{row.player.displayName}</span>
            <span className="record">
              {row.firsts}-{row.seconds}-{row.thirds}
            </span>
          </span>
          <span className="points">{row.points}</span>
        </div>
      ))}
    </div>
  );
}
