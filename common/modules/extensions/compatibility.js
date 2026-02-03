/**
 * Backward Compatibility Layer for Extension System
 * 
 * Provides adapters to automatically convert old anime-only queries and extensions
 * to work seamlessly with the new multi-media Phase 4 system.
 * 
 * Phase 4: Extension System Update
 * Last Updated: February 2, 2026
 */

/**
 * Converts old anime-only query format to new TorrentQuery format
 * 
 * This adapter ensures that old code sending queries like:
 * { titles: ['Anime'], anilist: 16498, episode: 5 }
 * 
 * Automatically gets converted to:
 * { mediaType: 'anime', ids: { anilist: 16498 }, titles: [...], episode: 5 }
 * 
 * @param {Object} query - Old or new format query
 * @returns {Object} - New format TorrentQuery
 */
export function adaptLegacyQuery(query) {
  // If already in new format with mediaType, return as-is
  if (query.mediaType !== undefined) {
    return query
  }

  // Build new format query
  const adapted = {
    mediaType: 'anime', // Default to anime for backward compatibility
    ids: {},
    titles: query.titles || [],
    episode: query.episode,
    episodeCount: query.episodeCount,
    resolution: query.resolution,
    exclusions: query.exclusions
  }

  // Convert legacy ID fields to new ids object
  if (query.anilist !== undefined || query.anilistId !== undefined) {
    adapted.ids.anilist = query.anilist || query.anilistId
  }
  if (query.anidb !== undefined || query.anidbAid !== undefined) {
    adapted.ids.anidb = query.anidb || query.anidbAid
  }
  if (query.anidbEid !== undefined) {
    adapted.ids.anidb = query.anidbEid
  }
  if (query.mal !== undefined) {
    adapted.ids.mal = query.mal
  }

  // Clean up undefined values
  Object.keys(adapted).forEach(key => {
    if (adapted[key] === undefined) {
      delete adapted[key]
    }
  })

  return adapted
}

/**
 * Filters query to only include IDs that extension supports
 * 
 * Removes IDs the extension can't use, preventing unnecessary data transfer
 * and focusing search on relevant providers.
 * 
 * Example:
 * - Query has: { ids: { anilist: 123, tmdb: 456, imdb: 'tt789' } }
 * - Extension supports: ['anilist', 'anidb']
 * - Filtered query: { ids: { anilist: 123 } }
 * 
 * @param {Object} query - TorrentQuery object
 * @param {Object} extension - Extension with config.supportedIds
 * @returns {Object} - Filtered query
 */
export function filterQueryForExtension(query, extension) {
  // If extension has no supportedIds, assume old extension - only send anime IDs
  if (!extension.config || !extension.config.supportedIds) {
    return {
      ...query,
      ids: {
        anilist: query.ids?.anilist,
        anidb: query.ids?.anidb,
        mal: query.ids?.mal
      }
    }
  }

  // New-style extension - filter to supported IDs
  const supportedIds = extension.config.supportedIds || []
  const filtered = {}

  supportedIds.forEach(idType => {
    if (query.ids?.[idType] !== undefined) {
      filtered[idType] = query.ids[idType]
    }
  })

  return {
    ...query,
    ids: filtered
  }
}

/**
 * Wraps an old anime-only extension to provide new interface
 * 
 * This allows old extensions that only understand anilist/episode/titles
 * to work transparently with the new system that sends mediaType/ids/season.
 * 
 * @param {Object} oldExtension - Legacy extension implementation
 * @returns {Object} - Wrapped extension compatible with new system
 */
export function wrapLegacyExtension(oldExtension) {
  // Ensure config exists
  const config = oldExtension.config || {}

  return {
    config: {
      ...config,
      // Provide defaults for new fields
      mediaTypes: config.mediaTypes || ['anime'],
      supportedIds: config.supportedIds || ['anilist', 'anidb', 'mal'],
      nsfw: config.nsfw || false,
      speed: config.speed || 'moderate',
      accuracy: config.accuracy || 'medium'
    },

    // Wrap each search method to adapt queries
    single: async (query) => {
      const adapted = adaptQueryForLegacyExtension(query, oldExtension)
      return oldExtension.single?.(adapted) || []
    },

    batch: async (query) => {
      const adapted = adaptQueryForLegacyExtension(query, oldExtension)
      return oldExtension.batch?.(adapted) || []
    },

    movie: async (query) => {
      const adapted = adaptQueryForLegacyExtension(query, oldExtension)
      return oldExtension.movie?.(adapted) || []
    },

    validate: async () => {
      return oldExtension.validate?.() || false
    }
  }
}

