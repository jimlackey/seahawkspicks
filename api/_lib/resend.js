import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL;

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendOtpEmail(to, code, poolName) {
  try {
    const { error } = await resend.emails.send({
      from: `Seahawks Score Picks <${fromEmail}>`,
      to: [to],
      subject: `${code} — Your login code for ${poolName}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f1;padding:40px 20px">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #dfe2e0;padding:32px">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 4px;color:#0b1f33">Seahawks Score Picks</h1>
    <p style="color:#57534e;font-size:14px;margin:0 0 24px">${escapeHtml(poolName)}</p>
    <p style="font-size:15px;margin:0 0 16px">Here's your login code:</p>
    <div style="background:#f4f5f1;border-radius:8px;padding:16px;text-align:center;margin:0 0 16px">
      <span style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#0b1f33">${code}</span>
    </div>
    <p style="color:#78716c;font-size:13px;margin:0">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
  </div>
</body></html>`,
      text: `Seahawks Score Picks — ${poolName}\n\nYour login code: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendAccessRequestEmail(adminEmails, { poolName, requestorEmail, referralText, grantUrl }) {
  if (adminEmails.length === 0) return { success: false, error: "No pool admins to notify." };
  try {
    const referralBlock = referralText?.trim()
      ? `<div style="background:#f4f5f1;border-radius:8px;padding:14px 16px;margin:0 0 20px">
           <p style="color:#78716c;font-size:12px;margin:0 0 6px">Who referred them</p>
           <p style="font-size:14px;margin:0;white-space:pre-wrap;color:#0b1f33">${escapeHtml(referralText)}</p>
         </div>`
      : `<p style="color:#78716c;font-size:13px;margin:0 0 20px">(No referral details provided.)</p>`;

    const { error } = await resend.emails.send({
      from: `Seahawks Score Picks <${fromEmail}>`,
      to: adminEmails,
      subject: `Access request for ${poolName} — ${requestorEmail}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f1;padding:40px 20px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #dfe2e0;padding:32px">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 4px;color:#0b1f33">Seahawks Score Picks</h1>
    <p style="font-size:15px;margin:0 0 8px">Someone has requested access:</p>
    <p style="font-size:16px;font-weight:600;margin:0 0 20px">${escapeHtml(requestorEmail)}</p>
    ${referralBlock}
    <a href="${grantUrl}" style="display:block;text-align:center;background:#5fa829;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 16px;border-radius:8px">Grant access</a>
  </div>
</body></html>`,
      text: `Seahawks Score Picks — access request\n\n${requestorEmail}${referralText?.trim() ? `\n\nReferral: ${referralText}` : ""}\n\nGrant access: ${grantUrl}`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
