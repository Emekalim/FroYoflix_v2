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
    const resultTitle = result.title || result.name
    
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
      
      if (parsed.mediaType === 'tv') {
        // For TV shows, try first_air_date
        resultYear = this.extractYear(result.first_air_date)
      } else {
        // For movies, try release_date
        resultYear = this.extractYear(result.release_date)
      }

      if (resultYear) {
        if (resultYear === parsed.year) {
          score += 20  // Year matches exactly
        } else if (Math.abs(resultYear - parsed.year) <= 1) {
          score += 15  // Year close (within 1 year)
        } else if (Math.abs(resultYear - parsed.year) <= 2) {
          score += 10  // Year somewhat close (within 2 years)
        }
      }
    }

    // Season/Episode matching for TV (30 points max)
    if (parsed.mediaType === 'tv' && parsed.season && result.seasons) {
      // Check if result has the season we're looking for
      const hasSeason = result.seasons.some(s => s.season_number === parsed.season)
      if (hasSeason) {
        score += 30  // Season exists in result
        
        // Bonus: check if episodes exist
        if (result.seasons.some(s => s.season_number === parsed.season && s.episode_count && s.episode_count >= parsed.episode)) {
          score += 10
        }
      }
    }

    // Media type bonus
    if (result.media_type === 'tv' && parsed.mediaType === 'tv') {
      score += 5
    } else if (result.media_type === 'movie' && parsed.mediaType === 'movie') {
      score += 5
    }

    // Popularity bonus (slight boost for popular/verified results)
    if (result.popularity && result.popularity > 10) {
      score += Math.min(5, result.popularity / 10)
    }

    // Cap at 100
    return Math.min(Math.max(score, 0), 100)
  }

  /**
   * Normalize TMDB result to Media format
   * @param {Object} result - TMDB result
   * @param {string} mediaType - 'tv' or 'movie'
   * @returns {Media}
   */
  normalizeResult(result, mediaType) {
    return {
      id: result.id,
      title: result.title || result.name,
      mediaType: mediaType,
      source: 'tmdb',
      externalIds: {
        tmdb: result.id,
        imdb: result.imdb_id
      },
      year: this.extractYear(
        mediaType === 'tv' ? result.first_air_date : result.release_date
      ),
      episodes: mediaType === 'tv' ? result.episode_run_time?.[0] : null,
      seasons: mediaType === 'tv' ? result.seasons : null,
      description: result.overview,
      posterImage: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
      backdropImage: result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : null,
      rating: result.vote_average,
      popularity: result.popularity,
      status: result.status,
      matchScore: 0, // Will be calculated by resolver
    }
  }
}
