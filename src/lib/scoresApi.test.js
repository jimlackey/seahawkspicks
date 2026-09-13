import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchNflScores,
  extractSeahawksResult,
  getSeahawksResult,
} from "./scoresApi.js";

const completedSeahawksGame = {
  id: "abc123",
  sport_key: "americanfootball_nfl",
  commence_time: "2026-09-13T17:00:00Z",
  completed: true,
  home_team: "Seattle Seahawks",
  away_team: "Denver Broncos",
  scores: [
    { name: "Seattle Seahawks", score: "17" },
    { name: "Denver Broncos", score: "16" },
  ],
};

const inProgressSeahawksGame = {
  id: "def456",
  home_team: "Arizona Cardinals",
  away_team: "Seattle Seahawks",
  completed: false,
  scores: null,
};

const otherGame = {
  id: "xyz789",
  home_team: "Kansas City Chiefs",
  away_team: "Buffalo Bills",
  completed: true,
  scores: [
    { name: "Kansas City Chiefs", score: "24" },
    { name: "Buffalo Bills", score: "20" },
  ],
};

test("extractSeahawksResult parses a completed game correctly", () => {
  const result = extractSeahawksResult(completedSeahawksGame);
  assert.deepEqual(result, {
    completed: true,
    hawksScore: 17,
    oppScore: 16,
    opponent: "Denver Broncos",
    home: true,
    commenceTime: "2026-09-13T17:00:00Z",
  });
});

test("extractSeahawksResult returns null scores for a game not yet completed", () => {
  const result = extractSeahawksResult(inProgressSeahawksGame);
  assert.equal(result.completed, false);
  assert.equal(result.hawksScore, null);
  assert.equal(result.oppScore, null);
  assert.equal(result.opponent, "Arizona Cardinals");
  assert.equal(result.home, false);
});

test("fetchNflScores throws a descriptive error on a failed request", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    text: async () => "Invalid API key",
  });
  await assert.rejects(
    () => fetchNflScores("bad-key", fakeFetch),
    /Scores API request failed: 401/
  );
});

test("getSeahawksResult combines fetch + find + extract for a completed game", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => "494" },
    json: async () => [otherGame, completedSeahawksGame],
  });
  const { game, result, requestsRemaining } = await getSeahawksResult("good-key", fakeFetch);
  assert.equal(game.id, "abc123");
  assert.equal(result.hawksScore, 17);
  assert.equal(result.oppScore, 16);
  assert.equal(requestsRemaining, 494);
});

test("getSeahawksResult handles no Seahawks game in the lookback window (e.g. bye week)", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => "492" },
    json: async () => [otherGame],
  });
  const { game, result } = await getSeahawksResult("good-key", fakeFetch);
  assert.equal(game, null);
  assert.equal(result, null);
});
