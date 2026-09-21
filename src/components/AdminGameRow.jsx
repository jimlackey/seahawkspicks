import { useState } from "react";
import TeamBadge from "./TeamBadge.jsx";
import { formatLine } from "../lib/format.js";
import { syncOdds, syncScore, syncGame } from "../lib/db.js";

export default function AdminGameRow({ week, game, updateAction, onSynced }) {
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null); // {ok, msg}

  const [editingLine, setEditingLine] = useState(false);
  const [spreadInput, setSpreadInput] = useState("");
  const [totalInput, setTotalInput] = useState("");
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState(null);

  const [editingScore, setEditingScore] = useState(false);
  const [hawksInput, setHawksInput] = useState("");
  const [oppInput, setOppInput] = useState("");
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreError, setScoreError] = useState(null);

  // Manual overrides need real schedule data (opponent/home/kickoff time)
  // to exist first — without it, a write would have to either guess those
  // required fields or fail outright. So they're only offered once a
  // schedule row exists for this week.
  const hasSchedule = Boolean(game);

  const home = game?.home;
  const opponent = game?.opponent ?? null;
  const homeTeamName = home === true ? "Seattle Seahawks" : home === false ? opponent : null;
  const awayTeamName = home === true ? opponent : home === false ? "Seattle Seahawks" : null;

  const lineText =
    game && (game.spread != null || game.total != null)
      ? `${formatLine(game.spread)}/${formatLine(game.total)}`
      : "—";

  const finalText =
    game?.completed && game.hawks_score != null && game.opp_score != null
      ? `SEA ${game.hawks_score} – ${game.opp_score}`
      : "—";

  function startEditLine() {
    setSpreadInput(game?.spread != null ? String(game.spread) : "");
    setTotalInput(game?.total != null ? String(game.total) : "");
    setLineError(null);
    setEditingLine(true);
  }

  async function handleSaveLine(e) {
    e.preventDefault();
    setLineSaving(true);
    setLineError(null);
    try {
      // A manual override — writes directly, no API call involved at all,
      // for whenever the auto-sync line is wrong (e.g. it pulled mid-game
      // odds instead of the closing line) or the API doesn't cover it.
      // Empty field explicitly clears that value (writes null) rather
      // than leaving it untouched, so this can also fix a bad prior sync.
      await syncGame({
        week,
        spread: spreadInput.trim() === "" ? null : Number(spreadInput),
        total: totalInput.trim() === "" ? null : Number(totalInput),
      });
      setEditingLine(false);
      onSynced?.();
    } catch (err) {
      setLineError(err.message);
    } finally {
      setLineSaving(false);
    }
  }

  function startEditScore() {
    setHawksInput(game?.hawks_score != null ? String(game.hawks_score) : "");
    setOppInput(game?.opp_score != null ? String(game.opp_score) : "");
    setScoreError(null);
    setEditingScore(true);
  }

  async function handleSaveScore(e) {
    e.preventDefault();
    const hawksEmpty = hawksInput.trim() === "";
    const oppEmpty = oppInput.trim() === "";
    if (hawksEmpty !== oppEmpty) {
      setScoreError("Enter both scores, or clear both to reset.");
      return;
    }
    setScoreSaving(true);
    setScoreError(null);
    try {
      // Same idea as the Line override: a direct write, no API call, so
      // a wrong final score (or one that needs a post-hoc correction)
      // can always be fixed by hand. Clearing both fields resets the
      // week to not-yet-played rather than leaving a stale score behind.
      await syncGame({
        week,
        hawksScore: hawksEmpty ? null : Number(hawksInput),
        oppScore: oppEmpty ? null : Number(oppInput),
        completed: !hawksEmpty,
      });
      setEditingScore(false);
      onSynced?.();
    } catch (err) {
      setScoreError(err.message);
    } finally {
      setScoreSaving(false);
    }
  }

  async function handleUpdateClick() {
    setUpdateBusy(true);
    setUpdateStatus(null);
    try {
      if (updateAction === "odds") {
        await syncOdds(week, opponent);
        setUpdateStatus({ ok: true, msg: "Updated" });
      } else if (updateAction === "score") {
        const data = await syncScore(week, opponent);
        setUpdateStatus({
          ok: true,
          msg: data.completed ? `Final ${data.hawksScore}-${data.oppScore}` : "Not final yet",
        });
      }
      onSynced?.();
    } catch (err) {
      setUpdateStatus({ ok: false, msg: err.message });
    } finally {
      setUpdateBusy(false);
    }
  }

  return (
    <tr>
      <td className="ag-week">{week}</td>
      <td className="ag-team">
        <TeamBadge fullName={homeTeamName} />
      </td>
      <td className="ag-team">
        <TeamBadge fullName={awayTeamName} />
      </td>
      <td className="ag-line">
        {editingLine ? (
          <form onSubmit={handleSaveLine} className="ag-line-edit">
            <input
              type="number"
              step="0.5"
              placeholder="Spread"
              value={spreadInput}
              onChange={(e) => setSpreadInput(e.target.value)}
            />
            <input
              type="number"
              step="0.5"
              placeholder="Total"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
            />
            <div className="ag-line-edit-actions">
              <button type="submit" className="ag-btn" disabled={lineSaving}>
                {lineSaving ? "…" : "Save"}
              </button>
              <button type="button" className="ag-btn" onClick={() => setEditingLine(false)} disabled={lineSaving}>
                Cancel
              </button>
            </div>
            {lineError && <div className="ag-status ag-status-err">{lineError}</div>}
          </form>
        ) : (
          <>
            {lineText}{" "}
            {hasSchedule && (
              <button type="button" className="ag-edit-link" onClick={startEditLine} title="Manually set spread/total">
                ✎
              </button>
            )}
          </>
        )}
      </td>
      <td className="ag-final">
        {editingScore ? (
          <form onSubmit={handleSaveScore} className="ag-line-edit">
            <input
              type="number"
              placeholder="SEA"
              value={hawksInput}
              onChange={(e) => setHawksInput(e.target.value)}
            />
            <input
              type="number"
              placeholder="Opp"
              value={oppInput}
              onChange={(e) => setOppInput(e.target.value)}
            />
            <div className="ag-line-edit-actions">
              <button type="submit" className="ag-btn" disabled={scoreSaving}>
                {scoreSaving ? "…" : "Save"}
              </button>
              <button type="button" className="ag-btn" onClick={() => setEditingScore(false)} disabled={scoreSaving}>
                Cancel
              </button>
            </div>
            {scoreError && <div className="ag-status ag-status-err">{scoreError}</div>}
          </form>
        ) : (
          <>
            {finalText}{" "}
            {hasSchedule && (
              <button type="button" className="ag-edit-link" onClick={startEditScore} title="Manually set final score">
                ✎
              </button>
            )}
          </>
        )}
      </td>
      <td className="ag-action">
        {updateAction && (
          <>
            <button className="ag-btn" onClick={handleUpdateClick} disabled={updateBusy}>
              {updateBusy ? "…" : updateAction === "odds" ? "Odds" : "Score"}
            </button>
            {updateStatus && (
              <div className={`ag-status ${updateStatus.ok ? "ag-status-ok" : "ag-status-err"}`}>
                {updateStatus.msg}
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
