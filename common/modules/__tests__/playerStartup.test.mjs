import assert from "assert";

import {
  beginPlayerStartup,
  clearPlayerStartup,
  completePlayerStartup,
  createStartupSnapshot,
  failPlayerStartup,
  playerStartup,
  updatePlayerStartup,
} from "../playerStartup.js";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║          PLAYER STARTUP STORE UNIT TESTS                 ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    clearPlayerStartup();
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failCount++;
  }
}

test("beginPlayerStartup creates an active startup session", () => {
  const id = beginPlayerStartup({ label: "Opening player", progress: 12 });
  assert.strictEqual(playerStartup.value.active, true);
  assert.strictEqual(playerStartup.value.id, id);
  assert.strictEqual(playerStartup.value.label, "Opening player");
  assert.strictEqual(playerStartup.value.progress, 12);
});

test("updatePlayerStartup only updates the active session", () => {
  const id = beginPlayerStartup({ label: "Opening player", progress: 10 });
  const staleId = id - 1;
  assert.strictEqual(
    updatePlayerStartup({ id: staleId, label: "Wrong", progress: 90 }),
    false,
  );
  assert.strictEqual(playerStartup.value.label, "Opening player");
  assert.strictEqual(playerStartup.value.progress, 10);

  assert.strictEqual(
    updatePlayerStartup({
      id,
      label: "Buffering stream",
      detail: "Waiting for the first segment",
      progress: 78,
    }),
    true,
  );
  assert.strictEqual(playerStartup.value.label, "Buffering stream");
  assert.strictEqual(playerStartup.value.detail, "Waiting for the first segment");
  assert.strictEqual(playerStartup.value.progress, 78);
});

test("completePlayerStartup marks the current session ready", () => {
  const id = beginPlayerStartup({ progress: 65 });
  assert.strictEqual(
    completePlayerStartup({ id, detail: "Playback ready" }),
    true,
  );
  assert.strictEqual(playerStartup.value.active, false);
  assert.strictEqual(playerStartup.value.progress, 100);
  assert.strictEqual(playerStartup.value.label, "Ready");
  assert.strictEqual(playerStartup.value.detail, "Playback ready");
});

test("failPlayerStartup preserves the session and error detail", () => {
  const id = beginPlayerStartup({ progress: 40 });
  assert.strictEqual(
    failPlayerStartup({ id, detail: "Failed to load video" }),
    true,
  );
  assert.strictEqual(playerStartup.value.active, false);
  assert.strictEqual(playerStartup.value.detail, "Failed to load video");
  assert.strictEqual(playerStartup.value.error, "Failed to load video");
});

test("createStartupSnapshot clamps progress into a safe range", () => {
  assert.strictEqual(createStartupSnapshot({ progress: 140 }).progress, 100);
  assert.strictEqual(createStartupSnapshot({ progress: -4 }).progress, 0);
});

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
}
