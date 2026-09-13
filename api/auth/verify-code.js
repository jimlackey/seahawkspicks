import { getPoolBySlug, findOrCreateParticipant, findOrCreateMembership } from "../_lib/pool.js";
import { verifyOtp } from "../_lib/otp.js";
import { createPoolSession } from "../_lib/session.js";

const POOL_SLUG = "seahawks";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, code } = req.body ?? {};
  if (!email || !code || String(code).length !== 6) {
    res.status(400).json({ error: "Please enter the 6-digit code." });
    return;
  }

  const pool = await getPoolBySlug(POOL_SLUG);
  if (!pool) {
    res.status(500).json({ error: "Pool not found." });
    return;
  }

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
