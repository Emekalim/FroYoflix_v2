// @ts-check
/**
 * TMDB Provider
 * Movies and TV shows from The Movie Database
 *
 * @typedef {import('../types.js').MediaProvider} MediaProvider
 * @typedef {import('../types.js').Media} Media
 * @typedef {import('../types.js').Episode} Episode
 * @typedef {import('../types.js').SearchFilters} SearchFilters
 */

import BaseProvider from '../BaseProvider.js'
import TMDBMapper from './mapper.js'
import config from '../config.js'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

export default class TMDBProvider extends BaseProvider {
  constructor(cfg = {}) {
    super({
      id: 'tmdb',
      name: 'The Movie Database',
      mediaTypes: ['movie', 'tv'],
      ...cfg
    })
    
    this.apiKey = cfg.apiKey || config.tmdbApiKey
    if (!this.apiKey) {
      throw new Error('TMDB provider requires apiKey in config or TMDB_API_KEY in .env')
    }
    
    this.mapper = new TMDBMapper()
    this.baseUrl = TMDB_BASE_URL
  }

  /**
   * Make authenticated request to TMDB API
   * @private
   * @param {string} endpoint - API endpoint
   * @param {object} params - Query parameters
   * @returns {Promise<any>}
   */
  async _request(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    url.searchParams.append('api_key', this.apiKey)
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value)
      }
    })

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  /**
   * Check if authenticated (TMDB doesn't require auth, just API key)
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    return !!this.apiKey
  }

  /**
   * Search for movies and TV shows
   * @param {string} query - Search query
   * @param {SearchFilters} filters - Search filters
   * @returns {Promise<Media[]>}
   */
  async search(query, filters = {}) {
    try {
      const mediaType = filters.type === 'tv' ? 'tv' : 'movie'
      const data = await this._request(`/search/${mediaType}`, {
        query: query,
        page: 1,
        year: filters.year
      })

      return (data.results || [])
        .slice(0, filters.limit || 20)
        .map(item => this.mapper.map(item, mediaType))
    } catch (error) {
      throw new Error(`TMDB search failed: ${error.message}`)
    }
  }

  /**
   * Get media by TMDB ID
   * @param {string|number} id - TMDB media ID
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Media>}
   */
  async getById(id, mediaType = 'movie') {
    try {
      const type = mediaType === 'tv' ? 'tv' : 'movie'
      const data = await this._request(`/${type}/${id}`, {
        append_to_response: 'external_ids'
      })

      return this.mapper.map(data, type)
    } catch (error) {
      throw new Error(`TMDB getById failed: ${error.message}`)
    }
  }

  /**
   * Get trending media
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Media[]>}
   */
  async getTrending(mediaType) {
    try {
      const type = mediaType === 'tv' ? 'tv' : 'movie'
      const data = await this._request(`/trending/${type}/week`)

      return (data.results || [])
        .map(item => this.mapper.map(item, type))
    } catch (error) {
      throw new Error(`TMDB getTrending failed: ${error.message}`)
    }
  }

  /**
   * Get popular media
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Media[]>}
   */
  async getPopular(mediaType) {
    try {
      const type = mediaType === 'tv' ? 'tv' : 'movie'
      const data = await this._request(`/${type}/popular`)

      return (data.results || [])
        .map(item => this.mapper.map(item, type))
    } catch (error) {
      throw new Error(`TMDB getPopular failed: ${error.message}`)
    }
  }

  /**
   * Get episodes for a series
   * @param {string|number} mediaId - TMDB TV show ID
   * @param {number} season - Season number
   * @returns {Promise<Episode[]>}
   */
  async getEpisodes(mediaId, season = 1) {
    try {
      const data = await this._request(`/tv/${mediaId}/season/${season}`)

      return (data.episodes || []).map(ep => ({
        number: ep.episode_number,
        season: ep.season_number,
        title: ep.name,
        aired: ep.air_date,
        runtime: ep.runtime,
        description: ep.overview
      }))
    } catch (error) {
      throw new Error(`TMDB getEpisodes failed: ${error.message}`)
    }
  }

  /**
   * Get all seasons for a series
   * @param {string|number} mediaId - TMDB TV show ID
   * @returns {Promise<any[]>}
   */
  async getSeasons(mediaId) {
    try {
      const data = await this._request(`/tv/${mediaId}`)

      return (data.seasons || []).map(season => ({
        number: season.season_number,
        title: season.name,
        episodeCount: season.episode_count,
        aired: season.air_date,
        poster: season.poster_path ? `https://image.tmdb.org/t/p/w342${season.poster_path}` : null
      }))
    } catch (error) {
      throw new Error(`TMDB getSeasons failed: ${error.message}`)
    }
  }
}
