// Server-side only — uses the Supabase Secret Key (sb_secret_...),
// Supabase's current name for what used to be the service_role key. It
// still bypasses RLS entirely the same way. Never import this from src/
// (the client bundle); it only runs inside /api serverless functions.

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
