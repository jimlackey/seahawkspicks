// Server-side only — uses the Supabase service_role key, which bypasses
// RLS entirely. Never import this from src/ (the client bundle); it only
// runs inside /api serverless functions.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY server env vars."
  );
}

export const supabaseAdmin = createClient(url ?? "", serviceRoleKey ?? "", {
  auth: { persistSession: false },
});
