// @ts-check
/**
 * MediaResolver - Adapter wrapper around TitleResolver
 * Provides backward-compatible API with AnimeResolver while supporting multi-media types
 * 
 * @typedef {import('./types.js').ParsedFilename} ParsedFilename
 * @typedef {import('./types.js').ResolverResult} ResolverResult
 */

import TitleResolver from './index.js'

/**
 * MediaResolver - Unified media resolution for anime, TV shows, and movies
 */
export class MediaResolver {
    constructor() {
        this.resolver = TitleResolver
    }

    /**
     * Resolve media files to metadata (replaces AnimeResolver.resolveFileAnime)
     * 
     * @param {string | string[]} fileName - Single filename or array of filenames
     * @returns {Promise<Array<{
     *   media: Object,
     *   episode: number,
     *   season?: number,
     *   parseObject: ParsedFilename,
     *   mediaType: 'anime' | 'tv' | 'movie',
     *   provider: 'anilist' | 'tmdb',
     *   failed: boolean
     * }>>}
     */
    async resolveFileMedia(fileName) {
        const fileNames = Array.isArray(fileName) ? fileName : [fileName]
        const results = []

        for (const file of fileNames) {
            try {
                const result = await this.resolver.resolve(file)

                // Convert TitleResolver result to legacy format
                const converted = {
                    media: result.media || null,
                    episode: result.parsed.episode || (result.parsed.mediaType === 'movie' ? 1 : null),
                    season: result.parsed.season,
                    parseObject: {
                        ...result.parsed,
                        // Map to legacy field names for compatibility
                        anime_title: result.parsed.title,
                        media_title: result.parsed.title,
                        anime_year: result.parsed.year,
                        episode_number: result.parsed.episode,
                        season_number: result.parsed.season,
                        anime_season: result.parsed.season,
                        video_resolution: result.parsed.resolution,
                        file_name: this.cleanFileName(file),
                    },
                    mediaType: result.parsed.mediaType,
                    provider: (result.provider === 'anilist' || result.provider === 'tmdb') ? result.provider : 'anilist',
                    failed: Boolean(result.userPromptRequired || !result.media),
                }

                results.push(converted)
            } catch (error) {
                console.error(`[MediaResolver] Failed to resolve ${file}:`, error)
                results.push({
                    media: null,
                    episode: null,
                    season: null,
                    parseObject: {
                        file_name: this.cleanFileName(file),
                        anime_title: file,
                        media_title: file,
                    },
                    mediaType: 'anime', // Default fallback
                    provider: 'unknown',
                    failed: true,
                })
            }
        }

        return results
    }

    /**
     * Clean filename (maintains AnimeResolver.cleanFileName compatibility)
     * 
     * @param {string | string[]} fileName
     * @returns {string | string[]}
     */
    cleanFileName(fileName) {
        if (Array.isArray(fileName)) {
            return fileName.map(f => this._cleanSingleFile(f))
        }
        return this._cleanSingleFile(fileName)
    }

    /**
     * Clean a single filename
     * @param {string} fileName
     * @returns {string}
     * @private
     */
    _cleanSingleFile(fileName) {
        // Remove path if present
        const baseName = fileName.split('/').pop().split('\\').pop()

        // Remove file extension
        const withoutExt = baseName.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|mpeg|mpg|3gp|ogg|ogv)$/i, '')

        // Replace dots/underscores with spaces
        let cleaned = withoutExt.replace(/[._]/g, ' ')

        // Remove brackets and their contents (except at start for subgroups)
        cleaned = cleaned.replace(/\[[^\]]*\]/g, '')
        cleaned = cleaned.replace(/\([^)]*\)/g, '')

        // Remove extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim()

        return cleaned
    }

    /**
     * Find and cache title (maintains AnimeResolver compatibility)
     * Used for title-only searches without full resolution
     * 
     * @param {string | string[]} fileName
     * @param {boolean} findAnime - Whether to search for anime (ignored, kept for compatibility)
     * @returns {Promise<ParsedFilename[]>}
     */
    async findAndCacheTitle(fileName, findAnime = true) {
        const fileNames = Array.isArray(fileName) ? fileName : [fileName]
        const parseObjects = []

        for (const file of fileNames) {
            try {
                const result = await this.resolver.resolve(file)
                parseObjects.push(result.parsed)
            } catch (error) {
                console.error(`[MediaResolver] Failed to parse ${file}:`, error)
                parseObjects.push({
                    mediaType: 'unknown',
                    title: this.cleanFileName(file),
                    file_name: this.cleanFileName(file),
                    confidence: 0,
                    rawFilename: file,
                })
            }
        }

        return parseObjects
    }
}

// Export singleton instance (maintains AnimeResolver pattern)
export default new MediaResolver()
