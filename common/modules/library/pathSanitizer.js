const ILLEGAL_CHARS_RX = /[<>:"/\\|?*\u0000-\u001F]/g
const SPACE_RX = /\s+/g

function getSeparator(...values) {
  return values.some(value => String(value || '').includes('\\')) ? '\\' : '/'
}

function trimSlashes(value) {
  return String(value || '').replace(/^[\\/]+|[\\/]+$/g, '')
}

function joinPath(...segments) {
  const separator = getSeparator(...segments)
  const [first, ...rest] = segments
  const normalizedFirst = String(first || '').replace(/[\\/]+$/g, '')
  const normalizedRest = rest.map(trimSlashes).filter(Boolean)
  return [normalizedFirst, ...normalizedRest].filter(Boolean).join(separator)
}

function relativePath(from, to) {
  const separator = getSeparator(from, to)
  const normalize = value => trimSlashes(String(value || '').replace(/\\/g, '/'))
  const fromParts = normalize(from).split('/').filter(Boolean)
  const toParts = normalize(to).split('/').filter(Boolean)
  let shared = 0
  while (shared < fromParts.length && shared < toParts.length && fromParts[shared] === toParts[shared]) shared++
  const up = new Array(Math.max(0, fromParts.length - shared)).fill('..')
  const down = toParts.slice(shared)
  return [...up, ...down].join(separator) || '.'
}

export function sanitizeSegment(value, fallback = 'Unknown') {
  const cleaned = String(value || fallback)
    .replace(ILLEGAL_CHARS_RX, ' ')
    .replace(SPACE_RX, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return cleaned || fallback
}

export function zeroPad(value, width = 2) {
  return String(Number(value) || 0).padStart(width, '0')
}

export function getCanonicalTitle(media) {
  return sanitizeSegment(
    media?.title?.userPreferred ||
    media?.title?.english ||
    media?.title?.romaji ||
    media?.title?.native ||
    media?.title?.default ||
    media?.title ||
    media?.name,
    'Unknown Title'
  )
}

export function getMediaBucket(mediaType) {
  if (mediaType === 'movie') return 'Movies'
  if (mediaType === 'tv') return 'Shows'
  return 'Anime'
}

export function getMovieFolderName(media) {
  const title = getCanonicalTitle(media)
  const year = media?.seasonYear || media?.startDate?.year || media?.year || media?.releaseYear
  return sanitizeSegment(year ? `${title} (${year})` : title)
}

export function getEpisodeToken(episode, episodeRange) {
  if (episodeRange?.first && episodeRange?.last) {
    return `E${zeroPad(episodeRange.first)}-E${zeroPad(episodeRange.last)}`
  }
  return `E${zeroPad(episode)}`
}

export function getSeasonFolder(season) {
  return `Season ${zeroPad(season || 1)}`
}

export function buildCanonicalPaths({ rootPath, media, mediaType, season, episode, episodeRange, extension, subtitleExtension, language }) {
  const bucket = getMediaBucket(mediaType)
  const canonicalTitle = getCanonicalTitle(media)
  const safeExtension = String(extension || '').replace(/^\./, '')
  const safeSubtitleExtension = String(subtitleExtension || '').replace(/^\./, '')

  if (mediaType === 'movie') {
    const folder = joinPath(rootPath, bucket, getMovieFolderName(media))
    const baseName = getMovieFolderName(media)
    return {
      canonicalTitle,
      folder,
      videoPath: safeExtension ? joinPath(folder, `${baseName}.${safeExtension}`) : joinPath(folder, baseName),
      subtitleFolder: joinPath(folder, 'Subtitles'),
      subtitlePath: safeSubtitleExtension
        ? joinPath(folder, 'Subtitles', `${baseName}${language ? `.${sanitizeSegment(language)}` : ''}.${safeSubtitleExtension}`)
        : joinPath(folder, 'Subtitles', baseName)
    }
  }

  const titleFolder = joinPath(rootPath, bucket, canonicalTitle)
  const seasonFolder = joinPath(titleFolder, getSeasonFolder(season))
  const episodeToken = getEpisodeToken(episode, episodeRange)
  const baseName = `${canonicalTitle} - S${zeroPad(season || 1)}${episodeToken}`
  return {
    canonicalTitle,
    folder: seasonFolder,
    videoPath: safeExtension ? joinPath(seasonFolder, `${baseName}.${safeExtension}`) : joinPath(seasonFolder, baseName),
    subtitleFolder: joinPath(seasonFolder, 'Subtitles'),
    subtitlePath: safeSubtitleExtension
      ? joinPath(seasonFolder, 'Subtitles', `${baseName}${language ? `.${sanitizeSegment(language)}` : ''}.${safeSubtitleExtension}`)
      : joinPath(seasonFolder, 'Subtitles', baseName)
  }
}

export function getRelativeManagedPath(rootPath, absolutePath) {
  const relative = relativePath(rootPath, absolutePath)
  return relative.startsWith('..') ? absolutePath : relative
}
