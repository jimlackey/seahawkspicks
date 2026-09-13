import { useState, useEffect } from "react";
import {
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  getAdminRoster,
  setParticipantRole,
} from "../lib/db.js";

export default function AdminPanel() {
  const [whitelist, setWhitelist] = useState([]);
  const [roster, setRoster] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    try {
      const [wl, r] = await Promise.all([getWhitelist(), getAdminRoster()]);
      setWhitelist(wl);
      setRoster(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await addToWhitelist(newEmail);
      setNewEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(email) {
    try {
      await removeFromWhitelist(email);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRoleToggle(participantId, currentRole) {
    try {
      await setParticipantRole(participantId, currentRole === "admin" ? "player" : "admin");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <h3 style={{ fontFamily: "var(--display)", color: "var(--navy)", fontSize: 18, marginBottom: 10 }}>
        Invite list
      </h3>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="email"
          required
          placeholder="new-player@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid var(--grey-light)",
            borderRadius: 4,
            fontSize: 14,
          }}
        />
        <button className="save-btn" style={{ width: "auto", padding: "0 16px" }} type="submit">
          Add
        </button>
      </form>
      <div style={{ marginBottom: 32 }}>
        {whitelist.map((email) => (
          <div
            key={email}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: "1px solid var(--grey-light)",
              fontSize: 14,
            }}
          >
            <span>{email}</span>
            <button
              onClick={() => handleRemove(email)}
              style={{ background: "none", border: "none", color: "#8a2f26", cursor: "pointer", fontSize: 13 }}
            >
              Remove
            </button>
          </div>
        ))}
        {whitelist.length === 0 && <div className="empty-state">No one on the invite list yet.</div>}
      </div>

      <h3 style={{ fontFamily: "var(--display)", color: "var(--navy)", fontSize: 18, marginBottom: 10 }}>
        Roster & roles
      </h3>
      <div>
        {roster.map((p) => (
          <div
            key={p.participantId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid var(--grey-light)",
              fontSize: 14,
            }}
          >
            <span>
              {p.displayName ?? p.email} <span style={{ color: "var(--grey)" }}>({p.role})</span>
            </span>
            <button
              onClick={() => handleRoleToggle(p.participantId, p.role)}
              style={{
                background: "none",
                border: "1px solid var(--grey-light)",
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {p.role === "admin" ? "Demote to player" : "Promote to admin"}
            </button>
          </div>
        ))}
        {roster.length === 0 && <div className="empty-state">No one has logged in yet.</div>}
      </div>
    </div>
  );
}
