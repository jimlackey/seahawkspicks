import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findSeahawksGame,
  extractSeahawksLines,
  fetchNflOdds,
  getSeahawksClosingLines,
} from "./oddsApi.js";

const sampleEvent = {
  id: "abc123",
  sport_key: "americanfootball_nfl",
  commence_time: "2026-09-20T20:25:00Z",
  home_team: "Arizona Cardinals",
  away_team: "Seattle Seahawks",
  bookmakers: [
    {
      key: "draftkings",
      markets: [
        {
          key: "spreads",
          outcomes: [
            { name: "Arizona Cardinals", point: -2.5 },
            { name: "Seattle Seahawks", point: 2.5 },
          ],
        },
        {
          key: "totals",
          outcomes: [
            { name: "Over", point: 44.5 },
            { name: "Under", point: 44.5 },
          ],
        },
      ],
    },
    {
      key: "fanduel",
      markets: [
        {
          key: "spreads",
          outcomes: [
            { name: "Arizona Cardinals", point: -3 },
            { name: "Seattle Seahawks", point: 3 },
          ],
        },
        {
          key: "totals",
          outcomes: [
            { name: "Over", point: 45 },
            { name: "Under", point: 45 },
          ],
        },
      ],
    },
  ],
};

const otherGameEvent = {
  id: "xyz789",
  home_team: "Kansas City Chiefs",
  away_team: "Buffalo Bills",
  bookmakers: [],
};

test("findSeahawksGame finds the Seahawks game among other events", () => {
  const found = findSeahawksGame([otherGameEvent, sampleEvent]);
  assert.equal(found.id, "abc123");
});

test("findSeahawksGame returns null when no Seahawks game is present", () => {
  assert.equal(findSeahawksGame([otherGameEvent]), null);
});

test("extractSeahawksLines averages across bookmakers and identifies the opponent/home status", () => {
  const lines = extractSeahawksLines(sampleEvent);
  assert.equal(lines.opponent, "Arizona Cardinals");
  assert.equal(lines.home, false);
  assert.equal(lines.spread, 2.75); // average of 2.5 and 3
  assert.equal(lines.total, 44.75); // average of 44.5 and 45
});

test("fetchNflOdds throws a descriptive error on a failed request", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    text: async () => "Invalid API key",
  });
  await assert.rejects(
    () => fetchNflOdds("bad-key", fakeFetch),
    /Odds API request failed: 401/
  );
});

test("fetchNflOdds returns events and the requests-remaining header", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: (h) => (h === "x-requests-remaining" ? "498" : null) },
    json: async () => [sampleEvent],
  });
  const { events, requestsRemaining } = await fetchNflOdds("good-key", fakeFetch);
  assert.equal(events.length, 1);
  assert.equal(requestsRemaining, 498);
});

test("getSeahawksClosingLines combines fetch + find + extract", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => "496" },
    json: async () => [otherGameEvent, sampleEvent],
  });
  const result = await getSeahawksClosingLines("good-key", fakeFetch);
  assert.equal(result.game.id, "abc123");
  assert.equal(result.lines.spread, 2.75);
  assert.equal(result.requestsRemaining, 496);
});

test("getSeahawksClosingLines handles no Seahawks game found (e.g. bye week)", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => "500" },
    json: async () => [otherGameEvent],
  });
  const result = await getSeahawksClosingLines("good-key", fakeFetch);
  assert.equal(result.game, null);
  assert.equal(result.lines, null);
});
