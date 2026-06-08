import assert from "assert";

import {
  beginBuiltinPlayback,
  failPlayback,
  markPlaybackEnded,
  markPlaybackPaused,
  markPlaybackPlaying,
  markPlaybackReady,
  playbackSession,
  PLAYBACK_STATUS,
  PLAYBACK_TARGET,
  resetPlaybackSession,
} from "../playback/session.js";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           PLAYBACK SESSION UNIT TESTS                    ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    resetPlaybackSession();
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failCount++;
  }
}

test("beginBuiltinPlayback sets source, target, and preparing status", () => {
  const source = { id: "source-1", file: { path: "/tmp/file.mkv" } };
  beginBuiltinPlayback(source);

  assert.strictEqual(playbackSession.value.target, PLAYBACK_TARGET.BUILTIN);
  assert.strictEqual(playbackSession.value.status, PLAYBACK_STATUS.PREPARING);
  assert.strictEqual(playbackSession.value.source, source);
  assert.strictEqual(playbackSession.value.error, null);
});

test("ready, playing, paused, and ended transitions update session status", () => {
  beginBuiltinPlayback({ id: "source-2" });
  markPlaybackReady();
  assert.strictEqual(playbackSession.value.status, PLAYBACK_STATUS.READY);

  markPlaybackPlaying();
  assert.strictEqual(playbackSession.value.status, PLAYBACK_STATUS.PLAYING);

  markPlaybackPaused();
  assert.strictEqual(playbackSession.value.status, PLAYBACK_STATUS.PAUSED);

  markPlaybackEnded();
  assert.strictEqual(playbackSession.value.status, PLAYBACK_STATUS.ENDED);
});

test("failPlayback stores error detail and failed status", () => {
  beginBuiltinPlayback({ id: "source-3" });
  failPlayback("Unable to load video");

  assert.strictEqual(playbackSession.value.status, PLAYBACK_STATUS.FAILED);
  assert.strictEqual(playbackSession.value.error, "Unable to load video");
});

test("resetPlaybackSession restores idle builtin defaults", () => {
  beginBuiltinPlayback({ id: "source-4" });
  markPlaybackPlaying();
  resetPlaybackSession();

  assert.strictEqual(playbackSession.value.target, PLAYBACK_TARGET.BUILTIN);
  assert.strictEqual(playbackSession.value.status, PLAYBACK_STATUS.IDLE);
  assert.strictEqual(playbackSession.value.source, null);
  assert.strictEqual(playbackSession.value.error, null);
});

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
}
