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

**Over/Under is inferred, not manually picked.** `inferOverUnder` in
`src/lib/scoring.js` compares predicted total (hawks + opp) to the
game's total line — no separate UI toggle. Returns `"Push"` on an exact
tie, `null` if no line has been synced yet. `picks.ou_pick` in the DB is
nullable and allows `'Push'` for this reason (originally `not null
check (... in ('Over','Under'))`, copied from the original sheet's
manual toggle; loosened once the toggle was removed — if a fresh
Supabase project still has the old constraint, run: `alter table picks
alter column ou_pick drop not null; alter table picks drop constraint
picks_ou_pick_check; alter table picks add constraint
picks_ou_pick_check check (ou_pick in ('Over','Under','Push'));`).
**Not used by the scoring engine at all** — `scoreWeek`/`rankWeek` only
look at the predicted score — so it's informational only.

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
`/api/*` serverless functions using the secret key
(`api/_lib/supabaseAdmin.js`). The browser never talks to Supabase
directly — no publishable/anon key is used anywhere in this app.

**Supabase key naming (gotcha, discovered post-deploy-planning)**:
Supabase has renamed its API keys — `sb_publishable_...` replaces the old
`anon` key, `sb_secret_...` replaces the old `service_role` key. Same
permissions/behavior, just not JWT-formatted anymore, and any client
library version accepts them as drop-in replacements. This project's env
var is still named `SUPABASE_SERVICE_ROLE_KEY` for historical consistency
with the rest of the codebase, but the value that goes in it is the
**Secret Key** from Settings → API Keys (not the Publishable Key). The
Project URL is on a separate tab, Settings → Data API, not the API Keys
tab — a genuinely non-obvious spot the user got stuck on once already.

This app only ever seeds one `pools` row (`slug = 'seahawks'`), even
though the schema supports many, for consistency with World Cup's
reusable design.

**Bootstrapping a new deployment**: the schema seeds the pool row, but
someone must be manually added to `pool_whitelist` via raw SQL before
anyone can log in, and the first participant to log in must be manually
promoted to `role = 'admin'` via raw SQL before the Admin tab is usable.
Exact statements are in `README.md` under Step 5. This is a one-time
chicken-and-egg cost, not a bug.

**Already hit this exact issue once**: if a Supabase project had the old
Step 4 schema (no `pool_id`/`participant_id`) run against it before the
current schema.sql, `games`/`picks` already exist with the old shape,
and `create table if not exists` silently no-ops instead of adding the
new columns — surfaces later as a PostgREST error like "Could not find
the 'pool_id' column of 'games' in the schema cache" when the app tries
to write. Diagnose with `select column_name from information_schema.
columns where table_name = 'games'` (or `'picks'`); fix (safe when no
real data is at stake yet) is `drop table if exists picks cascade; drop
table if exists games cascade;` then re-run the full current schema.sql
— everything else in it is idempotent, so re-running the whole file is
safe and only recreates the two dropped tables.

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

**Bug already found and fixed once**: `api/games.js` and `api/picks.js`
originally imported `../_lib/...` (copy-pasted from the `api/auth/*.js`
files, which are one folder deeper). Since `games.js`/`picks.js` live
directly in `/api/`, not a subfolder, that path resolved to a
nonexistent directory one level above `/api/`, crashing the function at
import time with a generic unhandled 500 (no JSON error body — that's
the tell: a deliberate `res.status(500).json({error: "..."})` in this
codebase always has a specific message; a bare "(500)" with nothing
after it means an uncaught crash before our own error handling ran).
Fixed to `./_lib/...`. If a similar generic 500 shows up again on a
different endpoint, check import path depth against actual folder
location first — `api/*.js` → `./_lib/`, `api/auth/*.js` and
`api/admin/*.js` → `../_lib/`.

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

**Gotcha, already hit once**: once `VITE_BASE_PATH=/seahawks/` is set in
Vercel, the bare `*.vercel.app` deployment URL will 404 on all JS/CSS
assets and render a blank page (valid `<head>`, empty `<div>` in
`<body>`) — this is expected, not a bug. The build's asset paths are
baked to expect the `/seahawks` prefix, which only exists once the
multi-zone rewrite (above) is live. To sanity-check the app standalone,
temporarily unset `VITE_BASE_PATH`, redeploy, test the bare URL, then
re-set it to `/seahawks/` and redeploy again before wiring/testing the
real rewrite — and from that point on, only test via
`www.jimlackey.com/seahawks`, not the bare Vercel URL.

---

## 7. Status by step

1. ✅ Scoring engine — built, tested, validated against real 2025 data.
2. ✅ Odds API integration — built, key verified live by the user.
3. ✅ Scores API integration — built, key verified live by the user
   (same provider/key as Step 2).
