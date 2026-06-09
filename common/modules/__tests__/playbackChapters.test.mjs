import assert from "assert";

import {
  findChapter,
  isChapterSkippable,
  mergeMicroSkippable,
  normaliseChapters,
  toSeekbarChapters,
} from "../playback/chapters.js";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           PLAYBACK CHAPTERS UNIT TESTS                    ║");
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

// chapter times are in milliseconds throughout
const sec = (s) => s * 1_000;

test("isChapterSkippable matches known skip labels", () => {
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(90), text: "OP" }),
    "Opening",
  );
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(90), text: "Opening" }),
    "Opening",
  );
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(90), text: "NCOP 1" }),
    "Opening",
  );
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(90), text: "ED" }),
    "Ending",
  );
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(90), text: "Recap" }),
    "Recap",
  );
});

test("isChapterSkippable rejects long and unmatched chapters", () => {
  // longer than MAX_TOTAL_SKIP_TIME (180s) is treated as invalid data
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(200), text: "OP" }),
    null,
  );
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(90), text: "Part A" }),
    null,
  );
  assert.strictEqual(
    isChapterSkippable({ start: 0, end: sec(90), text: undefined }),
    null,
  );
});

test("findChapter returns the chapter containing the time", () => {
  const chapters = [
    { start: 0, end: sec(90), text: "OP" },
    { start: sec(90), end: sec(1200), text: "Part A" },
  ];
  assert.strictEqual(findChapter(chapters, 45), chapters[0]);
  // start boundary is inclusive, end boundary exclusive
  assert.strictEqual(findChapter(chapters, 90), chapters[1]);
  assert.strictEqual(findChapter(chapters, 1500), undefined);
  assert.strictEqual(findChapter([], 45), null);
});

test("mergeMicroSkippable merges a micro chapter into its skippable neighbor", () => {
  const chapters = [
    { start: 0, end: sec(5), text: "Intro" },
    { start: sec(5), end: sec(65), text: "OP" },
    { start: sec(65), end: sec(1200), text: "Part A" },
  ];
  mergeMicroSkippable(chapters);
  assert.strictEqual(chapters.length, 2);
  assert.strictEqual(chapters[0].start, 0);
  assert.strictEqual(chapters[0].end, sec(65));
  assert.strictEqual(chapters[0].text, "OP");
  assert.strictEqual(chapters[1].text, "Part A");
});

test("mergeMicroSkippable leaves non-skippable neighbors untouched", () => {
  const chapters = [
    { start: 0, end: sec(5), text: "Intro" },
    { start: sec(5), end: sec(1200), text: "Part A" },
  ];
  mergeMicroSkippable(chapters);
  assert.strictEqual(chapters.length, 2);
  assert.strictEqual(chapters[0].end, sec(5));
});

test("normaliseChapters fixes negative times, zero-length chapters, and bounds", () => {
  const duration = 1440;
  const chapters = normaliseChapters(
    [
      { start: -0, end: -sec(90), text: "OP" },
      { start: sec(90), end: sec(90), text: "Part A" },
      { start: sec(1300), end: sec(1310), text: "ED" },
    ],
    duration,
  );
  assert.strictEqual(chapters[0].start, 0);
  assert.strictEqual(chapters[0].end, sec(90));
  // zero-length bookmark extended to the next chapter's start
  assert.strictEqual(chapters[1].end, sec(1300));
  // last chapter clamped to full duration
  assert.strictEqual(chapters[chapters.length - 1].end, sec(duration));
});

test("normaliseChapters sorts when the zero-start chapter is out of order", () => {
  const duration = 1440;
  const chapters = normaliseChapters(
    [
      { start: sec(90), end: sec(1200), text: "Part A" },
      { start: 0, end: sec(90), text: "OP" },
      { start: sec(1250), end: sec(1440), text: "ED" },
    ],
    duration,
  );
  assert.strictEqual(chapters[0].text, "OP");
  assert.strictEqual(chapters[1].text, "Part A");
  assert.strictEqual(chapters[2].text, "ED");
});

test("toSeekbarChapters renames timestamp-like labels and drops out-of-range chapters", () => {
  const duration = 1440;
  const result = toSeekbarChapters(
    [
      { start: 0, end: sec(720), text: "00:01:30" },
      { start: sec(720), end: sec(1440), text: "Part B" },
      { start: sec(2000), end: sec(2100), text: "Ghost" },
    ],
    duration,
  );
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].text, "Chapter 1");
  assert.strictEqual(result[1].text, "Part B");
  // sizes are percentages of the seekbar (end/10/duration - start/10/duration)
  assert.strictEqual(result[0].size, 50);
  assert.strictEqual(result[1].size, 50);
});

test("toSeekbarChapters clamps chapter ends past the duration", () => {
  const duration = 1440;
  const result = toSeekbarChapters(
    [{ start: 0, end: sec(2000), text: "Part A" }],
    duration,
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].size, 100);
});

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);
if (failCount > 0) process.exit(1);
