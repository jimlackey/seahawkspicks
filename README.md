# Seahawks Score Picks — Scoring Engine (Step 1)

`src/scoring.js` implements the league rules exactly as documented in the
original "Hawks Picks" sheet:

- **Diff** = `|actual Hawks − picked Hawks| + |actual Opp − picked Opp|`
- **1st place** goes to the lowest Diff *among players who correctly picked
  the game's winner*. If nobody picked the winner correctly that week, 1st
  falls back to the lowest Diff overall.
- **2nd/3rd** are the remaining players ordered by Diff.
- **Missed pick** = worst Diff among the other players that week, **+1**
  (guarantees last place).
- **Standings**: 1st = 3 pts, 2nd = 1 pt, 3rd = 0 pts.

Run tests: `npm test`

## Validation against the real 2025 season

I ran the engine against all 17 played weeks (week 11 was a bye) from your
sheet:

- **Missed-pick formula confirmed twice.** Two weeks had blank score cells
  (Mark in week 14, Brian in week 13) — these weren't data errors, they
  were missed picks. Feeding "worst diff + 1" through the formula
  reproduces the sheet's diff exactly in both cases (15 and 11
  respectively). Good sign the formula as documented is right.
- **15 of 17 weeks rank identically** to what the sheet implies.
- **One discrepancy: Week 13.** Mark had the lower diff (9) but picked the
  wrong winner; Jim had a higher diff (10) but picked correctly. Per the
  documented rule ("weekly winner must correctly identify the game
  winner"), Jim should get 1st. But working backward from the sheet's final
  point totals (Mark 17 / Brian 19 / Jim 32), it looks like **Mark** was
  actually awarded 1st that week instead — the opposite of what the rule
  says, and the opposite of what happened in two other similar situations
  (weeks 3 and 4) where the rule *was* correctly enforced.

  With the rule enforced consistently, the engine produces **Mark 15 /
  Brian 19 / Jim 34** instead of the sheet's 17/19/32 — Brian matches
  exactly; Mark and Jim differ by 2 points each (exactly a 1st/2nd swap for
  that one week).

**Resolved**: confirmed with the user — this was a manual entry mistake
in the sheet. Jim should have won week 13, and that's the behavior the
engine locks in (see the regression test).

## What's next (not yet built)
- Deploy to Vercel

## Step 4 — React UI + Supabase (done)

The app is a Vite + React single-page app with three tabs: **This Week**
(matchup ticket + pick entry for all three players), **Results** (per-week
diff breakdown with the weekly winner highlighted), and **Standings**
(season leaderboard).

### Why Supabase, and why it's not just a cache

The Odds API's `/scores` endpoint only has a rolling **3-day window** —
older completed games fall out of it. That means the app can't just call
the API live every time it needs history. Instead:

- `supabase/schema.sql` defines two tables: `games` (one row per week,
  populated by syncing the API, and then permanent) and `picks` (one row
  per player per week).
- Hitting "Sync latest odds/scores" in the **This Week** tab calls the
  `/api/sync-week` serverless function, which fetches from The Odds API
  server-side (keeping `ODDS_API_KEY` out of the client bundle) and writes
  the result into `games` — so once a week is synced while still fresh,
  its result is preserved forever regardless of the API's 3-day window.
- **Results** and **Standings** are computed straight from what's in
  Supabase, using the same `scoring.js` engine from Step 1 (via
  `src/lib/adapters.js`, which reshapes DB rows into what `scoring.js`
  expects) — one scoring implementation, no duplicated logic between
  historical and live views.

### Design direction

Went with a stadium-scoreboard feel instead of a generic SaaS-card
layout: navy "matchup ticket" panel, a bold condensed display face (Big
Shoulders Display) for scores and week numbers, hairline-rule tabs instead
of pill buttons, and a gold highlight reserved for whoever won the week.

### Setup to run locally

**Superseded by Step 5 below** — Step 5 changed the schema, locked down
RLS, and replaced the anon key with the secret key entirely. Use Step
5's setup instructions instead; this section is kept only as a record of
what Step 4 originally shipped.

1. `npm install`
2. Create a free [Supabase](https://supabase.com) project, then run
   `supabase/schema.sql` in its SQL editor.
3. Copy `.env.example` to `.env.local` and fill in your Supabase URL/anon
   key and your Odds API key.
4. `npm run dev`

### Security note (superseded by Step 5)

The Supabase `anon` key is meant to be public (that's how Supabase's model
works) — the RLS policies in `schema.sql` are the real access boundary,
and they're currently wide open (anyone with the app's URL can read/write
picks). That's a reasonable tradeoff for a private pool between three
friends with nothing sensitive at stake; call it out if that ever needs to
change.

### Known limitations / manual step for now

- **Week number isn't auto-detected.** The Odds/Scores API doesn't return
  an NFL week number, so the app just has a manual ← Week N → stepper.
  You'll need to advance it yourselves each week.
- **Sync is manual** (a button), not scheduled. A future step could add a
  Vercel Cron Job to call `/api/sync-week` automatically once a week.

## Step 5 — Auth + hosting, matching World Cup Pick'em (done)

Two decisions came out of this step: host as a **separate Vercel
project** proxied under `jimlackey.com/seahawks` (Vercel's "Multi-Zones"
pattern), and reuse World Cup's **email-code login** — but adapted to
stay on Vite rather than porting the whole app to Next.js.

### Why this required a real architecture change

Step 4 shipped a client-only SPA: the browser talked to Supabase directly
using the public anon key, with wide-open RLS policies as the only access
control. World Cup's auth depends on things a pure client bundle can't
do — issuing httpOnly cookies from the server, using Supabase's
service-role key (which must never reach the browser), and hashing
OTP codes with bcrypt. None of that can happen in client-side JS.

The fix: Vercel serverless functions (already used for the odds/scores
proxy in Step 2/3) can run the *exact same* Node libraries Next.js
Server Actions use — `jose` for JWTs, `bcryptjs` for OTP hashing,
`resend` for email. So the auth logic is a direct port of World Cup's
`lib/auth/*.ts` and `lib/pool/queries.ts`, just exposed as `/api/auth/*`
HTTP endpoints instead of Server Actions, called from React via `fetch`.

### What changed

- **Schema is now pool-shaped**, mirroring World Cup: `pools`,
  `participants`, `pool_memberships`, `pool_whitelist`, `otp_requests`,
  `sessions`, `access_requests`, `audit_log` — on top of `games`/`picks`,
  which now belong to a `pool_id` and are keyed by `participant_id`
  instead of a hardcoded `"Mark"`/`"Brian"`/`"Jim"` string.
- **RLS is now locked to default-deny.** Every read and write goes
  through an `/api/*` endpoint using the secret key
  (`api/_lib/supabaseAdmin.js`) — Supabase's current name for what used
  to be called the service_role key; same bypass-RLS behavior, new name.
  The publishable/anon key isn't used anywhere in this app — there's no
  direct Supabase access from the browser at all.
- **Login flow**: enter email → `/api/auth/request-code` checks the
  whitelist, rate-limits, generates a 6-digit code, bcrypt-hashes it into
  `otp_requests`, emails the plain code via Resend. Enter the code →
  `/api/auth/verify-code` checks it, finds-or-creates the `participants`/
  `pool_memberships` rows, and calls `createPoolSession` to sign a JWT,
  store its hash in `sessions`, and set an httpOnly cookie.
- **Not on the whitelist?** There's a self-serve "ask for access" flow
  (`/api/auth/request-access` → emails all admins a tokenized "Grant
  access" link → `/api/auth/grant-access` adds them to the whitelist),
  same as World Cup's.
- **Admin tab**: whitelist management and promote/demote player↔admin,
  gated on `session.role === "admin"`.
- **Picks are now identity-scoped for real**: `/api/picks` derives
  `participant_id` from the session cookie, never from the request body,
  so there's no way to submit a pick as someone else. As a side benefit,
  **This Week** now hides other players' actual numbers until kickoff
  (showing only "Submitted" / "Not yet"), which the old fixed 3-card
  layout couldn't do since it had no real identity to gate on.

### Hosting: Vercel Multi-Zones

To live at `jimlackey.com/seahawks` alongside `jimlackey.com/worldcup`:

1. This becomes its **own Vercel project** (own repo, own env vars),
   deployed to its own `*.vercel.app` URL — same pattern as
   `worldcup-pickem`.
2. `vite.config.js` reads a `VITE_BASE_PATH` env var (set it to
   `/seahawks/` in Vercel; leave unset for local dev, which defaults to
   `/`) so Vite emits correctly-prefixed asset URLs.
3. `src/lib/db.js` and the sync-week fetch in `App.jsx` prefix all
   `/api/*` calls with `import.meta.env.BASE_URL`, so they resolve to
   `/seahawks/api/...` once deployed and proxied.
4. **Still needed**: a rewrite rule in whatever Vercel project owns the
   `jimlackey.com` root domain, forwarding `/seahawks` and
   `/seahawks/:path*` to this project's deployment URL — the same
   mechanism that must already route `/worldcup/*` to
   `worldcup-pickem.vercel.app`. I don't have visibility into that root
   project's repo, so this piece needs to be set up on your end (or send
   me its `next.config.ts` rewrites so I can mirror the exact pattern).

### New environment variables (see `.env.example`)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (despite the var name, this
should hold Supabase's **Secret Key**, `sb_secret_...` — found under
Settings → API Keys, not the Publishable Key; the Project URL itself is
under Settings → Data API, a different tab), `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, `SESSION_SECRET` (generate with
`openssl rand -hex 32`), `SESSION_DURATION_HOURS`, `ODDS_API_KEY`
(unchanged from Step 2/3), `APP_URL` (used to build links in
access-request emails), and `VITE_BASE_PATH` (only needed for the
multi-zone production deploy).

### Setup to run locally

1. `npm install`
2. Run `supabase/schema.sql` in a fresh Supabase project's SQL editor
   (it seeds one `pools` row for you: `slug = 'seahawks'`).
3. Manually add your three emails to `pool_whitelist` for that pool via
   the SQL editor (no UI for this yet, since the Admin panel needs
   someone to already be an admin to use it — bootstrap problem). Example:
   ```sql
   insert into pool_whitelist (pool_id, email)
   select id, 'you@example.com' from pools where slug = 'seahawks';
   ```
4. Copy `.env.example` to `.env.local`, fill in Supabase, Resend, and
   Odds API values.
5. `npm run dev`, then log in with one of the whitelisted emails.
6. **Bootstrap the first admin**: after logging in once (which creates
   your `participants`/`pool_memberships` rows), manually flip your role
   to admin in Supabase:
   ```sql
   update pool_memberships set role = 'admin'
   where participant_id = (select id from participants where email = 'you@example.com');
   ```
   After that, the Admin tab can promote/demote everyone else — no more
   manual SQL needed.

### Known limitations

- **Not tested end-to-end.** This sandbox can't reach Supabase, Resend,
  or the multi-zone rewrite target — I verified the client builds clean,
  all 20 unit tests still pass, every serverless function syntax-checks,
  and both the JWT sign/verify roundtrip and OTP generation run correctly
  against dummy env vars. The actual request-code → email → verify-code →
  session flow needs a real run once deployed.
- **Bootstrapping the first admin requires manual SQL** (see above) —
  there's no chicken-and-egg-free way around this for a brand new pool.
- **Migrating from Step 4's schema**: if you already ran the old
  `schema.sql` and have real picks in it, they won't carry over
  automatically — the table shapes changed (`player` text column →
  `participant_id` uuid, plus everything is now `pool_id`-scoped). Flag
  it if that data needs preserving and I'll write a one-off migration.



## Step 2 — Odds API integration (done)

`src/oddsApi.js` pulls NFL closing spread/total from
[The Odds API](https://the-odds-api.com) and extracts the Seahawks'
line specifically.

- **Sign convention verified against your sheet**: negative spread =
  Seahawks favored, positive = underdogs. Confirmed against two real
  games (Week 1 vs. Broncos, Week 13 @ Rams) using the "Cover" column
  as a cross-check — both matched exactly.
- **Consensus line**: averages the spread/total across whichever
  bookmakers report both markets, rather than depending on one book.
- **Your API key was verified live** (200 OK, 498/500 credits
  remaining after the test call — this project will use roughly 2
  credits/week, nowhere near the free-tier limit).
- Tests use a mocked `fetch`, so `npm test` runs with no network
  access and no API credits consumed.

**Note on the key**: don't commit the API key into source control or
share this repo publicly with it inline — when we get to the Vercel
deploy step, it should go in as an environment variable
(e.g. `ODDS_API_KEY`) instead of being hardcoded anywhere.

## Step 3 — Scores integration (done)

`src/scoresApi.js` pulls final scores from the **same Odds API
provider/key** used in Step 2 — no second API needed. Uses
`/v4/sports/americanfootball_nfl/scores?daysFrom=3`, which returns
completed games from the last 3 days (2 credits/call).

- Reuses `findSeahawksGame` from `oddsApi.js` rather than duplicating
  the lookup logic.
- `extractSeahawksResult` returns `hawksScore`/`oppScore` as `null`
  until the game is marked `completed`, so the app can distinguish
  "not played yet" from "played, waiting on data."
- **Verified live** against the real key: 200 OK, correctly showed
  `completed: true` for the Seahawks' most recent game, cost 2 credits
  (496/500 remaining afterward).
- Combined weekly odds + scores usage is ~4 credits/week — comfortably
  under the 500/month free allowance for the whole season.


