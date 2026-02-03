// @ts-check
/**
 * TVShowParser - Detects TV shows from filename patterns
 * 
 * Patterns:
 * - Show.S01E05.1080p.mkv
 * - Show - 1x05 - Title.mkv
 * - Show.2024.S01E05.mkv
 * - Season.1.Episode.5.mkv
 * 
 * @typedef {import('../types.js').ParsedFilename} ParsedFilename
 */

import BaseParser from './BaseParser.js'
import {
  PATTERNS,
  PATTERN_SCORES,
  QUALITY_TIERS,
  isValidSeason,
  isValidEpisode,
} from './utils.js'

/**
 * TVShowParser - Identifies TV show files and extracts metadata
 */
export default class TVShowParser extends BaseParser {
  /**
   * Parse TV show filename
   * @returns {ParsedFilename|null}
   */
  parse() {
    const parsed = {
      mediaType: 'tv',
      rawFilename: this.filename,
      title: null,
      season: null,
      episode: null,
      year: null,
      resolution: null,
      confidence: 0,
      reasons: [],
    }

    // Step 1: Try to extract season/episode patterns
    let seasonEpisodeData = this.extractSeasonEpisode()
    
    if (!seasonEpisodeData) {
      this.addReason(parsed, 'No season/episode pattern found')
      return null
    }

    parsed.season = seasonEpisodeData.season
    parsed.episode = seasonEpisodeData.episode
    this.addReason(parsed, `Found S${parsed.season}E${parsed.episode}`)

    // Validate season and episode numbers
    if (!isValidSeason(parsed.season) || !isValidEpisode(parsed.episode)) {
      this.addReason(parsed, `Invalid season (${parsed.season}) or episode (${parsed.episode})`)
      return null
    }

    // Step 2: Extract year (for disambiguation, like "Show.2024.S01E05")
    const yearMatch = this.match(this.basename, PATTERNS.TV.year)
    if (yearMatch) {
      const year = this.parseNumber(yearMatch[1] || yearMatch[2])
      if (year && year >= 1980 && year <= 2100) {
        parsed.year = year
        this.addReason(parsed, `Found year: ${parsed.year}`)
      }
    }

    // Step 3: Extract resolution
    const resMatch = this.match(this.basename, PATTERNS.TV.resolution)
    if (resMatch) {
      const res = this.parseNumber(resMatch[1])
      parsed.resolution = QUALITY_TIERS[res.toString()] || 'Unknown'
      this.addReason(parsed, `Found resolution: ${res}p`)
    }

    // Step 4: Extract title (remove season/episode and metadata)
    let titleText = this.basename

    // Remove season/episode patterns
    titleText = titleText.replace(PATTERNS.TV.seasonEpisode, '')
    titleText = titleText.replace(PATTERNS.TV.alternateFormat, '')

    // Remove episode titles (anything after dash on same level)
    titleText = titleText.replace(/\s*-\s+.*$/i, '')

    // Remove year patterns
    titleText = titleText.replace(PATTERNS.TV.year, '')

    // Remove resolution and brackets
    titleText = titleText.replace(/\[[^\]]*\]/g, '')
    titleText = titleText.replace(PATTERNS.TV.resolution, '')

    // Clean up and extract title
    titleText = this.cleanTitle(titleText)
    titleText = titleText.replace(/-\s+.*$/i, '').trim()  // Remove episode title after dash
    
    if (titleText && titleText.length > 2) {
      parsed.title = titleText
      this.addReason(parsed, `Extracted title: ${parsed.title}`)
    }

    // Step 5: Calculate confidence score
    parsed.confidence = this.calculateConfidence(parsed)

    // Final validation: need at least a title
    if (!parsed.title || parsed.confidence < 40) {
      this.addReason(parsed, `Low confidence (${parsed.confidence}), rejected`)
      return null
    }

    return parsed
  }

  /**
   * Extract season and episode numbers from multiple patterns
   * Returns {season, episode} or null if not found
   * @returns {Object|null}
   */
  extractSeasonEpisode() {
    // Pattern 1: S01E05 format (most common)
    const se = this.match(this.basename, PATTERNS.TV.seasonEpisode)
    if (se) {
      return {
        season: this.parseNumber(se[1]),
        episode: this.parseNumber(se[2]),
      }
    }

    // Pattern 2: 1x05 format (alternate)
    const alt = this.match(this.basename, PATTERNS.TV.alternateFormat)
    if (alt) {
      return {
        season: this.parseNumber(alt[1]),
        episode: this.parseNumber(alt[2]),
      }
    }

    // Pattern 3: Verbose "Season 1 Episode 5" format
    const verbose = this.match(this.basename, PATTERNS.TV.verbose)
    if (verbose) {
      return {
        season: this.parseNumber(verbose[1]),
        episode: this.parseNumber(verbose[2]),
      }
    }

    return null
  }

  /**
   * Calculate confidence score based on detected patterns
   * @param {ParsedFilename} parsed
   * @returns {number}
   */
  calculateConfidence(parsed) {
    let score = 0

    // Base: has season/episode (core TV pattern) - STRONGEST
    if (parsed.season && parsed.episode) {
      score += 40  // Increased from 30
    }

    // Strong indicator: has year
    if (parsed.year) {
      score += 15  // Increased from 10
    }

    // Moderate indicator: episode in typical TV range
    if (parsed.episode && parsed.episode >= 1 && parsed.episode <= 30) {
      score += 15  // Increased from 10
    }

    // Bonus: no subgroup is expected for TV (anime indicator removed)
    if (!this.basename.match(/^\s*\[[^\]]+\]/)) {
      score += PATTERN_SCORES.TV.noSubGroup  // 10 points
    }

    // Bonus: has title
    if (parsed.title) {
      score += 10
    }

    // Penalty: if episode number is 4-digit, probably not TV
    if (parsed.episode && parsed.episode > 999) {
      score += PATTERN_SCORES.TV.fourDigitEpisode  // -20 penalty
    }

    // Cap at 100
    return Math.min(Math.max(score, 0), 100)
  }
}
