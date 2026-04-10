/**
 * Extension System Type Definitions
 * Defines interfaces for query building, extension development, and compatibility
 * 
 * Last Updated: February 2, 2026
 * Phase 4: Extension System Update
 */

// ============================================================================
// MEDIA TYPE ENUMS
// ============================================================================

export type MediaType = 'anime' | 'tv' | 'movie'
export type IdType = 'anilist' | 'mal' | 'anidb' | 'imdb' | 'tmdb' | 'tvdb' | 'trakt'

// ============================================================================
// MEDIA IDENTIFIERS
// ============================================================================

/**
 * Media identifiers from multiple providers
 * Extensions can declare which ID types they support via SourceConfig.supportedIds
 */
export interface MediaIds {
  /**
   * AniList ID - for anime content
   * Range: 1-999999
   */
  anilist?: number

  /**
   * MyAnimeList ID - for anime content
   * Range: 1-999999
   */
  mal?: number

  /**
   * AniDB ID - for anime content
   * Range: 1-999999
   */
  anidb?: number

  /**
   * IMDB ID - for movies, TV shows
   * Format: tt + 7-8 digits (e.g., tt1234567)
   */
  imdb?: string

  /**
   * TMDB ID - for movies, TV shows
   * Range: 1-999999
   */
  tmdb?: number

  /**
   * TVDB ID - for TV shows
   * Range: 1-999999
   */
  tvdb?: number

  /**
   * Trakt ID - for TV shows, movies
   * Range: 1-999999
   */
  trakt?: number

  /**
   * Trakt slug - URL-friendly identifier
   * Example: 'breaking-bad', 'the-office'
   */
  slug?: string
}

// ============================================================================
// TORRENT QUERY - EXTENDED & BACKWARD COMPATIBLE
// ============================================================================

/**
 * TorrentQuery - sent to extensions for searching
 * 
 * BACKWARD COMPATIBILITY NOTE:
 * All new fields are optional. Old anime-only queries still work via adapter.
 * Legacy fields (anilist, anidb, mal) are supported but DEPRECATED.
 * Use ids.anilist, ids.mal, ids.anidb instead.
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Anime query (backward compatible - old format):
 * {
 *   titles: ['Attack on Titan'],
 *   anilist: 16498,
 *   episode: 5
 * }
 * 
 * 2. Anime query (new format):
 * {
 *   mediaType: 'anime',
 *   ids: {
 *     anilist: 16498,
 *     anidb: 1234
 *   },
 *   titles: ['Attack on Titan', '進撃の巨人'],
 *   episode: 5,
 *   episodeCount: 94
 * }
 * 
 * 3. TV show query:
 * {
 *   mediaType: 'tv',
 *   ids: {
 *     tmdb: 1396,
 *     tvdb: 81189,
 *     imdb: 'tt0903747'
 *   },
 *   titles: ['Breaking Bad'],
 *   season: 1,
 *   episode: 5,
 *   resolution: '1080'
 * }
 * 
 * 4. Movie query:
 * {
 *   mediaType: 'movie',
 *   ids: {
 *     imdb: 'tt1375666',
 *     tmdb: 27205
 *   },
 *   titles: ['Inception'],
 *   year: 2010,
 *   resolution: '1080'
 * }
 */
export interface TorrentQuery {
  // ========================================================================
  // NEW FIELDS - Multi-media support
  // ========================================================================

  /**
   * Media type - what kind of content to search for
   * DEFAULT: 'anime' (for backward compatibility)
   * 
   * Extensions should check this field and:
   * - Only process queries for types they support (declared in SourceConfig.mediaTypes)
   * - Return empty array [] if type not supported
   */
  mediaType?: MediaType

  /**
   * Unified media identifiers
   * Extensions filter to only IDs they support (declared in SourceConfig.supportedIds)
   * 
   * Adapter automatically filters IDs per extension capability
   */
  ids?: Partial<MediaIds>

  /**
   * Release/broadcast year
   * Useful for disambiguation when multiple media have same title
   * Primarily for movies and TV shows
   * 
   * Examples:
   * - Movie: 2010 (for Inception)
   * - TV: 2008 (for Breaking Bad start year)
   * - Anime: 2013 (for Attack on Titan)
   */
  year?: number

  /**
   * TV show specific: season number
   * Used with episode field to target specific S##E## releases
   * 
   * Example: season: 1, episode: 5 = S01E05
   * 
   * NOT USED for anime (anime has single season concept)
   */
  season?: number

