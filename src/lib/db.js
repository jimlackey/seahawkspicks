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
 * Pulls the Seahawks' current closing spread/total (server-side, via
 * /api/sync-week?type=odds — costs 2 credits) and writes ONLY spread/total
 * into `games` for the given week. Doesn't touch opponent/home/
 * commence_time (those come from the schedule seed) or score/completed.
 *
 * Safety check: if `expectedOpponent` is provided (i.e. we already have a
 * scheduled opponent for this week) and the API's returned game is for a
 * different team, this throws instead of writing — the Odds API has no
 * concept of "week number," so without this check a wrong guess could
 * silently write the wrong game's line into the wrong week.
 */
/**
 * Pulls the Seahawks' current closing spread/total (server-side, via
 * /api/sync-week?type=odds — costs 2 credits) and writes spread/total
 * into `games` for the given week.
 *
 * If this week has no existing game row yet (e.g. a week whose opponent
 * the NFL hasn't announced), there's nothing to protect — so the API's
 * returned opponent/home/kickoff time get written too, backfilling the
 * schedule. If a row already exists, only spread/total are touched;
 * opponent/home/commence_time (from the schedule seed) are left alone.
 *
 * Safety check: if `expectedOpponent` is provided (i.e. we already have a
 * scheduled opponent for this week) and the API's returned game is for a
 * different team, this throws instead of writing — the Odds API has no
 * concept of "week number," so without this check a wrong guess could
 * silently write the wrong game's line into the wrong week.
 */
export async function syncOdds(week, expectedOpponent) {
  const data = await apiFetch("/api/sync-week?type=odds");
  if (!data.game && data.message) {
    throw new Error(data.message);
  }
  if (expectedOpponent && data.opponent !== expectedOpponent) {
    throw new Error(
      `Mismatch: expected ${expectedOpponent} for week ${week}, but the API returned ${data.opponent}. Not saved — check the schedule.`
    );
  }
  const payload = { week, spread: data.spread, total: data.total };
  if (!expectedOpponent) {
    // No existing row for this week — backfill the schedule fields too.
    payload.opponent = data.opponent;
    payload.home = data.home;
    payload.commenceTime = data.commenceTime;
  }
  await syncGame(payload);
  return data;
}

/**
 * Pulls the Seahawks' current/latest result (server-side, via
 * /api/sync-week?type=score — costs 2 credits) and writes
 * hawksScore/oppScore/completed into `games` for the given week. Same
 * no-existing-row backfill and opponent-mismatch safety check as
 * syncOdds.
 */
export async function syncScore(week, expectedOpponent) {
  const data = await apiFetch("/api/sync-week?type=score");
  if (!data.game && data.message) {
    throw new Error(data.message);
  }
  if (expectedOpponent && data.opponent !== expectedOpponent) {
    throw new Error(
      `Mismatch: expected ${expectedOpponent} for week ${week}, but the API returned ${data.opponent}. Not saved — check the schedule.`
    );
  }
  const payload = { week, hawksScore: data.hawksScore, oppScore: data.oppScore, completed: data.completed };
  if (!expectedOpponent) {
    payload.opponent = data.opponent;
    payload.home = data.home;
    payload.commenceTime = data.commenceTime;
  }
  await syncGame(payload);
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
