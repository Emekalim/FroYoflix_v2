// @ts-check
/**
 * MovieParser - Detects movies from filename patterns
 * 
 * Patterns:
 * - Inception.2010.1080p.mkv
 * - Movie Title (2024) 1080p.mkv
 * - Title.2024.BluRay.mkv
 * - No Year Movie.mkv (weak match)
 * 
 * @typedef {import('../types.js').ParsedFilename} ParsedFilename
 */

import BaseParser from './BaseParser.js'
import {
  PATTERNS,
  PATTERN_SCORES,
  QUALITY_TIERS,
} from './utils.js'

/**
 * MovieParser - Identifies movie files and extracts metadata
 */
export default class MovieParser extends BaseParser {
  /**
   * Parse movie filename
   * @returns {ParsedFilename|null}
   */
  parse() {
    const parsed = {
      mediaType: 'movie',
      rawFilename: this.filename,
      title: null,
      year: null,
      resolution: null,
      quality: null,
      confidence: 0,
      reasons: [],
    }

    // Step 1: Extract year (primary movie indicator)
    const yearData = this.extractYear()
    if (yearData) {
      parsed.year = yearData
      this.addReason(parsed, `Found year: ${parsed.year}`)
    } else {
      this.addReason(parsed, 'No year found - weak movie signal')
    }

    // Step 2: Extract resolution
    const resMatch = this.match(this.basename, PATTERNS.MOVIE.resolution)
    if (resMatch) {
      const res = this.parseNumber(resMatch[1])
      parsed.resolution = QUALITY_TIERS[res.toString()] || 'Unknown'
      this.addReason(parsed, `Found resolution: ${res}p`)
    }

    // Step 3: Extract quality markers (BluRay, HDTV, etc.)
    const qualityMatch = this.match(this.basename, PATTERNS.MOVIE.quality)
    if (qualityMatch) {
      parsed.quality = qualityMatch[0]
      this.addReason(parsed, `Found quality marker: ${parsed.quality}`)
    }

    // Step 4: Extract title
    let titleText = this.basename

    // Remove year patterns
    titleText = titleText.replace(PATTERNS.MOVIE.yearParens, '')
    titleText = titleText.replace(PATTERNS.MOVIE.yearStandalone, '')

    // Remove resolution and brackets
    titleText = titleText.replace(/\[[^\]]*\]/g, '')
    titleText = titleText.replace(PATTERNS.MOVIE.resolution, '')

    // Remove quality markers
    titleText = titleText.replace(PATTERNS.MOVIE.quality, '')

    // Clean up and extract title
    titleText = this.cleanTitle(titleText)

    // Remove technical terms that might be left over
    // e.g. "Tenet x264 AAC5 1" -> "Tenet"
    const techTerms = [
      // Codecs
      /\b(x264|x265|h264|h265|hevc|avc|divx|xvid)\b/gi,
      // Audio - catch AAC/AC3 followed by potential version numbers
      /\b(aac[\d\.]*|ac3|dts|dd5\.1|5\.1|7\.1|mp3|flac|wav|dual audio)\b/gi,
      // Qualities
      /\b(bluray|web-dl|webrip|hdtv|bdrip|brrip|dvdrip|cam|ts|tc|scr)\b/gi,
      // Release groups/junk
      /\b(yify|yts|eztv|rarbg|psa|evo|hon3y)\b/gi,
      // Brackets again just in case
      /\[.*?\]/g,
      /\(.*?\)/g,
      // Trailing numbers that look like disk/part numbers
      /\b(cd|disk|disc|part|pt)\s*\d+\b/gi
    ]

    for (const regex of techTerms) {
      titleText = titleText.replace(regex, '')
    }

    // Final trim
    titleText = this.cleanTitle(titleText)

    if (titleText && titleText.length > 2) {
      parsed.title = titleText
      this.addReason(parsed, `Extracted title: ${parsed.title}`)
    }

    // Step 5: Calculate confidence score
    parsed.confidence = this.calculateConfidence(parsed)

    // Final validation: need at least a title
    if (!parsed.title || parsed.confidence < 30) {
      this.addReason(parsed, `Low confidence (${parsed.confidence}), rejected`)
      return null
    }

    return parsed
  }

  /**
   * Extract year from filename
   * Tries parentheses first (2024), then standalone
   * @returns {number|null}
   */
  extractYear() {
    // Pattern 1: (2024)
    const parensMatch = this.match(this.basename, PATTERNS.MOVIE.yearParens)
    if (parensMatch) {
      const year = this.parseNumber(parensMatch[1])
      if (this.isValidMovieYear(year)) {
        return year
      }
    }

    // Pattern 2: Standalone year with word boundaries
    const standaloneMatch = this.match(this.basename, PATTERNS.MOVIE.yearStandalone)
    if (standaloneMatch) {
      const year = this.parseNumber(standaloneMatch[1] || standaloneMatch[2])
      if (this.isValidMovieYear(year)) {
        return year
      }
    }

    return null
  }

  /**
   * Check if year is valid for movies
   * @param {number} year
   * @returns {boolean}
   */
  isValidMovieYear(year) {
    return year && year >= 1890 && year <= 2100
  }

  /**
   * Calculate confidence score based on detected patterns
   * @param {ParsedFilename} parsed
   * @returns {number}
   */
  calculateConfidence(parsed) {
    let score = 0

    // Strong indicator: has year
    if (parsed.year) {
      score += PATTERN_SCORES.MOVIE.hasYear  // 40 points
      this.addReason(parsed, 'Strong: has year')
    } else {
      score += 5  // Weak without year
    }

    // Strong indicator: no season/episode pattern
    if (!this.basename.match(PATTERNS.TV.seasonEpisode) &&
      !this.basename.match(PATTERNS.TV.alternateFormat)) {
      score += PATTERN_SCORES.MOVIE.noSeasonEpisode  // 30 points
      this.addReason(parsed, 'Strong: no season/episode')
    } else {
      this.addReason(parsed, 'Has season/episode pattern (not movie)')
      return 0  // Definitely not a movie
    }

    // Moderate indicator: no subgroup
    if (!this.basename.match(/^\s*\[[^\]]+\]/)) {
      score += PATTERN_SCORES.MOVIE.noSubGroup  // 10 points
      this.addReason(parsed, 'Moderate: no subgroup')
    }

    // Weak indicator: quality marker present
    if (parsed.quality) {
      score += PATTERN_SCORES.MOVIE.haveQualityMarker  // 5 points
      this.addReason(parsed, `Weak: has quality marker (${parsed.quality})`)
    }

    // Weak indicator: has resolution
    if (parsed.resolution) {
      score += 5
    }

    // Penalty: if looks like anime pattern
    if (this.basename.match(/\d{1,3}(?:\.\d)?(?:\s|$|\])/)) {
      score -= 20  // Has episode-like pattern
      this.addReason(parsed, 'Penalty: looks like anime episode')
    }

    // Cap at 100
    return Math.min(Math.max(score, 0), 100)
  }
}
