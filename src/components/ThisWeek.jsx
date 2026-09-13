import { useState } from "react";
import PlayerPickCard from "./PlayerPickCard.jsx";

function formatKickoff(iso) {
  if (!iso) return "Kickoff TBD";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ThisWeek({
  week,
  onWeekChange,
  game,
  weekPicks, // { participantId: pickRow }
  roster,
  me, // { id, displayName }
  onSync,
  syncing,
  onSavePick,
}) {
  const [syncError, setSyncError] = useState(null);
  const locked = game?.commence_time ? new Date(game.commence_time) <= new Date() : false;

  async function handleSync() {
    setSyncError(null);
    try {
      await onSync();
    } catch (err) {
      setSyncError(err.message);
    }
  }

  const others = roster.filter((p) => p.participantId !== me.id);

  return (
    <div>
      <div className="sync-row">
        <button onClick={() => onWeekChange(week - 1)} style={{ marginRight: 8 }}>
          ← Week {week - 1}
        </button>
        <button onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync latest odds/scores"}
        </button>
        <button onClick={() => onWeekChange(week + 1)} style={{ marginLeft: 8 }}>
          Week {week + 1} →
        </button>
      </div>

      {syncError && <div className="error-banner">Sync failed: {syncError}</div>}

      <div className="ticket">
        <p className="week-line">Week {week}</p>
        {game ? (
          <>
            <p className="matchup-line">
              {game.home ? "vs" : "@"} {game.opponent} · {formatKickoff(game.commence_time)}
            </p>
            <div className="lines-row">
              <span>
                Spread: <strong>{game.spread != null ? game.spread : "—"}</strong>
              </span>
              <span>
                Total: <strong>{game.total != null ? game.total : "—"}</strong>
              </span>
              {game.completed && (
                <span>
                  Final: <strong>Hawks {game.hawks_score} – {game.opp_score}</strong>
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="matchup-line">
            No synced data for this week yet — hit "Sync latest odds/scores" above.
          </p>
        )}
      </div>

      {locked && <p className="locked-note">Kickoff has passed — picks are locked for this week.</p>}

      <PlayerPickCard
        displayName={me.displayName}
        existingPick={weekPicks[me.id]}
        locked={locked}
        gameTotal={game?.total ?? null}
        onSave={(pick) => onSavePick({ week, ...pick })}
      />

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontFamily: "var(--display)", fontSize: 16, color: "var(--navy)", marginBottom: 10 }}>
          {locked ? "Everyone's picks" : "Who's picked so far"}
        </h3>
        <div className="pick-rows">
          {others.map((p) => {
            const pick = weekPicks[p.participantId];
            return (
              <div className="pick-row" key={p.participantId}>
                <span className="player-name">{p.displayName}</span>
                <span className="picked-score">
                  {locked
                    ? pick
                      ? `Picked ${pick.hawks_score}–${pick.opp_score}`
                      : "Missed pick"
                    : pick
                    ? "Submitted"
                    : "Not yet"}
                </span>
                <span className="diff-badge"></span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
