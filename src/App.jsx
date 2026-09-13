import { useState, useEffect, useCallback, useMemo } from "react";
import TabBar from "./components/TabBar.jsx";
import ThisWeek from "./components/ThisWeek.jsx";
import Results from "./components/Results.jsx";
import Standings from "./components/Standings.jsx";
import Login from "./components/Login.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import {
  getCurrentParticipant,
  logout,
  getRoster,
  getGames,
  getPicks,
  savePick,
  syncGame,
  picksByWeek,
} from "./lib/db.js";
import { buildScoringWeeks } from "./lib/adapters.js";

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = checking, null = logged out
  const [tab, setTab] = useState("week");
  const [week, setWeek] = useState(1);
  const [roster, setRoster] = useState([]);
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Check for an existing session on load.
  useEffect(() => {
    getCurrentParticipant()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [rosterData, gamesData, picksData] = await Promise.all([
        getRoster(),
        getGames(),
        getPicks(),
      ]);
      setRoster(rosterData);
      setGames(gamesData);
      setPicks(picksData);
      if (gamesData.length > 0) {
        setWeek(Math.max(...gamesData.map((g) => g.week)));
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me) loadData();
  }, [me, loadData]);

  const picksMap = useMemo(() => picksByWeek(picks), [picks]);
  const currentGame = useMemo(() => games.find((g) => g.week === week) ?? null, [games, week]);
  const scoringWeeks = useMemo(
    () => buildScoringWeeks(games, picksMap, roster),
    [games, picksMap, roster]
  );

  async function handleSync() {
    setSyncing(true);
    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${basePath}/api/sync-week`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      if (!data.game && data.message) throw new Error(data.message);

      await syncGame({
        week,
        opponent: data.opponent,
        home: data.home,
        commenceTime: data.commenceTime,
        spread: data.spread,
        total: data.total,
        hawksScore: data.hawksScore,
        oppScore: data.oppScore,
        completed: data.completed,
      });
      await loadData();
    } finally {
      setSyncing(false);
    }
  }

  async function handleSavePick(pick) {
    await savePick(pick);
    await loadData();
  }

  async function handleLogout() {
    await logout();
    setMe(null);
  }

  if (me === undefined) {
    return (
      <div className="app-shell">
        <div className="empty-state">Loading…</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="app-shell">
        <Login onLoggedIn={setMe} />
      </div>
    );
  }

  const isAdmin = me.role === "admin";

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Seahawks Score Picks</h1>
        <button
          onClick={handleLogout}
          style={{ background: "none", border: "none", color: "var(--grey)", fontSize: 13, cursor: "pointer" }}
        >
          Sign out ({me.displayName ?? me.email})
        </button>
      </header>

      <TabBar active={tab} onChange={setTab} isAdmin={isAdmin} />

      {loadError && <div className="error-banner">Couldn't load data: {loadError}</div>}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          {tab === "week" && (
            <ThisWeek
              week={week}
              onWeekChange={setWeek}
              game={currentGame}
              weekPicks={picksMap[week] ?? {}}
              roster={roster}
              me={{ id: me.id, displayName: me.displayName ?? me.email }}
              onSync={handleSync}
              syncing={syncing}
              onSavePick={handleSavePick}
            />
          )}
          {tab === "results" && <Results weeks={scoringWeeks} roster={roster} />}
          {tab === "standings" && <Standings weeks={scoringWeeks} roster={roster} />}
          {tab === "admin" && isAdmin && <AdminPanel />}
        </>
      )}
    </div>
  );
}
