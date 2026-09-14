import { useState, useEffect } from "react";
import {
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  getAdminRoster,
  setParticipantRole,
  updateParticipantProfile,
  getOddsApiUsage,
} from "../lib/db.js";
import AdminGamesTable from "./AdminGamesTable.jsx";

export default function AdminPanel({ onGamesChanged }) {
  const [whitelist, setWhitelist] = useState([]);
  const [roster, setRoster] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUsage() {
    setUsageError(null);
    try {
      setUsage(await getOddsApiUsage());
    } catch (err) {
      setUsageError(err.message);
    }
  }

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
    loadUsage();
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

  async function handleProfileSave(participantId, { displayName, email }) {
    await updateParticipantProfile(participantId, { displayName, email });
    await load();
  }

  function handleGamesChanged() {
    onGamesChanged?.();
    loadUsage();
  }

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <h3 style={{ fontFamily: "var(--display)", color: "var(--navy)", fontSize: 18, marginBottom: 10 }}>
        Odds API usage
      </h3>
      <div style={{ marginBottom: 24, fontSize: 14 }}>
        {usageError ? (
          <span style={{ color: "#8a2f26" }}>{usageError}</span>
        ) : usage ? (
          <>
            <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--navy)" }}>
              {usage.requestsRemaining}
            </span>{" "}
            <span style={{ color: "var(--grey)" }}>
              remaining
              {usage.requestsRemaining != null && usage.requestsUsed != null
                ? ` of ${usage.requestsRemaining + usage.requestsUsed} this cycle (${usage.requestsUsed} used)`
                : ""}
            </span>
            <div style={{ fontSize: 11, color: "var(--grey)", marginTop: 2 }}>
              Checking this doesn't use any credits — free to refresh anytime.
            </div>
          </>
        ) : (
          <span style={{ color: "var(--grey)" }}>Loading…</span>
        )}
      </div>

      <h3 style={{ fontFamily: "var(--display)", color: "var(--navy)", fontSize: 18, marginBottom: 10 }}>
        Games — odds & scores
      </h3>
      <p style={{ fontSize: 12, color: "var(--grey)", marginTop: -4, marginBottom: 10 }}>
        Update Odds costs 2 credits · Update Score costs 2 credits. Both buttons stay available for
        past weeks in case a score needs correcting — Results/Standings recompute automatically from
        whatever's in the games table, so a correction there updates everything else on its own.
      </p>
      <div style={{ marginBottom: 32 }}>
        <AdminGamesTable onGamesChanged={handleGamesChanged} />
      </div>

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
          <RosterRow
            key={p.participantId}
            player={p}
            onRoleToggle={() => handleRoleToggle(p.participantId, p.role)}
            onProfileSave={(fields) => handleProfileSave(p.participantId, fields)}
          />
        ))}
        {roster.length === 0 && <div className="empty-state">No one has logged in yet.</div>}
      </div>
    </div>
  );
}

function RosterRow({ player, onRoleToggle, onProfileSave }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(player.displayName ?? "");
  const [email, setEmail] = useState(player.email);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState(null);

  function startEdit() {
    setDisplayName(player.displayName ?? "");
    setEmail(player.email);
    setRowError(null);
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setRowError(null);
    try {
      await onProfileSave({ displayName, email });
      setEditing(false);
    } catch (err) {
      setRowError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        style={{
          padding: "8px 0",
          borderBottom: "1px solid var(--grey-light)",
        }}
      >
        {rowError && <div className="error-banner" style={{ marginBottom: 8 }}>{rowError}</div>}
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 8px",
              border: "1px solid var(--grey-light)",
              borderRadius: 4,
              fontSize: 13,
            }}
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 8px",
              border: "1px solid var(--grey-light)",
              borderRadius: 4,
              fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="submit"
            disabled={saving}
            className="save-btn"
            style={{ width: "auto", padding: "4px 12px", fontSize: 13 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{
              background: "none",
              border: "1px solid var(--grey-light)",
              borderRadius: 4,
              padding: "4px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
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
        {player.displayName ?? player.email}{" "}
        <span style={{ color: "var(--grey)" }}>
          ({player.email}, {player.role})
        </span>
      </span>
      <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          onClick={startEdit}
          style={{
            background: "none",
            border: "1px solid var(--grey-light)",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Edit
        </button>
        <button
          onClick={onRoleToggle}
          style={{
            background: "none",
            border: "1px solid var(--grey-light)",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {player.role === "admin" ? "Demote to player" : "Promote to admin"}
        </button>
      </span>
    </div>
  );
}
