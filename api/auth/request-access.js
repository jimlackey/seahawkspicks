import { randomBytes } from "crypto";
import {
  getPoolBySlug,
  isEmailWhitelisted,
  getPoolAdminEmails,
  createAccessRequest,
} from "../_lib/pool.js";
import { checkOtpRateLimit } from "../_lib/otp.js";
import { sendAccessRequestEmail } from "../_lib/resend.js";

const POOL_SLUG = "seahawks";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, referral = "" } = req.body ?? {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const pool = await getPoolBySlug(POOL_SLUG);
  if (!pool) {
    res.status(500).json({ error: "Pool not found." });
    return;
  }

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
