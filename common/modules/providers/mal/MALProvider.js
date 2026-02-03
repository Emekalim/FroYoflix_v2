// @ts-check
/**
 * MyAnimeList Provider
 * Wraps existing MAL module to conform to MediaProvider interface
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
import MALMapper from './mapper.js'

export default class MALProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'mal',
      name: 'MyAnimeList',
      mediaTypes: ['anime'],
      ...config
    })
    this.mapper = new MALMapper()
  }

  /**
   * Check if authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const mal = await this._getMAL()
      return mal?.isAuthenticated?.() || false
    } catch {
      return false
    }
  }

  /**
   * Get MyAnimeList module (lazy import)
   * @private
   */
  async _getMAL() {
    if (this._malModule) return this._malModule
    try {
      this._malModule = await import('../../../myanimelist.js')
      return this._malModule
    } catch (error) {
      throw new Error(`Failed to load MyAnimeList module: ${error.message}`)
    }
  }

  /**
   * Authenticate
   * @returns {Promise<void>}
   */
  async authenticate() {
    const mal = await this._getMAL()
    if (mal?.authenticate) {
      return mal.authenticate()
    }
  }

  /**
   * Get current user
   * @returns {Promise<any>}
   */
  async getUser() {
    const mal = await this._getMAL()
    return mal?.getUser?.()
  }

  /**
   * Search for anime
   * @param {string} query
   * @param {SearchFilters} filters
   * @returns {Promise<Media[]>}
   */
  async search(query, filters = {}) {
    const mal = await this._getMAL()
    if (!mal?.search) throw new Error('MyAnimeList search not available')

    const results = await mal.search(query)
    return (results || []).map(item => this.mapper.mapAnime(item))
  }

  /**
   * Get anime by ID
   * @param {string|number} id - MAL anime ID
   * @returns {Promise<Media>}
   */
  async getById(id) {
    const mal = await this._getMAL()
    if (!mal?.getById) throw new Error('MyAnimeList getById not available')

    const anime = await mal.getById(id)
    return this.mapper.mapAnime(anime)
  }

  /**
   * Get episodes
   * @param {string|number} mediaId - MAL anime ID
   * @param {number} season - (unused for anime)
   * @returns {Promise<Episode[]>}
   */
  async getEpisodes(mediaId, season = null) {
    const mal = await this._getMAL()
    if (!mal?.getById) throw new Error('MyAnimeList getById not available')

    const anime = await mal.getById(mediaId)
    return (anime?.episodes || []).map((ep, idx) => ({
      number: idx + 1,
      season: null,
      title: ep?.title || `Episode ${idx + 1}`,
      aired: ep?.aired
    }))
  }

  /**
   * Get user lists
   * @returns {Promise<UserList[]>}
   */
  async getUserLists() {
    const mal = await this._getMAL()
    return mal?.getUserLists?.() || []
  }

  /**
   * Update progress
   * @param {string|number} mediaId
   * @param {ProgressUpdate} progress
   * @returns {Promise<void>}
   */
  async updateProgress(mediaId, progress) {
    const mal = await this._getMAL()
    if (!mal?.updateProgress) throw new Error('MyAnimeList updateProgress not available')
    return mal.updateProgress(mediaId, progress)
  }
}
