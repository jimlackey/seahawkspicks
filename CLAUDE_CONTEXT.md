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
compact — `formatKickoff` in `src/lib/format.js`), home team, away team,
line (`formatLine`, e.g. `-3.5/44.0` — always one decimal), your
Hawks-score pick, your opponent-score pick, computed predicted total +
inferred O/U (display only, via `inferOverUnder` from §2), and a small
save-status dot.

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
- **Team display**: small color-coded badge (`teamInfo()` in
  `src/lib/teams.js`, extracted to `src/components/TeamBadge.jsx` for
  reuse — real team brand colors, not logo artwork; see the "Team logos"
  note in §8) — full team name shown alongside the badge only on wide
  screens (`.team-full` toggled by a CSS media query at 700px, not JS).
- **Mobile width was the whole point** of this design — deliberately
  tight padding/font-size in `.picks-table` CSS to fit 9 columns without
  horizontal scroll on a phone. First attempt still had a small scroll;
  fixed by replacing team full-name text (up to 90px ellipsis each, ×2
  columns) with the compact badges above, shrinking padding/fonts
  further, narrowing score inputs to 24px, hiding number-input spinner
  arrows (were eating into that width), and shortening the line format
  to `-3.5/44.5` and kickoff time by dropping the comma. **Confirmed
  fixed** — no more horizontal scroll on the user's phone.
- **Line formatting**: `src/lib/format.js`'s `formatLine()` always shows
  one decimal (`toFixed(1)`), so an even-number line like `-6` displays
  as `-6.0`, matching `-3.5`'s style. Shared by `PickRow.jsx` and
  `ResultsTile.jsx` (§10) — don't reintroduce a separate un-padded
  formatter in either.
- **Sync odds/scores moved to Admin-only** (`AdminPanel.jsx`, a week-number
  input + button calling `syncOddsAndScores(week)` from `db.js`, which
  wraps the `/api/sync-week` fetch + `/api/games` PUT that used to live
  in `App.jsx`/`ThisWeek.jsx`). Not on the main picks page anymore at
  all, by explicit request ("we will focus more on this later").
- **Full season schedule seeded** from NFL.com for weeks 1-17 (week 18
  @ Rams has no date yet — NFL sets it only after Week 17 finishes).
  Seed script updated `opponent`/`home`/`commence_time` only, via
  `on conflict do update` naming just those columns, so it never
  touched already-recorded spread/total/scores for weeks 1-2. New rows
  got no spread/total (left null) since those are future games — don't
  fabricate lines for them.

---

## 10. Results page (weekly tiles, full transparency)

`src/components/Results.jsx` + `ResultsTile.jsx` (replaced the old
single-column list version). One tile per week, **all 18 weeks always
shown** (not just completed ones), Week 1 on top through Week 18 at the
bottom (ascending order — changed once from a "newest first" default;
if this comes up again, ascending is the confirmed preference).

