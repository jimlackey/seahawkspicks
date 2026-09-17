import { supabaseAdmin } from "./supabaseAdmin.js";

/**
 * Looks up the pool by slug. Throws on a genuine query failure (network
 * blip, Supabase project cold-starting after inactivity, timeout, etc.)
 * instead of silently returning null for that case — silently coercing
 * every failure mode into "not found" made a transient, recoverable
 * error indistinguishable from an actually-missing pool, which is
 * exactly the bug that caused intermittent "Pool not found" errors on
 * every page even though the pool obviously exists most of the time.
 * Only PGRST116 ("no rows", .single()'s real not-found signal) returns
 * null; every other error propagates with its real message.
 */
export async function getPoolBySlug(slug) {
  const { data, error } = await supabaseAdmin.from("pools").select("*").eq("slug", slug).single();
  if (error && error.code !== "PGRST116") {
    throw new Error(`Pool lookup failed: ${error.message}`);
  }
  return data ?? null;
}

export async function isEmailWhitelisted(poolId, email) {
  const { data } = await supabaseAdmin
    .from("pool_whitelist")
    .select("id")
    .eq("pool_id", poolId)
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

export async function findOrCreateParticipant(email, displayName = null) {
  const normalized = email.toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("participants")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from("participants")
    .insert({ email: normalized, display_name: displayName })
    .select("*")
    .single();
  if (error) throw error;
  return created;
}

export async function findOrCreateMembership(poolId, participantId, defaultRole = "player") {
  const { data: existing } = await supabaseAdmin
    .from("pool_memberships")
    .select("*")
    .eq("pool_id", poolId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from("pool_memberships")
    .insert({ pool_id: poolId, participant_id: participantId, role: defaultRole })
    .select("*")
    .single();
  if (error) throw error;
  return created;
}

export async function getPoolAdminEmails(poolId) {
  const { data } = await supabaseAdmin
    .from("pool_memberships")
    .select("participants(email)")
    .eq("pool_id", poolId)
    .eq("role", "admin")
    .eq("is_active", true);
  return (data ?? []).map((row) => row.participants?.email).filter(Boolean);
}

export async function createAccessRequest(poolId, email, referral, token) {
  const { data, error } = await supabaseAdmin
    .from("access_requests")
    .insert({ pool_id: poolId, email: email.toLowerCase(), referral, token })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function grantAccessByToken(token) {
  const { data: request } = await supabaseAdmin
    .from("access_requests")
    .select("*")
    .eq("token", token)
    .eq("granted", false)
    .maybeSingle();
  if (!request) return { success: false, error: "Invalid or already-used link." };

  await supabaseAdmin.from("pool_whitelist").upsert(
    { pool_id: request.pool_id, email: request.email },
    { onConflict: "pool_id,email" }
  );
  await supabaseAdmin
    .from("access_requests")
    .update({ granted: true, granted_at: new Date().toISOString() })
    .eq("id", request.id);

  return { success: true, poolId: request.pool_id, email: request.email };
}

/** All active players in a pool, joined with their participant record. */
export async function getPoolRoster(poolId) {
  const { data } = await supabaseAdmin
    .from("pool_memberships")
    .select("role, is_active, participants(id, email, display_name)")
    .eq("pool_id", poolId)
    .eq("is_active", true);
  return (data ?? []).map((row) => ({
    participantId: row.participants.id,
    email: row.participants.email,
    displayName: row.participants.display_name,
    role: row.role,
  }));
}

export async function getWhitelist(poolId) {
  const { data } = await supabaseAdmin
    .from("pool_whitelist")
    .select("email")
    .eq("pool_id", poolId)
    .order("email");
  return (data ?? []).map((r) => r.email);
}

export async function addToWhitelist(poolId, email) {
  const { error } = await supabaseAdmin
    .from("pool_whitelist")
    .upsert({ pool_id: poolId, email: email.toLowerCase() }, { onConflict: "pool_id,email" });
  if (error) throw error;
}

export async function removeFromWhitelist(poolId, email) {
  const { error } = await supabaseAdmin
    .from("pool_whitelist")
    .delete()
    .eq("pool_id", poolId)
    .eq("email", email.toLowerCase());
  if (error) throw error;
}
