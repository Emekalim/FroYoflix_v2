function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function unique(values) {
  return [...new Set(values.map(normalizeWhitespace).filter(Boolean))]
}

function sanitizeTitle(title) {
  return normalizeWhitespace(title)
    .replace(/[^\p{L}\p{N}\s:'&().,\-+!?\[\]]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function addSeasonVariants(title) {
  const values = [title]
  const seasonWordMatch = title.match(/Season\s+(\d+)/i)
  const ordinalSeasonMatch = title.match(/(\d+)(?:st|nd|rd|th)\s+Season/i)

  if (seasonWordMatch) values.push(title.replace(/Season\s+(\d+)/i, `S${seasonWordMatch[1]}`))
  if (ordinalSeasonMatch) values.push(title.replace(/(\d+)(?:st|nd|rd|th)\s+Season/i, `S${ordinalSeasonMatch[1]}`))

  return values
}

function orderTitleCandidates(media) {
  const orderedTitleKeys = ['userPreferred', 'english', 'romaji', 'native']
  const titleEntries = media?.title || {}
  const preferredTitles = orderedTitleKeys
    .map(key => titleEntries[key])
    .filter(Boolean)
  const remainingTitles = Object.entries(titleEntries)
    .filter(([key, value]) => !orderedTitleKeys.includes(key) && value)
    .map(([, value]) => value)

  return [
    ...preferredTitles,
    ...remainingTitles,
    ...(Array.isArray(media?.synonyms) ? media.synonyms : [])
  ]
}

function splitPreferredTitles(titles, limit = 2) {
  const preferred = titles.slice(0, limit)
  const fallback = titles.slice(limit)
  return { preferred, fallback }
}

function createStage(stageMode, terms) {
  const uniqueTerms = unique(terms)
  if (!uniqueTerms.length) return null
  return { stageMode, terms: uniqueTerms }
}

function flattenStages(stages) {
  return unique(stages.flatMap(stage => stage?.terms || []))
}

export function determineBuiltInMediaType(media, explicitMovie = false) {
  if (!media) return 'anime'
  const declaredMediaType = String(media?.mediaType || '').toLowerCase()
  if (['anime', 'animemovie', 'tv', 'movie'].includes(declaredMediaType)) return declaredMediaType

  const source = String(media?.source || '').toUpperCase()

  // TMDB content: platform source is reliable, use format directly
  if (source === 'TMDB') {
    if (explicitMovie || media.format === 'MOVIE') return 'movie'
    if (media.format === 'TV') return 'tv'
    return 'movie'
  }

  if (['ANILIST', 'MAL', 'MYANIMELIST'].includes(source)) {
    return (explicitMovie || media.format === 'MOVIE') ? 'animeMovie' : 'anime'
  }

  // AniList's media.source is the source material (MANGA, ORIGINAL, etc.), not the tracking
  // platform — so we can't rely on it to detect AniList data. Instead, check for AniList/MAL
  // identifiers or Japanese title fields, which are reliable anime signals regardless of source.
  const looksAnimeNative = Boolean(media?.idMal || media?.title?.romaji || media?.title?.native)
  if (looksAnimeNative) {
    return (explicitMovie || media.format === 'MOVIE') ? 'animeMovie' : 'anime'
  }

  if (explicitMovie || media.format === 'MOVIE') return 'movie'
  if (media.format === 'TV') return 'tv'
  return 'anime'
}

export function createSearchTitles(media) {
  const baseTitles = orderTitleCandidates(media)

  const expanded = []
  for (const entry of baseTitles) {
    const title = sanitizeTitle(entry)
    if (!title || title.length < 2) continue
    expanded.push(...addSeasonVariants(title))
    if (title.includes('-')) expanded.push(...addSeasonVariants(title.replaceAll('-', ' ')))
    if (title.includes("'")) expanded.push(...addSeasonVariants(title.replaceAll("'", '')))
    expanded.push(...addSeasonVariants(title.replaceAll('-', '')))
  }

  return unique(expanded)
}

export function collectIds(media) {
  const ids = {}
  if (media?.id) ids.anilist = media.id
  if (media?.idMal) ids.mal = media.idMal
  if (media?.imdbId || media?.externalIds?.imdb) ids.imdb = media.imdbId || media.externalIds.imdb
  if (media?.tmdbId || media?.externalIds?.tmdb) ids.tmdb = media.tmdbId || media.externalIds.tmdb
  if (media?.tvdbId || media?.externalIds?.tvdb) ids.tvdb = media.tvdbId || media.externalIds.tvdb
  if (media?.traktId || media?.externalIds?.trakt) ids.trakt = media.traktId || media.externalIds.trakt
  return ids
}

function appendResolution(query, resolution) {
  return normalizeWhitespace(`${query} ${resolution ? `${resolution}p` : ''}`)
}

function buildAnimeSingleTerms(title, episode, resolution) {
  const numericEpisode = Number.isFinite(Number(episode)) ? Number(episode) : null
  if (numericEpisode == null) {
    return {
      exact: [],
      alternate: [],
      broad: [appendResolution(title, resolution), title]
    }
  }

  const ep2 = String(numericEpisode).padStart(2, '0')
  const ep3 = String(numericEpisode).padStart(3, '0')
  // Include 3-digit padding — Nyaa uses "002" for long-running shows like One Piece
  const exactEpisodes = ep3 !== ep2 ? [ep3, ep2] : [ep2]
  return {
    exact: exactEpisodes.flatMap(ep => [
      `${title} ${ep}`,
      `${title} - ${ep}`,
      appendResolution(`${title} ${ep}`, resolution),
      appendResolution(`${title} - ${ep}`, resolution)
    ]),
    alternate: [
      `${title} ${numericEpisode}`,
      `${title} Episode ${numericEpisode}`,
      appendResolution(`${title} ${numericEpisode}`, resolution)
    ],
    broad: [appendResolution(title, resolution), title]
  }
}

function buildAnimeBatchTerms(title, resolution) {
  return [
    `${title} batch`,
    `${title} complete`,
    `${title} 全集`,
    `${title} 合集`,
    appendResolution(`${title} batch`, resolution),
    appendResolution(`${title} complete`, resolution),
    appendResolution(`${title} 全集`, resolution),
    appendResolution(`${title} 合集`, resolution)
  ]
}

function buildAnimeSinglePlan(titles, episode, resolution) {
  const { preferred, fallback } = splitPreferredTitles(titles, 2)
  const stages = []

  const addStagesForTerms = (titlesToUse) => {
    const titleTerms = titlesToUse.map(title => buildAnimeSingleTerms(title, episode, resolution))
    stages.push(createStage('single', titleTerms.flatMap(entry => entry.exact)))
    stages.push(createStage('single', titleTerms.flatMap(entry => entry.alternate)))
    stages.push(createStage('single', titleTerms.flatMap(entry => entry.broad)))
  }

  addStagesForTerms(preferred)
  addStagesForTerms(fallback)

  return stages.filter(Boolean)
}

function buildAnimeSingleVariants(titles, episode, resolution) {
  return flattenStages(buildAnimeSinglePlan(titles, episode, resolution))
}

function buildAnimeBatchPlan(titles, episode, resolution) {
  const { preferred, fallback } = splitPreferredTitles(titles, 2)
  const stages = []

  const addBatchStages = (titlesToUse) => {
    const titleTerms = titlesToUse.flatMap(title => buildAnimeBatchTerms(title, resolution))
    stages.push(createStage('batch', titleTerms))
  }

  addBatchStages(preferred)
  addBatchStages(fallback)

  return stages.filter(Boolean)
}

function buildAnimeBatchVariants(titles, episode, resolution) {
  return flattenStages(buildAnimeBatchPlan(titles, episode, resolution))
}

function buildSimplePlan(mode, variants) {
  return variants.length ? [{ stageMode: mode, terms: variants }] : []
}

function buildTvEpisodeVariants(titles, season, episode, resolution) {
  const safeSeason = Number.isFinite(Number(season)) ? String(Number(season)).padStart(2, '0') : null
  const safeEpisode = Number.isFinite(Number(episode)) ? String(Number(episode)).padStart(2, '0') : null
  const effectiveSeason = safeSeason || (safeEpisode ? '01' : null)
  const { preferred, fallback } = splitPreferredTitles(titles, 2)
  const values = []

  for (const title of preferred) {
    if (effectiveSeason && safeEpisode) {
      values.push(
        `${title} S${effectiveSeason}E${safeEpisode}`,
        `${title} ${Number(effectiveSeason)}x${safeEpisode}`,
        appendResolution(`${title} S${effectiveSeason}E${safeEpisode}`, resolution),
        appendResolution(`${title} ${Number(effectiveSeason)}x${safeEpisode}`, resolution)
      )
    }
    if (safeEpisode) values.push(appendResolution(`${title} Episode ${Number(safeEpisode)}`, resolution))
    values.push(appendResolution(title, resolution), title)
  }

  for (const title of fallback) {
    if (effectiveSeason && safeEpisode) {
      values.push(
        `${title} S${effectiveSeason}E${safeEpisode}`,
        appendResolution(`${title} S${effectiveSeason}E${safeEpisode}`, resolution)
      )
    }
    values.push(title)
  }

  return unique(values)
}

function buildTvBatchVariants(titles, season, resolution) {
  const safeSeason = Number.isFinite(Number(season)) ? String(Number(season)).padStart(2, '0') : null
  const { preferred, fallback } = splitPreferredTitles(titles, 2)
  const values = []

  for (const title of preferred) {
    if (safeSeason) {
      values.push(
        `${title} S${safeSeason}`,
        `${title} Season ${Number(safeSeason)}`,
        appendResolution(`${title} S${safeSeason}`, resolution),
        appendResolution(`${title} Season ${Number(safeSeason)}`, resolution)
      )
    }
    values.push(appendResolution(title, resolution), title)
  }

  for (const title of fallback) values.push(title)

  return unique(values)
}

function buildMovieVariants(titles, year, resolution) {
  const { preferred, fallback } = splitPreferredTitles(titles, 2)
  const values = []
  for (const title of preferred) {
    values.push(
      `${title} ${year || ''}`.trim(),
      appendResolution(`${title} ${year || ''}`, resolution),
      appendResolution(title, resolution),
      title
    )
  }

  for (const title of fallback) values.push(`${title} ${year || ''}`.trim(), title)

  return unique(values)
}

export function buildBuiltInSearchQuery({ media, episode, season, batch = false, movie = false, resolution = '' }) {
  const mediaType = determineBuiltInMediaType(media, movie)
  const titles = createSearchTitles(media)
  const safeSeason = season ?? media?.season ?? undefined
  const safeEpisodeCount = Number.isFinite(Number(media?.episodes)) ? Number(media.episodes) : undefined
  const isAnimeMovie = mediaType === 'animeMovie'
  const base = {
    mediaType,
    titles,
    ids: collectIds(media),
    season: safeSeason,
    episode,
    episodeCount: safeEpisodeCount,
    year: media?.startDate?.year,
    resolution,
    exclusions: [],
    batch,
    movie: movie || isAnimeMovie  // animeMovie always uses movie search methods
  }

  let variants
  let variantPlan
  if (mediaType === 'anime') {
    const animeSinglePlan = buildAnimeSinglePlan(titles, episode, resolution)
    const animeBatchPlan = buildAnimeBatchPlan(titles, episode, resolution)
    const animeMovieVariants = buildMovieVariants(titles, media?.startDate?.year, resolution)
    variants = {
      single: flattenStages(animeSinglePlan),
      batch: flattenStages(animeBatchPlan),
      movie: animeMovieVariants
    }
    variantPlan = {
      single: animeSinglePlan,
      batch: animeBatchPlan,
      movie: buildSimplePlan('movie', animeMovieVariants)
    }
  } else if (mediaType === 'tv') {
    const tvSingleVariants = buildTvEpisodeVariants(titles, safeSeason, episode, resolution)
    const tvBatchVariants = buildTvBatchVariants(titles, safeSeason, resolution)
    const tvMovieVariants = buildMovieVariants(titles, media?.startDate?.year, resolution)
    variants = {
      single: tvSingleVariants,
      batch: tvBatchVariants,
      movie: tvMovieVariants
    }
    variantPlan = {
      single: buildSimplePlan('single', tvSingleVariants),
      batch: buildSimplePlan('batch', tvBatchVariants),
      movie: buildSimplePlan('movie', tvMovieVariants)
    }
  } else if (mediaType === 'animeMovie') {
    const animeMovieVariants = buildMovieVariants(titles, media?.startDate?.year, resolution)
    const animeSinglePlan = buildAnimeSinglePlan(titles, episode, resolution)
    variants = {
      single: flattenStages(animeSinglePlan),
      batch: animeMovieVariants,
      movie: animeMovieVariants
    }
    variantPlan = {
      single: animeSinglePlan,
      batch: buildSimplePlan('batch', animeMovieVariants),
      movie: buildSimplePlan('movie', animeMovieVariants)
    }
  } else {
    const movieVariants = buildMovieVariants(titles, media?.startDate?.year, resolution)
    variants = {
      single: movieVariants,
      batch: movieVariants,
      movie: movieVariants
    }
    variantPlan = {
      single: buildSimplePlan('single', movieVariants),
      batch: buildSimplePlan('batch', movieVariants),
      movie: buildSimplePlan('movie', movieVariants)
    }
  }

  return { ...base, variants, variantPlan }
}