- **Explicit privacy reversal from the Picks page**: unlike
  `PicksGrid`/`PickRow` (which only show the current user's own pick),
  Results shows **everyone's picks for every week, including future
  ones, as soon as they're submitted** — no hide-until-kickoff here.
  This was a deliberate, explicit user instruction ("Picks are publicly
  visible as soon as they are made") specific to this page. Don't
  "fix" this into matching the Picks page's privacy model — they're
  intentionally different.
- **Layout per tile**: header row (week #, kickoff time, away @ home via
  `TeamBadge`, spread/total line, final score once complete), then three
  side-by-side player sub-tiles sorted **alphabetically by display name**
  (not roster/insertion order).
- **Medal styling** only applies once `game.completed` is true (ranking
  is meaningless before that): gold/silver/bronze border + tinted
  background via `scoreWeek`/`rankWeek` from `src/lib/scoring.js` — same
  functions Standings uses, so ranking logic isn't duplicated. Colors
  are new CSS vars `--silver`/`--bronze` added alongside the existing
  `--gold`.
- **Explicitly out of scope for now**: only 3 players are laid out
  (fixed 3-column grid). If the pool grows beyond 3, this tile layout
  needs revisiting — user said so explicitly, don't try to make it
  N-player-flexible preemptively.

---

## 11. Standings page (table, not stacked rows)

`src/components/Standings.jsx` — a real `<table>` now (was a flex-row
list). Columns: **Place, Name, 1st, 2nd, 3rd, Total**. Sorted by total
points descending.

- Each of the 1st/2nd/3rd columns shows **both** the count and the
  points that count earned, e.g. `2` (bold, larger) with `(6 pts)`
  (small, grey) beneath/beside it — computed as `count *
  STANDINGS_POINTS[place]` (imported from `scoring.js`, not
  hand-hardcoded 3/1/0 again).
- 3rd-place points are always `(0 pts)` since `STANDINGS_POINTS[3] = 0`
  — that's correct per the scoring rules (§2), not a display bug.
- Total column is the same `computeSeasonStandings` output as before —
  no scoring logic changed, only how it's rendered.

---

## 12. Admin panel: editing player name/email

`AdminPanel.jsx`'s roster rows now have an "Edit" button (inline form,
not a modal) for `displayName`/`email`, alongside the existing
promote/demote role button. Backed by `PATCH /api/admin/roster`
(`api/admin/roster.js`), extended to accept optional `displayName`/
`email` fields alongside the pre-existing `role` field —
`updateParticipantProfile()` in `db.js` calls it.

**Important correctness detail, already handled**: changing a
participant's email also moves their `pool_whitelist` entry (delete old
email's row, upsert the new one) in the same request. Without this,
editing someone's email would lock them out entirely — the whitelist
check in `/api/auth/request-code` matches by email, so the new address
wouldn't be whitelisted and the old one would be orphaned. If this
endpoint gets touched again, keep that swap — don't let email updates
skip it.

---

## 13. Rules page (static, read-only)

`src/components/Rules.jsx` — a 5th tab (Picks/Results/Standings/Rules,
plus Admin for admins). Plain static JSX, no data fetching. Explains
Diff, the correct-winner-first ranking rule, missed-pick penalty,
season standings points, and the informational-only O/U — each with a
worked numeric example.

**The worked examples are verified against the real engine, not just
hand-computed** — same Jim/Mark/Brian names and diff values (6/7/16)
used in §2's week-13 discussion, run through the actual `scoreWeek`/
`rankWeek` functions to confirm the displayed ranks (Mark 1st, Jim 2nd,
Brian 3rd) and the missed-pick example (diff 8) are exactly what the
engine produces. If this page is ever edited, re-verify any changed
numbers the same way rather than hand-computing — it's easy to get diff
math subtly wrong, and this page is presented as the authoritative
rules explanation.

**Tab bar CSS was tightened** (gap 28px→16px, font 15px→13.5px, added
`overflow-x:auto` as a safety net) when this 5th tab was added, since
5 tabs at the original sizing risked its own horizontal scroll on
mobile — the same class of problem as §9's picks-table scroll issue.

---

## 14. Score updates: manual, admin-only (and its real gaps)

There is no automatic score-updating — no cron, no polling, no trigger
on game completion. The only mechanism is the Admin tab's "Sync
odds/scores" (built in §9), which is entirely manual: an admin types a
week number and clicks Sync.

**Two real correctness gaps the user was told about explicitly** (not
hidden as "future work" — surfaced directly when asked how this works):

1. The sync doesn't verify which week it's writing to. It fetches
   whatever game The Odds API considers "current" and trusts whatever
   week number the admin typed. Type the wrong week, silently overwrite
   the wrong row — the same class of bug as the SEA/ARI mislabeling
   the user caught manually earlier (§ schedule-seeding note).
2. The scores endpoint's 3-day rolling window (§3) means if nobody
   syncs within ~3 days of a game finishing, the real result becomes
   unrecoverable through the API — manual SQL entry (as done for Week 1)
   becomes the only option.

**As of this note, no decision has been made yet** on which fix to
pursue (Vercel Cron for full automation, auto-detecting the week number
to remove the mistype risk, or just living with manual + care). If a
future session lands here, check whether that decision happened later
in conversation before assuming it's still open.

### Odds API usage/quota display (built alongside this)

`getUsageQuota()` in `src/lib/oddsApi.js` hits `GET /v4/sports` — an
endpoint The Odds API's own docs confirm costs **0 credits** — to read
the `x-requests-remaining`/`x-requests-used` response headers. Exposed
as `GET /api/admin/usage` (admin-only) and shown at the top of the
Admin tab, refreshed on load and after every real sync. This means
**quota can be checked for free, as often as wanted**, unlike the
actual odds/scores calls which do cost credits — don't accidentally
build a "cheaper" quota check later; this one already costs nothing.

---

## 15. Vercel Hobby plan's 12-function limit (already hit once)

Hobby-tier Vercel projects cap out at **12 Serverless Functions per
deployment**. This repo hit that limit for real (deploy failed) once
`api/admin/usage.js` (§14) pushed the count to 13 separate route files.

**Fix applied**: Vercel supports dynamic API routes via bracket-named
files (`[param].js`), same convention as Next.js file routing — one
file can serve many URL paths, with the matched segment available as
`req.query.<param>`. Consolidated:
- `api/auth/{request-code,verify-code,me,logout,request-access,
  grant-access}.js` (6 files) → **`api/auth/[action].js`** (1 file),
  dispatching on `req.query.action` via a switch statement.
- `api/admin/{whitelist,roster,usage}.js` (3 files) → **`api/admin/[action].js`**
  (1 file), same pattern.

This is a **pure routing consolidation, zero behavior change** — every
handler's logic (auth checks, validation, error messages) was moved
verbatim into a named function within the merged file. The frontend's
`fetch()` calls in `db.js` were never touched and don't need to be —
`/api/auth/request-code` etc. still resolve to exactly those same URLs,
Vercel's router just maps them to the dynamic file now instead of a
dedicated one.

**Current count: 6 functions** (`api/auth/[action].js`,
`api/admin/[action].js`, `api/games.js`, `api/picks.js`, `api/roster.js`,
`api/sync-week.js`) — comfortable headroom under 12. `api/_lib/*` files
don't count at all (Vercel excludes underscore-prefixed
folders/files from function routing entirely — that's *why* the shared
lib code lives under `_lib` in the first place, not just a naming
preference).