  /**
   * Quality/resolution preference
   * Extensions should prefer higher resolutions if available
   * 
   * Examples: '2160', '1080', '720', '480', ''
   * Empty string means no preference
   */
  resolution?: '2160' | '1080' | '720' | '540' | '480' | ''

  /**
   * Terms/keywords to exclude from results
   * Helps filter out unwanted quality/format variations
   * 
   * Examples:
   * - ['x264', 'hardsubbed', 'dubbed'] - exclude low quality, hardsubbed, or dubbed
   * - ['CAM', 'SCREENER'] - exclude low quality source types
   * - ['5.1', 'DTS'] - exclude specific audio formats
   * 
   * Extensions should filter results if they support exclusions
   * (check SourceConfig.features.supportsExclusions)
   */
  exclusions?: string[]

  // ========================================================================
  // EXISTING FIELDS - Kept for compatibility
  // ========================================================================

  /**
   * Search titles - always provided
   * Array of possible titles in different languages/formats
   * 
   * Examples:
   * - Anime: ['Attack on Titan', '進撃の巨人', 'Shingeki no Kyojin']
   * - TV: ['Breaking Bad', 'Breaking.Bad']
   * - Movie: ['Inception', 'Inception (2010)']
   * 
   * Extensions should try all titles and return best matches
   */
  titles: string[]

  /**
   * Episode number (anime/TV)
   * For anime: 1-12 typically per season
   * For TV: absolute episode number across all seasons, OR specific with season field
   * 
   * Examples:
   * - Anime: 5 (for 5th episode)
   * - TV with season: season=1, episode=5 (S01E05)
   * - TV without season: episode=5 (5th episode total)
   */
  episode?: number

  /**
   * Total episode count (for validation)
   * Useful for checking if requested episode exists in this media
   * 
   * Examples:
   * - Anime: 12, 13, 24 (typical anime episode counts)
   * - TV: 62 (Breaking Bad total episodes)
   * - Movie: undefined (movies have no episodes)
   */
  episodeCount?: number

  // ========================================================================
  // DEPRECATED FIELDS - For backward compatibility only
  // Use ids.anilist, ids.mal, ids.anidb instead
  // ========================================================================

  /**
   * @deprecated Use ids.anilist instead
   * AniList ID for anime content
   * Kept for compatibility with old extensions
   * Adapter automatically converts to ids.anilist
   */
  anilist?: number

  /**
   * @deprecated Use ids.anidb instead
   * AniDB ID for anime content
   * Kept for compatibility with old extensions
   * Adapter automatically converts to ids.anidb
   */
  anidb?: number

  /**
   * @deprecated Use ids.mal instead
   * MyAnimeList ID for anime content
   * Kept for compatibility with old extensions
   * Adapter automatically converts to ids.mal
   */
  mal?: number

  /**
   * @deprecated Use ids.anidb instead
   * AniDB episode ID - legacy anime field
   * Kept for compatibility
   */
  anidbEid?: number

  /**
   * @deprecated Use ids.anidb instead
   * AniDB aid - legacy anime field
   * Kept for compatibility
   */
  anidbAid?: number
}

// ============================================================================
// TORRENT RESULT - WHAT EXTENSIONS RETURN
// ============================================================================

export interface TorrentResult {
  /**
   * Display title of the torrent
   * Example: '[HorribleSubs] Attack on Titan - 01 [720p].mkv'
   */
  title: string

  /**
   * Playable torrent identifier
   * Must be a magnet URI, raw hash, or direct .torrent URL
   * This is the field the client should use for download/play actions
   */
  uri: string

  /**
   * Source link retained for metadata/reference use
   * Example: 'magnet:?xt=urn:btih:...'
   */
  link: string

  /**
   * Torrent hash (for deduplication)
   * Extracted from magnet link btih parameter
   * Example: 'A1B2C3D4E5F6...'
   */
  hash: string

  /**
   * Number of active seeders
   * Indicates health of torrent
   */
  seeders: number

  /**
   * Number of active leechers
   * Indicates popularity
   */
  leechers: number

  /**
   * Total downloads (lifetime)
   * Indicates how popular/trusted torrent is
   */
  downloads: number

  /**
   * File size in bytes
   * Use for quality estimation
   * Example: 1073741824 = 1GB
   */
  size: number

  /**
   * Upload/release date
   * ISO 8601 string or Date object
   */
  date: Date | string

  /**
   * Confidence in match accuracy
   * - 'high': Title matches exactly, correct episode
   * - 'medium': Title similar, episode likely correct
   * - 'low': Guess, may need verification
   */
  accuracy?: 'high' | 'medium' | 'low'

