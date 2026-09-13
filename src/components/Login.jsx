import { useState } from "react";
import { requestLoginCode, verifyLoginCode, requestAccess } from "../lib/db.js";

export default function Login({ onLoggedIn }) {
  const [step, setStep] = useState("email"); // "email" | "code" | "request-access" | "requested"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [referral, setReferral] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleRequestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestLoginCode(email);
      setStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { participant } = await verifyLoginCode(email, code);
      onLoggedIn(participant);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestAccess(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestAccess(email, referral);
      setStep("requested");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "60px auto" }}>
      <h2 style={{ fontFamily: "var(--display)", color: "var(--navy)", fontSize: 22, marginBottom: 4 }}>
        Sign in
      </h2>
      <p style={{ color: "var(--grey)", fontSize: 14, marginBottom: 20 }}>
        Seahawks Score Picks — enter your email for a login code.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {step === "email" && (
        <form onSubmit={handleRequestCode}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--grey-light)",
              borderRadius: 4,
              fontSize: 15,
              marginBottom: 12,
            }}
          />
          <button className="save-btn" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send login code"}
          </button>
          <button
            type="button"
            onClick={() => setStep("request-access")}
            style={{
              display: "block",
              margin: "14px auto 0",
              background: "none",
              border: "none",
              color: "var(--grey)",
              fontSize: 13,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Not on the list yet? Ask for access
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleVerifyCode}>
          <p style={{ fontSize: 13, color: "var(--grey)", marginBottom: 10 }}>
            Sent a 6-digit code to {email}.
          </p>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--grey-light)",
              borderRadius: 4,
              fontSize: 20,
              letterSpacing: 4,
              textAlign: "center",
              marginBottom: 12,
              fontFamily: "var(--display)",
            }}
          />
          <button className="save-btn" type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Verify & sign in"}
          </button>
        </form>
      )}

      {step === "request-access" && (
        <form onSubmit={handleRequestAccess}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--grey-light)",
              borderRadius: 4,
              fontSize: 15,
              marginBottom: 10,
            }}
          />
          <textarea
            placeholder="Who invited you? (optional)"
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--grey-light)",
              borderRadius: 4,
              fontSize: 14,
              marginBottom: 12,
              fontFamily: "inherit",
            }}
          />
          <button className="save-btn" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Request access"}
          </button>
        </form>
      )}

      {step === "requested" && (
        <p style={{ fontSize: 14, color: "var(--ink)" }}>
          Thanks — if that email needs to be added, the pool admin has been notified. You'll get an
          email once you're in.
        </p>
      )}
    </div>
  );
}
