import { fetchJson, parseLooseDate, parseHumanSize, ensureTorrentIdentifier } from '../utils.js'

const API_URL = 'https://movies-api.accel.li/api/v2/list_movies.json'

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

function scoreMovie(query, movie) {
  const imdbId = String(query?.ids?.imdb || '').trim()
  if (imdbId && movie?.imdb_code && imdbId.toLowerCase() === String(movie.imdb_code).toLowerCase()) return 500

  const candidates = [
    normalizeTitle(movie?.title),
    normalizeTitle(movie?.title_english),
    normalizeTitle(movie?.title_long)
  ].filter(Boolean)

  let score = 0
  for (const wanted of getNormalizedTitles(query)) {
    for (const candidate of candidates) {
      const exactPattern = new RegExp(`(^| )${escapeRegex(wanted)}( |$)`, 'i')
      if (exactPattern.test(candidate)) score = Math.max(score, 200 + wanted.length)
      else {
        const tokens = wanted.split(' ').filter(token => token.length >= 2)
        if (tokens.length && tokens.every(token => new RegExp(`(^| )${escapeRegex(token)}( |$)`, 'i').test(candidate))) {
          score = Math.max(score, 100 + tokens.length)
        }
      }
    }
  }

  if (!score) return 0

  const year = Number.isFinite(Number(query?.year)) ? Number(query.year) : null
  if (year != null) {
    if (Number(movie?.year) !== year) return 0
    score += 50
  }

  return score
}

function createTorrentTitle(movie, torrent) {
  const type = String(torrent?.type || '').toLowerCase() === 'web' ? 'WEBRip' : 'BluRay'
  const codec = torrent?.video_codec || 'x264'
  const audio = torrent?.audio_channels ? ` ${torrent.audio_channels}` : ''
  return `${movie.title} (${movie.year}) ${torrent.quality} ${type}${audio} ${codec} - YTS`
}

function sortTorrents(query, torrents = []) {
  return torrents
    .map(torrent => {
      let score = torrent?.seeds || 0
      if (query?.resolution && String(torrent?.quality || '').startsWith(`${query.resolution}`)) score += 500
      if (String(torrent?.type || '').toLowerCase() === 'bluray') score += 50
      return { torrent, score }
    })
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.torrent)
}

function getQueryTerms(query) {
  const terms = []
  if (query?.ids?.imdb) terms.push(String(query.ids.imdb))

  for (const title of query?.titles || []) {
    if (title) terms.push(title)
    if (title && query?.year) terms.push(`${title} ${query.year}`)
  }

  return [...new Set(terms.map(term => String(term || '').trim()).filter(Boolean))]
}

export const ytsAdapter = {
  id: 'yts',
  name: 'YTS',
  mediaTypes: ['movie', 'animeMovie'],
  async validate() {
    try {
      const data = await fetchJson(`${API_URL}?limit=1`)
      return data?.status === 'ok'
    } catch {
      return false
    }
  },
  async searchSingle(query) {
    return await this.searchMovie(query)
  },
  async searchBatch(query) {
    return await this.searchMovie(query)
  },
  async searchMovie(query) {
    const filtered = []
    for (const queryTerm of getQueryTerms(query)) {
      const params = new URLSearchParams({
        limit: '50',
        sort_by: 'date_added',
        order_by: 'desc',
        query_term: queryTerm
      })
      const payload = await fetchJson(`${API_URL}?${params.toString()}`)
      const movies = Array.isArray(payload?.data?.movies) ? payload.data.movies : []
      filtered.push(...movies
        .map(movie => ({ movie, score: scoreMovie(query, movie) }))
        .filter(entry => entry.score > 0))
      if (filtered.length) break
    }

    const uniqueMovies = [...new Map(filtered
      .sort((a, b) => b.score - a.score)
      .map(entry => [entry.movie.imdb_code || entry.movie.id, entry])).values()]

    const results = []
    for (const { movie } of uniqueMovies) {
      for (const torrent of sortTorrents(query, movie?.torrents || [])) {
        const title = createTorrentTitle(movie, torrent)
        const hash = String(torrent?.hash || '').toLowerCase()
        const uri = ensureTorrentIdentifier(torrent?.url, hash, title)
        results.push({
          title,
          uri,
          link: uri,
          hash,
          seeders: Number(torrent?.seeds || 0),
          leechers: Number(torrent?.peers || 0),
          downloads: 0,
          size: Number(torrent?.size_bytes || parseHumanSize(torrent?.size)),
          date: parseLooseDate(torrent?.date_uploaded_unix || torrent?.date_uploaded),
          source: { id: 'yts', name: 'YTS' }
        })
      }
    }

    return results.filter(result => result.hash)
  }
}
