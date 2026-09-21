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
  // Seahawks' current (next unplayed) game is — no per-week lookup, no
  // historical closing lines for games already played. "nextWeek" is
  // the one week that endpoint can actually answer for.
  const nextWeek = weeks.find((w) => {
    const g = gamesByWeek[w];
    return g && !g.completed;
  });

  /**
   * What the single "Update" button should do for a given row, per the
   * user's explicit rules:
   *  - completed game -> "score" (lets a wrong final score be corrected,
   *    on ANY past week, not just the most recent one)
   *  - not the next upcoming week -> nothing (either already-covered by
   *    the completed case above, or a future week with nothing to fetch)
   *  - next upcoming week, not yet kicked off -> "odds"
   *  - next upcoming week, kicked off but not yet marked completed
   *    (game in progress) -> nothing, specifically to avoid pulling
   *    live in-game odds over the closing line
   */
  function getUpdateAction(week, game) {
    if (game?.completed) return "score";
    if (week !== nextWeek) return null;
    const started = game?.commence_time ? new Date(game.commence_time) <= new Date() : false;
    return started ? null : "odds";
  }

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
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <AdminGameRow
                key={week}
                week={week}
                game={gamesByWeek[week] ?? null}
                updateAction={getUpdateAction(week, gamesByWeek[week])}
                onSynced={handleSynced}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
