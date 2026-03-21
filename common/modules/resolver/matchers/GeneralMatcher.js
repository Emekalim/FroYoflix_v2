// @ts-check
/**
 * GeneralMatcher - Searches for TV shows and movies using TMDB
 * 
 * @typedef {import('../types.js').ParsedFilename} ParsedFilename
 * @typedef {import('../types.js').Media} Media
 */

import BaseMatcher from './BaseMatcher.js'

/**
 * GeneralMatcher - Finds TV shows and movies in TMDB based on parsed data
 */
export default class GeneralMatcher extends BaseMatcher {
  /**
   * Search for TV or movie using title and year
   * @param {ParsedFilename} parsed - TV show or movie parsed data
   * @returns {Promise<Media|null>}
   */
  async match(parsed) {
    try {
      // Get TMDB provider from parent modules directory
      const { getProvider } = await import('../../providers/index.js')
      const tmdb = getProvider('tmdb')

      if (!tmdb) {
        console.error('TMDB provider not available')
        return null
      }

      // Determine search type
      const searchType = parsed.mediaType === 'tv' ? 'tv' : 'movie'

      // Search TMDB
      const results = await tmdb.search(parsed.title, { type: searchType })

      if (!results || results.length === 0) {
        console.warn(`TMDB: No results for "${parsed.title}" (${searchType})`)
        return null
      }

      // Score and return best match
      let bestResult = null
      let bestScore = 0

      for (const result of results.slice(0, 10)) {
        const score = this.calculateScore(parsed, result)
        if (score > bestScore) {
          bestScore = score
          bestResult = result
        }
      }

      if (!bestResult || bestScore < 60) {
        console.warn(`TMDB: Best score ${bestScore} below threshold for "${parsed.title}"`)
        return null
      }

      // Normalize to Media format
      return this.normalizeResult(bestResult, parsed.mediaType)
    } catch (err) {
      console.error('GeneralMatcher.match() error:', err.message)
      return null
    }
  }

  /**
   * Calculate match score between parsed media and TMDB result
   * @param {ParsedFilename} parsed
   * @param {Object} result - TMDB search result
   * @returns {number} 0-100
   */
  calculateScore(parsed, result) {
    let score = 0

    // Get result title
    let resultTitle = result.title || result.name

    // Handle object titles (TMDB/AniList can return localized objects)
    if (resultTitle && typeof resultTitle === 'object') {
      resultTitle = resultTitle.english || resultTitle.default || resultTitle.title || resultTitle.name || ''
    }

    // Validate title exists
    if (!resultTitle || typeof resultTitle !== 'string') {
      return 0  // No valid title to match
    }

    // Title matching (40 points max)
    if (resultTitle === parsed.title) {
      score += 40  // Exact match
    } else if (resultTitle.toLowerCase() === parsed.title.toLowerCase()) {
      score += 38  // Case-insensitive match
    } else if (this.isSimilar(resultTitle, parsed.title)) {
      score += 30  // Fuzzy match
    } else {
      // String similarity
      const similarity = this.stringSimilarity(resultTitle, parsed.title)
      score += similarity * 25
    }

    // Year matching (20 points max)
    if (parsed.year) {
      let resultYear = null

      // Handle normalized Media object (has direct .year property)
      if (result.year) {
        resultYear = parseInt(result.year)
      } else {
        // Handle raw/mapped TMDB keys
        const releaseDate = result.releaseDate || result.first_air_date || result.release_date
        resultYear = this.extractYear(releaseDate)
      }

      if (resultYear) {
        // Ensure parsed.year is a number
        const parsedYear = parseInt(parsed.year)

        if (resultYear === parsedYear) {
          score += 20  // Year matches exactly
        } else if (Math.abs(resultYear - parsedYear) <= 1) {
          score += 15  // Year close (within 1 year)
        } else if (Math.abs(resultYear - parsedYear) <= 2) {
          score += 10  // Year somewhat close (within 2 years)
        }
      }
    }

    // Season/Episode matching for TV (30 points max)
    if (parsed.mediaType === 'tv' && parsed.season) {
      // Check mapped seasonCount or raw seasons array
      const hasSeasons = result.seasonCount || (result.seasons && result.seasons.length > 0)

      if (hasSeasons) {
        // If we have detailed season info (raw TMDB)
        if (result.seasons && Array.isArray(result.seasons)) {
          const hasSeason = result.seasons.some(s => s.season_number === parsed.season)
          if (hasSeason) {
            score += 30
            if (result.seasons.some(s => s.season_number === parsed.season && s.episode_count >= parsed.episode)) {
              score += 10
            }
          }
        } else if (result.seasonCount >= parsed.season) {
          // Mapped result just has count
          score += 30
        }
      }
    }

    // Media type bonus
    // Support normalized 'mediaType', mapped 'type', or raw 'media_type'
    const resultType = result.mediaType || result.type || result.media_type

    if (resultType === 'tv' && parsed.mediaType === 'tv') {
      score += 5
    } else if (resultType === 'movie' && parsed.mediaType === 'movie') {
      score += 5
    } else if (!resultType) {
      // Assume correct type if not specified
      score += 5
    }

    // Popularity bonus (slight boost for popular/verified results)
    if (result.popularity && result.popularity > 10) {
      score += Math.min(5, result.popularity / 10)
    }

    // Cap at 100
    const finalScore = Math.min(Math.max(score, 0), 100)

    return finalScore
  }

