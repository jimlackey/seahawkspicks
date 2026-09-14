import { useState, useEffect, useRef } from "react";
import { inferOverUnder } from "../lib/scoring.js";
import { teamCode } from "../lib/teams.js";

const SAVE_DEBOUNCE_MS = 600;

function formatKickoff(iso) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  // "Wed 9/9, 5:30p" — compact, single lowercase am/pm letter.
  const ampm = get("dayPeriod").toLowerCase().charAt(0);
  return `${get("weekday")} ${get("month")}/${get("day")}, ${get("hour")}:${get("minute")}${ampm}`;
}

export default function PickRow({ week, game, existingPick, onSave }) {
  const [hawks, setHawks] = useState(existingPick ? String(existingPick.hawks_score) : "");
  const [opp, setOpp] = useState(existingPick ? String(existingPick.opp_score) : "");
  const [status, setStatus] = useState("idle"); // idle | pending | saved | error
  const debounceRef = useRef(null);
  const lastSavedRef = useRef(
    existingPick ? `${existingPick.hawks_score}-${existingPick.opp_score}` : null
  );

  // Keep in sync if picks reload from the server (e.g. after an admin sync).
  useEffect(() => {
    setHawks(existingPick ? String(existingPick.hawks_score) : "");
    setOpp(existingPick ? String(existingPick.opp_score) : "");
    lastSavedRef.current = existingPick ? `${existingPick.hawks_score}-${existingPick.opp_score}` : null;
  }, [existingPick]);

  const locked = game?.commence_time ? new Date(game.commence_time) <= new Date() : false;

  const hawksNum = Number(hawks);
  const oppNum = Number(opp);
  const bothValid =
    hawks !== "" && opp !== "" && Number.isInteger(hawksNum) && Number.isInteger(oppNum) && hawksNum >= 0 && oppNum >= 0;

  useEffect(() => {
    if (!bothValid || locked) return;
    const key = `${hawksNum}-${oppNum}`;
    if (key === lastSavedRef.current) return;

    setStatus("pending");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const ouPick = inferOverUnder({ hawks: hawksNum, opp: oppNum }, game?.total ?? null);
        await onSave(week, { hawksScore: hawksNum, oppScore: oppNum, ouPick });
        lastSavedRef.current = key;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hawks, opp]);

  const home = game?.home;
  const opponent = game?.opponent ?? null;
  const homeTeamName = home === true ? "Seattle Seahawks" : home === false ? opponent : null;
  const awayTeamName = home === true ? opponent : home === false ? "Seattle Seahawks" : null;

  const lineText =
    game && (game.spread != null || game.total != null)
      ? `${game.spread != null ? game.spread : "—"}, ${game.total != null ? game.total : "—"}`
      : "—";

  const predictedTotal = bothValid ? hawksNum + oppNum : null;
  const predictedOu = bothValid ? inferOverUnder({ hawks: hawksNum, opp: oppNum }, game?.total ?? null) : null;

  return (
    <tr className={locked ? "locked" : ""}>
      <td className="col-week">{week}</td>
      <td className="col-time">{formatKickoff(game?.commence_time)}</td>
      <td className="col-team">
        <TeamLabel fullName={homeTeamName} />
      </td>
      <td className="col-team">
        <TeamLabel fullName={awayTeamName} />
      </td>
      <td className="col-line">{lineText}</td>
      <td className="col-pick">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={hawks}
          disabled={locked}
          onChange={(e) => setHawks(e.target.value)}
          aria-label={`Week ${week} predicted Seahawks score`}
        />
      </td>
      <td className="col-pick">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={opp}
          disabled={locked}
          onChange={(e) => setOpp(e.target.value)}
          aria-label={`Week ${week} predicted opponent score`}
        />
      </td>
      <td className="col-total">
        {predictedTotal != null ? (
          <span>
            {predictedTotal} <span className="ou-tag">{predictedOu === "Push" ? "P" : predictedOu?.charAt(0) ?? ""}</span>
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="col-status">
        <StatusDot status={locked ? "locked" : status} />
      </td>
    </tr>
  );
}

function TeamLabel({ fullName }) {
  if (!fullName) {
    return (
      <>
        <span className="team-short">—</span>
        <span className="team-full">—</span>
      </>
    );
  }
  return (
    <>
      <span className="team-short">{teamCode(fullName)}</span>
      <span className="team-full">{fullName}</span>
    </>
  );
}

function StatusDot({ status }) {
  const label = { pending: "Saving…", saved: "Saved", error: "Save failed", locked: "Locked" }[status] ?? "";
  const cls = { pending: "dot-pending", saved: "dot-saved", error: "dot-error", locked: "dot-locked" }[status] ?? "";
  if (!label) return null;
  return <span className={`status-dot ${cls}`} title={label} aria-label={label} />;
}
