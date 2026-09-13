import { useState, useEffect } from "react";
import { inferOverUnder } from "../lib/scoring.js";

export default function PlayerPickCard({ displayName, existingPick, locked, gameTotal, onSave }) {
  const [hawks, setHawks] = useState("");
  const [opp, setOpp] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (existingPick) {
      setHawks(String(existingPick.hawks_score));
      setOpp(String(existingPick.opp_score));
    }
  }, [existingPick]);

  const hawksNum = Number(hawks);
  const oppNum = Number(opp);
  const canSave = hawks !== "" && opp !== "" && !Number.isNaN(hawksNum) && !Number.isNaN(oppNum);

  // Over/Under is fully determined by the predicted score plus the game's
  // total line — no separate manual choice needed. Null while the line
  // hasn't been synced yet, or scores aren't filled in.
  const inferredOu = canSave ? inferOverUnder({ hawks: hawksNum, opp: oppNum }, gameTotal) : null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ hawksScore: hawksNum, oppScore: oppNum, ouPick: inferredOu });
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="player-card">
      <h3>Your pick, {displayName}</h3>
      <div className="score-inputs">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Hawks"
          value={hawks}
          disabled={locked}
          onChange={(e) => setHawks(e.target.value)}
          aria-label="Predicted Seahawks score"
        />
        <span className="dash">–</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Opp"
          value={opp}
          disabled={locked}
          onChange={(e) => setOpp(e.target.value)}
          aria-label="Predicted opponent score"
        />
      </div>
      <div className="ou-inferred">
        {gameTotal == null
          ? "Over/Under: waiting on the total line (sync first)"
          : inferredOu
          ? `Predicted total ${hawksNum + oppNum} vs. line ${gameTotal} → ${inferredOu}`
          : "Enter both scores to see your Over/Under"}
      </div>
      <button className="save-btn" disabled={locked || !canSave || saving} onClick={handleSave}>
        {locked ? "Locked" : saving ? "Saving…" : "Save pick"}
      </button>
      <div className="save-status">
        {error ? <span style={{ color: "#8a2f26" }}>{error}</span> : savedAt ? `Saved at ${savedAt.toLocaleTimeString()}` : ""}
      </div>
    </div>
  );
}
