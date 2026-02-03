// @ts-check
/**
 * MyAnimeList Mapper
 * Maps MyAnimeList API response to unified Media model
 *
 * @typedef {import('../types').Media} Media
 */

export default class MALMapper {
  /**
   * Map MyAnimeList anime data to unified Media model
   * @param {object} malData - Raw MyAnimeList anime data
   * @returns {Media}
   */
  mapAnime(malData) {
    if (!malData || !malData.id) {
      throw new Error('Invalid MyAnimeList anime data')
    }

    return {
      id: String(malData.id),
      externalIds: {
        mal: malData.id,
        anilist: malData.anilistId
      },
      type: 'anime',
      title: {
        english: malData.title,
        native: malData.titleJapanese,
        default: malData.title || 'Unknown'
      },
      description: malData.synopsis,
      status: this._mapStatus(malData.status),
      releaseDate: malData.aired?.from,
      runtime: malData.duration,
      episodeCount: malData.episodes,
      poster: malData.images?.jpg?.image_url,
      userProgress: malData.myListStatus ? {
        score: malData.myListStatus.score,
        status: this._mapProgressStatus(malData.myListStatus.status),
        progress: malData.myListStatus.num_episodes_watched,
        updatedAt: malData.myListStatus.updated_at
      } : null
    }
  }

  /**
   * Map MAL status to unified status
   * @private
   */
  _mapStatus(malStatus) {
    if (!malStatus) return null
    const statusMap = {
      'finished_airing': 'FINISHED',
      'currently_airing': 'RELEASING',
      'not_yet_aired': 'UPCOMING'
    }
    return statusMap[malStatus?.toLowerCase()] || malStatus
  }

  /**
   * Map MAL progress status to unified status
   * @private
   */
  _mapProgressStatus(malStatus) {
    if (!malStatus) return null
    const statusMap = {
      'watching': 'WATCHING',
      'completed': 'COMPLETED',
      'on_hold': 'PAUSED',
      'dropped': 'DROPPED',
      'plan_to_watch': 'PLANNING'
    }
    return statusMap[malStatus?.toLowerCase()] || malStatus
  }
}
