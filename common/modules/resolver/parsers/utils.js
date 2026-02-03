/**
 * Shared utilities and regex patterns for title resolution
 */

/**
 * Regex patterns for parsing different media types
 */
export const PATTERNS = {
  // Anime patterns
  ANIME: {
    // [SubGroup] at start
    subGroup: /^\s*\[([^\]]+)\]/,
    
    // Episode number: 01, 02.5, 01a, etc
    episode: /(\d{1,3})(?:\.(\d))?(?:[a-z])?(?:\s|$|\])/i,
    
    // Version marker: v2, v3, etc
    version: /[vV](\d+)/,
    
    // CRC or other brackets
    brackets: /\[([A-F0-9]{8})\]/,
    
    // Resolution
    resolution: /(\d{3,4})[pi]/i,
  },

  // TV show patterns
  TV: {
    // S01E05, s01e05
    seasonEpisode: /[Ss](\d{1,2})[Ee](\d{1,2})/,
    
    // 1x05, 1x5
    alternateFormat: /(\d{1,2})[xX](\d{1,2})/,
    
    // Season 1 Episode 5 (verbose)
    verbose: /[Ss]eason\s*(\d{1,2}).*[Ee]pisode\s*(\d{1,2})/i,
    
    // Resolution
    resolution: /(\d{3,4})[pi]/i,
    
    // Year in format (2024) or separate
    year: /\((\d{4})\)|\b(\d{4})\b(?=[^\d]|$)/,
  },

  // Movie patterns
  MOVIE: {
    // Year in parentheses
    yearParens: /\((\d{4})\)/,
    
    // Year standalone
    yearStandalone: /(?:^|[\s\.\-_])(\d{4})(?:[\s\.\-_]|$)/,
    
    // Resolution
    resolution: /(\d{3,4})[pi]/i,
    
    // Quality markers
    quality: /BluRay|HDTV|WEB-DL|DVDRip|WEBRIP|H\.?264|H\.?265|HEVC|x264|x265/i,
  },

  // Common patterns
  COMMON: {
    // Resolution
    resolution: /(\d{3,4})[pi]/i,
    
    // File extension
    extension: /\.([^.]+)$/,
    
    // Multiple dots/dashes/underscores
    separators: /[\.\-_]+/g,
    
    // Extra whitespace
    whitespace: /\s+/g,
  }
}

/**
 * Media type probabilities based on patterns
 */
export const PATTERN_SCORES = {
  ANIME: {
    hasSubGroup: 20,
    hasVersion: 15,
    hasEpisode: 20,
    noSeasonEpisode: 15,
    episodeRange: 10,
  },
  
  TV: {
    hasSeasonEpisode: 30,
    hasYear: 10,
    noSubGroup: 10,
    fourDigitEpisode: -20,
  },
  
  MOVIE: {
    hasYear: 40,
    noSeasonEpisode: 30,
    noSubGroup: 10,
    haveQualityMarker: 5,
  }
}

/**
 * Quality tier mappings
 */
export const QUALITY_TIERS = {
  '2160': 'UltraHD',
  '1080': 'FullHD',
  '720': 'HD',
  '480': 'SD',
  '360': 'SD',
}

/**
 * Common anime keywords/patterns
 */
export const ANIME_KEYWORDS = [
  'anime',
  'japanese',
  'subtitled',
  'sub',
  'dub',
  'raw',
  'aac',
  'dvdrip',
  'bluray',
  'bd'
]

/**
 * Common movie/TV keywords
 */
export const TV_KEYWORDS = [
  'season',
  'episode',
  'series',
  'complete',
  'hdtv',
  'web-dl'
]

/**
 * Excluded words that shouldn't be in title
 */
export const EXCLUDED_WORDS = [
  'x264',
  'x265',
  'h264',
  'h265',
  'hevc',
  'aac',
  'mp3',
  'flac',
  'opus',
  '1080p',
  '720p',
  '480p',
  '360p',
  '2160p',
  'bluray',
  'dvdrip',
  'web-dl',
  'hdtv',
  'webrip',
  'proper',
  'repack',
  'internal',
  'sample',
  'proof'
]

/**
 * Helper: Check if string contains anime keywords
 * @param {string} str
 * @returns {number} Count of anime keywords found
 */
export function countAnimeKeywords(str) {
  const lower = str.toLowerCase()
  return ANIME_KEYWORDS.filter(kw => lower.includes(kw)).length
}

/**
 * Helper: Check if string contains TV keywords
 * @param {string} str
 * @returns {number} Count of TV keywords found
 */
export function countTVKeywords(str) {
  const lower = str.toLowerCase()
  return TV_KEYWORDS.filter(kw => lower.includes(kw)).length
}

/**
 * Helper: Remove excluded words from string
 * @param {string} str
 * @returns {string}
 */
export function removeExcludedWords(str) {
  let result = str
  for (const word of EXCLUDED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(regex, '')
  }
  return result.replace(/\s+/g, ' ').trim()
}

/**
 * Helper: Is valid year
 * @param {number} year
 * @returns {boolean}
 */
export function isValidYear(year) {
  return year && year >= 1890 && year <= 2100
}

/**
 * Helper: Is valid episode number
 * @param {number} episode
 * @returns {boolean}
 */
export function isValidEpisode(episode) {
  return episode && episode > 0 && episode <= 10000
}

/**
 * Helper: Is valid season number
 * @param {number} season
 * @returns {boolean}
 */
export function isValidSeason(season) {
  return season && season > 0 && season <= 100
}