  /**
   * Type of torrent package
   * - 'batch': Multiple episodes in one release
   * - 'best': Single episode, best quality/source
   * - 'alt': Alternative source/quality
   */
  type?: 'batch' | 'best' | 'alt'
}

// ============================================================================
// SOURCE CONFIGURATION - EXTENSION METADATA
// ============================================================================

/**
 * Configuration/metadata for a torrent source extension
 * Used by registry to route queries appropriately
 */
export interface SourceConfig {
  /**
   * Unique identifier for extension
   * Used in logs, settings, registry lookups
   * Example: 'nyaa-si', '1337x', 'rarbg'
   */
  id: string

  /**
   * Display name shown to users
   * Example: 'Nyaa.si', '1337x', 'RARBG'
   */
  name: string

  /**
   * Semantic version of extension
   * Example: '1.0.0', '2.1.0'
   */
  version: string

  /**
   * Media types this extension supports
   * DEFAULT: ['anime'] for backward compatibility
   * 
   * Examples:
   * - Anime-only: ['anime']
   * - General torrent: ['anime', 'tv', 'movie']
   * - TV/Movie only: ['tv', 'movie']
   * 
   * Registry only routes queries to extensions that support the mediaType
   */
  mediaTypes: MediaType[]

  /**
   * ID types this extension can use for searching
   * DEFAULT: ['anilist', 'anidb', 'mal'] for backward compatibility
   * 
   * Examples:
   * - Anime extension: ['anilist', 'anidb', 'mal']
   * - General extension: ['anilist', 'imdb', 'tmdb', 'tvdb']
   * - IMDB-based: ['imdb', 'tmdb']
   * 
   * Adapter filters ids object to only send supported types
   */
  supportedIds: IdType[]

  /**
   * Content warnings
   * true = extension includes NSFW content
   * Users can filter out NSFW sources in settings
   */
  nsfw?: boolean

  /**
   * Relative speed of searches
   * 'fast': responds < 1 second
   * 'moderate': 1-5 seconds
   * 'slow': > 5 seconds
   */
  speed?: 'fast' | 'moderate' | 'slow'

  /**
   * Match accuracy of results
   * 'high': Matches are usually correct
   * 'medium': ~70% accuracy
   * 'low': Many false positives
   */
  accuracy?: 'high' | 'medium' | 'low'

  /**
   * Optional features the extension supports
   * Used to enable advanced search filters in UI
   */
  features?: {
    /**
     * Extension respects resolution parameter
     * If false, extension ignores resolution field
     */
    supportsQualityFilter?: boolean

    /**
     * Extension respects exclusions parameter
     * If false, extension ignores exclusions field
     */
    supportsExclusions?: boolean

    /**
     * Extension can target specific TV seasons (S##E##)
     * If false, extension ignores season parameter
     */
    supportsSeasonSpecific?: boolean
  }
}

// ============================================================================
// EXTENSION INTERFACE - WHAT EXTENSIONS IMPLEMENT
// ============================================================================

export type SearchFunction = (query: TorrentQuery) => Promise<TorrentResult[]>

/**
 * Extension interface - contract for torrent source implementations
 * All extensions must implement these methods
 */
export interface Extension {
  /**
   * Configuration/metadata about this extension
   */
  config: SourceConfig

  /**
   * Search for single episode/movie
   * Called for individual episode lookups
   * 
   * @param query - Search parameters
   * @returns Array of matching torrents, or empty array if none found
   */
  single: SearchFunction

  /**
   * Search for batch releases (multiple episodes)
   * Called for season-wide or collection searches
   * 
   * @param query - Search parameters (may include season info)
   * @returns Array of batch torrents, or empty array if none found
   */
  batch: SearchFunction

  /**
   * Search for movies
   * Called for movie content searches
   * 
   * @param query - Search parameters with mediaType='movie'
   * @returns Array of movie torrents, or empty array if none found
   */
  movie: SearchFunction

  /**
   * Validate that extension is functional
   * Called during initialization to test API availability
   * 
   * @returns true if extension works, false otherwise
   */
  validate(): Promise<boolean>
}

// ============================================================================
// BACKWARD COMPATIBILITY HELPERS
// ============================================================================

/**
 * Helper to convert old anime-only query to new format
 * Used internally by adapter
 */
export interface LegacyQuery {
  anilistId?: number
  anidbAid?: number
  anidbEid?: number
  titles: string[]
  episode?: number
  episodeCount?: number
  resolution?: string
  exclusions?: string[]
}