  /**
   * Normalize TMDB result to Media format
   * @param {Object} result - TMDB result
   * @param {string} mediaType - 'tv' or 'movie'
   * @returns {Media}
   */
  normalizeResult(result, mediaType) {
    // Check if title is an object (found during debugging)
    let titleText = result.title || result.name
    if (titleText && typeof titleText === 'object') {
      titleText = titleText.english || titleText.default || titleText.title || titleText.name || ''
    }

    // Handle date extraction for normalized object
    const releaseDate = mediaType === 'tv'
      ? (result.first_air_date || result.releaseDate)
      : (result.release_date || result.releaseDate)
    const year = this.extractYear(
      mediaType === 'tv' ? (result.first_air_date || result.releaseDate) : (result.release_date || result.releaseDate)
    )
    const normalizedTitle = {
      userPreferred: titleText,
      romaji: titleText,
      english: titleText,
      native: titleText
    }
    const coverImage = {
      extraLarge: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : (result.posterImage || result.poster || null),
      large: result.poster_path ? `https://image.tmdb.org/t/p/w342${result.poster_path}` : (result.posterImage || result.poster || null),
      medium: result.poster_path ? `https://image.tmdb.org/t/p/w185${result.poster_path}` : (result.posterImage || result.poster || null),
      color: null
    }
    const status = releaseDate
      ? (new Date(releaseDate).getTime() > Date.now() ? 'NOT_YET_RELEASED' : 'FINISHED')
      : 'UNKNOWN'

    return {
      id: result.id,
      title: normalizedTitle,
      mediaType,
      source: 'TMDB',
      externalIds: {
        tmdb: result.id,
        imdb: result.imdb_id
      },
      tmdbId: result.id,
      year,
      seasonYear: year,
      format: mediaType === 'tv' ? 'TV' : 'MOVIE',
      type: mediaType === 'tv' ? 'TV' : 'MOVIE',
      coverImage,
      bannerImage: result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : (result.backdropImage || result.banner || null),
      episodes: mediaType === 'tv' ? null : 1,
      duration: Array.isArray(result.episode_run_time) ? result.episode_run_time[0] : result.runtime || null,
      seasons: mediaType === 'tv' ? result.seasons : null,
      description: result.overview || result.description,
      genres: result.genres || [],
      averageScore: result.vote_average ? Math.round(result.vote_average * 10) : result.averageScore || null,
      rating: result.vote_average || result.rating,
      popularity: result.popularity,
      status,
      isAdult: result.adult || false,
      mediaListEntry: null,
      relations: { edges: [] },
      recommendations: { edges: [] },
      stats: { scoreDistribution: [] },
      airingSchedule: { nodes: [] },
      nextAiringEpisode: null,
      tags: [],
      matchScore: 0, // Will be calculated by resolver
    }
  }
}
