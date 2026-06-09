import assert from "assert";

import { createAudioGainManager } from "../playback/audioGain.js";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           AUDIO GAIN MANAGER UNIT TESTS                   ║");
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

const caches = { GENERAL: "general", HISTORY: "history" };

function makeCacheStub(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getEntry: (cacheName, key) => store.get(`${cacheName}:${key}`),
    setEntry: (cacheName, key, value) =>
      store.set(`${cacheName}:${key}`, value),
  };
}

function makeManager(initial) {
  const cache = makeCacheStub(initial);
  const gainNode = { gain: { value: 1 } };
  const manager = createAudioGainManager({
    cache,
    caches,
    createContext: () => ({ audioCtx: {}, gainNode }),
  });
  return { manager, cache, gainNode };
}

test("volume hydrates from cache and defaults to 1", () => {
  const { manager } = makeManager({ "general:volume": "0.4" });
  assert.strictEqual(manager.volume.value, 0.4);
  const { manager: fresh } = makeManager();
  assert.strictEqual(fresh.volume.value, 1);
});

test("volume changes persist to cache", () => {
  const { manager, cache } = makeManager();
  manager.volume.value = 0.7;
  assert.strictEqual(cache.getEntry(caches.GENERAL, "volume"), "0.7");
});

test("setGain at or below 1 acts as plain volume", () => {
  const { manager, gainNode } = makeManager();
  manager.attach({});
  manager.setGain(0.5, "show");
  assert.strictEqual(gainNode.gain.value, 1);
  assert.strictEqual(manager.volume.value, 0.5);
  assert.strictEqual(manager.gain.value, 0.5);
});

test("setGain above 1 boosts via the gain node and persists", () => {
  const { manager, gainNode, cache } = makeManager();
  manager.attach({});
  manager.setGain(2, "show");
  assert.strictEqual(manager.volume.value, 1);
  assert.strictEqual(gainNode.gain.value, 2);
  assert.strictEqual(manager.gain.value, 2);
  assert.deepStrictEqual(
    cache.getEntry(caches.HISTORY, "lastBoosted").show,
    { boosted: false, gain: 2 },
  );
});

test("toggleGain on boosts from current volume and persists boosted state", () => {
  const { manager, cache } = makeManager();
  manager.volume.value = 0.8;
  manager.toggleGain("show", {});
  assert.strictEqual(manager.volumeBoosted.value, true);
  assert.strictEqual(manager.gain.value, 0.8);
  assert.deepStrictEqual(
    cache.getEntry(caches.HISTORY, "lastBoosted").show,
    { boosted: true, gain: 0.8 },
  );
});

test("toggleGain off restores volume and resets the gain node", () => {
  const { manager, gainNode, cache } = makeManager();
  manager.toggleGain("show", {});
  manager.setGain(2, "show");
  manager.toggleGain("show", {});
  assert.strictEqual(manager.volumeBoosted.value, false);
  assert.strictEqual(manager.volume.value, 1);
  assert.strictEqual(manager.gain.value, 1);
  assert.strictEqual(gainNode.gain.value, 1);
  assert.strictEqual(
    cache.getEntry(caches.HISTORY, "lastBoosted").show.boosted,
    false,
  );
});

test("restoreBoostForMedia applies a persisted boost", () => {
  const { manager, gainNode } = makeManager({
    "history:lastBoosted": { show: { boosted: true, gain: 2.5 } },
  });
  manager.restoreBoostForMedia("show", {});
  assert.strictEqual(manager.volumeBoosted.value, true);
  assert.strictEqual(manager.gain.value, 2.5);
  assert.strictEqual(gainNode.gain.value, 2.5);
});

test("restoreBoostForMedia without a boost resets gain to volume", () => {
  const { manager, gainNode } = makeManager();
  manager.attach({});
  manager.volume.value = 0.6;
  manager.setGain(2, "other");
  manager.restoreBoostForMedia("show", {});
  assert.strictEqual(manager.volumeBoosted.value, false);
  assert.strictEqual(manager.gain.value, 0);
  assert.strictEqual(gainNode.gain.value, manager.volume.value);
});

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);
if (failCount > 0) process.exit(1);
