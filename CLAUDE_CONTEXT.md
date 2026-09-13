# Seahawks Score Picks — Project Context

**Purpose of this file**: a dense reference so a new Claude session can get
up to speed without re-deriving decisions already made. Read this first;
consult the actual source files (paths noted throughout) for exact
implementation details rather than asking the user to re-explain them.

Owner: Jim Lackey. Repo (once created): TBD, sibling to
`github.com/jimlackey/worldcup-pickem`. Hosting target:
`https://www.jimlackey.com/seahawks` (Vercel, multi-zone alongside the
World Cup pool at `/worldcup`).

---

## 1. What this is

A season-long NFL score-prediction pool between three named players
(Mark, Brian, Jim — plus whoever else gets whitelisted later) for
Seahawks games specifically. Each week, each player predicts the Hawks'
score and the opponent's score, plus an Over/Under pick. Replaces a
manual Google Sheet the group used previously.

**Stack**: React (Vite, not Next.js — see §5 for why), Supabase (Postgres,
service-role-key-only access from serverless functions), Vercel
(hosting + serverless functions), The Odds API (spreads/totals/scores),
Resend (login-code email).

---

## 2. Scoring rules (ground truth — do not re-derive from scratch)

Source of truth: `src/lib/scoring.js`. Reverse-engineered from the
original Google Sheet and validated against real 2025 season data
(`src/lib/scoring.test.js` has the full regression test).

- **Diff** = `|actual Hawks − picked Hawks| + |actual Opp − picked Opp|`
- **1st place** (weekly winner) = lowest Diff **among players who
  correctly picked the game's winner**. If nobody picked the winner
  correctly that week, 1st falls back to lowest Diff overall.
- **2nd/3rd** = remaining players ordered by Diff.
- **Missed pick** = worst Diff among the other players that week, **+1**
  (guarantees last place). Confirmed against two real sheet rows with
  blank score cells (both reproduced the sheet's diff exactly via this
  formula — this is not a guess, it's verified).
- **Standings**: 1st = 3 pts, 2nd = 1 pt, 3rd = 0 pts.

**Known historical data issue, resolved**: Week 13 of the original sheet
awarded 1st place to a player with a lower Diff but the *wrong* winner
pick, over a player with a higher Diff but the *correct* winner pick —
which violates the sheet's own documented rule (confirmed by two other
weeks, 3 and 4, where the rule *was* applied correctly in the same
situation shape). Conclusion: Week 13 was a manual tallying mistake in
the original sheet. **User confirmed this explicitly.** The engine
enforces the rule consistently and does NOT special-case Week 13 — if a
future session sees the engine's output not match old sheet totals for
that week, that's expected and correct, not a bug.

---

## 3. External APIs

**The Odds API** (`the-odds-api.com`, NOT `theoddsapi.com` — confusingly
similar name, different service, different free-tier coverage). One API
key covers both endpoints used:

- `GET /v4/sports/americanfootball_nfl/odds?regions=us&markets=spreads,totals`
  → closing spread/total. Cost: 2 credits/call (`src/lib/oddsApi.js`).
- `GET /v4/sports/americanfootball_nfl/scores?daysFrom=3` → final scores,
  but **only a rolling 3-day window** — this is why Supabase stores
  `games` permanently rather than re-querying history from the API.
  Cost: 2 credits/call (`src/lib/scoresApi.js`).
- Free tier: 500 credits/month. Actual usage ~4 credits/week — trivial
  headroom.
- **Sign convention** (load-bearing, verified against real games): the
  spread value for the Seahawks outcome in the API response is already
  Hawks-relative in the same convention the original sheet used —
  negative = Hawks favored, positive = Hawks underdogs. No sign-flipping
  needed. Verified against Week 1 (Hawks +6.5, won outright, covered) and
  Week 13 (Hawks −7.0, won by 4, did not cover) — both check out.
