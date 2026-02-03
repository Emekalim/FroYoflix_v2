// @ts-check
/**
 * Trakt Data Mapper
 * Maps Trakt API responses to unified Media model
 *
 * @typedef {import('../types').Media} Media
 */

export default class TraktMapper {
  /**
   * Map Trakt response to unified Media model
   * @param {object} data - Raw Trakt data (show or movie)
   * @param {'show' | 'movie'} mediaType - Type of media
   * @returns {Media}
   */
  map(data, mediaType) {
    const ids = data.ids || {}
    const isShow = mediaType === 'show'

    return {
      id: String(ids.trakt),
      externalIds: {
        trakt: ids.trakt,
        imdb: ids.imdb,
        tmdb: ids.tmdb,
        tvdb: ids.tvdb,
        slug: ids.slug
      },
      type: isShow ? 'tv' : 'movie',
      title: {
        english: data.title,
        default: data.title
      },
      description: data.overview,
      status: this._mapStatus(data.status || ''),
      releaseDate: data.first_aired || data.released,
      runtime: data.runtime,
      episodeCount: isShow ? data.aired_episodes : null,
      seasonCount: isShow ? data.seasons : null,
      poster: data.images?.poster?.full || null,
      banner: data.images?.banner?.full || null,
      userProgress: null  // Trakt tracks progress separately
    }
  }

  /**
   * Map Trakt status to unified status
   * @private
   * @param {string} traktStatus - Trakt status string
   * @returns {string}
   */
  _mapStatus(traktStatus) {
    const statusMap = {
      'returning': 'RELEASING',
      'in production': 'RELEASING',
      'planned': 'UPCOMING',
      'upcoming': 'UPCOMING',
      'ended': 'FINISHED',
      'cancelled': 'CANCELLED',
      'released': 'FINISHED'
    }
    return statusMap[traktStatus?.toLowerCase()] || 'RELEASING'
  }
}
