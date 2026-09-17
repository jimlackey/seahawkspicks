// Vercel dynamic route: matches /api/auth/:action for ANY action segment,
// so this one file replaces what used to be 6 separate function files
// (request-code, verify-code, me, logout, request-access, grant-access).
// Existing frontend fetch calls to those exact paths are unaffected —
// Vercel's router maps them all here with req.query.action set to the
// matched segment. Consolidated specifically to stay under the Hobby
// plan's 12-serverless-function limit (see CLAUDE_CONTEXT.md §15).

import { randomBytes } from "crypto";
import {
  isEmailWhitelisted,
  getPoolAdminEmails,
  createAccessRequest,
  findOrCreateParticipant,
  findOrCreateMembership,
  grantAccessByToken,
} from "../_lib/pool.js";
import { getPoolOrFail } from "../_lib/requireAuth.js";
import { checkOtpRateLimit, createOtpRequest, verifyOtp } from "../_lib/otp.js";
import { createPoolSession, getPoolSession, destroyPoolSession } from "../_lib/session.js";
import { sendOtpEmail, sendAccessRequestEmail } from "../_lib/resend.js";

const POOL_SLUG = "seahawks";

export default async function handler(req, res) {
  const { action } = req.query;

  switch (action) {
    case "request-code":
      return requestCode(req, res);
    case "verify-code":
      return verifyCode(req, res);
    case "me":
      return me(req, res);
    case "logout":
      return logout(req, res);
    case "request-access":
      return requestAccess(req, res);
    case "grant-access":
      return grantAccess(req, res);
    default:
      res.status(404).json({ error: `Unknown auth action: ${action}` });
  }
}

async function requestCode(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const pool = await getPoolOrFail(res);
  if (!pool) return;

  const whitelisted = await isEmailWhitelisted(pool.id, email);
  if (!whitelisted) {
    res.status(403).json({
      error: "This email is not on the invite list. Contact the pool admin to be added.",
    });
    return;
  }

  const allowed = await checkOtpRateLimit(email, pool.id);
  if (!allowed) {
    res.status(429).json({ error: "Too many login attempts. Please wait a bit and try again." });
    return;
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] ?? null;
  const code = await createOtpRequest(email, pool.id, ip);
  const emailResult = await sendOtpEmail(email, code, pool.name);

  if (!emailResult.success) {
    res.status(502).json({ error: "Failed to send login code. Please try again." });
    return;
  }

  res.status(200).json({ success: true });
}

async function verifyCode(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, code } = req.body ?? {};
  if (!email || !code || String(code).length !== 6) {
    res.status(400).json({ error: "Please enter the 6-digit code." });
    return;
  }

  const pool = await getPoolOrFail(res);
  if (!pool) return;

  const result = await verifyOtp(email, pool.id, String(code));
  if (!result.valid) {
    res.status(401).json({ error: result.error });
    return;
  }

  const participant = await findOrCreateParticipant(email);
  const membership = await findOrCreateMembership(pool.id, participant.id);

  await createPoolSession(res, {
    poolId: pool.id,
    poolSlug: POOL_SLUG,
    participantId: participant.id,
    email: participant.email,
    displayName: participant.display_name,
    role: membership.role,
  });

  res.status(200).json({
    success: true,
    participant: {
      id: participant.id,
      email: participant.email,
      displayName: participant.display_name,
      role: membership.role,
    },
  });
}

async function me(req, res) {
  const pool = await getPoolOrFail(res);
  if (!pool) return;

  const session = await getPoolSession(req, pool.id, POOL_SLUG);
  if (!session) {
    res.status(200).json({ participant: null });
    return;
  }

  res.status(200).json({
    participant: {
      id: session.participantId,
      email: session.email,
      displayName: session.displayName,
      role: session.role,
    },
  });
}

async function logout(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  await destroyPoolSession(req, res, POOL_SLUG);
  res.status(200).json({ success: true });
}

async function requestAccess(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, referral = "" } = req.body ?? {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const pool = await getPoolOrFail(res);
  if (!pool) return;

  const allowed = await checkOtpRateLimit(email, pool.id);
  if (!allowed) {
    res.status(429).json({ error: "Too many requests. Please wait a bit and try again." });
    return;
  }

  // Same response either way, so this can't be used to probe the whitelist.
  const alreadyWhitelisted = await isEmailWhitelisted(pool.id, email);
  if (alreadyWhitelisted) {
    res.status(200).json({ success: true });
    return;
  }

  const adminEmails = await getPoolAdminEmails(pool.id);
  if (adminEmails.length === 0) {
    res.status(500).json({ error: "No admin is configured to review requests right now." });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  await createAccessRequest(pool.id, email, referral, token);

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const grantUrl = `${appUrl}/api/auth/grant-access?token=${encodeURIComponent(token)}`;

  const emailResult = await sendAccessRequestEmail(adminEmails, {
    poolName: pool.name,
    requestorEmail: email,
    referralText: referral,
    grantUrl,
  });

  if (!emailResult.success) {
    res.status(502).json({ error: "Couldn't notify the pool admins right now." });
    return;
  }

  res.status(200).json({ success: true });
}

async function grantAccess(req, res) {
  const { token } = req.query;
  if (!token) {
    res.status(400).send("Missing token.");
    return;
  }

  const result = await grantAccessByToken(token);

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!result.success) {
    res.status(400).send(result.error);
    return;
  }

  // Simple redirect back to the app with a confirmation flag; the frontend
  // can show a "access granted" banner if it sees ?granted=1.
  res.writeHead(302, { Location: `${appUrl}/?granted=1` });
  res.end();
}
