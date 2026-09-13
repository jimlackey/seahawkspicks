import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDiff,
  pickedCorrectWinner,
  scoreWeek,
  rankWeek,
  computeSeasonStandings,
} from "./scoring.js";

test("computeDiff sums absolute score errors", () => {
  assert.equal(computeDiff({ hawks: 17, opp: 16 }, { hawks: 10, opp: 31 }), 22);
});

test("pickedCorrectWinner: correct pick", () => {
  assert.equal(
    pickedCorrectWinner({ hawks: 17, opp: 16 }, { hawks: 20, opp: 10 }),
    true
  );
});

test("pickedCorrectWinner: wrong pick", () => {
  assert.equal(
    pickedCorrectWinner({ hawks: 17, opp: 16 }, { hawks: 10, opp: 20 }),
    false
  );
});

test("pickedCorrectWinner: actual tie never counts as a correct pick", () => {
  assert.equal(
    pickedCorrectWinner({ hawks: 20, opp: 20 }, { hawks: 24, opp: 10 }),
    false
  );
});

test("scoreWeek applies the missed-pick penalty (worst diff + 1)", () => {
  const actual = { hawks: 20, opp: 10 };
  const picks = {
    Mark: { hawks: 21, opp: 12 }, // diff 3
    Brian: { hawks: 10, opp: 30 }, // diff 30
    Jim: null, // missed
  };
  const scored = scoreWeek(picks, actual);
  assert.equal(scored.Jim.diff, 31);
  assert.equal(scored.Jim.missed, true);
  assert.equal(scored.Jim.correctWinner, false);
});

test("rankWeek: correct-winner requirement overrides raw diff order", () => {
  // Mirrors sheet Week 3: Jim has the lowest diff but picked the wrong
  // winner; Brian has a higher diff but picked correctly, so Brian is 1st.
  const scored = {
    Mark: { diff: 14, correctWinner: true, missed: false },
    Brian: { diff: 8, correctWinner: true, missed: false },
    Jim: { diff: 7, correctWinner: false, missed: false },
  };
  assert.deepEqual(rankWeek(scored), { Brian: 1, Jim: 2, Mark: 3 });
});

test("rankWeek: falls back to pure lowest-diff when nobody picked correctly", () => {
  const scored = {
    Mark: { diff: 22, correctWinner: false, missed: false },
    Brian: { diff: 14, correctWinner: false, missed: false },
    Jim: { diff: 8, correctWinner: false, missed: false },
  };
  assert.deepEqual(rankWeek(scored), { Jim: 1, Brian: 2, Mark: 3 });
});

// --- Regression test against the real 2025 season sheet ---
// All 17 played weeks (week 11 was a bye). Two weeks include a missed pick
// (Mark in week 14, Brian in week 13) that the sheet recorded as blank
// score cells with a pre-computed diff — both reproduce exactly under the
// "worst diff + 1" penalty rule, which is a strong confirmation the engine
// logic is right.
test("full season standings closely match the sheet's own totals", () => {
  const weeks = [
    { actual: { hawks: 17, opp: 16 }, picks: { Mark: { hawks: 10, opp: 31 }, Brian: { hawks: 10, opp: 23 }, Jim: { hawks: 13, opp: 20 } } },
    { actual: { hawks: 7, opp: 27 }, picks: { Mark: { hawks: 19, opp: 22 }, Brian: { hawks: 16, opp: 23 }, Jim: { hawks: 17, opp: 26 } } },
    { actual: { hawks: 23, opp: 27 }, picks: { Mark: { hawks: 17, opp: 19 }, Brian: { hawks: 16, opp: 26 }, Jim: { hawks: 22, opp: 21 } } },
    { actual: { hawks: 48, opp: 45 }, picks: { Mark: { hawks: 28, opp: 21 }, Brian: { hawks: 22, opp: 30 }, Jim: { hawks: 20, opp: 23 } } },
    { actual: { hawks: 32, opp: 39 }, picks: { Mark: { hawks: 20, opp: 23 }, Brian: { hawks: 25, opp: 27 }, Jim: { hawks: 26, opp: 23 } } },
    { actual: { hawks: 19, opp: 9 }, picks: { Mark: { hawks: 31, opp: 38 }, Brian: { hawks: 26, opp: 32 }, Jim: { hawks: 27, opp: 24 } } },
    { actual: { hawks: 37, opp: 23 }, picks: { Mark: { hawks: 15, opp: 30 }, Brian: { hawks: 23, opp: 31 }, Jim: { hawks: 20, opp: 27 } } },
    { actual: { hawks: 27, opp: 13 }, picks: { Mark: { hawks: 24, opp: 23 }, Brian: { hawks: 19, opp: 24 }, Jim: { hawks: 24, opp: 28 } } },
    { actual: { hawks: 31, opp: 21 }, picks: { Mark: { hawks: 19, opp: 20 }, Brian: { hawks: 26, opp: 32 }, Jim: { hawks: 26, opp: 20 } } },
    { actual: { hawks: 16, opp: 21 }, picks: { Mark: { hawks: 27, opp: 24 }, Brian: { hawks: 23, opp: 26 }, Jim: { hawks: 27, opp: 16 } } },
    // week 11 = BYE, skipped
    { actual: { hawks: 34, opp: 40 }, picks: { Mark: { hawks: 33, opp: 16 }, Brian: { hawks: 26, opp: 27 }, Jim: { hawks: 27, opp: 19 } } },
    { actual: { hawks: 27, opp: 23 }, picks: { Mark: { hawks: 20, opp: 21 }, Brian: null, Jim: { hawks: 31, opp: 17 } } }, // week 13, Brian missed
    { actual: { hawks: 24, opp: 30 }, picks: { Mark: null, Brian: { hawks: 27, opp: 19 }, Jim: { hawks: 24, opp: 20 } } }, // week 14, Mark missed
    { actual: { hawks: 13, opp: 21 }, picks: { Mark: { hawks: 7, opp: 30 }, Brian: { hawks: 20, opp: 30 }, Jim: { hawks: 16, opp: 26 } } },
    { actual: { hawks: 10, opp: 24 }, picks: { Mark: { hawks: 10, opp: 27 }, Brian: { hawks: 20, opp: 38 }, Jim: { hawks: 13, opp: 31 } } },
    { actual: { hawks: 23, opp: 6 }, picks: { Mark: { hawks: 27, opp: 23 }, Brian: { hawks: 20, opp: 22 }, Jim: { hawks: 21, opp: 20 } } },
    { actual: { hawks: 19, opp: 16 }, picks: { Mark: { hawks: 12, opp: 22 }, Brian: { hawks: 27, opp: 22 }, Jim: { hawks: 27, opp: 13 } } },
  ];

  const standings = computeSeasonStandings(weeks);

  // Sheet's own totals: Mark 17, Brian 19, Jim 32.
  // Engine reproduces Brian exactly. Mark/Jim are off by 2 points each
  // (engine: Mark 15, Jim 34) traced to week 13, where the sheet awards
  // 1st to Mark (lower diff, wrong winner) despite the documented
  // "must correctly identify the winner" rule — which this engine
  // enforces and which gives 1st to Jim (higher diff, correct winner)
  // instead. This is flagged for the user rather than silently patched.
  assert.deepEqual(
    { Mark: standings.Mark.points, Brian: standings.Brian.points, Jim: standings.Jim.points },
    { Mark: 15, Brian: 19, Jim: 34 }
  );
});
