import { fetchHtml, parseHtml, parseHumanSize, parseLooseDate, parseInteger, magnetHash } from '../utils.js'

const BASE_URL = 'https://nyaa.si'

function buildUrl(term) {
  return `${BASE_URL}/?f=0&c=1_0&q=${encodeURIComponent(term)}`
}

function text(node) {
  return node?.text?.trim?.() || ''
}

function normalizeResult(row) {
  const cells = row.querySelectorAll('td')
  const titleLink = cells[1]?.querySelector('a:last-of-type')
  const magnetLink = row.querySelector('a[href^="magnet:?"]')
  const title = text(titleLink)
  const magnet = magnetLink?.getAttribute('href') || ''

  if (!title || !magnet) return null

  // Nyaa table: [category] [title] [links] [size] [date] [seeders] [leechers] [completed]
  //             at(-8)    at(-7)  at(-6)  at(-5) at(-4) at(-3)   at(-2)     at(-1)
  const sizeCell = cells.at(-5)
  const dateCell = cells.at(-4)
  const timestamp = dateCell?.getAttribute('data-timestamp')

  return {
    title,
    uri: magnet,
    link: magnet,
    hash: magnetHash(magnet),
    seeders: parseInteger(text(cells.at(-3))),
    leechers: parseInteger(text(cells.at(-2))),
    downloads: parseInteger(text(cells.at(-1))),
    size: parseHumanSize(text(sizeCell)),
    date: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : parseLooseDate(text(dateCell)),
    source: { id: 'nyaa', name: 'Nyaa' }
  }
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeQueryTitle(value) {
  // Strip everything except Unicode letters/digits, spaces, and hyphens.
  // Nyaa's search chokes on colons, brackets, apostrophes etc. — the old
  // Nyaa extension used /[^\w\s-]/g (ASCII-only) which worked well in practice.
  // We keep Unicode letters so Japanese/Chinese titles still search correctly.
  return String(value || '')
    .replace(/[^\p{L}\p{N}\s\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getOrderedTitles(query) {
  return [...new Set((query?.titles || [])
    .map(sanitizeQueryTitle)
    .filter(title => title.length >= 2))]
}

function getNormalizedTitles(query) {
  return getOrderedTitles(query)
    .map(normalizeTitle)
    .filter(Boolean)
}

function scoreResult(query, result, mode) {
  const rawTitle = String(result?.title || '')
  const title = normalizeTitle(rawTitle)
  if (!title) return 0

  // Detect collections/seasons — these are not individual episodes.
  // Non-ASCII keywords (全集, 合集) and season patterns must be checked against rawTitle
  // because normalizeTitle() strips everything outside [a-z0-9].
  // "S01" alone (no Exx episode) is a season pack; "S01E01" is a single episode — use negative lookahead.
  // Episode ranges like "[01-28]" or "[01~28]" indicate a batch collection.
  const isBatchLike = /\b(batch|complete|season pack)\b/i.test(title) ||
    /[全合]集/.test(rawTitle) ||
    /\bsaison\s+\d+\b/i.test(rawTitle) ||
    /\bseason\s+\d+\b/i.test(rawTitle) ||
    /\bS\d{1,2}(?!E\d)\b/.test(rawTitle) ||
    /\b\d{2,3}[-~]\d{2,3}/.test(rawTitle)

  let score = 0
  for (const candidate of getNormalizedTitles(query)) {
    // Title at the very start — highest confidence e.g. "One Piece - 002"
    if (new RegExp(`^${escapeRegex(candidate)}(\\s|$|-|\\[)`, 'i').test(title)) {
      score = Math.max(score, 280 + candidate.length)
      break
    }
    // Title anywhere as exact phrase — lower confidence e.g. "Koisuru One Piece - 02"
    const exactPattern = new RegExp(`(^| )${escapeRegex(candidate)}( |$)`, 'i')
    if (exactPattern.test(title)) {
      score = Math.max(score, 160 + candidate.length)
      break
    }
    // All tokens present — least reliable
    const tokens = candidate.split(' ').filter(token => token.length >= 2)
    if (tokens.length && tokens.every(token => new RegExp(`(^| )${escapeRegex(token)}( |$)`, 'i').test(title))) {
      score = Math.max(score, 80 + tokens.length)
    }
  }

  if (!score) return 0

  if (query?.resolution && new RegExp(`(^| )${escapeRegex(`${query.resolution}p`)}( |$)`, 'i').test(title)) score += 30

  // Always exclude batch/collection results in single mode, regardless of whether
  // an episode number is present — the isBatchLike check was previously gated
  // behind numEpisode != null which let batch files through when episode was unset.
  if (mode === 'single' && isBatchLike) return 0

  const numEpisode = Number.isFinite(Number(query?.episode)) ? Number(query.episode) : null
  if (mode === 'single' && numEpisode != null) {
    // Check 3-digit, 2-digit, and bare number — Nyaa uses "002" for long-running shows.
    // Also match SxxExx notation used by some groups for sequel seasons (e.g. S02E01).
    const ep2 = String(numEpisode).padStart(2, '0')
    const ep3 = String(numEpisode).padStart(3, '0')
    const epRaw = String(numEpisode)
    const episodePattern = new RegExp(
      // Anime-style: "- 01", "ep01", bare "01" with word boundary
      `(^| )(?:(?:-|ep)\\.?\\s*)?(?:${escapeRegex(ep3)}|${escapeRegex(ep2)}|${escapeRegex(epRaw)})( |$|\\.)` +
      // TV-style SxxExx used by some Nyaa groups (e.g. S02E01, S01E001) — any season, specific episode
      `|[Ee]${escapeRegex(ep3)}(?:[^\\d]|$)` +
      `|[Ee]${escapeRegex(ep2)}(?:[^\\d]|$)`,
      'i'
    )
    if (!episodePattern.test(title)) return 0

    // Reject if the only matching digits are a CJK calendar/date marker in rawTitle —
    // e.g. "01月新番" (January new-season tag) where "月" is stripped by normalizeTitle,
    // leaving a naked "01" that falsely matches the episode pattern.
    // Build a rawTitle pattern using the same numbers but assert no CJK suffix follows.
    const rawEpPattern = new RegExp(
      `(?:^|[\\s\\[\\(])(?:(?:-|ep)\\.?\\s*)?(?:${escapeRegex(ep3)}|${escapeRegex(ep2)}|${escapeRegex(epRaw)})(?![\\d月号话期集章回])`,
      'i'
    )
    const rawSxxExxPattern = new RegExp(
      `[Ee](?:${escapeRegex(ep3)}|${escapeRegex(ep2)})(?![\\d月号话期集章回])`,
      'i'
    )
    if (!rawEpPattern.test(rawTitle) && !rawSxxExxPattern.test(rawTitle)) return 0

    score += 80
  }

  if (mode === 'batch') {
    if (!isBatchLike) return 0
    score += 40
  }

  return score
}

function getSearchPlan(query, mode) {
  const stagePlan = Array.isArray(query?.variantPlan?.[mode]) ? query.variantPlan[mode] : []
  if (stagePlan.length) {
    return stagePlan
      .map(stage => ({
        stageMode: stage?.stageMode || mode,
        terms: [...new Set((stage?.terms || []).map(sanitizeQueryTitle).filter(Boolean))]
      }))
      .filter(stage => stage.terms.length)
  }

  const stages = []
  const modeVariants = Array.isArray(query?.variants?.[mode]) ? query.variants[mode] : []
  if (modeVariants.length) stages.push({ stageMode: mode, terms: modeVariants })

  if (mode === 'movie') {
    const singleVariants = Array.isArray(query?.variants?.single) ? query.variants.single : []
    if (singleVariants.length) stages.push({ stageMode: 'single', terms: singleVariants })
  }

  if (!stages.length) {
    const fallbackTitles = getOrderedTitles(query)
    if (fallbackTitles.length) stages.push({ stageMode: mode, terms: fallbackTitles })
  }

  return stages
    .map(stage => ({
      stageMode: stage.stageMode,
      terms: [...new Set(stage.terms.map(sanitizeQueryTitle).filter(Boolean))]
    }))
    .filter(stage => stage.terms.length)
}

function collectMatches(html, query, mode) {
  const root = parseHtml(html)
  const rows = root.querySelectorAll('tbody tr')
  return rows
    .map(normalizeResult)
    .filter(result => result?.hash)
    .map(result => ({ result, score: scoreResult(query, result, mode) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => (b.score - a.score) || ((b.result?.seeders || 0) - (a.result?.seeders || 0)))
    .map(entry => ({
      ...entry.result,
      type: mode === 'batch' && /\b(batch|complete|全集)\b/i.test(entry.result.title) ? 'batch' : entry.result.type
    }))
}

function isGoodMatchSet(matches, mode) {
  if (!matches.length) return false
  if (mode === 'single') return matches.some(match => (match.seeders || 0) > 0)
  if (mode === 'batch') return matches.some(match => match.type === 'batch')
  return matches.length >= 1
}

async function searchMode(query, mode) {
  const results = new Map()

  const stages = getSearchPlan(query, mode)
  for (const stage of stages) {
    // Fetch all terms in the stage in parallel — avoids sequential hang-on-timeout
    const settled = await Promise.allSettled(
      stage.terms.map(term =>
        fetchHtml(buildUrl(term)).then(html => collectMatches(html, query, stage.stageMode))
      )
    )

    const stageMatches = []
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue
      for (const result of outcome.value) {
        if (!results.has(result.hash)) {
          results.set(result.hash, result)
          stageMatches.push(result)
        }
      }
    }

    if (isGoodMatchSet(stageMatches, stage.stageMode)) break
  }

  return [...results.values()].sort((a, b) => {
    const modeForB = b.type === 'batch' ? 'batch' : mode
    const modeForA = a.type === 'batch' ? 'batch' : mode
    const titleScoreDelta = scoreResult(query, b, modeForB) - scoreResult(query, a, modeForA)
    return titleScoreDelta || ((b.seeders || 0) - (a.seeders || 0))
  })
}

export const nyaaAdapter = {
  id: 'nyaa',
  name: 'Nyaa',
  mediaTypes: ['anime', 'animeMovie'],
  async validate() {
    try {
      await fetchHtml(BASE_URL)
      return true
    } catch {
      return false
    }
  },
  async searchSingle(query) {
    return await searchMode(query, 'single')
  },
  async searchBatch(query) {
    return await searchMode(query, 'batch')
  },
  async searchMovie(query) {
    return await searchMode(query, 'movie')
  }
}
