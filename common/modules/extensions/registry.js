/**
 * Extension Registry & Routing System
 * 
 * Manages the complete lifecycle of extensions:
 * - Discovery and loading from filesystem
 * - Routing queries to appropriate extensions based on mediaType
 * - ID-based filtering (extensions only see IDs they support)
 * - Parallel execution and result aggregation
 * 
 * Phase 4: Extension System Update
 * Last Updated: February 2, 2026
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  adaptLegacyQuery,
  filterQueryForExtension,
  wrapLegacyExtension,
  validateSourceConfig
} from './compatibility.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Global registry of loaded extensions
 * Map<extensionId, wrappedExtension>
 */
const extensionRegistry = new Map()

/**
 * Cache of loaded manifests
 * Map<extensionId, SourceConfig>
 */
const manifestCache = new Map()

/**
 * Load all extensions from a directory
 * 
 * Scans for extension folders, loads index.js, reads manifests,
 * validates, and registers each extension.
 * 
 * @param {string} extensionsDir - Path to extensions directory (default: ./sources)
 * @returns {Promise<Object>} - { loaded: [], failed: [] }
 */
export async function loadExtensions(extensionsDir = null) {
  if (!extensionsDir) {
    extensionsDir = path.join(__dirname, '..', '..', 'SourceExtensions', 'shiru', 'sources')
  }

  const result = {
    loaded: [],
    failed: []
  }

  // Check if directory exists
  if (!fs.existsSync(extensionsDir)) {
    console.warn(`Extensions directory not found: ${extensionsDir}`)
    return result
  }

  // Read all folders
  const entries = fs.readdirSync(extensionsDir)

  for (const entry of entries) {
    const entryPath = path.join(extensionsDir, entry)
    const stat = fs.statSync(entryPath)

    // Skip non-directories and special files
    if (!stat.isDirectory() || entry.startsWith('.')) {
      continue
    }

    try {
      // Try to load extension from index.js
      const indexPath = path.join(entryPath, 'index.js')
      if (!fs.existsSync(indexPath)) {
        result.failed.push({
          id: entry,
          error: 'No index.js found'
        })
        continue
      }

      // Import extension module
      const module = await import(`file://${indexPath}`)
      let extension = module.default || module

      // Handle case where export is a class instance
      if (extension && typeof extension.single !== 'function') {
        console.warn(`Extension ${entry} doesn't export search methods`)
        result.failed.push({
          id: entry,
          error: 'Missing search methods (single, batch, movie)'
        })
        continue
      }

      // Load and merge manifest
      const manifestPath = path.join(entryPath, 'extension.json')
      let manifest = null

      if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8')
        manifest = JSON.parse(manifestContent)
      } else if (extension.config) {
        manifest = extension.config
      }

      // Build config with defaults
      const config = buildExtensionConfig(entry, manifest)

      // Validate config
      const validation = validateSourceConfig(config)
      if (!validation.valid) {
        result.failed.push({
          id: entry,
          error: `Invalid config: ${validation.errors.join(', ')}`
        })
        continue
      }

      // Wrap extension to ensure it has new interface
      const wrapped = {
        config,
        single: extension.single,
        batch: extension.batch,
        movie: extension.movie,
        validate: extension.validate
      }

      // Register extension
      extensionRegistry.set(config.id, wrapped)
      manifestCache.set(config.id, config)

      result.loaded.push({
        id: config.id,
        name: config.name,
        version: config.version,
        mediaTypes: config.mediaTypes
      })

      console.log(`✓ Loaded extension: ${config.name} (${config.mediaTypes.join(', ')})`)
    } catch (error) {
      result.failed.push({
        id: entry,
        error: error.message
      })
      console.warn(`✗ Failed to load extension ${entry}:`, error.message)
    }
  }

  return result
}

/**
 * Build extension config with defaults
 * 
 * @param {string} extensionId - Extension folder name
 * @param {Object} manifest - Manifest data (may be null)
 * @returns {Object} - Complete SourceConfig with defaults
 */
function buildExtensionConfig(extensionId, manifest = null) {
  return {
    id: manifest?.id || extensionId,
    name: manifest?.name || extensionId,
    version: manifest?.version || '1.0.0',
    description: manifest?.description || '',
    mediaTypes: manifest?.mediaTypes || ['anime'],
    supportedIds: manifest?.supportedIds || ['anilist', 'anidb', 'mal'],
    nsfw: manifest?.nsfw || false,
    speed: manifest?.speed || 'moderate',
    accuracy: manifest?.accuracy || 'medium',
    features: manifest?.features || {}
  }
}

/**
 * Get extensions that support a specific media type
 * 
 * @param {string} mediaType - 'anime' | 'tv' | 'movie'
 * @returns {Array<Object>} - Array of extensions
 */
export function getExtensionsForMediaType(mediaType) {
  return Array.from(extensionRegistry.values()).filter(ext => {
    // Include if explicitly supports type, or if anime type and default is anime
    return ext.config.mediaTypes.includes(mediaType)
  })
}

/**
 * Get extensions that support a specific ID type
 * 
 * @param {string} idType - 'anilist' | 'mal' | 'imdb' | 'tmdb' | etc.
 * @returns {Array<Object>} - Array of extensions
 */
