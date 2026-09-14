/**
 * All data access now goes through the authenticated /api/* serverless
 * functions (see api/) rather than talking to Supabase directly from the
 * browser — RLS is locked to default-deny in schema.sql, so the anon key
 * alone can't do anything. Session identity comes from the httpOnly
 * cookie automatically via `credentials: "include"`.
 */

// import.meta.env.BASE_URL reflects Vite's `base` config (see vite.config.js),
// so requests correctly land on "/api/..." locally and "/seahawks/api/..."
// once deployed behind the multi-zone rewrite.
const API_PREFIX = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_PREFIX}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request to ${path} failed (${res.status})`);
  }
  return data;
}

// ---- Auth ----

export function requestLoginCode(email) {
  return apiFetch("/api/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyLoginCode(email, code) {
  return apiFetch("/api/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function requestAccess(email, referral) {
  return apiFetch("/api/auth/request-access", {
    method: "POST",
    body: JSON.stringify({ email, referral }),
  });
}

export async function getCurrentParticipant() {
  const { participant } = await apiFetch("/api/auth/me");
  return participant;
}

export function logout() {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

// ---- Roster ----

export async function getRoster() {
  const { roster } = await apiFetch("/api/roster");
  return roster; // [{ participantId, displayName }]
}

// ---- Games ----

export async function getGames() {
  const { games } = await apiFetch("/api/games");
  return games;
}

export function syncGame(weekData) {
  return apiFetch("/api/games", { method: "PUT", body: JSON.stringify(weekData) });
}

/**
 * Pulls the Seahawks' current odds/score from the Odds API (server-side,
 * via /api/sync-week) and writes the result into `games` for the given
 * week. Combines what used to be two separate calls orchestrated by the
 * caller — now used only from the Admin panel.
 */
export async function syncOddsAndScores(week) {
  const data = await apiFetch("/api/sync-week");
  if (!data.game && data.message) {
    throw new Error(data.message);
  }
  await syncGame({
    week,
    opponent: data.opponent,
    home: data.home,
    commenceTime: data.commenceTime,
    spread: data.spread,
    total: data.total,
    hawksScore: data.hawksScore,
    oppScore: data.oppScore,
    completed: data.completed,
  });
  return data;
}

// ---- Picks ----

export async function getPicks() {
  const { picks } = await apiFetch("/api/picks");
  return picks;
}

export function savePick({ week, hawksScore, oppScore, ouPick }) {
  return apiFetch("/api/picks", {
    method: "PUT",
    body: JSON.stringify({ week, hawksScore, oppScore, ouPick }),
  });
}

/** Groups flat picks rows into { week: { participantId: pick } }. */
export function picksByWeek(picks) {
  const byWeek = {};
  for (const p of picks) {
    if (!byWeek[p.week]) byWeek[p.week] = {};
    byWeek[p.week][p.participant_id] = p;
  }
  return byWeek;
}

// ---- Admin ----

export async function getWhitelist() {
  const { emails } = await apiFetch("/api/admin/whitelist");
  return emails;
}

export function addToWhitelist(email) {
  return apiFetch("/api/admin/whitelist", { method: "POST", body: JSON.stringify({ email }) });
}

export function removeFromWhitelist(email) {
  return apiFetch("/api/admin/whitelist", { method: "DELETE", body: JSON.stringify({ email }) });
}

export async function getAdminRoster() {
  const { roster } = await apiFetch("/api/admin/roster");
  return roster;
}

export function setParticipantRole(participantId, role) {
  return apiFetch("/api/admin/roster", {
    method: "PATCH",
    body: JSON.stringify({ participantId, role }),
  });
}

export function updateParticipantProfile(participantId, { displayName, email }) {
  return apiFetch("/api/admin/roster", {
    method: "PATCH",
    body: JSON.stringify({ participantId, displayName, email }),
  });
}

/** Free to call — the underlying /v4/sports check costs 0 API credits. */
export function getOddsApiUsage() {
  return apiFetch("/api/admin/usage");
}