/**
 * Adapts new query format to old format for legacy extensions
 * 
 * Converts: { mediaType: 'anime', ids: { anilist: 123 }, titles: [...], episode: 5 }
 * To:       { anilist: 123, titles: [...], episode: 5 }
 * 
 * @param {Object} newQuery - New format TorrentQuery
 * @param {Object} extension - Extension being called
 * @returns {Object} - Old format query
 */
function adaptQueryForLegacyExtension(newQuery, extension) {
  // If extension declares it's new-style, pass query as-is
  if (extension.config?.supportedIds) {
    // But filter to supported IDs
    const filtered = filterQueryForExtension(newQuery, extension)
    // Convert back to old format for actual call
    return convertToOldFormat(filtered)
  }

  // Old-style extension - convert to old format
  return convertToOldFormat(newQuery)
}

/**
 * Converts new TorrentQuery format to old anime-only format
 * 
 * @param {Object} query - New format query
 * @returns {Object} - Old format query
 */
function convertToOldFormat(query) {
  const oldFormat = {
    titles: query.titles || [],
    episode: query.episode,
    episodeCount: query.episodeCount,
    resolution: query.resolution,
    exclusions: query.exclusions
  }

  // Convert new ids object to legacy fields
  if (query.ids?.anilist) {
    oldFormat.anilist = query.ids.anilist
    oldFormat.anilistId = query.ids.anilist
  }
  if (query.ids?.anidb) {
    oldFormat.anidb = query.ids.anidb
    oldFormat.anidbAid = query.ids.anidb
  }
  if (query.ids?.mal) {
    oldFormat.mal = query.ids.mal
  }

  // Clean up undefined values
  Object.keys(oldFormat).forEach(key => {
    if (oldFormat[key] === undefined) {
      delete oldFormat[key]
    }
  })

  return oldFormat
}

/**
 * Validates that a query has required fields
 * 
 * @param {Object} query - Query to validate
 * @returns {boolean} - True if valid
 */
export function isValidQuery(query) {
  return (
    query &&
    typeof query === 'object' &&
    Array.isArray(query.titles) &&
    query.titles.length > 0
  )
}

/**
 * Validates that an extension has required interface
 * 
 * @param {Object} extension - Extension to validate
 * @returns {boolean} - True if has required methods
 */
export function isValidExtension(extension) {
  return (
    extension &&
    typeof extension.single === 'function' &&
    typeof extension.batch === 'function' &&
    typeof extension.movie === 'function' &&
    typeof extension.validate === 'function'
  )
}

/**
 * Validates SourceConfig manifest structure
 * 
 * @param {Object} config - Config to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateSourceConfig(config) {
  const errors = []

  if (!config) {
    return { valid: false, errors: ['Config is null or undefined'] }
  }

  if (!config.id || typeof config.id !== 'string') {
    errors.push('Missing or invalid id field')
  }

  if (!config.name || typeof config.name !== 'string') {
    errors.push('Missing or invalid name field')
  }

  if (!config.version || typeof config.version !== 'string') {
    errors.push('Missing or invalid version field')
  }

  if (!Array.isArray(config.mediaTypes) || config.mediaTypes.length === 0) {
    errors.push('Missing or empty mediaTypes array')
  }

  if (!Array.isArray(config.supportedIds) || config.supportedIds.length === 0) {
    errors.push('Missing or empty supportedIds array')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  adaptLegacyQuery,
  filterQueryForExtension,
  wrapLegacyExtension,
  isValidQuery,
  isValidExtension,
  validateSourceConfig
}
