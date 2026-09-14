// Vercel dynamic route: matches /api/admin/:action, replacing what used
// to be 3 separate function files (whitelist, roster, usage). Existing
// frontend fetch calls to those exact paths are unaffected. Consolidated
// specifically to stay under the Hobby plan's 12-serverless-function
// limit (see CLAUDE_CONTEXT.md §15).

import { requireAdmin } from "../_lib/requireAuth.js";
import { getWhitelist, addToWhitelist, removeFromWhitelist, getPoolRoster } from "../_lib/pool.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { getUsageQuota } from "../../src/lib/oddsApi.js";

export default async function handler(req, res) {
  const { action } = req.query;

  switch (action) {
    case "whitelist":
      return whitelist(req, res);
    case "roster":
      return roster(req, res);
    case "usage":
      return usage(req, res);
    default:
      res.status(404).json({ error: `Unknown admin action: ${action}` });
  }
}

async function whitelist(req, res) {
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

async function roster(req, res) {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { pool } = ctx;

  if (req.method === "GET") {
    const roster = await getPoolRoster(pool.id);
    res.status(200).json({ roster });
    return;
  }

  if (req.method === "PATCH") {
    const { participantId, role, displayName, email } = req.body ?? {};
    if (!participantId) {
      res.status(400).json({ error: "participantId is required." });
      return;
    }

    if (role != null) {
      if (!["admin", "player"].includes(role)) {
        res.status(400).json({ error: "Invalid role." });
        return;
      }
      const { error } = await supabaseAdmin
        .from("pool_memberships")
        .update({ role })
        .eq("pool_id", pool.id)
        .eq("participant_id", participantId);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
    }

    if (displayName != null || email != null) {
      const updates = {};
      let normalizedEmail = null;
      if (displayName != null) updates.display_name = displayName;
      if (email != null) {
        if (!email.includes("@")) {
          res.status(400).json({ error: "Please provide a valid email address." });
          return;
        }
        normalizedEmail = email.toLowerCase();
        updates.email = normalizedEmail;
      }

      // Look up the current email first (needed to move the whitelist
      // entry) — if we don't, the person can no longer log in with their
      // new address, since it was never whitelisted.
      let oldEmail = null;
      if (normalizedEmail) {
        const { data: current } = await supabaseAdmin
          .from("participants")
          .select("email")
          .eq("id", participantId)
          .single();
        oldEmail = current?.email ?? null;
      }

      const { error } = await supabaseAdmin.from("participants").update(updates).eq("id", participantId);
      if (error) {
        if (error.code === "23505") {
          res.status(409).json({ error: "That email is already in use by another participant." });
          return;
        }
        res.status(500).json({ error: error.message });
        return;
      }

      if (normalizedEmail && oldEmail && normalizedEmail !== oldEmail) {
        await supabaseAdmin.from("pool_whitelist").delete().eq("pool_id", pool.id).eq("email", oldEmail);
        await supabaseAdmin
          .from("pool_whitelist")
          .upsert({ pool_id: pool.id, email: normalizedEmail }, { onConflict: "pool_id,email" });
      }
    }

    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

async function usage(req, res) {
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
