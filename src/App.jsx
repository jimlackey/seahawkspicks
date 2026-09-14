import { useState, useEffect, useCallback, useMemo } from "react";
import TabBar from "./components/TabBar.jsx";
import PicksGrid from "./components/PicksGrid.jsx";
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
  picksByWeek,
} from "./lib/db.js";
import { buildScoringWeeks } from "./lib/adapters.js";

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = checking, null = logged out
  const [tab, setTab] = useState("picks");
  const [roster, setRoster] = useState([]);
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const myPicksByWeek = useMemo(() => {
    if (!me) return {};
    const out = {};
    for (const [week, byParticipant] of Object.entries(picksMap)) {
      if (byParticipant[me.id]) out[week] = byParticipant[me.id];
    }
    return out;
  }, [picksMap, me]);
  const scoringWeeks = useMemo(
    () => buildScoringWeeks(games, picksMap, roster),
    [games, picksMap, roster]
  );

  // Updates local state immediately after a save instead of doing a full
  // reload — a full reload on every debounced autosave (one per row, up to
  // 18 rows) would be wasteful and risks clobbering in-progress typing in
  // other rows.
  async function handleSavePick(week, { hawksScore, oppScore, ouPick }) {
    await savePick({ week, hawksScore, oppScore, ouPick });
    setPicks((prev) => {
      const next = prev.filter((p) => !(p.week === week && p.participant_id === me.id));
      next.push({
        week,
        participant_id: me.id,
        hawks_score: hawksScore,
        opp_score: oppScore,
        ou_pick: ouPick,
        submitted_at: new Date().toISOString(),
      });
      return next;
    });
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
          {tab === "picks" && (
            <PicksGrid games={games} myPicks={myPicksByWeek} onSavePick={handleSavePick} />
          )}
          {tab === "results" && <Results weeks={scoringWeeks} roster={roster} />}
          {tab === "standings" && <Standings weeks={scoringWeeks} roster={roster} />}
          {tab === "admin" && isAdmin && <AdminPanel onGamesChanged={loadData} />}
        </>
      )}
    </div>
  );
}
