/**
 * Phase 3: Title Resolution System Types
 * Type definitions for filename parsing and media resolution
 */

/**
 * Parsed filename data extracted from a media file
 */
export interface ParsedFilename {
  // Core metadata
  mediaType: 'anime' | 'tv' | 'movie'
  title: string
  year?: number                        // For movies and recent TV
  
  // Episode information (TV/anime)
  season?: number                      // For TV shows
  episode?: number                     // Episode number (1-13 or 1-52 for anime)
  episodeCount?: number                // Inferred from episode number or [SubGroup] patterns
  
  // Resolution and quality
  resolution?: string                  // '1080p', '720p', '480p', etc
  
  // Anime specific
  subGroup?: string                    // [SubGroup] from anime names
  version?: number                     // v2, v3 for anime rereleases
  
  // Metadata
  confidence: number                   // 0-100 confidence score
  rawFilename: string                  // Original filename
  reasons?: string[]                   // Debug: why this classification
}

/**
 * Provider search result
 */
export interface Media {
  id: string | number
  title: string
  mediaType: 'anime' | 'tv' | 'movie'
  description?: string
  status?: string
  releaseDate?: Date
  episodeCount?: number
  seasonCount?: number
  rating?: number
  poster?: string
  banner?: string
}

/**
 * Final resolver result
 */
export interface ResolverResult {
  parsed: ParsedFilename           // Parsed filename data
  media?: Media                    // Found media (if matched)
  provider: string                 // 'anilist', 'tmdb', 'mal'
  matchScore: number               // 0-100 match confidence
  error?: string                   // Error message if resolution failed
}

/**
 * Parser interface - all parsers must implement
 */
export interface IParser {
  filename: string
  basename: string
  parse(): ParsedFilename | null
  getConfidence(): number
}

/**
 * Matcher interface - all matchers must implement
 */
export interface IMatcher {
  match(parsed: ParsedFilename): Promise<Media | null>
  calculateScore(parsed: ParsedFilename, result: Media): number
}
