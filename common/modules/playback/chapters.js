export const MAX_TOTAL_SKIP_TIME = 180;

export const skippableChaptersRx = [
  ["Intro", /^intro$/im],
  ["Opening", /^op$|opening$|title$|^ncop/im],
  ["Outro", /^outro$/im],
  ["Ending", /^ed$|ending$|^nced/im],
  ["Credits", /credits/i],
  ["Preview", /^preview$|previews$|pv$|next$/im],
  ["Recap", /recap/im],
];

export function isChapterSkippable(chapter) {
  if ((chapter.end - chapter.start) / 1_000 > MAX_TOTAL_SKIP_TIME)
    return null; // Anything longer than 180s (3m) is likely invalid, skipping this chapter would be a mistake!
  for (const [name, regex] of skippableChaptersRx) {
    if (
      /** @type {RegExp} */ chapter.text &&
      regex.test(chapter.text.trim())
    ) {
      return name;
    }
  }
  return null;
}

export function findChapter(chapters, time) {
  if (!chapters.length) return null;
  for (const chapter of chapters) {
    if (time < chapter.end / 1_000 && time >= chapter.start / 1_000)
      return chapter;
  }
}

export function mergeMicroSkippable(_chapters) {
  const isSkippable = (chapter) =>
    chapter.text &&
    skippableChaptersRx.some(([_, rx]) => rx.test(chapter.text.trim()));
  const isShort = (chapter) => (chapter.end - chapter.start) / 1_000 < 10; // anything shorter than 10 seconds is just fluff... probably a mistake.
  const underMaxSkip = (chapter) =>
    (chapter.end - chapter.start) / 1_000 <= MAX_TOTAL_SKIP_TIME;
  for (let i = 0; i < _chapters.length - 1; i++) {
    const cur = _chapters[i];
    const next = _chapters[i + 1];
    if (
      isSkippable(cur) &&
      isSkippable(next) &&
      underMaxSkip(cur) &&
      underMaxSkip(next)
    ) {
      if (isShort(cur) && !isShort(next)) {
        next.start = cur.start;
        _chapters.splice(i, 1);
        i--;
      } else if (!isShort(cur) && isShort(next)) {
        cur.end = next.end;
        _chapters.splice(i + 1, 1);
        i--;
      } else if (isShort(cur) && isShort(next)) {
        cur.end = next.end;
        _chapters.splice(i + 1, 1);
        i--;
      }
    }
  }
  return _chapters;
}

// fixes broken chapter data in place (negative times, ordering, overlaps,
// zero-length bookmarks) and merges adjacent micro-skippables; returns a new
// array that shares the surviving chapter objects
export function normaliseChapters(_chapters, safeduration) {
  const first = _chapters[0];
  for (const chapter of _chapters) {
    // Fix negative values
    if (typeof chapter.start === "number" && chapter.start < 0)
      chapter.start = -chapter.start; // Fixes negative start values, likely was a mistake and is actually correct if positive.
    if (typeof chapter.end === "number" && chapter.end < 0)
      chapter.end = -chapter.end; // Fixes negative end values, likely was a mistake and is actually correct if positive.
  }
  if (first.start !== 0 && _chapters.some((ch) => ch?.start === 0)) {
    // Fix incorrect order of chapters (when start === 0 is somewhere else)
    _chapters.sort((a, b) => (a?.start ?? 0) - (b?.start ?? 0));
  }
  const boundaryMatches = _chapters
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch }) => ch.start === first.end);
  if (boundaryMatches.length > 0) {
    // Fix overlapping chapters where valid chapter end time matches a valid chapter start time.
    boundaryMatches.sort(
      (a, b) => a.ch.end - a.ch.start - (b.ch.end - b.ch.start),
    );
    const boundaryIndex = boundaryMatches[0].i;
    if (boundaryIndex > 1) _chapters.splice(1, boundaryIndex - 1);
  }
  _chapters = _chapters.map((chapter, index, arr) => {
    if (chapter.start === chapter.end) {
      // Fix chapters with incorrect start/end times which causes an invisible seekbar, this happens when the start and end time are identical
      const nextChapter = arr[index + 1]; // We now assume each chapter is a bookmark and use the next chapters start time and the current chapters end time.
      return {
        ...chapter,
        end: nextChapter ? nextChapter.start : safeduration * 1_000,
      }; // Use next chapter's start or ensure the entire safe duration of seekbar is visible.
    }
    return chapter;
  });
  _chapters[_chapters.length - 1].end = safeduration * 1_000; // fix the final chapter so its duration actually reaches the end of the video...
  _chapters[0].start = 0;

  mergeMicroSkippable(_chapters);
  return _chapters;
}

// remaps normalised chapters to what perfect-seekbar uses
export function toSeekbarChapters(_chapters, safeduration) {
  const sanitised = [];
  let chapterCounter = 1;
  for (let { start, end, text } of _chapters) {
    if (start > safeduration * 1_000) continue;
    if (end > safeduration * 1_000) end = safeduration * 1_000;
    if (text && /^[\d:.\s]+$/.test(text)) {
      // Replace numerical/timestamp-like chapter names
      text = `Chapter ${chapterCounter}`;
      chapterCounter++;
    }
    sanitised.push({
      size: end / 10 / safeduration - start / 10 / safeduration,
      text,
    });
  }
  return sanitised;
}