/**
 * Helper to track which IDs were filtered
 * For debugging why certain extensions didn't return results
 */
export interface QueryFilterResult {
  original: TorrentQuery
  filtered: TorrentQuery
  supportedIds: IdType[]
  removedIds: (keyof MediaIds)[]
}

// ============================================================================
// COMPATIBILITY LAYER - BACKWARD COMPATIBILITY HELPERS
// ============================================================================

/**
 * Compatibility layer functions for handling legacy extensions and queries
 */
export namespace Compatibility {
  /**
   * Converts old anime-only query to new TorrentQuery format
   * @param query - Old format query with anilist, anidb fields
   * @returns New format TorrentQuery with mediaType and ids
   */
  export function adaptLegacyQuery(query: any): TorrentQuery

  /**
   * Filters query to only include IDs the extension supports
   * @param query - Full query with all IDs
   * @param extension - Extension with supportedIds declaration
   * @returns Filtered query with only relevant IDs
   */
  export function filterQueryForExtension(query: TorrentQuery, extension: Extension): TorrentQuery

  /**
   * Wraps old anime-only extension to provide new interface
   * @param oldExtension - Legacy extension implementation
   * @returns Wrapped extension compatible with new system
   */
  export function wrapLegacyExtension(oldExtension: any): Extension

  /**
   * Validates query has required fields
   * @param query - Query to validate
   * @returns true if valid
   */
  export function isValidQuery(query: any): boolean

  /**
   * Validates extension has required interface
   * @param extension - Extension to validate
   * @returns true if has all methods
   */
  export function isValidExtension(extension: any): boolean

  /**
   * Validates SourceConfig manifest structure
   * @param config - Config to validate
   * @returns { valid: boolean, errors: string[] }
   */
  export function validateSourceConfig(config: any): { valid: boolean; errors: string[] }
}

// ============================================================================
// EXTENSION REGISTRY - LOADING AND ROUTING
// ============================================================================

/**
 * Query result from a single extension
 */
export interface ExtensionQueryResult {
  extensionId: string
  extensionName?: string
  results: TorrentResult[]
  ok: boolean
  error?: string
}

/**
 * Extension loading result
 */
export interface ExtensionLoadResult {
  id: string
  name?: string
  version?: string
  mediaTypes?: MediaType[]
  error?: string
}

/**
 * Extension registry and routing functions
 */
export namespace Registry {
  /**
   * Load all extensions from a directory
   * @param extensionsDir - Path to extensions directory (optional)
   * @returns { loaded: [], failed: [] }
   */
  export function loadExtensions(extensionsDir?: string): Promise<{
    loaded: ExtensionLoadResult[]
    failed: ExtensionLoadResult[]
  }>

  /**
   * Get extensions that support a media type
   * @param mediaType - 'anime' | 'tv' | 'movie'
   * @returns Array of extensions
   */
  export function getExtensionsForMediaType(mediaType: MediaType): Extension[]

  /**
   * Get extensions that support an ID type
   * @param idType - 'anilist' | 'imdb' | 'tmdb' | etc.
   * @returns Array of extensions
   */
  export function getExtensionsForIdType(idType: IdType): Extension[]

  /**
   * Get a single extension by ID
   * @param extensionId - Extension ID
   * @returns Extension or null
   */
  export function getExtension(extensionId: string): Extension | null

  /**
   * Get all loaded extensions
   * @returns Array of all extensions
   */
  export function getAllExtensions(): Extension[]

  /**
   * Query all appropriate extensions for results
   * Routes to extensions supporting mediaType, filters IDs, executes in parallel
   * @param query - TorrentQuery object
   * @returns Array of results from each extension
   */
  export function queryExtensions(query: TorrentQuery): Promise<ExtensionQueryResult[]>

  /**
   * Get statistics about loaded extensions
   * @returns Stats including counts by type, ID support, etc.
   */
  export function getExtensionStats(): {
    total: number
    byMediaType: Record<MediaType, number>
    byIdType: Record<IdType, number>
    nsfw: number
    speeds: Record<string, number>
    accuracies: Record<string, number>
  }

  /**
   * Validate all loaded extensions are functional
   * @returns { ok: [], failed: [] }
   */
  export function validateAllExtensions(): Promise<{
    ok: Array<{ id: string; name: string }>
    failed: Array<{ id: string; name: string; error?: string }>
  }>

  /**
   * Clear registry (useful for testing/reloading)
   */
  export function clearRegistry(): void
}
