export const PLAYBACK_SOURCE_KIND = {
  TORRENT: "torrent",
  LIBRARY: "library",
};

const BUILTIN_TARGET = "builtin";

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeSubtitles(subtitles = []) {
  return (Array.isArray(subtitles) ? subtitles : [])
    .filter(Boolean)
    .map((subtitle) => ({
      ...subtitle,
      subtitle: true,
    }));
}

function createSourceId(prefix, file, context = {}) {
  const path = file?.path || file?.url || file?.name || "unknown";
  const mediaId = context?.media?.id || context?.parseObject?.anime_title || "media";
  const episode = context?.episode ?? context?.parseObject?.episode_number ?? "na";
  const season = context?.season ?? context?.parseObject?.anime_season ?? "na";
  return `${prefix}:${mediaId}:${season}:${episode}:${path}`;
}

function baseSource(kind, file, context = {}) {
  return {
    id: context.id || createSourceId(kind, file, context),
    kind,
    target: context.target || BUILTIN_TARGET,
    media: context.media || null,
    episode: toNumberOrNull(context.episode ?? context.parseObject?.episode_number),
    season: toNumberOrNull(context.season ?? context.parseObject?.anime_season),
    parseObject: context.parseObject || null,
    file,
    subtitles: normalizeSubtitles(context.subtitles || file?.subtitleFiles),
    resume: context.resume || null,
    failed: !!context.failed,
    episodeRange: context.episodeRange || null,
    title: context.title || null,
    episodeTitle: context.episodeTitle || null,
    thumbnail: context.thumbnail || null,
    zeroEpisode: !!context.zeroEpisode,
  };
}

export function createTorrentPlaybackSource(file, context = {}) {
  const fileContext = file?.media || {};
  return baseSource(PLAYBACK_SOURCE_KIND.TORRENT, file, {
    ...context,
    media: context.media || fileContext.media || null,
    episode: context.episode ?? fileContext.episode ?? null,
    season: context.season ?? fileContext.season ?? null,
    parseObject: context.parseObject || fileContext.parseObject || null,
    subtitles: context.subtitles || file?.subtitleFiles || [],
    resume: context.resume || null,
    failed: context.failed ?? fileContext.failed ?? false,
    episodeRange: context.episodeRange || fileContext.episodeRange || null,
  });
}

export function createLibraryPlaybackSource(fileObject, nowPlayingData = {}) {
  const fileContext = fileObject?.media || {};
  return baseSource(PLAYBACK_SOURCE_KIND.LIBRARY, fileObject, {
    ...nowPlayingData,
    media: nowPlayingData.media || fileContext.media || null,
    episode: nowPlayingData.episode ?? fileContext.episode ?? null,
    season: nowPlayingData.season ?? fileContext.season ?? null,
    parseObject: nowPlayingData.parseObject || fileContext.parseObject || null,
    subtitles: nowPlayingData.subtitles || fileObject?.subtitleFiles || [],
    resume: nowPlayingData.resume || null,
    failed: nowPlayingData.failed ?? fileContext.failed ?? false,
    episodeRange: nowPlayingData.episodeRange || fileContext.episodeRange || null,
    title: nowPlayingData.title || null,
    episodeTitle: nowPlayingData.episodeTitle || null,
    thumbnail: nowPlayingData.thumbnail || null,
    zeroEpisode: nowPlayingData.zeroEpisode || false,
  });
}

export function getNowPlayingSnapshot(source) {
  if (!source) return {};
  return {
    media: source.media || null,
    episode: source.episode,
    season: source.season,
    parseObject: source.parseObject || null,
    failed: !!source.failed,
    zeroEpisode: !!source.zeroEpisode,
    episodeRange: source.episodeRange || null,
    title: source.title || null,
    episodeTitle: source.episodeTitle || null,
    thumbnail: source.thumbnail || null,
    resume: source.resume || null,
  };
}
