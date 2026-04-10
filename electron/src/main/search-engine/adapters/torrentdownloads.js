import { fetchHtml, parseLooseDate, buildMagnetLink, decodeXmlEntities } from '../utils.js'

const BASE_URL = 'https://www.torrentdownloads.pro'
const RSS_URL = `${BASE_URL}/rss.xml`

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNormalizedTitles(query) {
  return [...new Set((query?.titles || [])
    .map(normalizeTitle)
    .filter(title => title.length >= 2)
    .sort((a, b) => b.length - a.length))]
}

function readXmlTag(block, tag) {
  const pattern = new RegExp(`<${escapeRegex(tag)}(?:\\b[^>]*)?>([\\s\\S]*?)</${escapeRegex(tag)}>`, 'i')
  const match = block.match(pattern)
  return decodeXmlEntities(match?.[1]?.trim?.() || '')
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim()
}

function parseRssItems(xml) {
  return Array.from(String(xml || '').matchAll(/<item\b[\s\S]*?<\/item>/gi)).map(match => {
    const block = match[0]
    const title = readXmlTag(block, 'title')
    const hash = readXmlTag(block, 'info_hash').toLowerCase()
    const size = Number(readXmlTag(block, 'size')) || 0
    const seeders = Number(readXmlTag(block, 'seeders')) || 0
    const leechers = Number(readXmlTag(block, 'leechers')) || 0
    const date = parseLooseDate(readXmlTag(block, 'pubDate'))

    if (!title || !hash) return null

    return {
      title,
      uri: buildMagnetLink(hash, title),
      link: buildMagnetLink(hash, title),
      hash,
      seeders,
      leechers,
      downloads: 0,
      size,
      date,
      source: { id: 'torrentdownloads', name: 'Torrent Downloads' }
    }
  }).filter(Boolean)
}

function scoreResult(query, result, mode) {
  const title = normalizeTitle(result?.title)
  if (!title) return 0

  let titleScore = 0
  for (const candidate of getNormalizedTitles(query)) {
    const exactPattern = new RegExp(`(^| )${escapeRegex(candidate)}( |$)`, 'i')
    if (exactPattern.test(title)) {
      titleScore = Math.max(titleScore, 200 + candidate.length)
      break
    }

    const tokens = candidate.split(' ').filter(token => token.length >= 2)
    if (tokens.length && tokens.every(token => new RegExp(`(^| )${escapeRegex(token)}( |$)`, 'i').test(title))) {
      titleScore = Math.max(titleScore, 100 + tokens.length)
    }
  }

  if (!titleScore) return 0

  let score = titleScore + (Number(result?.seeders) || 0)

  const year = Number.isFinite(Number(query?.year)) ? String(Number(query.year)) : ''
  if (query?.mediaType === 'movie' && year) {
    if (!new RegExp(`(^| )${escapeRegex(year)}( |$)`).test(title)) return 0
    score += 50
  }

  if (query?.resolution && new RegExp(`(^| )${escapeRegex(`${query.resolution}p`)}( |$)`, 'i').test(title)) score += 30

  const season = Number.isFinite(Number(query?.season)) ? String(Number(query.season)).padStart(2, '0') : ''
  const episode = Number.isFinite(Number(query?.episode)) ? String(Number(query.episode)).padStart(2, '0') : ''

  if (mode === 'single' && season && episode) {
    const episodePattern = new RegExp(`(^| )(s${season}e${episode}|${Number(season)}x${episode})( |$)`, 'i')
    if (!episodePattern.test(title)) return 0
    score += 100
  }

  if (mode === 'batch' && season) {
    if (new RegExp(`(^| )s${season}( |$)`, 'i').test(title)) score += 50
    if (/\b(batch|complete|season pack|collection)\b/i.test(title)) score += 30
  }

  return score
}

async function searchVariants(query, modes) {
  const collected = new Map()

  for (const mode of modes) {
    const variants = query?.variants?.[mode] || query?.titles || []
    for (const term of variants.slice(0, 4)) {
      const params = new URLSearchParams({ type: 'search', search: term })
      const xml = await fetchHtml(`${RSS_URL}?${params.toString()}`)
      const matches = parseRssItems(xml)
        .map(result => ({ result, score: scoreResult(query, result, mode) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(entry => ({
          ...entry.result,
          type: mode === 'batch' && /\b(batch|complete|season pack|collection)\b/i.test(entry.result.title) ? 'batch' : entry.result.type
        }))

      for (const result of matches) {
        if (!collected.has(result.hash)) collected.set(result.hash, result)
      }
    }
  }

  return [...collected.values()].sort((a, b) => b.seeders - a.seeders)
}

export const torrentDownloadsAdapter = {
  id: 'torrentdownloads',
  name: 'Torrent Downloads',
  mediaTypes: ['tv', 'movie', 'animeMovie'],
  async validate() {
    try {
      await fetchHtml(`${RSS_URL}?type=search&search=test`)
      return true
    } catch {
      return false
    }
  },
  async searchSingle(query) {
    return await searchVariants(query, ['single'])
  },
  async searchBatch(query) {
    return await searchVariants(query, ['batch', 'single'])
  },
  async searchMovie(query) {
    return await searchVariants(query, ['movie'])
  }
}
