import { getUsageQuota } from "../../src/lib/oddsApi.js";
import { requireAdmin } from "../_lib/requireAuth.js";

export default async function handler(req, res) {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ODDS_API_KEY is not configured on the server." });
    return;
  }

  try {
    const quota = await getUsageQuota(apiKey);
    res.status(200).json(quota);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
