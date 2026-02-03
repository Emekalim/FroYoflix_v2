/**
 * @file mediaType.js
 * @description Manages the current media type selection (Anime | TV | Movie)
 * 
 * This module provides a reactive store that tracks which media type the user is currently
 * viewing/searching. The selection persists across app restarts via the cache system.
 * 
 * @example
 * import { mediaType } from '@/modules/mediaType.js'
 * 
 * // Subscribe to media type changes
 * mediaType.subscribe(type => console.log(`Switched to ${type}`))
 * 
 * // Change media type
 * mediaType.set('tv')
 * 
 * // Get current value
 * console.log($mediaType)  // In Svelte components: 'tv'
 */

import { writable } from 'simple-store-svelte'
import { cache, caches } from './cache.js'

/**
 * Reactive store for current media type selection.
 * 
 * @type {import('simple-store-svelte').WritableStore<'anime' | 'tv' | 'movie'>}
 * 
 * @property {'anime' | 'tv' | 'movie'} value - The current media type
 * 
 * Persists to GENERAL cache under key 'mediaType'
 * Default value is 'anime' for backward compatibility
 */
const stored = cache.getEntry(caches.GENERAL, 'mediaType')
export const mediaType = writable(stored || 'anime')

/**
 * Subscribe to media type changes and persist to cache
 * This ensures the user's selection is saved across app restarts
 * Wrapped in try-catch to prevent store initialization loops
 */
let initialized = false
mediaType.subscribe(value => {
  // Skip the initial subscription to avoid persisting before app fully loads
  if (!initialized) {
    initialized = true
    return
  }
  try {
    cache.setEntry(caches.GENERAL, 'mediaType', value)
  } catch (error) {
    console.error('[mediaType] Failed to persist media type:', error)
  }
})

/**
 * List of valid media types for validation
 * @type {Array<'anime' | 'tv' | 'movie'>}
 */
export const MEDIA_TYPES = Object.freeze(['anime', 'tv', 'movie'])

/**
 * Checks if a value is a valid media type
 * 
 * @param {*} value - Value to validate
 * @returns {boolean} True if value is a valid media type
 * 
 * @example
 * isValidMediaType('tv')     // true
 * isValidMediaType('movie')  // true
 * isValidMediaType('manga')  // false
 */
export function isValidMediaType(value) {
  return MEDIA_TYPES.includes(value)
}

/**
 * Sets the media type with validation
 * 
 * @param {'anime' | 'tv' | 'movie'} value - The media type to set
 * @throws {Error} If value is not a valid media type
 * 
 * @example
 * setMediaType('movie')  // OK
 * setMediaType('manga')  // Throws error
 */
export function setMediaType(value) {
  if (!isValidMediaType(value)) {
    throw new Error(`Invalid media type: ${value}. Must be one of: ${MEDIA_TYPES.join(', ')}`)
  }
  mediaType.set(value)
}

/**
 * Gets the current media type (synchronous)
 * Useful for non-Svelte contexts where you can't use reactive stores
 * 
 * @returns {'anime' | 'tv' | 'movie'} The current media type
 * 
 * @example
 * const type = getMediaType()
 * console.log(type)  // 'tv'
 */
export function getMediaType() {
  return mediaType.value
}
