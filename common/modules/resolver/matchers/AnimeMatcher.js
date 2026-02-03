// @ts-check
/**
 * AnimeMatcher - Searches for anime using AniList and MyAnimeList
 * 
 * @typedef {import('../types.js').ParsedFilename} ParsedFilename
 * @typedef {import('../types.js').Media} Media
 */

import BaseMatcher from './BaseMatcher.js'

/**
 * AnimeMatcher - Finds anime in AniList and MAL based on parsed data
 */
export default class AnimeMatcher extends BaseMatcher {
  /**
   * Search for anime using title and episode info
   * @param {ParsedFilename} parsed
   * @returns {Promise<Media|null>}
   */
  async match(parsed) {
    try {
      // Try AniList first (better data)
      const anilistResult = await this.searchAniList(parsed)
      if (anilistResult) {
        return {
          id: anilistResult.id,
          title: anilistResult.title.english || anilistResult.title.romaji,
          titleRomaji: anilistResult.title.romaji,
          titleNative: anilistResult.title.native,
          source: 'anilist',
          externalIds: {
            anilist: anilistResult.id,
            myanimelist: anilistResult.idMal
          },
          episodes: anilistResult.episodes,
          description: anilistResult.description,
          coverImage: anilistResult.coverImage?.large,
          bannerImage: anilistResult.bannerImage,
          status: anilistResult.status,
          matchScore: 0, // Will be calculated by resolver
        }
      }

      // Fallback to MyAnimeList
      const malResult = await this.searchMyAnimeList(parsed)
      if (malResult) {
        return {
          id: malResult.id,
          title: malResult.title,
          titleEnglish: malResult.title_english,
          source: 'myanimelist',
          externalIds: {
            myanimelist: malResult.id
          },
          episodes: malResult.num_episodes,
          description: malResult.synopsis,
          coverImage: malResult.images?.jpg?.image_url,
          status: malResult.status,
          matchScore: 0,
        }
      }

      return null
    } catch (err) {
      console.error('AnimeMatcher.match() error:', err.message)
      return null
    }
  }

  /**
   * Search AniList GraphQL for anime
   * @param {ParsedFilename} parsed
   * @returns {Promise<Object|null>}
   */
  async searchAniList(parsed) {
    try {
      // Lazy load AniList module from parent directory
      const { searchAnime } = await import('../../anilist.js')
      
      // Search with title
      const results = await searchAnime(parsed.title)
      if (!results || results.length === 0) {
        console.warn(`AniList: No results for "${parsed.title}"`)
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

      return bestScore > 60 ? bestResult : null
    } catch (err) {
      console.warn('AniList search failed:', err.message)
      return null
    }
  }

  /**
   * Search MyAnimeList REST API for anime
   * @param {ParsedFilename} parsed
   * @returns {Promise<Object|null>}
   */
  async searchMyAnimeList(parsed) {
    try {
      // Lazy load MAL module from parent directory
      const { search } = await import('../../myanimelist.js')
      
      // Search with title
      const results = await search(parsed.title)
      if (!results || results.length === 0) {
        console.warn(`MAL: No results for "${parsed.title}"`)
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

      return bestScore > 60 ? bestResult : null
    } catch (err) {
      console.warn('MyAnimeList search failed:', err.message)
      return null
    }
  }

  /**
   * Calculate match score between parsed anime and search result
   * @param {ParsedFilename} parsed
   * @param {Object} result - Anime result from AniList or MAL
   * @returns {number} 0-100
   */
  calculateScore(parsed, result) {
    let score = 0

    // Get result title(s)
    const resultTitles = this.getResultTitles(result)
    
    // Title matching (40 points max)
    let bestTitleScore = 0
    for (const resultTitle of resultTitles) {
      if (resultTitle === parsed.title) {
        bestTitleScore = 40  // Exact match
        break
      } else if (resultTitle.toLowerCase() === parsed.title.toLowerCase()) {
        bestTitleScore = Math.max(bestTitleScore, 38)
      } else if (this.isSimilar(resultTitle, parsed.title)) {
        bestTitleScore = Math.max(bestTitleScore, 30)
      } else {
        // String similarity
        const similarity = this.stringSimilarity(resultTitle, parsed.title)
        bestTitleScore = Math.max(bestTitleScore, similarity * 25)
      }
    }
    score += bestTitleScore

    // Episode count matching (30 points max)
    const resultEpisodes = result.episodes || result.num_episodes
    if (resultEpisodes && parsed.episode) {
      if (parsed.episode <= resultEpisodes) {
        score += 30  // Episode count matches (file is valid)
      } else if (parsed.episode > resultEpisodes) {
        score -= 30  // File has more episodes than anime exists
      }
    } else if (resultEpisodes) {
      score += 15  // Have episode count but no parsed episode
    }

    // Status bonus (10 points)
    const status = result.status || result.airing
    if (status === 'FINISHED' || status === 'finished airing') {
      score += 5
    } else if (status === 'AIRING' || status === 'currently airing') {
      score += 10
    }

    // Description/synopsis bonus (5 points)
    if ((result.description || result.synopsis) && 
        (result.description?.length > 50 || result.synopsis?.length > 50)) {
      score += 5
    }

    // Cap at 100
    return Math.min(Math.max(score, 0), 100)
  }

  /**
   * Extract all possible titles from result object
   * @param {Object} result
   * @returns {string[]}
   */
  getResultTitles(result) {
    const titles = []
    
    // AniList format
    if (result.title) {
      if (typeof result.title === 'string') {
        titles.push(result.title)
      } else {
        if (result.title.english) titles.push(result.title.english)
        if (result.title.romaji) titles.push(result.title.romaji)
        if (result.title.native) titles.push(result.title.native)
      }
    }
    
    // MAL format
    if (result.title_english) titles.push(result.title_english)
    if (result.title_japanese) titles.push(result.title_japanese)
    
    return titles.filter((t, i, arr) => t && arr.indexOf(t) === i) // Deduplicate
  }
}
