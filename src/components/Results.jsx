import ResultsTile from "./ResultsTile.jsx";

const TOTAL_WEEKS = 18;

export default function Results({ games, picksByWeek, roster }) {
  if (roster.length === 0) {
    return <div className="empty-state">No players yet.</div>;
  }

  const gamesByWeek = {};
  for (const g of games) gamesByWeek[g.week] = g;

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

  return (
    <div>
      {weeks.map((week) => (
        <ResultsTile
          key={week}
          week={week}
          game={gamesByWeek[week] ?? null}
          weekPicks={picksByWeek[week] ?? {}}
          roster={roster}
        />
      ))}
    </div>
  );
}
