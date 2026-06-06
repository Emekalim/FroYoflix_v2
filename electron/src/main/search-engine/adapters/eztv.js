import { fetchJson, fetchHtml, parseHtml, parseHumanSize, parseLooseDate, parseInteger, magnetHash, ensureTorrentIdentifier } from '../utils.js'

const API_URL = 'https://eztv.proxyninja.net/api/get-torrents'
const BASE_URL = 'https://eztvx.to'

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

function getEpisodePattern(query) {
  const season = Number.isFinite(Number(query?.season)) ? String(Number(query.season)).padStart(2, '0') : ''
  const episode = Number.isFinite(Number(query?.episode)) ? String(Number(query.episode)).padStart(2, '0') : ''
  if (!season || !episode) return null
  return `s${season}e${episode}`
}

function scoreTorrent(query, torrent, mode) {
  const title = normalizeTitle(torrent?.title || torrent?.filename || torrent?.episode_title)
  if (!title) return 0

  let score = 0
  for (const wanted of getNormalizedTitles(query)) {
    const exactPattern = new RegExp(`(^| )${escapeRegex(wanted)}( |$)`, 'i')
    if (exactPattern.test(title)) score = Math.max(score, 200 + wanted.length)
    else {
      const tokens = wanted.split(' ').filter(token => token.length >= 2)
      if (tokens.length && tokens.every(token => new RegExp(`(^| )${escapeRegex(token)}( |$)`, 'i').test(title))) {
        score = Math.max(score, 100 + tokens.length)
      }
    }
  }

  if (!score) return 0

  const episodePattern = getEpisodePattern(query)
  if (mode === 'single' && episodePattern) {
    if (!new RegExp(`(^| )${escapeRegex(episodePattern)}( |$)`, 'i').test(title)) return 0
    score += 50
  }

  if (mode === 'batch') {
    const season = Number.isFinite(Number(query?.season)) ? String(Number(query.season)).padStart(2, '0') : ''
    if (season && !new RegExp(`(^| )s${escapeRegex(season)}( |$)`, 'i').test(title)) return 0
    score += 25
  }

  if (query?.resolution && new RegExp(`(^| )${escapeRegex(`${query.resolution}p`)}( |$)`, 'i').test(title)) score += 20
  score += Number(torrent?.seeds || 0)
  return score
}

function mapApiTorrent(torrent) {
  const link = torrent?.magnet_url || torrent?.magnet || torrent?.torrent_url || ''
  const hash = String(torrent?.hash || magnetHash(link)).toLowerCase()
  const uri = ensureTorrentIdentifier(link, hash, torrent?.title || torrent?.filename || torrent?.episode_title || '')
  return {
    title: torrent?.title || torrent?.filename || torrent?.episode_title || '',
    uri,
    link: uri,
    hash,
    seeders: Number(torrent?.seeds || 0),
    leechers: Number(torrent?.peers || 0),
    downloads: 0,
    size: Number(torrent?.size_bytes || parseHumanSize(torrent?.size)),
    date: parseLooseDate(torrent?.date_released_unix || torrent?.date_released || torrent?.release_date),
    source: { id: 'eztv', name: 'EZTV' }
  }
}

function parseHtmlRows(html) {
  const root = parseHtml(html)
  return root.querySelectorAll("table.forum_header_border tr[name='hover'].forum_header_border")
    .map(row => {
      const titleLink = row.querySelector('td:nth-child(2) a')
      const magnet = row.querySelector('td:nth-child(3) a.magnet, td:nth-child(3) a')?.getAttribute('href') || ''
      const title = titleLink?.getAttribute('title')?.replace('[eztv]', '').replace(/\(.*\)$/, '').trim() || ''
      return {
        title,
        uri: magnet,
        link: magnet,
        hash: magnetHash(magnet),
        size: parseHumanSize(row.querySelector('td:nth-child(4)')?.text),
        date: parseLooseDate(`${row.querySelector('td:nth-child(5)')?.text || ''} ago`),
        seeders: parseInteger(row.querySelector('td:nth-child(6)')?.text),
        leechers: 0,
        downloads: 0,
        source: { id: 'eztv', name: 'EZTV' }
      }
    })
    .filter(result => result.hash)
}

async function searchViaApi(query) {
  const imdbId = String(query?.ids?.imdb || '').replace(/^tt/i, '')
  if (!imdbId) return []
  const params = new URLSearchParams({ imdb_id: imdbId, limit: '100', page: '1' })
  const payload = await fetchJson(`${API_URL}?${params.toString()}`)
  return Array.isArray(payload?.torrents) ? payload.torrents.map(mapApiTorrent) : []
}

async function searchViaHtml(query, mode) {
  const term = query?.variants?.[mode]?.[0] || query?.titles?.[0]
  if (!term) return []
  const path = String(term).replace(/\bS\d{2,3}\b/g, '').trim().replace(/-/g, '').replace(/\s+/g, '-').replace(/&/g, '')
  const html = await fetchHtml(`${BASE_URL}/search/${encodeURIComponent(path)}`)
  return parseHtmlRows(html)
}

async function search(query, mode) {
  const apiResults = await searchViaApi(query).catch(() => [])
  const htmlResults = apiResults.length ? [] : await searchViaHtml(query, mode).catch(() => [])
  return [...apiResults, ...htmlResults]
    .map(result => ({ result, score: scoreTorrent(query, result, mode) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.result)
}

export const eztvAdapter = {
  id: 'eztv',
  name: 'EZTV',
  mediaTypes: ['tv'],
  async validate() {
    try {
      const payload = await fetchJson(`${API_URL}?limit=1&page=1`)
      return Array.isArray(payload?.torrents)
    } catch {
      return false
    }
  },
  async searchSingle(query) {
    return await search(query, 'single')
  },
  async searchBatch(query) {
    return await search(query, 'batch')
  },
  async searchMovie() {
    return []
  }
}