4. ✅ React UI (Vite) — built. Originally client-only Supabase anon-key
   access; **superseded by Step 5's server-side rework** (RLS now
   default-deny, all access via `/api/*`).
5. ✅ Auth + hosting groundwork — built per §5/§6 above.
6. 🟡 In progress: Vercel project **deployed and live** at
   `seahawkspicks.vercel.app` (note: actual project name differs from the
   `seahawks-scores` name originally discussed — use the real deployed
   URL, not the planned one, when it matters). Supabase "seahawks"
   project created, schema applied (after fixing a stale-table issue —
   see §4's gotcha), login/games/picks confirmed working end-to-end.
   **Still open**: the root-domain rewrite in `worldcup-pickem` (§6) to
   actually serve this at `jimlackey.com/seahawks` hasn't been done yet.
7. ✅ Main picks UI reworked from single-week stepper to a full-season
   grid (see §10). Sync odds/scores moved to Admin-only, no longer on
   the main picks page.

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
- Main picks page is a **full-season grid** (one row per week 1-18), not
  a single-week view — explicitly requested to replace the stepper.
  Sync odds/scores lives in Admin only now, not on the picks page.
- **Team logos**: real NFL logo images are off-limits for Claude to
  source (licensed sports content, blocked for image search/fetch
  regardless of the user's fair-use intent for a personal project).
  Team identification uses small colored badges (`teamInfo()` in
  `src/lib/teams.js` — real brand colors, which are facts, not
  copyrighted artwork) instead. If the user wants actual logo images,
  they need to supply the image files themselves; Claude can wire them
  in but shouldn't try to fetch them again.

## 9. Main picks UI (full-season grid, not a stepper)

`src/components/PicksGrid.jsx` + `PickRow.jsx` (replaced the old
`ThisWeek.jsx`/`PlayerPickCard.jsx`, both deleted). One `<table>` row per
week (1-18, always all 18 rendered regardless of whether a `games` row
exists yet for that week). Columns: week #, kickoff time (Pacific,
compact — `formatKickoff` in `PickRow.jsx`), home team, away team, line
(`spread, total`), your Hawks-score pick, your opponent-score pick,
computed predicted total + inferred O/U (display only, via
`inferOverUnder` from §2), and a small save-status dot.

- **Autosave, no Save button**: each row debounces 600ms after the last
  keystroke once both score fields are valid non-negative integers, then
  calls `onSave(week, {...})` directly — no manual submit.
- **Only the current user's own pick** is shown/editable here (unlike
  the Results tab, which reveals everyone's picks after kickoff). This
  page was never meant to show other players' numbers.
- **Locking**: a row is locked (inputs disabled, status dot hidden) once
  `game.commence_time` has passed. A week with no synced `games` row yet
  is treated as unlocked/editable — consistent with "any week not yet
  played" from the user's own framing of the requirement.
- **Team display**: full name on wide screens, 3-letter code
  (`src/lib/teams.js`, `teamCode()`) on narrow ones — done via two
  sibling spans (`.team-short`/`.team-full`) toggled by a CSS media
  query at 700px, not JS, so there's no layout-measuring logic to
  maintain.
- **Mobile width was the whole point** of this design — deliberately
  tight padding/font-size in `.picks-table` CSS to fit 9 columns without
  horizontal scroll on a phone. If that turns out not to work in
  practice, the user already floated a fallback (a two-line-per-week
  layout) — ask before redesigning again from scratch, since "let's see
  how it works out" was the explicit framing, not a firm commitment to
  the single-line approach.

**Tightening pass (still narrow on first try)**: user reported a small
horizontal scroll on mobile even with the original sizing. Response:
replaced team full-name text (up to 90px ellipsis width each, ×2
columns) with small color-coded badges (~20-26px, no text on mobile),
shrank all padding/font-sizes further, narrowed the score inputs to
24px, hid number-input spinner arrows (were eating into that width),
and shortened the line format from "-3.5, 44.5" to "-3.5/44.5" and the
kickoff time by dropping the comma. Not verified on an actual device —
if it's still scrolling, the next lever is the two-line-per-week
fallback design, not further micro-tightening of this one.
- **Sync odds/scores moved to Admin-only** (`AdminPanel.jsx`, a week-number
  input + button calling `syncOddsAndScores(week)` from `db.js`, which
  wraps the `/api/sync-week` fetch + `/api/games` PUT that used to live
  in `App.jsx`/`ThisWeek.jsx`). Not on the main picks page anymore at
  all, by explicit request ("we will focus more on this later").

---

## 10. How to use this file

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
