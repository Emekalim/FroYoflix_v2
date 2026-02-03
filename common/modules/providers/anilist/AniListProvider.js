// @ts-check
/**
 * AniList Provider
 * Wraps existing AniList module to conform to MediaProvider interface
 *
 * @typedef {import('../types.js').MediaProvider} MediaProvider
 * @typedef {import('../types.js').Media} Media
 * @typedef {import('../types.js').SearchFilters} SearchFilters
 * @typedef {import('../types.js').Episode} Episode
 * @typedef {import('../types.js').Season} Season
 * @typedef {import('../types.js').UserList} UserList
 * @typedef {import('../types.js').ProgressUpdate} ProgressUpdate
 */

import BaseProvider from '../BaseProvider.js'
import AniListMapper from './mapper.js'

export default class AniListProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'anilist',
      name: 'AniList',
      mediaTypes: ['anime'],
      ...config
    })
    this.mapper = new AniListMapper()
  }

  /**
   * Check if authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    // Import existing anilist to check auth status
    try {
      const anilist = await this._getAniList()
      return anilist?.isAuthenticated?.() || false
    } catch {
      return false
    }
  }

  /**
   * Get AniList module (lazy import)
   * @private
   */
  async _getAniList() {
    if (this._anilistModule) return this._anilistModule
    try {
      this._anilistModule = await import('../../../anilist.js')
      return this._anilistModule
    } catch (error) {
      throw new Error(`Failed to load AniList module: ${error.message}`)
    }
  }

  /**
   * Authenticate
   * @returns {Promise<void>}
   */
  async authenticate() {
    const anilist = await this._getAniList()
    if (anilist?.authenticate) {
      return anilist.authenticate()
    }
  }

  /**
   * Get current user
   * @returns {Promise<any>}
   */
  async getUser() {
    const anilist = await this._getAniList()
    return anilist?.getUser?.()
  }

  /**
   * Search for anime
   * @param {string} query
   * @param {SearchFilters} filters
   * @returns {Promise<Media[]>}
   */
  async search(query, filters = {}) {
    const anilist = await this._getAniList()
    if (!anilist?.search) throw new Error('AniList search not available')

    const results = await anilist.search(query)
    return (results || []).map(item => this.mapper.mapAnime(item))
  }

  /**
   * Get anime by ID
   * @param {string|number} id - AniList anime ID
   * @returns {Promise<Media>}
   */
  async getById(id) {
    const anilist = await this._getAniList()
    if (!anilist?.getById) throw new Error('AniList getById not available')

    const anime = await anilist.getById(id)
    return this.mapper.mapAnime(anime)
  }

  /**
   * Get episodes
   * @param {string|number} mediaId - AniList anime ID
   * @param {number} season - (unused for anime)
   * @returns {Promise<Episode[]>}
   */
  async getEpisodes(mediaId, season = null) {
    const anilist = await this._getAniList()
    if (!anilist?.getById) throw new Error('AniList getById not available')

    const anime = await anilist.getById(mediaId)
    return (anime?.episodes || []).map((ep, idx) => ({
      number: idx + 1,
      season: null,
      title: ep?.title || `Episode ${idx + 1}`,
      aired: ep?.aired,
      runtime: ep?.runtime,
      description: ep?.description
    }))
  }

  /**
   * Get trending anime
   * @returns {Promise<Media[]>}
   */
  async getTrending() {
    const anilist = await this._getAniList()
    if (!anilist?.getTrending) return []

    const results = await anilist.getTrending()
    return (results || []).map(item => this.mapper.mapAnime(item))
  }

  /**
   * Get user lists
   * @returns {Promise<UserList[]>}
   */
  async getUserLists() {
    const anilist = await this._getAniList()
    return anilist?.getUserLists?.() || []
  }

  /**
   * Update progress
   * @param {string|number} mediaId
   * @param {ProgressUpdate} progress
   * @returns {Promise<void>}
   */
  async updateProgress(mediaId, progress) {
    const anilist = await this._getAniList()
    if (!anilist?.updateProgress) throw new Error('AniList updateProgress not available')
    return anilist.updateProgress(mediaId, progress)
  }
}
