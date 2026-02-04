// @ts-check
/**
 * TMDB Module - Main exports
 */

export { default as TMDBProgress } from './tmdb-progress.js'
export { default as TMDBAPI } from './tmdb-api.js'

// Re-export commonly used functions
export {
    getProgress,
    setProgress,
    deleteProgress,
    getAllProgress,
    getByStatus,
    toggleFavorite
} from './tmdb-progress.js'

export {
    fetchRecommendations,
    fetchExternalIds,
    getTMDBUrl,
    getIMDbUrl
} from './tmdb-api.js'
