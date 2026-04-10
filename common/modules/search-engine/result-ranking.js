import { createSearchTitles, determineBuiltInMediaType } from './query-builder.js'

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function titleMatchScore(title, media) {
  const normalizedTitle = normalizeText(title)
  if (!normalizedTitle) return 0

  const candidates = createSearchTitles(media).slice(0, 6).map(normalizeText).filter(Boolean)
  let score = 0

  for (const [index, candidate] of candidates.entries()) {
    const titleBias = Math.max(0, 30 - (index * 5))
    const exactPattern = new RegExp(`(^| )${escapeRegex(candidate)}( |$)`, 'i')
    if (exactPattern.test(normalizedTitle)) {
      score = Math.max(score, 240 + candidate.length + titleBias)
      continue
    }

    const tokens = candidate.split(' ').filter(token => token.length >= 2)
    if (tokens.length && tokens.every(token => new RegExp(`(^| )${escapeRegex(token)}( |$)`, 'i').test(normalizedTitle))) {
      score = Math.max(score, 160 + (tokens.length * 10) + titleBias)
    }
  }

  return score
}

function getRequestedResolution(search, result) {
  return search?.resolution || result?.resolution || ''
}

function resolutionScore(result, search) {
  const resolution = String(getRequestedResolution(search, result) || '').trim()
  if (!resolution) return 0
  return new RegExp(`(^| )${escapeRegex(`${resolution}p`)}( |$)`, 'i').test(String(result?.title || '')) ? 60 : 0
}

function movieScore(result, search) {
  const year = Number.isFinite(Number(search?.media?.startDate?.year))
    ? String(Number(search.media.startDate.year))
    : ''

  let score = 0
  if (year && new RegExp(`(^| )${escapeRegex(year)}( |$)`).test(normalizeText(result?.title))) score += 90
  if (/\b(remux|bluray|webrip|web dl|webdl)\b/i.test(String(result?.title || ''))) score += 20
  return score
}

function tvScore(result, search) {
  const season = Number.isFinite(Number(search?.season ?? search?.media?.season))
    ? String(Number(search.season ?? search.media.season)).padStart(2, '0')
    : (search?.episode != null ? '01' : '')
  const episode = Number.isFinite(Number(search?.episode))
    ? String(Number(search.episode)).padStart(2, '0')
    : ''

  if (!episode) return 0

  const normalizedTitle = normalizeText(result?.title)
  const patterns = [
    new RegExp(`(^| )s${escapeRegex(season)}e${escapeRegex(episode)}( |$)`, 'i'),
    new RegExp(`(^| )${Number(season)}x${escapeRegex(episode)}( |$)`, 'i')
  ]

  let score = patterns.some(pattern => pattern.test(normalizedTitle)) ? 180 : 0
  if (/episode\s+\d+/i.test(String(result?.title || ''))) score += 20
  return score
}

function animeScore(result, search) {
  const episode = Number.isFinite(Number(search?.episode)) ? Number(search.episode) : null
  const normalizedTitle = normalizeText(result?.title)
  let score = 0

  if (episode != null) {
    const padded = String(episode).padStart(2, '0')
    const patterns = [
      new RegExp(`(^| )${escapeRegex(padded)}( |$)`, 'i'),
      new RegExp(`(^| )${escapeRegex(String(episode))}( |$)`, 'i'),
      new RegExp(`episode\\s+${escapeRegex(String(episode))}( |$)`, 'i')
    ]
    if (patterns.some(pattern => pattern.test(normalizedTitle))) score += 170
  }

  if (search?.batch) {
    if (/\b(batch|complete|全集)\b/i.test(String(result?.title || ''))) score += 120
  } else if (/\b(batch|complete|全集)\b/i.test(String(result?.title || ''))) {
    score -= 80
  }

  return score
}

function sourceConfidenceScore(result, search) {
  const mediaType = determineBuiltInMediaType(search?.media, search?.movie)
  const sourceId = String(result?.source?.id || '').toLowerCase()
  const scores = {
    anime: { nyaa: 30 },
    movie: { yts: 25, torrentdownloads: 12, '1337x': 8 },
    tv: { showrss: 25, torrentdownloads: 12, eztv: 16, '1337x': 8 }
  }

  return scores[mediaType]?.[sourceId] || 0
}

export function getResultRelevanceScore(result, search) {
  if (!result || !search?.media) return 0

  const mediaType = determineBuiltInMediaType(search.media, search.movie)
  let score = titleMatchScore(result?.title, search.media)
  score += resolutionScore(result, search)
  score += sourceConfidenceScore(result, search)

  if (mediaType === 'movie') score += movieScore(result, search)
  else if (mediaType === 'tv') score += tvScore(result, search)
  else score += animeScore(result, search)

  if (result?.accuracy === 'high') score += 30
  if (result?.type === 'best') score += 50
  if (result?.type === 'alt') score += 20
  if (result?.type === 'batch' && search?.batch) score += 50

  return score
}

export function compareTorrentResults(a, b, sort, search) {
  const mediaType = determineBuiltInMediaType(search?.media, search?.movie)
  const relevanceDelta = getResultRelevanceScore(b, search) - getResultRelevanceScore(a, search)
  const seederDelta = (b?.seeders || 0) - (a?.seeders || 0)
  const newerDelta = new Date(b?.date || 0) - new Date(a?.date || 0)

  switch (sort) {
    case 'smallest':
      return ((a?.size || 0) - (b?.size || 0)) || relevanceDelta || seederDelta
    case 'best':
      return relevanceDelta ||
        ((b?.type === 'best') - (a?.type === 'best')) ||
        ((b?.type === 'alt') - (a?.type === 'alt')) ||
        seederDelta
    case 'batch':
      return ((b?.type === 'batch') - (a?.type === 'batch')) ||
        relevanceDelta ||
        seederDelta
    case 'new':
      return newerDelta || relevanceDelta || seederDelta
    case 'old':
      return (new Date(a?.date || 0) - new Date(b?.date || 0)) || relevanceDelta || seederDelta
    case 'seeders':
    default:
      if (mediaType === 'anime') return relevanceDelta || seederDelta || newerDelta
      return seederDelta || relevanceDelta || newerDelta
  }
}

function getSourceKey(result) {
  return String(result?.source?.id || result?.source?.name || 'unknown')
}

export function diversifyTorrentResults(results, search, sort) {
  const sorted = Array.isArray(results) ? [...results] : []
  if (sorted.length < 3) return sorted
  if (determineBuiltInMediaType(search?.media, search?.movie) === 'anime') return sorted

  const sourceOrder = []
  const grouped = new Map()

  for (const result of sorted) {
    const sourceKey = getSourceKey(result)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, [])
      sourceOrder.push(sourceKey)
    }
    grouped.get(sourceKey).push(result)
  }

  if (sourceOrder.length < 2) return sorted
  if (!['seeders', 'best', 'batch', 'new', 'old'].includes(sort || 'seeders')) return sorted

  const diversityWindow = Math.min(sorted.length, Math.max(sourceOrder.length * 3, 8))
  const diversified = []

  while (diversified.length < diversityWindow) {
    let insertedThisRound = false
    for (const sourceKey of sourceOrder) {
      const queue = grouped.get(sourceKey)
      if (!queue?.length || diversified.length >= diversityWindow) continue
      diversified.push(queue.shift())
      insertedThisRound = true
    }
    if (!insertedThisRound) break
  }

  const consumed = new Set(diversified)
  const remaining = sorted.filter(result => !consumed.has(result))
  return [...diversified, ...remaining]
}
