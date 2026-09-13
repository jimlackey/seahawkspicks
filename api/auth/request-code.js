import { getPoolBySlug, isEmailWhitelisted } from "../_lib/pool.js";
import { checkOtpRateLimit, createOtpRequest } from "../_lib/otp.js";
import { sendOtpEmail } from "../_lib/resend.js";

const POOL_SLUG = "seahawks";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const pool = await getPoolBySlug(POOL_SLUG);
  if (!pool) {
    res.status(500).json({ error: "Pool not found. Has the schema been seeded?" });
    return;
  }

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
