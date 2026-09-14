import { computeSeasonStandings, STANDINGS_POINTS } from "../lib/scoring.js";

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
    <table className="standings-table">
      <thead>
        <tr>
          <th className="place-col">Place</th>
          <th className="name-col">Name</th>
          <th>1st</th>
          <th>2nd</th>
          <th>3rd</th>
          <th className="total-col">Total</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((row, i) => (
          <tr key={row.player.participantId}>
            <td className="place-col">{i + 1}</td>
            <td className="name-col">{row.player.displayName}</td>
            <PlaceCell count={row.firsts} points={row.firsts * STANDINGS_POINTS[1]} />
            <PlaceCell count={row.seconds} points={row.seconds * STANDINGS_POINTS[2]} />
            <PlaceCell count={row.thirds} points={row.thirds * STANDINGS_POINTS[3]} />
            <td className="total-col">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlaceCell({ count, points }) {
  return (
    <td>
      <span className="place-count">{count}</span> <span className="place-points">({points} pts)</span>
    </td>
  );
}
