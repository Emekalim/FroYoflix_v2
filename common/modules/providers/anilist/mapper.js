// @ts-check
/**
 * AniList Mapper
 * Maps AniList API response to unified Media model
 *
 * @typedef {import('../types').Media} Media
 */

export default class AniListMapper {
  /**
   * Map AniList anime data to unified Media model
   * @param {object} anilistData - Raw AniList anime data
   * @returns {Media}
   */
  mapAnime(anilistData) {
    if (!anilistData || !anilistData.id) {
      throw new Error('Invalid AniList anime data')
    }

    return {
      id: String(anilistData.id),
      externalIds: {
        anilist: anilistData.id,
        mal: anilistData.idMal,
        imdb: this._extractImdbId(anilistData.externalLinks)
      },
      type: 'anime',
      title: {
        romaji: anilistData.title?.romaji,
        english: anilistData.title?.english,
        native: anilistData.title?.native,
        userPreferred: anilistData.title?.userPreferred,
        default: anilistData.title?.userPreferred ||
          anilistData.title?.english ||
          anilistData.title?.romaji ||
          'Unknown'
      },
      description: anilistData.description,
      status: anilistData.status,
      releaseDate: this._formatDate(anilistData.startDate),
      runtime: anilistData.duration,
      episodeCount: anilistData.episodes,
      poster: anilistData.coverImage?.large || anilistData.coverImage?.medium,
      banner: anilistData.bannerImage,
      userProgress: anilistData.mediaListEntry ? {
        score: anilistData.mediaListEntry.score,
        status: anilistData.mediaListEntry.status,
        progress: anilistData.mediaListEntry.progress,
        updatedAt: anilistData.mediaListEntry.updatedAt
      } : null
    }
  }

  /**
   * Extract IMDb ID from external links
   * @private
   */
  _extractImdbId(externalLinks) {
    if (!Array.isArray(externalLinks)) return null
    const imdbLink = externalLinks.find(l => l?.site === 'IMDb')
    if (!imdbLink?.url) return null
    const match = imdbLink.url.match(/tt\d+/)
    return match ? match[0] : null
  }

  /**
   * Format date from AniList date object
   * @private
   */
  _formatDate(dateObj) {
    if (!dateObj || !dateObj.year) return null
    const month = String(dateObj.month || 1).padStart(2, '0')
    const day = String(dateObj.day || 1).padStart(2, '0')
    return `${dateObj.year}-${month}-${day}`
  }
}
