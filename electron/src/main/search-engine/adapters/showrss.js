import { fetchHtml, parseLooseDate, buildMagnetLink, decodeXmlEntities, magnetHash } from '../utils.js'

const BASE_URL = 'https://showrss.info'
const BROWSE_URL = `${BASE_URL}/browse`

let cachedShows = null

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readXmlTag(block, tag) {
  const pattern = new RegExp(`<${escapeRegex(tag)}(?:\\b[^>]*)?>([\\s\\S]*?)</${escapeRegex(tag)}>`, 'i')
  const match = block.match(pattern)
  return decodeXmlEntities(match?.[1]?.trim?.() || '')
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim()
}

function readXmlAttribute(block, tag, attribute) {
  const pattern = new RegExp(`<${escapeRegex(tag)}\\b[^>]*${escapeRegex(attribute)}="([^"]+)"[^>]*/?>`, 'i')
  return decodeXmlEntities(block.match(pattern)?.[1] || '')
}

function getNormalizedTitles(query) {
  return [...new Set((query?.titles || [])
    .map(normalizeTitle)
    .filter(title => title.length >= 2)
    .sort((a, b) => b.length - a.length))]
}

function parseShowOptions(html) {
  return Array.from(String(html || '').matchAll(/<option value="(\d+)">([\s\S]*?)<\/option>/gi))
    .map(([, id, name]) => ({
      id,
      name: decodeXmlEntities(name).trim()
    }))
    .filter(option => option.id !== 'all' && option.name)
}

function scoreShowOption(query, option) {
  const optionTitle = normalizeTitle(option?.name)
  if (!optionTitle) return 0

  let score = 0
  for (const title of getNormalizedTitles(query)) {
    if (title === optionTitle) score = Math.max(score, 300 + title.length)
    else if (optionTitle.includes(title) || title.includes(optionTitle)) score = Math.max(score, 200 + Math.min(title.length, optionTitle.length))
    else {
      const tokens = title.split(' ').filter(token => token.length >= 2)
      if (tokens.length && tokens.every(token => optionTitle.includes(token))) {
        score = Math.max(score, 100 + tokens.length)
      }
    }
  }

  return score
}

async function getShowCatalog() {
  if (cachedShows) return cachedShows
  const html = await fetchHtml(BROWSE_URL)
  cachedShows = parseShowOptions(html)
  return cachedShows
}

async function findShow(query) {
  const catalog = await getShowCatalog()
  return catalog
    .map(option => ({ option, score: scoreShowOption(query, option) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.option.name.length - b.option.name.length)[0]
    ?.option || null
}

function parseFeed(xml) {
  return Array.from(String(xml || '').matchAll(/<item\b[\s\S]*?<\/item>/gi)).map(match => {
    const block = match[0]
    const title = readXmlTag(block, 'tv:raw_title') || readXmlTag(block, 'title')
    const magnet = readXmlAttribute(block, 'enclosure', 'url') || readXmlTag(block, 'link')
    const hash = readXmlTag(block, 'tv:info_hash').toLowerCase() || magnetHash(magnet)
    const date = parseLooseDate(readXmlTag(block, 'pubDate'))

    if (!title || !hash || !magnet) return null

    const uri = magnet.startsWith('magnet:?') ? magnet : buildMagnetLink(hash, title)
    return {
      title,
      uri,
      link: uri,
      hash,
      seeders: 1,
      leechers: 1,
      downloads: 0,
      size: 0,
      date,
      source: { id: 'showrss', name: 'showRSS' }
    }
  }).filter(Boolean)
}

function scoreEpisode(query, result, mode) {
  const title = normalizeTitle(result?.title)
  if (!title) return 0

  let score = 0
  for (const candidate of getNormalizedTitles(query)) {
    if (candidate && (title.includes(candidate) || candidate.includes(title))) {
      score = Math.max(score, 100 + Math.min(candidate.length, title.length))
    }
  }

  if (!score) score = 50

  const season = Number.isFinite(Number(query?.season)) ? String(Number(query.season)).padStart(2, '0') : ''
  const episode = Number.isFinite(Number(query?.episode)) ? String(Number(query.episode)).padStart(2, '0') : ''

  if (season && episode) {
    const episodePattern = new RegExp(`(^| )(s${season}e${episode}|${Number(season)}x${episode})( |$)`, 'i')
    if (!episodePattern.test(title)) return 0
    score += 200
  } else if (mode === 'batch' && season && new RegExp(`(^| )s${season}( |$)`, 'i').test(title)) {
    score += 50
  }

  if (query?.resolution && new RegExp(`(^| )${escapeRegex(`${query.resolution}p`)}( |$)`, 'i').test(title)) score += 30
  if (/\b(1080p|720p|2160p)\b/i.test(title)) score += 10

  return score
}

async function searchShow(query, mode) {
  const show = await findShow(query)
  if (!show) return []

  const xml = await fetchHtml(`${BASE_URL}/show/${show.id}.rss`)
  const results = parseFeed(xml)
    .map(result => ({ result, score: scoreEpisode(query, result, mode) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.result)

  return [...new Map(results.map(result => [result.hash, result])).values()]
}

export const showRssAdapter = {
  id: 'showrss',
  name: 'showRSS',
  mediaTypes: ['tv'],
  async validate() {
    try {
      await fetchHtml(BROWSE_URL)
      return true
    } catch {
      return false
    }
  },
  async searchSingle(query) {
    return await searchShow(query, 'single')
  },
  async searchBatch(query) {
    return await searchShow(query, 'single')
  },
  async searchMovie() {
    return []
  }
}
