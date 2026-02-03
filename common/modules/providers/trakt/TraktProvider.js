// @ts-check
/**
 * Trakt Provider
 * TV show and movie tracking with Trakt.tv
 *
 * @typedef {import('../types.js').MediaProvider} MediaProvider
 * @typedef {import('../types.js').Media} Media
 * @typedef {import('../types.js').Episode} Episode
 * @typedef {import('../types.js').SearchFilters} SearchFilters
 * @typedef {import('../types.js').ProgressUpdate} ProgressUpdate
 */

import BaseProvider from '../BaseProvider.js'
import TraktMapper from './mapper.js'
import config from '../config.js'

const TRAKT_BASE_URL = 'https://api.trakt.tv'
const TRAKT_API_VERSION = '2'

export default class TraktProvider extends BaseProvider {
  constructor(cfg = {}) {
    super({
      id: 'trakt',
      name: 'Trakt.tv',
      mediaTypes: ['tv', 'movie'],
      ...cfg
    })
    
    this.clientId = cfg.clientId || config.traktClientId
    this.accessToken = cfg.accessToken || config.traktAccessToken
    
    if (!this.clientId) {
      throw new Error('Trakt provider requires clientId in config or TRAKT_CLIENT_ID in .env')
    }
    
    this.mapper = new TraktMapper()
    this.baseUrl = TRAKT_BASE_URL
  }

  /**
   * Make authenticated request to Trakt API
   * @private
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @returns {Promise<any>}
   */
  async _request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': TRAKT_API_VERSION,
      'trakt-api-key': this.clientId
    }

    // Only add auth header if we have a valid access token (not placeholder)
    if (this.accessToken && !this.accessToken.includes('your_')) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    })

    if (!response.ok) {
      throw new Error(`Trakt API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Check if authenticated (has access token)
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    return !!this.accessToken
  }

  /**
   * Search for shows and movies
   * @param {string} query - Search query
   * @param {SearchFilters} filters - Search filters
   * @returns {Promise<Media[]>}
   */
  async search(query, filters = {}) {
    try {
      const mediaType = filters.type === 'movie' ? 'movie' : 'show'
      const data = await this._request(`/search/${mediaType}?query=${encodeURIComponent(query)}`, {
        method: 'GET'
      })

      return (data || [])
        .slice(0, filters.limit || 10)
        .map(item => this.mapper.map(item[mediaType], mediaType))
    } catch (error) {
      throw new Error(`Trakt search failed: ${error.message}`)
    }
  }

  /**
   * Get media by Trakt ID or slug
   * @param {string|number} id - Trakt ID or slug
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Media>}
   */
  async getById(id, mediaType = 'show') {
    try {
      const type = mediaType === 'movie' ? 'movie' : 'show'
      const data = await this._request(`/${type}s/${id}`, {
        method: 'GET'
      })

      return this.mapper.map(data, type)
    } catch (error) {
      throw new Error(`Trakt getById failed: ${error.message}`)
    }
  }

  /**
   * Get trending media
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Media[]>}
   */
  async getTrending(mediaType) {
    try {
      const type = mediaType === 'movie' ? 'movies' : 'shows'
      const data = await this._request(`/${type}/trending`)

      return (data || [])
        .slice(0, 10)
        .map(item => this.mapper.map(item[mediaType === 'movie' ? 'movie' : 'show'], mediaType))
    } catch (error) {
      throw new Error(`Trakt getTrending failed: ${error.message}`)
    }
  }

  /**
   * Get user's lists (requires authentication)
   * @returns {Promise<any[]>}
   */
  async getUserLists() {
    if (!this.accessToken) {
      throw new Error('getUserLists requires authentication')
    }

    try {
      const data = await this._request('/users/me/lists')
      return data || []
    } catch (error) {
      throw new Error(`Trakt getUserLists failed: ${error.message}`)
    }
  }

  /**
   * Get episodes for a TV show
   * @param {string|number} mediaId - Trakt show ID
   * @param {number} season - Season number
   * @returns {Promise<Episode[]>}
   */
  async getEpisodes(mediaId, season = 1) {
    try {
      const data = await this._request(`/shows/${mediaId}/seasons/${season}`)

      return (data || []).map(ep => ({
        number: ep.number,
        season: ep.season,
        title: ep.title,
        aired: ep.first_aired,
        runtime: null,  // Trakt doesn't provide per-episode runtime
        description: ep.overview
      }))
    } catch (error) {
      throw new Error(`Trakt getEpisodes failed: ${error.message}`)
    }
  }

  /**
   * Update user progress (requires authentication)
   * @param {string|number} mediaId - Trakt media ID
   * @param {ProgressUpdate} progress - Progress update
   * @returns {Promise<void>}
   */
  async updateProgress(mediaId, progress) {
    if (!this.accessToken) {
      throw new Error('updateProgress requires authentication')
    }

    try {
      const payload = {
        progress: progress.progress,
        status: (progress.status || 'watching').toLowerCase()
      }

      await this._request('/sync/watchlist', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    } catch (error) {
      throw new Error(`Trakt updateProgress failed: ${error.message}`)
    }
  }
}