**Already caused a real deploy failure once, on the very next
deploy.** The user's workflow is extracting delivered zips over their
existing repo — which only adds/overwrites files, it never deletes
anything not present in the zip. When the 9 old individual route files
were replaced by the 2 `[action].js` files, the zip didn't (couldn't)
remove the old ones, so the repo ended up with **15** functions
(9 stale + 6 current), not 6 — same "12 function limit" error,
worse than before the fix. Fixed with an explicit `git rm` of the 9
stale paths. **General lesson, not just this one incident**: any time
a future session deletes/replaces a file as part of a fix, explicitly
call out which old file(s) need manual removal from the repo — don't
assume the zip handles it, because it structurally can't.

**If more endpoints get added later**: prefer adding a new `case` to
one of the two existing `[action].js` switches, or consolidating
`games.js`/`picks.js`/`roster.js`/`sync-week.js` the same way, before
reaching for a new standalone file — the ceiling is real and close.

---

## 16. Admin games table (replaced the week-number textbox)

`AdminGamesTable.jsx` + `AdminGameRow.jsx` — the Admin tab's sync UI is
now a table, one row per week (1-18), each with its own **Update Odds**
and **Update Score** buttons, instead of a single textbox + one combined
sync button.

- **Split by credit cost, not just UI**: `api/sync-week.js` now takes
  `?type=odds` or `?type=score` and only calls the one Odds API endpoint
  needed (2 credits each) instead of always fetching both (4 credits)
  regardless of which button was clicked. `syncOdds()`/`syncScore()` in
  `db.js` replaced the old single `syncOddsAndScores()`.
