import assert from "assert";

import {
  buildBrowsingActivity,
  buildWatchingActivity,
} from "../playback/discordActivity.js";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           DISCORD ACTIVITY UNIT TESTS                     ║");
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

const episodeNowPlaying = {
  title: "Some Show",
  episode: 5,
  thumbnail: "https://img.example/cover.jpg",
  media: { id: 123, format: "TV", episodes: 12 },
};

test("episode playback sets state and party size", () => {
  const activity = buildWatchingActivity({
    nowPlaying: episodeNowPlaying,
    paused: false,
    currentTime: 60,
    duration: 1440,
  });
  assert.strictEqual(activity.details, "Some Show");
  assert.strictEqual(activity.state, "Episode: 5 of 12");
  assert.deepStrictEqual(activity.party.size, [5, 12]);
  assert.strictEqual(activity.assets.large_image, episodeNowPlaying.thumbnail);
  assert.strictEqual(activity.type, 3);
});

test("movie format uses 'The Movie' state", () => {
  const activity = buildWatchingActivity({
    nowPlaying: {
      title: "Some Film",
      media: { id: 7, format: "MOVIE", episodes: 1 },
    },
    paused: false,
    currentTime: 0,
    duration: 7200,
  });
  assert.strictEqual(activity.state, "The Movie");
  assert.strictEqual(activity.party.size, undefined);
});

test("paused playback has no timestamps and paused assets", () => {
  const activity = buildWatchingActivity({
    nowPlaying: episodeNowPlaying,
    paused: true,
    currentTime: 60,
    duration: 1440,
  });
  assert.strictEqual(activity.timestamps, undefined);
  assert.strictEqual(activity.assets.small_image, "paused");
  assert.strictEqual(activity.assets.small_text, "Paused");
});

test("playing timestamps derive from currentTime and duration", () => {
  const before = Date.now();
  const activity = buildWatchingActivity({
    nowPlaying: episodeNowPlaying,
    paused: false,
    currentTime: 60,
    duration: 1440,
  });
  const after = Date.now();
  // start ≈ now - 60s, end ≈ now + (1440 - 60)s
  assert.ok(activity.timestamps.start >= before - 60_000);
  assert.ok(activity.timestamps.start <= after - 60_000);
  assert.ok(activity.timestamps.end >= before + 1_380_000);
  assert.ok(activity.timestamps.end <= after + 1_380_000);
});

test("w2g code yields secrets and party id but never buttons", () => {
  const activity = buildWatchingActivity({
    nowPlaying: episodeNowPlaying,
    paused: false,
    currentTime: 60,
    duration: 1440,
    w2gCode: "abc123",
  });
  // Discord rejects activities that carry both buttons and secrets
  assert.strictEqual(activity.buttons, undefined);
  assert.deepStrictEqual(activity.secrets, { join: "abc123", match: "abc123m" });
  assert.strictEqual(activity.party.id, "abc123p");
});

test("no w2g code yields buttons but never secrets", () => {
  const activity = buildWatchingActivity({
    nowPlaying: episodeNowPlaying,
    paused: false,
    currentTime: 60,
    duration: 1440,
  });
  assert.strictEqual(activity.secrets, undefined);
  assert.strictEqual(activity.party.id, undefined);
  assert.strictEqual(activity.buttons.length, 2);
  assert.strictEqual(activity.buttons[0].url, "froyo://anime/123");
});

test("browsing activity is a static presence with download button", () => {
  const activity = buildBrowsingActivity();
  assert.strictEqual(activity.details, "Streaming anime instantly");
  assert.strictEqual(activity.assets.small_image, "searching");
  assert.strictEqual(activity.buttons.length, 1);
  assert.ok(activity.timestamps.start <= Date.now());
});

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);
if (failCount > 0) process.exit(1);
