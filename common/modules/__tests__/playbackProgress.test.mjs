import assert from "assert";

import {
  buildMediaCacheKey,
  buildProgressQuery,
  clampTimeToDuration,
  shouldAutoComplete,
} from "../playback/progress.js";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           PLAYBACK PROGRESS UNIT TESTS                    ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failCount++;
  }
}

test("buildProgressQuery returns full identity for trusted media", () => {
  const current = {
    media: {
      media: { id: 42 },
      episode: 5,
      parseObject: { anime_title: "Some Show", anime_season: 2 },
    },
  };
  const media = { media: { id: 42 }, episode: 5, season: 2 };
  const query = buildProgressQuery(current, media);
  assert.strictEqual(query.name, "Some Show S2 E5");
  assert.strictEqual(query.mediaId, 42);
  assert.strictEqual(query.episode, 5);
});

test("buildProgressQuery falls back to name-only when resolution failed", () => {
  const current = {
    media: {
      media: { id: 42 },
      episode: 5,
      failed: true,
      parseObject: { anime_title: "Some Show", episode_number: 5 },
    },
  };
  const media = { media: { id: 42 }, episode: 5 };
  const query = buildProgressQuery(current, media);
  assert.strictEqual(query.name, "Some Show E5");
  assert.strictEqual(query.mediaId, undefined);
  assert.strictEqual(query.episode, undefined);
});

test("buildProgressQuery falls back to file name without a parsed title", () => {
  const query = buildProgressQuery({ name: "raw-file.mkv" }, {});
  assert.strictEqual(query.name, "raw-file.mkv");
  assert.strictEqual(query.mediaId, undefined);
});

test("buildMediaCacheKey follows id > title > parsed title > file name", () => {
  assert.strictEqual(buildMediaCacheKey({ media: { id: 42 } }), "42");
  assert.strictEqual(buildMediaCacheKey({ title: "Some Show" }), "Some Show");
  assert.strictEqual(
    buildMediaCacheKey({ parseObject: { title: "Parsed" } }),
    "Parsed",
  );
  assert.strictEqual(
    buildMediaCacheKey({ parseObject: { file_name: "file.mkv" } }),
    "file.mkv",
  );
  assert.strictEqual(buildMediaCacheKey(undefined), "undefined");
});

test("clampTimeToDuration clamps to [0, duration]", () => {
  assert.strictEqual(clampTimeToDuration(-5, 100), 0);
  assert.strictEqual(clampTimeToDuration(NaN, 100), 0);
  assert.strictEqual(clampTimeToDuration("abc", 100), 0);
  assert.strictEqual(clampTimeToDuration(150, 100), 100);
  assert.strictEqual(clampTimeToDuration(50, 100), 50);
});

test("clampTimeToDuration passes time through without a finite duration", () => {
  assert.strictEqual(clampTimeToDuration(150, undefined), 150);
  assert.strictEqual(clampTimeToDuration(150, 0), 150);
});

test("shouldAutoComplete respects the threshold", () => {
  const base = {
    duration: 1000,
    readyState: 4,
    thresholdPercent: 90,
    media: { media: { episodes: 12 } },
  };
  assert.strictEqual(shouldAutoComplete({ ...base, currentTime: 899 }), false);
  assert.strictEqual(shouldAutoComplete({ ...base, currentTime: 900 }), true);
  assert.strictEqual(
    shouldAutoComplete({ ...base, currentTime: 900, readyState: 0 }),
    false,
  );
});

test("shouldAutoComplete honours the airing-episode guard", () => {
  const base = {
    currentTime: 950,
    duration: 1000,
    readyState: 4,
    thresholdPercent: 90,
  };
  // no episode count: only complete when the episode has aired
  assert.strictEqual(
    shouldAutoComplete({
      ...base,
      media: { media: { nextAiringEpisode: { episode: 6 } }, episode: 5 },
    }),
    true,
  );
  assert.strictEqual(
    shouldAutoComplete({
      ...base,
      media: { media: { nextAiringEpisode: { episode: 4 } }, episode: 5 },
    }),
    false,
  );
  // episodeRange takes precedence over the single episode number
  assert.strictEqual(
    shouldAutoComplete({
      ...base,
      media: {
        media: { nextAiringEpisode: { episode: 6 } },
        episode: 3,
        episodeRange: { last: 7 },
      },
    }),
    false,
  );
});

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);
if (failCount > 0) process.exit(1);