export function getExtensionsForIdType(idType) {
  return Array.from(extensionRegistry.values()).filter(ext => {
    return ext.config.supportedIds.includes(idType)
  })
}

/**
 * Get a single extension by ID
 * 
 * @param {string} extensionId - Extension ID
 * @returns {Object|null} - Extension or null if not found
 */
export function getExtension(extensionId) {
  return extensionRegistry.get(extensionId) || null
}

/**
 * Get all loaded extensions
 * 
 * @returns {Array<Object>} - All extensions
 */
export function getAllExtensions() {
  return Array.from(extensionRegistry.values())
}

/**
 * Query all appropriate extensions for a media type
 * 
 * Routes the query to extensions that:
 * 1. Support the mediaType
 * 2. Support at least one ID in the query
 * 
 * Filters each extension to only receive IDs it supports.
 * Executes searches in parallel, handles errors gracefully.
 * 
 * @param {Object} query - TorrentQuery object
 * @returns {Promise<Array>} - Array of { extensionId, results, ok, error }
 */
export async function queryExtensions(query) {
  // Adapt legacy query format
  const adaptedQuery = adaptLegacyQuery(query)

  // Determine media type
  const mediaType = adaptedQuery.mediaType || 'anime'

  // Find extensions that support this media type
  const appropriateExts = getExtensionsForMediaType(mediaType)

  if (appropriateExts.length === 0) {
    console.warn(`No extensions found for media type: ${mediaType}`)
    return []
  }

  // Query each extension in parallel
  const promises = appropriateExts.map(async (extension) => {
    try {
      // Filter query to only include IDs extension supports
      const filteredQuery = filterQueryForExtension(adaptedQuery, extension)

      // Determine which search method to call
      let searchMethod = 'single'
      if (adaptedQuery.season && extension.config.features?.supportsSeasonSpecific) {
        searchMethod = 'batch'
      } else if (mediaType === 'movie') {
        searchMethod = 'movie'
      }

      // Call extension search
      const searchFn = extension[searchMethod]
      if (!searchFn) {
        return {
          extensionId: extension.config.id,
          results: [],
          ok: false,
          error: `Missing method: ${searchMethod}`
        }
      }

      const results = await searchFn.call(extension, filteredQuery)

      return {
        extensionId: extension.config.id,
        extensionName: extension.config.name,
        results: results || [],
        ok: true
      }
    } catch (error) {
      return {
        extensionId: extension.config.id,
        extensionName: extension.config.name,
        results: [],
        ok: false,
        error: error.message
      }
    }
  })

  // Wait for all searches to complete
  const allResults = await Promise.allSettled(promises)

  return allResults.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        extensionId: appropriateExts[idx].config.id,
        extensionName: appropriateExts[idx].config.name,
        results: [],
        ok: false,
        error: result.reason?.message || 'Unknown error'
      }
    }
  })
}

/**
 * Get statistics about loaded extensions
 * 
 * @returns {Object} - Stats including counts by type, ID support, etc.
 */
export function getExtensionStats() {
  const extensions = getAllExtensions()

  const stats = {
    total: extensions.length,
    byMediaType: {
      anime: 0,
      tv: 0,
      movie: 0
    },
    byIdType: {},
    nsfw: 0,
    speeds: {},
    accuracies: {}
  }

  extensions.forEach(ext => {
    // Count by media type
    ext.config.mediaTypes.forEach(type => {
      stats.byMediaType[type]++
    })

    // Count by ID type
    ext.config.supportedIds.forEach(idType => {
      stats.byIdType[idType] = (stats.byIdType[idType] || 0) + 1
    })

    // Count NSFW
    if (ext.config.nsfw) {
      stats.nsfw++
    }

    // Count by speed/accuracy
    stats.speeds[ext.config.speed] = (stats.speeds[ext.config.speed] || 0) + 1
    stats.accuracies[ext.config.accuracy] = (stats.accuracies[ext.config.accuracy] || 0) + 1
  })

  return stats
}

/**
 * Validate all loaded extensions
 * 
 * Calls validate() on each extension to ensure they're functional
 * 
 * @returns {Promise<Object>} - { ok: [], failed: [] }
 */
export async function validateAllExtensions() {
  const extensions = getAllExtensions()

  const results = {
    ok: [],
    failed: []
  }

  const promises = extensions.map(async (ext) => {
    try {
      const isValid = await ext.validate()
      return {
        id: ext.config.id,
        name: ext.config.name,
        valid: isValid
      }
    } catch (error) {
      return {
        id: ext.config.id,
        name: ext.config.name,
        valid: false,
        error: error.message
      }
    }
  })

  const allResults = await Promise.allSettled(promises)

  allResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      if (result.value.valid) {
        results.ok.push(result.value)
      } else {
        results.failed.push(result.value)
      }
    }
  })

  return results
}

/**
 * Clear all loaded extensions
 * Useful for reloading or testing
 */
export function clearRegistry() {
  extensionRegistry.clear()
  manifestCache.clear()
}

export default {
  loadExtensions,
  getExtensionsForMediaType,
  getExtensionsForIdType,
  getExtension,
  getAllExtensions,
  queryExtensions,
  getExtensionStats,
  validateAllExtensions,
  clearRegistry
}
