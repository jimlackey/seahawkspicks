import { useState } from "react";
import TeamBadge from "./TeamBadge.jsx";
import { formatLine } from "../lib/format.js";
import { syncOdds, syncScore } from "../lib/db.js";

export default function AdminGameRow({ week, game, showOddsButton, onSynced }) {
  const [oddsBusy, setOddsBusy] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [oddsStatus, setOddsStatus] = useState(null); // {ok, msg}
  const [scoreStatus, setScoreStatus] = useState(null);

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
      <td className="ag-line">{lineText}</td>
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
