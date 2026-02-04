// @ts-check
/**
 * TMDB Progress Tracking Module
 * Local IndexedDB storage for TMDB watch progress, ratings, and status
 */

const DB_NAME = 'FroYoflixTMDB'
const DB_VERSION = 1
const STORE_NAME = 'progress'

/** @type {IDBDatabase | null} */
let db = null

/**
 * Initialize IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function initDB() {
    if (db) return db

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
            db = request.result
            resolve(db)
        }

        request.onupgradeneeded = (event) => {
            const database = event.target.result

            // Create object store if it doesn't exist
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'tmdbId' })

                // Create indexes for efficient querying
                objectStore.createIndex('status', 'status', { unique: false })
                objectStore.createIndex('mediaType', 'mediaType', { unique: false })
                objectStore.createIndex('updatedAt', 'updatedAt', { unique: false })
                objectStore.createIndex('isFavorite', 'isFavorite', { unique: false })
            }
        }
    })
}

/**
 * Get progress for a specific TMDB item
 * @param {number} tmdbId - TMDB ID
 * @returns {Promise<Object | null>}
 */
export async function getProgress(tmdbId) {
    const database = await initDB()

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly')
        const objectStore = transaction.objectStore(STORE_NAME)
        const request = objectStore.get(tmdbId)

        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
    })
}

/**
 * Set/update progress for a TMDB item
 * @param {number} tmdbId - TMDB ID
 * @param {Object} data - Progress data
 * @param {string} data.mediaType - 'tv' | 'movie'
 * @param {string} data.title - Media title
 * @param {string} [data.status] - 'PLANNING' | 'CURRENT' | 'COMPLETED' | 'DROPPED' | 'PAUSED'
 * @param {number} [data.progress] - Last watched episode (0 for movies)
 * @param {number} [data.score] - User rating 0-10
 * @param {boolean} [data.isFavorite] - Favorite status
 * @returns {Promise<void>}
 */
export async function setProgress(tmdbId, data) {
    const database = await initDB()

    // Get existing data to merge with updates
    const existing = await getProgress(tmdbId)

    const now = Date.now()
    const progressData = {
        tmdbId,
        mediaType: data.mediaType,
        title: data.title,
        status: data.status || existing?.status || 'PLANNING',
        progress: data.progress !== undefined ? data.progress : (existing?.progress || 0),
        score: data.score !== undefined ? data.score : (existing?.score || 0),
        isFavorite: data.isFavorite !== undefined ? data.isFavorite : (existing?.isFavorite || false),
        updatedAt: now,
        createdAt: existing?.createdAt || now
    }

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite')
        const objectStore = transaction.objectStore(STORE_NAME)
        const request = objectStore.put(progressData)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
    })
}

/**
 * Delete progress for a TMDB item
 * @param {number} tmdbId - TMDB ID
 * @returns {Promise<void>}
 */
export async function deleteProgress(tmdbId) {
    const database = await initDB()

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite')
        const objectStore = transaction.objectStore(STORE_NAME)
        const request = objectStore.delete(tmdbId)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
    })
}

/**
 * Get all progress entries
 * @returns {Promise<Array>}
 */
export async function getAllProgress() {
    const database = await initDB()

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly')
        const objectStore = transaction.objectStore(STORE_NAME)
        const request = objectStore.getAll()

        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
    })
}

/**
 * Get progress entries by status
 * @param {string} status - Status to filter by
 * @returns {Promise<Array>}
 */
export async function getByStatus(status) {
    const database = await initDB()

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly')
        const objectStore = transaction.objectStore(STORE_NAME)
        const index = objectStore.index('status')
        const request = index.getAll(status)

        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
    })
}

/**
 * Get progress entries by media type
 * @param {string} mediaType - 'tv' | 'movie'
 * @returns {Promise<Array>}
 */
export async function getByMediaType(mediaType) {
    const database = await initDB()

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly')
        const objectStore = transaction.objectStore(STORE_NAME)
        const index = objectStore.index('mediaType')
        const request = index.getAll(mediaType)

        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
    })
}

/**
 * Get all favorites
 * @returns {Promise<Array>}
 */
export async function getFavorites() {
    const database = await initDB()

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly')
        const objectStore = transaction.objectStore(STORE_NAME)
        const index = objectStore.index('isFavorite')
        const request = index.getAll(true)

        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
    })
}

/**
 * Toggle favorite status
 * @param {number} tmdbId - TMDB ID
 * @returns {Promise<boolean>} New favorite status
 */
export async function toggleFavorite(tmdbId) {
    const existing = await getProgress(tmdbId)
    if (!existing) {
        throw new Error(`No progress found for TMDB ID: ${tmdbId}`)
    }

    const newStatus = !existing.isFavorite
    await setProgress(tmdbId, {
        ...existing,
        isFavorite: newStatus
    })

    return newStatus
}

/**
 * Clear all progress data (use with caution)
 * @returns {Promise<void>}
 */
export async function clearAllProgress() {
    const database = await initDB()

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite')
        const objectStore = transaction.objectStore(STORE_NAME)
        const request = objectStore.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
    })
}

// Export default object with all functions
export default {
    initDB,
    getProgress,
    setProgress,
    deleteProgress,
    getAllProgress,
    getByStatus,
    getByMediaType,
    getFavorites,
    toggleFavorite,
    clearAllProgress
}
