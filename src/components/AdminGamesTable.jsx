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
              <AdminGameRow key={week} week={week} game={gamesByWeek[week] ?? null} onSynced={handleSynced} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
