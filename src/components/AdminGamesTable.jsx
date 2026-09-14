import { useState, useEffect, useCallback } from "react";
import AdminGameRow from "./AdminGameRow.jsx";
import { getGames } from "../lib/db.js";

const TOTAL_WEEKS = 18;

export default function AdminGamesTable({ onGamesChanged }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setGames(await getGames());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleSynced() {
    load();
    onGamesChanged?.();
  }

  if (loading) return <div className="empty-state">Loading…</div>;

  const gamesByWeek = {};
  for (const g of games) gamesByWeek[g.week] = g;
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

  // The Odds API's /odds endpoint only ever returns whatever the
  // Seahawks' current (next unplayed) game is — it has no concept of
  // "week number" and can't serve historical closing lines for games
  // already played. So "Update Odds" only ever does anything useful for
  // the earliest week that has a game and hasn't completed yet; showing
  // it anywhere else just guarantees the opponent-mismatch safety check
  // (see db.js's syncOdds) rejects the write.
  const relevantOddsWeek = weeks.find((w) => {
    const g = gamesByWeek[w];
    return g && !g.completed;
  });

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="ag-table-wrap">
        <table className="ag-table">
          <thead>
            <tr>
              <th>Wk</th>
              <th>Home</th>
              <th>Away</th>
              <th>Line</th>
              <th>Final</th>
              <th>Odds</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <AdminGameRow
                key={week}
                week={week}
                game={gamesByWeek[week] ?? null}
                showOddsButton={week === relevantOddsWeek}
                onSynced={handleSynced}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
