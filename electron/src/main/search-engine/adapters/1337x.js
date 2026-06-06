import { fetchHtml, parseHtml, parseHumanSize, parseLooseDate, parseInteger, magnetHash } from '../utils.js'

const BASE_URL = 'https://1337xx.to'

function text(node) {
  return node?.text?.trim?.() || ''
}

function buildSearchUrl(term, category) {
  if (category) return `${BASE_URL}/category-search/${encodeURIComponent(term)}/${category}/1/`
  return `${BASE_URL}/search/${encodeURIComponent(term)}/1/`
}

function buildAbsoluteUrl(path) {
  return path?.startsWith('http') ? path : `${BASE_URL}${path}`
}

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

function getRowScore(row, query, mode) {
  const title = normalizeTitle(row?.title)
  if (!title) return 0

  const normalizedTitles = getNormalizedTitles(query)
  let titleScore = 0
  for (const candidate of normalizedTitles) {
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

  let score = titleScore
  const year = Number.isFinite(Number(query?.year)) ? String(Number(query.year)) : ''
  if (query?.mediaType === 'movie' && year) {
    if (!new RegExp(`(^| )${escapeRegex(year)}( |$)`).test(title)) return 0
    score += 50
  }

  if (query?.resolution && new RegExp(`(^| )${escapeRegex(`${query.resolution}p`)}( |$)`, 'i').test(title)) score += 20

  if (mode === 'single') {
    const season = Number.isFinite(Number(query?.season)) ? String(Number(query.season)).padStart(2, '0') : ''
    const episode = Number.isFinite(Number(query?.episode)) ? String(Number(query.episode)).padStart(2, '0') : ''
    if (season && episode && new RegExp(`(^| )s${season}e${episode}( |$)`, 'i').test(title)) score += 50
  }

  if (mode === 'batch') {
    const season = Number.isFinite(Number(query?.season)) ? String(Number(query.season)).padStart(2, '0') : ''
    if (season && new RegExp(`(^| )s${season}( |$)`, 'i').test(title)) score += 30
  }

  return score
}

function filterRows(rows, query, mode) {
  return rows
    .map(row => ({ row, score: getRowScore(row, query, mode) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.row.seeders - a.row.seeders)
    .map(entry => entry.row)
}

function getCategoryForQuery(query) {
  if (query?.mediaType === 'movie') return 'Movies'
  if (query?.mediaType === 'tv') return 'TV'
  return ''
}

function extractSearchRows(html) {
  const root = parseHtml(html)
  return root.querySelectorAll('tbody tr')
    .map(row => {
      const nameCell = row.querySelector('td.name')
      const detailLink = nameCell?.querySelector('a:last-of-type')
      const detailHref = detailLink?.getAttribute('href')
      const title = text(detailLink)
      if (!detailHref || !title) return null

      const cells = row.querySelectorAll('td')
      return {
        title,
        detailUrl: buildAbsoluteUrl(detailHref),
        seeders: parseInteger(text(cells[cells.length - 2])),
        leechers: parseInteger(text(cells[cells.length - 1]))
      }
    })
    .filter(Boolean)
}

function extractDetailMetadata(html) {
  const root = parseHtml(html)
  const magnet = root.querySelector('a[href^="magnet:?"]')?.getAttribute('href') || ''
  if (!magnet) return null

  const labels = root.querySelectorAll('div.clearfix ul li > span').map(node => text(node))
  const [category, type, language, size, uploadedBy, downloads, lastChecked, dateUploaded, seeders, leechers] = labels

  return {
    link: magnet,
    hash: magnetHash(magnet),
    size: parseHumanSize(size),
    downloads: parseInteger(downloads),
    date: parseLooseDate(dateUploaded || lastChecked),
    detailSeeders: parseInteger(seeders),
    detailLeechers: parseInteger(leechers),
    metadata: { category, type, language, uploadedBy }
  }
}

async function searchVariants(query, mode) {
  const variants = query?.variants?.[mode] || query?.titles || []
  const category = getCategoryForQuery(query)
  for (const term of variants.slice(0, 4)) {
    const searchHtml = await fetchHtml(buildSearchUrl(term, category))
    const rows = filterRows(extractSearchRows(searchHtml), query, mode).slice(0, 8)
    if (!rows.length) continue

    const settled = await Promise.allSettled(rows.map(async row => {
      const detailHtml = await fetchHtml(row.detailUrl)
      const detail = extractDetailMetadata(detailHtml)
      if (!detail?.hash) return null
      return {
        title: row.title,
        uri: detail.link,
        link: detail.link,
        hash: detail.hash,
        seeders: detail.detailSeeders || row.seeders,
        leechers: detail.detailLeechers || row.leechers,
        downloads: detail.downloads,
        size: detail.size,
        date: detail.date,
        type: mode === 'batch' ? 'batch' : undefined,
        source: { id: '1337x', name: '1337x' }
      }
    }))

    const results = settled
      .filter(entry => entry.status === 'fulfilled')
      .map(entry => entry.value)
      .filter(result => result?.hash)

    if (results.length) return results
  }

  return []
}

export const x1337Adapter = {
  id: '1337x',
  name: '1337x',
  mediaTypes: ['tv', 'movie'],
  async validate() {
    try {
      await fetchHtml(BASE_URL)
      return true
    } catch {
      return false
    }
  },
  async searchSingle(query) {
    return await searchVariants(query, 'single')
  },
  async searchBatch(query) {
    return await searchVariants(query, 'batch')
  },
  async searchMovie(query) {
    return await searchVariants(query, 'movie')
  }
}
