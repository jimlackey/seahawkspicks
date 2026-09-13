import { grantAccessByToken } from "../_lib/pool.js";

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) {
    res.status(400).send("Missing token.");
    return;
  }

  const result = await grantAccessByToken(token);

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!result.success) {
    res.status(400).send(result.error);
    return;
  }

  // Simple redirect back to the app with a confirmation flag; the frontend
  // can show a "access granted" banner if it sees ?granted=1.
  res.writeHead(302, { Location: `${appUrl}/?granted=1` });
  res.end();
}
