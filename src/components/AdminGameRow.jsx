import { useState } from "react";
import TeamBadge from "./TeamBadge.jsx";
import { formatLine } from "../lib/format.js";
import { syncOdds, syncScore, syncGame } from "../lib/db.js";

export default function AdminGameRow({ week, game, showOddsButton, onSynced }) {
  const [oddsBusy, setOddsBusy] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [oddsStatus, setOddsStatus] = useState(null); // {ok, msg}
  const [scoreStatus, setScoreStatus] = useState(null);

  const [editingLine, setEditingLine] = useState(false);
  const [spreadInput, setSpreadInput] = useState("");
  const [totalInput, setTotalInput] = useState("");
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState(null);

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

  async function handleUpdateOdds() {
    setOddsBusy(true);
    setOddsStatus(null);
    try {
      await syncOdds(week, opponent);
      setOddsStatus({ ok: true, msg: "Updated" });
      onSynced?.();
    } catch (err) {
      setOddsStatus({ ok: false, msg: err.message });
    } finally {
      setOddsBusy(false);
    }
  }

  async function handleUpdateScore() {
    setScoreBusy(true);
    setScoreStatus(null);
    try {
      const data = await syncScore(week, opponent);
      setScoreStatus({
        ok: true,
        msg: data.completed ? `Final ${data.hawksScore}-${data.oppScore}` : "Not final yet",
      });
      onSynced?.();
    } catch (err) {
      setScoreStatus({ ok: false, msg: err.message });
    } finally {
      setScoreBusy(false);
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
            <button type="button" className="ag-edit-link" onClick={startEditLine} title="Manually set spread/total">
              ✎
            </button>
          </>
        )}
      </td>
      <td className="ag-final">{finalText}</td>
      <td className="ag-action">
        {showOddsButton ? (
          <>
            <button className="ag-btn" onClick={handleUpdateOdds} disabled={oddsBusy}>
              {oddsBusy ? "…" : "Update Odds"}
            </button>
            {oddsStatus && (
              <div className={`ag-status ${oddsStatus.ok ? "ag-status-ok" : "ag-status-err"}`}>{oddsStatus.msg}</div>
            )}
          </>
        ) : (
          <span className="ag-na">—</span>
        )}
      </td>
      <td className="ag-action">
        <button className="ag-btn" onClick={handleUpdateScore} disabled={scoreBusy}>
          {scoreBusy ? "…" : "Update Score"}
        </button>
        {scoreStatus && (
          <div className={`ag-status ${scoreStatus.ok ? "ag-status-ok" : "ag-status-err"}`}>{scoreStatus.msg}</div>
        )}
      </td>
    </tr>
  );
}
