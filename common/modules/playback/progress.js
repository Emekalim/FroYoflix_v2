function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// builds the identity used to read/write anime progress for the current file;
// returns { name, mediaId, episode } when the resolved media is trustworthy,
// otherwise the name-only fallback
export function buildProgressQuery(current, media) {
  const name = current?.media?.parseObject?.anime_title
    ? current?.media?.parseObject?.anime_title +
      ((media?.season || current?.media?.parseObject?.anime_season
        ? ` S${media?.season || current?.media?.parseObject?.anime_season}`
        : "") +
        (media?.episode || current?.media?.parseObject?.episode_number
          ? ` E${media?.episode || current?.media?.parseObject?.episode_number}`
          : ""))
    : current?.name;
  if (
    !current?.media?.media?.id ||
    !isValidNumber(current?.media?.episode) ||
    current?.media?.failed ||
    !media?.media?.id ||
    !isValidNumber(media?.episode)
  ) {
    return { name };
  }
  return {
    name,
    mediaId: current.media.media.id,
    episode: current.media.episode,
  };
}

// key used for per-media history entries (lastBoosted, lastSubtitle)
export function buildMediaCacheKey(media) {
  return `${media?.media?.id || media?.title || media?.parseObject?.title || media?.parseObject?.file_name}`;
}

export function clampTimeToDuration(time, duration) {
  const numericTime = Number(time);
  if (!Number.isFinite(numericTime) || numericTime < 0) return 0;
  const max = Number(duration);
  if (Number.isFinite(max) && max > 0) {
    return Math.max(0, Math.min(max, numericTime));
  }
  return numericTime;
}

// whether playback has crossed the autocomplete threshold for a media entry
// that can actually be completed (known episode count, or the episode has aired)
export function shouldAutoComplete({
  currentTime,
  duration,
  readyState,
  thresholdPercent,
  media,
}) {
  const threshold = thresholdPercent / 100;
  return Boolean(
    duration &&
      currentTime &&
      readyState &&
      currentTime >= duration * threshold &&
      (media?.media?.episodes ||
        media?.media?.nextAiringEpisode?.episode >=
          (media.episodeRange?.last || media.episode)),
  );
}
