import { useState, useEffect, useCallback, useMemo } from "react";
import TabBar from "./components/TabBar.jsx";
import PicksGrid from "./components/PicksGrid.jsx";
import Results from "./components/Results.jsx";
import Standings from "./components/Standings.jsx";
import Rules from "./components/Rules.jsx";
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

  // Check for an existing session — independent of loading the public
  // data below, so a logged-out visitor isn't blocked on this resolving.
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

  // Results/Standings/Rules are public — load this data immediately,
  // regardless of auth state. Only the Picks tab itself is gated.
  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const isAdmin = me?.role === "admin";

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Seahawks Score Picks</h1>
        {me && (
          <button
            onClick={handleLogout}
            style={{ background: "none", border: "none", color: "var(--grey)", fontSize: 13, cursor: "pointer" }}
          >
            Log Out
          </button>
        )}
      </header>

      <TabBar active={tab} onChange={setTab} isAdmin={isAdmin} />

      {loadError && <div className="error-banner">Couldn't load data: {loadError}</div>}

      {loading || me === undefined ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          {tab === "picks" &&
            (me ? (
              <PicksGrid games={games} myPicks={myPicksByWeek} onSavePick={handleSavePick} />
            ) : (
              <div>
                <p style={{ fontSize: 14, color: "var(--grey)", marginBottom: 20 }}>
                  Log in to enter your picks.
                </p>
                <Login onLoggedIn={setMe} />
              </div>
            ))}
          {tab === "results" && <Results games={games} picksByWeek={picksMap} roster={roster} />}
          {tab === "standings" && <Standings weeks={scoringWeeks} roster={roster} />}
          {tab === "rules" && <Rules />}
          {tab === "admin" && isAdmin && <AdminPanel onGamesChanged={loadData} />}
        </>
      )}
    </div>
  );
}
