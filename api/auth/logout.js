import { destroyPoolSession } from "../_lib/session.js";

const POOL_SLUG = "seahawks";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  await destroyPoolSession(req, res, POOL_SLUG);
  res.status(200).json({ success: true });
}
