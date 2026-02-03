// @ts-check
/**
 * Provider Registry & Factory
 * Central hub for managing all media providers
 *
 * @typedef {import('./types.js').MediaProvider} MediaProvider
 * @typedef {import('./types.js').Media} Media
 * @typedef {import('./types.js').SearchFilters} SearchFilters
 */

import BaseProvider from './BaseProvider.js'
import AniListProvider from './anilist/AniListProvider.js'
import MALProvider from './mal/MALProvider.js'
import TMDBProvider from './tmdb/TMDBProvider.js'
import TraktProvider from './trakt/TraktProvider.js'

/**
 * Registry of available providers
 * Maps provider IDs to their class constructors
 * @type {Object<string, typeof AniListProvider>}
 */
const PROVIDERS = {
  anilist: AniListProvider,
  mal: MALProvider,
  tmdb: TMDBProvider,
  trakt: TraktProvider
}

/**
 * Cache for provider instances
 * @type {Map<string, BaseProvider>}
 */
const providerInstances = new Map()

/**
 * Get or create provider instance
 * @param {string} providerId - 'anilist' | 'mal' | 'tmdb' | 'trakt'
 * @param {object} config - Provider configuration
 * @returns {MediaProvider}
 * @throws {Error} If provider not found
 */
export function getProvider(providerId, config = {}) {
  const cacheKey = `${providerId}:${JSON.stringify(config)}`

  if (providerInstances.has(cacheKey)) {
    return providerInstances.get(cacheKey)
  }

  const ProviderClass = PROVIDERS[providerId]
  if (!ProviderClass) {
    throw new Error(`Unknown provider: ${providerId}`)
  }

  const instance = new ProviderClass(config)
  providerInstances.set(cacheKey, instance)
  return instance
}

/**
 * Get all available providers for a media type
 * @param {string} mediaType - 'anime' | 'tv' | 'movie'
 * @returns {string[]} Provider IDs
 */
export function getProvidersForMediaType(mediaType) {
  return Object.entries(PROVIDERS)
    .filter(([_, ProviderClass]) => {
      const instance = new ProviderClass()
      return instance.mediaTypes.includes(mediaType)
    })
    .map(([id, _]) => id)
}

/**
 * Register a new provider (for third-party or dynamic providers)
 * @param {string} id - Provider ID
 * @param {typeof AniListProvider} ProviderClass - Provider class constructor
 */
export function registerProvider(id, ProviderClass) {
  PROVIDERS[id] = ProviderClass
}

/**
 * Search across multiple providers with fallback
 * Tries providers in order until one returns results
 * @param {string} query - Search query
 * @param {'anime' | 'tv' | 'movie'} mediaType - Media type
 * @param {string[]} providerIds - Provider priority list
 * @returns {Promise<{provider: string, results: Media[]}>}
 */
export async function searchMultiple(query, mediaType, providerIds = []) {
  const providers = providerIds.length
    ? providerIds
    : getProvidersForMediaType(mediaType)

  for (const providerId of providers) {
    try {
      const provider = getProvider(providerId)
      const results = await provider.search(query, { type: mediaType, limit: 10 })
      if (results.length > 0) {
        return { provider: providerId, results }
      }
    } catch (error) {
      console.warn(`Provider ${providerId} search failed:`, error.message)
      continue
    }
  }

  return { provider: null, results: [] }
}

/**
 * Clear all cached provider instances
 */
export function clearCache() {
  providerInstances.clear()
}

/**
 * Get all registered providers
 * @returns {string[]} Provider IDs
 */
export function getAllProviders() {
  return Object.keys(PROVIDERS)
}

export default {
  getProvider,
  getProvidersForMediaType,
  registerProvider,
  searchMultiple,
  clearCache,
  getAllProviders
}
