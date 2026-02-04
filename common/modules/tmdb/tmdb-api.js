// @ts-check
/**
 * TMDB API Integration Module
 * Handles TMDB API calls for recommendations, external IDs, and metadata
 */

import { getConfig } from '../providers/config.js'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

/**
 * Get TMDB API key from environment
 * @returns {string}
 */
function getApiKey() {
    return getConfig('TMDB_API_KEY', '')
}

/**
 * Check if cached data is still valid
 * @param {number} timestamp - Cache timestamp
 * @returns {boolean}
 */
function isCacheValid(timestamp) {
    return Date.now() - timestamp < CACHE_DURATION
}

/**
 * Get from localStorage cache
 * @param {string} key - Cache key
 * @returns {any | null}
 */
function getFromCache(key) {
    try {
        const cached = localStorage.getItem(key)
        if (!cached) return null

        const { data, timestamp } = JSON.parse(cached)
        if (!isCacheValid(timestamp)) {
            localStorage.removeItem(key)
            return null
        }

        return data
    } catch (error) {
        console.error('[TMDB Cache] Error reading cache:', error)
        return null
    }
}

/**
 * Save to localStorage cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
function saveToCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }))
    } catch (error) {
        console.error('[TMDB Cache] Error saving cache:', error)
    }
}

/**
 * Make TMDB API request
 * @param {string} endpoint - API endpoint
 * @param {Object} [params] - Query parameters
 * @returns {Promise<any>}
 */
async function tmdbRequest(endpoint, params = {}) {
    const apiKey = getApiKey()
    if (!apiKey) {
        console.warn('[TMDB API] No API key configured')
        return null
    }

    try {
        const url = new URL(`${TMDB_BASE_URL}${endpoint}`)
        url.searchParams.append('api_key', apiKey)

        // Add additional parameters
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, String(value))
        })

        const response = await fetch(url.toString())
        if (!response.ok) {
            console.error(`[TMDB API] Request failed: ${response.status} ${response.statusText}`)
            return null
        }

        return await response.json()
    } catch (error) {
        console.error('[TMDB API] Request error:', error)
        return null
    }
}

/**
 * Fetch recommendations for a TMDB item
 * @param {number} tmdbId - TMDB ID
 * @param {string} mediaType - 'tv' | 'movie'
 * @returns {Promise<Array>}
 */
export async function fetchRecommendations(tmdbId, mediaType) {
    const cacheKey = `tmdb_rec_${mediaType}_${tmdbId}`

    // Check cache first
    const cached = getFromCache(cacheKey)
    if (cached) {
        console.log('[TMDB API] Using cached recommendations')
        return cached
    }

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie'
    const data = await tmdbRequest(`/${endpoint}/${tmdbId}/recommendations`)

    if (!data || !data.results) {
        return []
    }

    // Transform to consistent format
    const recommendations = data.results.slice(0, 20).map(item => ({
        tmdbId: item.id,
        title: item.name || item.title,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        overview: item.overview,
        voteAverage: item.vote_average,
        releaseDate: item.first_air_date || item.release_date,
        mediaType: mediaType
    }))

    // Cache the results
    saveToCache(cacheKey, recommendations)

    return recommendations
}

/**
 * Fetch external IDs for a TMDB item
 * @param {number} tmdbId - TMDB ID
 * @param {string} mediaType - 'tv' | 'movie'
 * @returns {Promise<Object | null>}
 */
export async function fetchExternalIds(tmdbId, mediaType) {
    const cacheKey = `tmdb_ext_${mediaType}_${tmdbId}`

    // Check cache first
    const cached = getFromCache(cacheKey)
    if (cached) {
        console.log('[TMDB API] Using cached external IDs')
        return cached
    }

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie'
    const data = await tmdbRequest(`/${endpoint}/${tmdbId}/external_ids`)

    if (!data) {
        return null
    }

    const externalIds = {
        imdbId: data.imdb_id || null,
        tvdbId: data.tvdb_id || null,
        facebookId: data.facebook_id || null,
        instagramId: data.instagram_id || null,
        twitterId: data.twitter_id || null
    }

    // Cache the results
    saveToCache(cacheKey, externalIds)

    return externalIds
}

/**
 * Fetch credits (cast & crew) for a TMDB item
 * @param {number} tmdbId - TMDB ID
 * @param {string} mediaType - 'tv' | 'movie'
 * @returns {Promise<Object | null>}
 */
export async function fetchCredits(tmdbId, mediaType) {
    const cacheKey = `tmdb_credits_${mediaType}_${tmdbId}`

    // Check cache first
    const cached = getFromCache(cacheKey)
    if (cached) {
        console.log('[TMDB API] Using cached credits')
        return cached
    }

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie'
    const data = await tmdbRequest(`/${endpoint}/${tmdbId}/credits`)

    if (!data) {
        return null
    }

    const credits = {
        cast: (data.cast || []).slice(0, 10).map(person => ({
            id: person.id,
            name: person.name,
            character: person.character,
            profilePath: person.profile_path
        })),
        crew: (data.crew || []).filter(person =>
            ['Director', 'Producer', 'Writer'].includes(person.job)
        ).map(person => ({
            id: person.id,
            name: person.name,
            job: person.job,
            profilePath: person.profile_path
        }))
    }

    // Cache the results
    saveToCache(cacheKey, credits)

    return credits
}

/**
 * Search TMDB for content
 * @param {string} query - Search query
 * @param {string} mediaType - 'tv' | 'movie' | 'multi'
 * @returns {Promise<Array>}
 */
export async function searchTMDB(query, mediaType = 'multi') {
    if (!query) return []

    const endpoint = mediaType === 'multi' ? '/search/multi' : `/search/${mediaType}`
    const data = await tmdbRequest(endpoint, { query })

    if (!data || !data.results) {
        return []
    }

    return data.results.map(item => ({
        tmdbId: item.id,
        title: item.name || item.title,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        overview: item.overview,
        voteAverage: item.vote_average,
        releaseDate: item.first_air_date || item.release_date,
        mediaType: item.media_type || mediaType
    }))
}

/**
 * Get TMDB URL for an item
 * @param {number} tmdbId - TMDB ID
 * @param {string} mediaType - 'tv' | 'movie'
 * @returns {string}
 */
export function getTMDBUrl(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie'
    return `https://www.themoviedb.org/${type}/${tmdbId}`
}

/**
 * Get IMDb URL from ID
 * @param {string} imdbId - IMDb ID
 * @returns {string}
 */
export function getIMDbUrl(imdbId) {
    return `https://www.imdb.com/title/${imdbId}`
}

/**
 * Clear all TMDB caches
 */
export function clearTMDBCache() {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
        if (key.startsWith('tmdb_')) {
            localStorage.removeItem(key)
        }
    })
    console.log('[TMDB Cache] Cleared all TMDB caches')
}

// Export default object with all functions
export default {
    fetchRecommendations,
    fetchExternalIds,
    fetchCredits,
    searchTMDB,
    getTMDBUrl,
    getIMDbUrl,
    clearTMDBCache
}
