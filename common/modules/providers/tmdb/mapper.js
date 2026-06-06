// @ts-check
/**
 * TMDB Data Mapper
 * Maps TMDB API responses to unified Media model
 *
 * @typedef {import('../types').Media} Media
 */

export default class TMDBMapper {
  /**
   * Map TMDB response to unified Media model
   * @param {object} data - Raw TMDB data
   * @param {'movie' | 'tv'} mediaType - Type of media
   * @returns {Media}
   */
  map(data, mediaType) {
    const externalIds = data.external_ids || {}
    
    return {
      id: String(data.id),
      tmdbId: data.id,
      source: 'TMDB',
      format: mediaType === 'tv' ? 'TV' : 'MOVIE',
      type: mediaType === 'tv' ? 'TV' : 'MOVIE',
      mediaType,
      externalIds: {
        tmdb: data.id,
        imdb: data.imdb_id || externalIds.imdb_id,
        tvdb: externalIds.tvdb_id
      },
      title: {
        userPreferred: mediaType === 'tv' ? data.name : data.title,
        english: mediaType === 'tv' ? data.name : data.title,
        romaji: mediaType === 'tv' ? data.name : data.title,
        native: mediaType === 'tv' ? data.name : data.title,
        default: mediaType === 'tv' ? data.name : data.title
      },
      description: data.overview,
      status: this._mapStatus(data.status || ''),
      releaseDate: mediaType === 'tv' ? data.first_air_date : data.release_date,
      runtime: data.runtime || data.episode_run_time?.[0],
      episodeCount: mediaType === 'tv' ? data.number_of_episodes : null,
      seasonCount: mediaType === 'tv' ? data.number_of_seasons : null,
      seasons: mediaType === 'tv' ? (data.number_of_seasons || null) : null,
      poster: data.poster_path
        ? `https://image.tmdb.org/t/p/w342${data.poster_path}`
        : null,
      posterImage: data.poster_path
        ? `https://image.tmdb.org/t/p/w342${data.poster_path}`
        : null,
      banner: data.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}`
        : null,
      backdropImage: data.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}`
        : null,
      userProgress: null
    }
  }

  /**
   * Map TMDB status to unified status
   * @private
   * @param {string} tmdbStatus - TMDB status string
   * @returns {string}
   */
  _mapStatus(tmdbStatus) {
    const statusMap = {
      'Returning Series': 'RELEASING',
      'Ended': 'FINISHED',
      'Cancelled': 'CANCELLED',
      'Pilot': 'UPCOMING',
      'Released': 'FINISHED'
    }
    return statusMap[tmdbStatus] || 'RELEASING'
  }
}
