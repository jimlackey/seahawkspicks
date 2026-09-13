import { SignJWT, jwtVerify } from "jose";
import cookie from "cookie";
import { supabaseAdmin } from "./supabaseAdmin.js";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
const SESSION_DURATION_HOURS = Number(process.env.SESSION_DURATION_HOURS ?? 2160); // 90 days
const SESSION_COOKIE_PREFIX = "shk_session_";

function cookieName(poolSlug) {
  return `${SESSION_COOKIE_PREFIX}${poolSlug}`;
}

async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates a session and attaches the Set-Cookie header to `res`.
 * Call this before writing any other response headers/body.
 */
export async function createPoolSession(res, { poolId, poolSlug, participantId, email, displayName, role }) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  const token = await new SignJWT({ poolId, poolSlug, participantId, email, displayName, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setJti(crypto.randomUUID())
    .sign(SECRET);

  const tokenHash = await hashToken(token);

  await supabaseAdmin.from("sessions").insert({
    pool_id: poolId,
    participant_id: participantId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  res.setHeader(
    "Set-Cookie",
    cookie.serialize(cookieName(poolSlug), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    })
  );
}

/**
 * Reads and validates the session cookie from an incoming request.
 * Returns null if there's no valid session.
 */
export async function getPoolSession(req, poolId, poolSlug) {
  const cookies = cookie.parse(req.headers.cookie ?? "");
  const token = cookies[cookieName(poolSlug)];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.poolId !== poolId) return null;

    const tokenHash = await hashToken(token);
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("id, expires_at")
      .eq("token_hash", tokenHash)
      .eq("pool_id", poolId)
      .single();

    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) return null;

    return {
      sessionId: session.id,
      poolId: payload.poolId,
      poolSlug: payload.poolSlug,
      participantId: payload.participantId,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      expiresAt: session.expires_at,
    };
  } catch {
    return null;
  }
}

/**
 * Destroys the session — removes the DB row and clears the cookie via
 * the Set-Cookie header on `res`.
 */
export async function destroyPoolSession(req, res, poolSlug) {
  const cookies = cookie.parse(req.headers.cookie ?? "");
  const token = cookies[cookieName(poolSlug)];

  if (token) {
    const tokenHash = await hashToken(token);
    await supabaseAdmin.from("sessions").delete().eq("token_hash", tokenHash);
  }

  res.setHeader(
    "Set-Cookie",
    cookie.serialize(cookieName(poolSlug), "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    })
  );
}
