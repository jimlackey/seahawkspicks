import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabaseAdmin.js";

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RATE_LIMIT_PER_HOUR = 5;
export const OTP_CODE_LENGTH = 6;

export function generateOtpCode() {
  const digits = OTP_CODE_LENGTH;
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const code = Math.floor(min + Math.random() * (max - min + 1));
  return code.toString();
}

export async function checkOtpRateLimit(email, poolId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from("otp_requests")
    .select("*", { count: "exact", head: true })
    .eq("email", email.toLowerCase())
    .eq("pool_id", poolId)
    .gte("created_at", oneHourAgo);

  return (count ?? 0) < OTP_RATE_LIMIT_PER_HOUR;
}

export async function createOtpRequest(email, poolId, ipAddress) {
  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await supabaseAdmin.from("otp_requests").insert({
    email: email.toLowerCase(),
    pool_id: poolId,
    code_hash: codeHash,
    expires_at: expiresAt,
    ip_address: ipAddress,
  });

  return code;
}

export async function verifyOtp(email, poolId, code) {
  const { data: otpRecords } = await supabaseAdmin
    .from("otp_requests")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("pool_id", poolId)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (!otpRecords || otpRecords.length === 0) {
    return { valid: false, error: "No valid code found. Please request a new one." };
  }

  const otp = otpRecords[0];

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  const isMatch = await bcrypt.compare(code, otp.code_hash);

  if (!isMatch) {
    await supabaseAdmin
      .from("otp_requests")
      .update({ attempts: otp.attempts + 1 })
      .eq("id", otp.id);
    return { valid: false, error: "Incorrect code. Please try again." };
  }

  await supabaseAdmin.from("otp_requests").update({ used: true }).eq("id", otp.id);

  return { valid: true };
}