- Both API calls are proxied server-side via `api/sync-week.js` so the
  key never reaches the browser. Triggered manually (a "Sync latest
  odds/scores" button), not on a schedule yet.
- **Week numbers are not returned by the API.** The app has a manual
  ← Week N → stepper; someone has to advance it each week by hand.

---

## 4. Data model (Supabase)

Full DDL: `supabase/schema.sql` (single file, no migration chain yet).

Pool/auth tables (mirrors World Cup Pick'em's structure — see §5):
`pools`, `participants`, `pool_memberships` (role: admin/player),
`pool_whitelist`, `otp_requests`, `sessions`, `access_requests`,
`audit_log`.

Domain tables, both scoped by `pool_id`:
- `games` (season, week, opponent, home, commence_time, spread, total,
  hawks_score, opp_score, completed) — unique on (pool_id, season, week)
- `picks` (season, week, participant_id, hawks_score, opp_score,
  ou_pick) — unique on (pool_id, season, week, participant_id)

**RLS is default-deny on every table.** All reads/writes go through
`/api/*` serverless functions using the service-role key
(`api/_lib/supabaseAdmin.js`). The browser never talks to Supabase
directly — no anon key is used anywhere in this app.

This app only ever seeds one `pools` row (`slug = 'seahawks'`), even
though the schema supports many, for consistency with World Cup's
reusable design.

**Bootstrapping a new deployment**: the schema seeds the pool row, but
someone must be manually added to `pool_whitelist` via raw SQL before
anyone can log in, and the first participant to log in must be manually
promoted to `role = 'admin'` via raw SQL before the Admin tab is usable.
Exact statements are in `README.md` under Step 5. This is a one-time
chicken-and-egg cost, not a bug.

---

## 5. Auth system — ported from World Cup Pick'em, not Next.js

The user has an existing app, `github.com/jimlackey/worldcup-pickem`
(Next.js App Router), that does email-code login: bcrypt-hashed OTP →
Resend email → on verify, JWT (`jose`) signed and stored as an httpOnly
cookie, with a hash of that JWT also stored in a `sessions` table for
server-side revocation. Whitelist-gated, with admin/player roles and a
self-serve "request access" flow that emails admins a grant link.

**Explicit decision**: user wants this Seahawks app to keep using **Vite**
(declined rebuilding on Next.js), but wants **full parity** with World
Cup's pool/admin/whitelist auth system (not a simplified version). The
resolution: the exact same Node libraries Next.js Server Actions use
(`jose`, `bcryptjs`, `resend`) run identically inside plain Vercel
serverless functions — so the auth logic (`api/_lib/otp.js`,
`api/_lib/session.js`, `api/_lib/pool.js`, `api/_lib/resend.js`) is a
direct port of World Cup's `src/lib/auth/*.ts` and
`src/lib/pool/queries.ts`, just exposed as `/api/auth/*` HTTP endpoints
instead of Server Actions. Session cookie is manually parsed/set with
the `cookie` npm package instead of Next's `cookies()` helper.

**Do not suggest rebuilding this on Next.js** — that was explicitly
declined once already.

Endpoints: `/api/auth/{request-code,verify-code,me,logout,
request-access,grant-access}`, `/api/admin/{whitelist,roster}`,
`/api/{games,picks,roster}`.

**Not yet tested end-to-end** against real Supabase/Resend (sandbox has
no network access to either) — JWT roundtrip and OTP generation were
verified in isolation with dummy env vars, and the client build/tests
pass, but the actual request-code → email → verify-code → session flow
needs a real run once deployed.

---

## 6. Hosting: Vercel Multi-Zones

Target URL: `jimlackey.com/seahawks`, alongside the existing
`jimlackey.com/worldcup` (which serves `worldcup-pickem`, deployed as its
own Vercel project to `worldcup-pickem.vercel.app`).

Plan (Vercel's documented "Multi-Zones" pattern): this becomes its own
Vercel project too, and whatever project owns the `jimlackey.com` root
domain needs a `rewrites()` rule forwarding `/seahawks` and
`/seahawks/:path*` to this project's deployment URL.

To make a Vite app work when reverse-proxied under a path prefix:
- `vite.config.js` reads `VITE_BASE_PATH` (set to `/seahawks/` in
  Vercel; unset/defaults to `/` for local dev) and passes it as Vite's
  `base` config, so built asset URLs are correctly prefixed.
- `src/lib/db.js` and the sync-week fetch in `src/App.jsx` prefix every
  `/api/*` call with `import.meta.env.BASE_URL` for the same reason.

**Open item, blocking final hosting setup**: the root `jimlackey.com`
project's repo/rewrite config is not visible to Claude — it's a separate
repo from `worldcup-pickem`. Need the user to either share that project's
`next.config.ts` rewrites (to mirror the exact pattern already used for
`/worldcup`) or confirm it a different way. Don't guess at this — ask.

---

## 7. Status by step

1. ✅ Scoring engine — built, tested, validated against real 2025 data.
2. ✅ Odds API integration — built, key verified live by the user.
3. ✅ Scores API integration — built, key verified live by the user
   (same provider/key as Step 2).
4. ✅ React UI (Vite) — built. Originally client-only Supabase anon-key
   access; **superseded by Step 5's server-side rework** (RLS now
   default-deny, all access via `/api/*`).
5. ✅ Auth + hosting groundwork — built per §5/§6 above. **Blocked on**:
   root-domain rewrite config (§6) and a real deployed end-to-end test.
6. ⬜ Not started: actual Vercel project creation/deployment, Supabase
   project creation, Resend domain setup, the root-domain rewrite itself,
   and a live smoke test of the whole login → pick → sync → standings
   flow.

---

## 8. Things to NOT re-litigate

- Vite vs. Next.js: **decided, staying on Vite.**
- Auth parity scope: **full parity with World Cup's pool/admin/whitelist
  system was explicitly requested**, not a simplified 3-person version.
- Week 13 scoring: **resolved, engine is correct, sheet had a manual
  error.** Don't re-debate which player should have won that week.
- Odds/scores provider: **The Odds API, one key for both**, chosen and
  verified live already — don't re-shop providers.
- Supabase over Vercel KV/Postgres or reusing the Google Sheet as a
  backend: **decided in Step 4 scoping**, before auth was added.

## 9. How to use this file

Point a new Claude session at this file (paste it in, upload it, or — if
using Claude Projects — add it to the project's knowledge so it's always
in context) before asking for more work on this app. It should replace
re-explaining the above, not supplement a full history read. For exact
code, read the referenced files directly rather than asking the user to
restate what's already built; this doc records decisions and *why*, not
full implementations.

**Keep this file updated** as the project progresses — after any session
that changes architecture, adds a major feature, or resolves an open
item, update the relevant section here (especially §7 Status and §6
Open items) rather than letting it drift out of sync with reality.
