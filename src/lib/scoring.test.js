import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDiff,
  pickedCorrectWinner,
  scoreWeek,
  rankWeek,
  computeSeasonStandings,
  inferOverUnder,
} from "./scoring.js";

test("inferOverUnder: predicted total above the line is Over", () => {
  assert.equal(inferOverUnder({ hawks: 27, opp: 20 }, 44.5), "Over");
});

test("inferOverUnder: predicted total below the line is Under", () => {
  assert.equal(inferOverUnder({ hawks: 17, opp: 13 }, 44.5), "Under");
});

test("inferOverUnder: exact tie on a whole-number line is a Push", () => {
  assert.equal(inferOverUnder({ hawks: 24, opp: 20 }, 44), "Push");
});

test("inferOverUnder: no line available yet returns null", () => {
  assert.equal(inferOverUnder({ hawks: 24, opp: 20 }, null), null);
  assert.equal(inferOverUnder({ hawks: 24, opp: 20 }, undefined), null);
});


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

test("rankWeek: correct-winner picks always outrank incorrect-winner picks, regardless of Diff", () => {
  // Mirrors sheet Week 3: Mark and Brian both picked the correct winner,
  // Jim picked wrong despite having the single lowest Diff of the three.
  // Under the current rule, Jim's Diff doesn't matter — he ranks 3rd no
  // matter what, and Mark/Brian split 1st/2nd between themselves by Diff.
  const scored = {
    Mark: { diff: 14, correctWinner: true, missed: false },
    Brian: { diff: 8, correctWinner: true, missed: false },
    Jim: { diff: 7, correctWinner: false, missed: false },
  };
  assert.deepEqual(rankWeek(scored), { Brian: 1, Mark: 2, Jim: 3 });
});

test("rankWeek: two correct-winner picks both outrank one incorrect pick with a better Diff", () => {
  // The exact scenario that prompted this rule: two players pick the
  // Seahawks (correct), one picks the opponent (wrong) — even though the
  // wrong pick has the best raw Diff of the three, it still finishes 3rd.
  const scored = {
    Jim: { diff: 27, correctWinner: true, missed: false },
    Brian: { diff: 26, correctWinner: true, missed: false },
    Mark: { diff: 21, correctWinner: false, missed: false }, // best Diff, but wrong winner
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

  // These totals reflect the CURRENT rule (correct-winner always outranks
  // Diff, at every position — not just 1st place). That rule was adopted
  // after this test was first written; 4 of the 17 weeks here (3, 5, 17,
  // 18) rank differently than they did under the original "1st place
  // only" rule, which is why these numbers won't match an older version
  // of this test or of hand-worked examples from that period.
  //
  // Week 13 is a separate, independent story: the original sheet's own
  // tally gave 1st to Mark (lower Diff, wrong winner) over Jim (higher
  // Diff, correct winner) — the sheet's own documented rule required
  // Jim to win that week regardless of which rule-scope is used (only
  // one player picked the winner correctly, so "1st place only" and
  // "every position" agree there). That's a genuine sheet data-entry
  // error, confirmed by two structurally identical weeks (3 and 4) where
  // the rule *was* applied correctly, and the user explicitly confirmed
  // Jim should have won. This test locks in Jim winning week 13.
  assert.deepEqual(
    { Mark: standings.Mark.points, Brian: standings.Brian.points, Jim: standings.Jim.points },
    { Mark: 17, Brian: 19, Jim: 32 }
  );
});