- **Partial writes, explicitly built** (`api/games.js`'s PUT handler):
  Update Odds only touches `spread`/`total`; Update Score only touches
  `hawks_score`/`opp_score`/`completed`. Neither touches
  `opponent`/`home`/`commence_time` (those come from the schedule seed,
  §9). Built as an explicit conditional field list, not by relying on
  `undefined` keys silently dropping through Supabase's client
  internals — safer and doesn't depend on library behavior this
  codebase can't easily verify from the sandbox.
- **Wrong-week safety check, finally addressed**: since every week now
  has a known expected opponent (from the seeded schedule, §9), both
  `syncOdds`/`syncScore` compare the API's returned opponent against
  what's already stored for that week and **refuse to write, with a
  clear error, on a mismatch** — this was gap #1 from §14's "two real
  correctness gaps" note. Only closes it for weeks with a schedule row
  already (all of 1-17); week 18 still has no row to check against.
- **Bug hit twice, two different real causes** — same error message
  both times (`null value in column "opponent"... violates not-null
  constraint`), but don't assume it's the first cause again if it ever
  recurs:
  1. **First cause** (weeks with no `games` row yet, e.g. week 18):
     the write only sent spread/total, but an INSERT needs the NOT NULL
     opponent/home/commence_time too. Fixed client-side: `syncOdds`/
     `syncScore` in `db.js` backfill opponent/home/commenceTime from the
     API response when `expectedOpponent` is falsy (i.e. no existing
     row — `opponent` is NOT NULL whenever a row exists, so its absence
     reliably signals "new row").
  2. **Second, more fundamental cause** — this is the one that actually
     hit in practice, on a week that *already had* a schedule row: this
     is genuine, documented PostgreSQL behavior (confirmed by the
     Postgres core team in bug #16706, not a Supabase quirk) —
     `INSERT ... ON CONFLICT DO UPDATE` validates NOT NULL constraints
     on the *proposed insert row* **before** it ever checks for a
     conflict. So a `.upsert()` call that omits `opponent` fails
     immediately even when the row already exists and would only take
     the UPDATE branch. Fix #1 (client-side backfill for new rows)
     didn't touch this at all, because it still applies to every
     partial update, existing row or not.
  **Real fix** (`api/games.js`'s PUT handler): check whether a row
  exists first (`select().maybeSingle()`), then branch — existing row →
  plain `.update(fields).eq("id", existing.id)` (never constructs an
  insert candidate row, so NOT NULL on omitted columns is a non-issue);
  no existing row → real `.insert()`, which 400s with a clear message
  if opponent/home/commence_time are still missing rather than letting
  Postgres throw a cryptic constraint error. **General lesson**: don't
  reach for `.upsert()` for a partial-field update against a table with
  NOT NULL columns beyond the conflict key — it silently requires every
  NOT NULL column on every call, existing row or not. Check-then-branch
  (update vs insert) is the correct pattern here, not upsert.
- **Both buttons stay live for past weeks on purpose** (explicit user
  request) — Update Score can correct a wrong final score after the
  fact.
- **No separate "recalculate" step exists or is needed.** Results and
  Standings are pure functions computed live from whatever's currently
  in `games`+`picks` (`scoreWeek`/`rankWeek`/`computeSeasonStandings`,
  §2) — nothing is cached or pre-computed. Correcting a score via
  Update Score and then loading Results/Standings just works, no extra
  step. Don't build a recompute button/job; there's nothing to trigger.

---

## 17. How to use this file

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
