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

**This needs your call**: was the sheet's week 13 result a manual entry
mistake (engine's version, Jim 1st, is correct), or is there a rule nuance
I'm missing that should let Mark keep 1st there? Either way, this is the
last open question before the engine is "final" — happy to hardcode either
behavior once you confirm.

## What's next (not yet built)
- Scores API integration for auto-pulling final results
- React UI (pick submission, results, leaderboard)
- Deploy to Vercel

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


