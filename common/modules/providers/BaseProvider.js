/**
 * Abstract base class for all media providers
 * All providers must extend this class and implement required methods
 */
// @ts-check
/** @typedef {import('./types').MediaProvider} MediaProvider */
/** @typedef {import('./types').Media} Media */
/** @typedef {import('./types').SearchFilters} SearchFilters */
/** @typedef {import('./types').Episode} Episode */
/** @typedef {import('./types').Season} Season */
/** @typedef {import('./types').UserList} UserList */
/** @typedef {import('./types').ProgressUpdate} ProgressUpdate */

export default class BaseProvider {
  constructor(config = {}) {
    this.id = config.id
    this.name = config.name
    this.mediaTypes = config.mediaTypes || []
    this.config = config
    this._authenticated = false
  }

  /**
   * Check if provider is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    return this._authenticated
  }

  /**
   * Authenticate with provider (if needed)
   * @returns {Promise<void>}
   */
  async authenticate() {
    throw new Error(`authenticate() not implemented for ${this.id}`)
  }

  /**
   * Get current user info
   * @returns {Promise<any>}
   */
  async getUser() {
    throw new Error(`getUser() not implemented for ${this.id}`)
  }

  /**
   * Search for media by query
   * @param {string} query - Search query
   * @param {SearchFilters} filters - Search filters
   * @returns {Promise<Media[]>}
   */
  async search(query, filters = {}) {
    throw new Error(`search() must be implemented by ${this.id}`)
  }

  /**
   * Get media by provider-specific ID
   * @param {string|number} id - Media ID
   * @returns {Promise<Media>}
   */
  async getById(id) {
    throw new Error(`getById() must be implemented by ${this.id}`)
  }

  /**
   * Get trending media
   * @param {string} type - Media type ('anime'|'tv'|'movie')
   * @returns {Promise<Media[]>}
   */
  async getTrending(type) {
    throw new Error(`getTrending() not implemented for ${this.id}`)
  }

  /**
   * Get popular media
   * @param {string} type - Media type
   * @returns {Promise<Media[]>}
   */
  async getPopular(type) {
    throw new Error(`getPopular() not implemented for ${this.id}`)
  }

  /**
   * Get episodes for a series
   * @param {string|number} mediaId - Media ID
   * @param {number} season - Season number (optional)
   * @returns {Promise<Episode[]>}
   */
  async getEpisodes(mediaId, season) {
    throw new Error(`getEpisodes() must be implemented by ${this.id}`)
  }

  /**
   * Get seasons for a series
   * @param {string|number} mediaId - Media ID
   * @returns {Promise<Season[]>}
   */
  async getSeasons(mediaId) {
    throw new Error(`getSeasons() not implemented for ${this.id}`)
  }

  /**
   * Get user's lists
   * @returns {Promise<UserList[]>}
   */
  async getUserLists() {
    throw new Error(`getUserLists() not implemented for ${this.id}`)
  }

  /**
   * Update user progress on media
   * @param {string|number} mediaId - Media ID
   * @param {ProgressUpdate} progress - Progress update
   * @returns {Promise<void>}
   */
  async updateProgress(mediaId, progress) {
    throw new Error(`updateProgress() not implemented for ${this.id}`)
  }
}
