import { useState, useEffect } from "react";

export default function PlayerPickCard({ displayName, existingPick, locked, onSave }) {
  const [hawks, setHawks] = useState("");
  const [opp, setOpp] = useState("");
  const [ou, setOu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (existingPick) {
      setHawks(String(existingPick.hawks_score));
      setOpp(String(existingPick.opp_score));
      setOu(existingPick.ou_pick);
    }
  }, [existingPick]);

  const canSave =
    hawks !== "" && opp !== "" && ou != null && !Number.isNaN(Number(hawks)) && !Number.isNaN(Number(opp));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ hawksScore: Number(hawks), oppScore: Number(opp), ouPick: ou });
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
      <div className="ou-toggle">
        <button
          type="button"
          className={ou === "Over" ? "selected" : ""}
          disabled={locked}
          onClick={() => setOu("Over")}
        >
          Over
        </button>
        <button
          type="button"
          className={ou === "Under" ? "selected" : ""}
          disabled={locked}
          onClick={() => setOu("Under")}
        >
          Under
        </button>
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
