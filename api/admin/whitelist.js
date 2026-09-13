import { requireAdmin } from "../_lib/requireAuth.js";
import { getWhitelist, addToWhitelist, removeFromWhitelist } from "../_lib/pool.js";

export default async function handler(req, res) {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { pool } = ctx;

  if (req.method === "GET") {
    const emails = await getWhitelist(pool.id);
    res.status(200).json({ emails });
    return;
  }

  if (req.method === "POST") {
    const { email } = req.body ?? {};
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }
    await addToWhitelist(pool.id, email);
    res.status(200).json({ success: true });
    return;
  }

  if (req.method === "DELETE") {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).json({ error: "Please provide an email address." });
      return;
    }
    await removeFromWhitelist(pool.id, email);
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
