import PickRow from "./PickRow.jsx";

const TOTAL_WEEKS = 18;

export default function PicksGrid({ games, myPicks, onSavePick }) {
  const gamesByWeek = {};
  for (const g of games) gamesByWeek[g.week] = g;

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

  return (
    <div className="picks-table-wrap">
      <table className="picks-table">
        <thead>
          <tr>
            <th className="col-week">Wk</th>
            <th className="col-time">Time</th>
            <th className="col-team">Home</th>
            <th className="col-team">Away</th>
            <th className="col-line">Line</th>
            <th className="col-pick">SEA</th>
            <th className="col-pick">Opp</th>
            <th className="col-total">Tot</th>
            <th className="col-status"></th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <PickRow
              key={week}
              week={week}
              game={gamesByWeek[week] ?? null}
              existingPick={myPicks[week] ?? null}
              onSave={onSavePick}
            />
          ))}
        </tbody>
      </table>
      <p className="picks-legend">
        <span className="ou-tag">O</span> Over · <span className="ou-tag">U</span> Under ·{" "}
        <span className="ou-tag">P</span> Push — computed from your picked scores vs. the total line, for
        reference only.
      </p>
    </div>
  );
}
