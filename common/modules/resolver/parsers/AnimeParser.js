// @ts-check
/**
 * AnimeParser - Detects anime from filename patterns
 * 
 * Patterns:
 * - [SubGroup] Title - 01 [1080p].mkv
 * - Title 01 [v2].mkv
 * - [SubGroup] Title - 01.5 - Special.mkv
 * - NoSubgroup Title 05.mkv
 * 
 * @typedef {import('../types.js').ParsedFilename} ParsedFilename
 */

import BaseParser from './BaseParser.js'
import {
  PATTERNS,
  PATTERN_SCORES,
  QUALITY_TIERS,
  countAnimeKeywords,
  removeExcludedWords,
  isValidEpisode,
} from './utils.js'

/**
 * AnimeParser - Identifies anime files and extracts metadata
 */
export default class AnimeParser extends BaseParser {
  /**
   * Parse anime filename
   * @returns {ParsedFilename|null}
   */
  parse() {
    const parsed = {
      mediaType: 'anime',
      rawFilename: this.filename,
      title: null,
      episode: null,
      subGroup: null,
      version: null,
      resolution: null,
      confidence: 0,
      reasons: [],
    }

    // Step 1: Extract sub group (highest priority anime marker)
    const subGroupMatch = this.match(this.basename, PATTERNS.ANIME.subGroup)
    if (subGroupMatch) {
      parsed.subGroup = subGroupMatch[1].trim()
      this.addReason(parsed, `Found subgroup: ${parsed.subGroup}`)
    }

    // Step 2: Extract episode number (core anime pattern)
    const episodeMatch = this.match(this.basename, PATTERNS.ANIME.episode)
    if (episodeMatch) {
      const episodeNum = this.parseNumber(episodeMatch[1])
      const fractional = episodeMatch[2] ? this.parseNumber(episodeMatch[2]) : null

      if (isValidEpisode(episodeNum)) {
        // Check if this is actually a TV show pattern (S01E05)
        if (this.basename.match(/[Ss]\d{1,2}[Ee]\d{1,2}/)) {
          this.addReason(parsed, 'Found S01E05 pattern, rejecting')
          return null
        }

        parsed.episode = episodeNum
        parsed.fractional = fractional // 01.5 = special episode

        // If episode >= 100, likely episode count, not anime episode
        if (episodeNum >= 100) {
          this.addReason(parsed, `Episode ${episodeNum} too high, likely movie/TV`)
          return null // This is not anime
        }

        this.addReason(parsed, `Found episode: ${parsed.episode}${fractional ? '.' + fractional : ''}`)
      }
    }

    // If no episode found, this might not be anime
    if (!parsed.episode) {
      this.addReason(parsed, 'No episode number detected')
      return null
    }

    // Step 3: Extract version (v2, v3, etc)
    const versionMatch = this.match(this.basename, PATTERNS.ANIME.version)
    if (versionMatch) {
      parsed.version = this.parseNumber(versionMatch[1])
      this.addReason(parsed, `Found version: v${parsed.version}`)
    }

    // Step 4: Extract resolution
    const resMatch = this.match(this.basename, PATTERNS.ANIME.resolution)
    if (resMatch) {
      const res = this.parseNumber(resMatch[1])
      parsed.resolution = QUALITY_TIERS[res.toString()] || 'Unknown'
      this.addReason(parsed, `Found resolution: ${res}p`)
    }

    // Step 5: Extract title
    // Remove brackets, episodes, and metadata to isolate title
    let titleText = this.basename

    // Remove sub group
    if (parsed.subGroup) {
      titleText = titleText.replace(`[${parsed.subGroup}]`, '')
    }

    // Remove episode patterns
    titleText = titleText.replace(PATTERNS.ANIME.episode, '')

    // Remove version markers
    titleText = titleText.replace(PATTERNS.ANIME.version, '')

    // Remove resolution and CRC brackets
    titleText = titleText.replace(/\[[^\]]*\]/g, '')

    // Clean up and extract title
    titleText = this.cleanTitle(titleText)
    titleText = titleText.replace(/special/gi, '').trim()  // Remove "Special" suffix
    titleText = removeExcludedWords(titleText)
    
    if (titleText && titleText.length > 2) {
      parsed.title = titleText
      this.addReason(parsed, `Extracted title: ${parsed.title}`)
    }

    // Step 6: Calculate confidence score
    parsed.confidence = this.calculateConfidence(parsed)

    // Final validation: need at least a title and episode
    if (!parsed.title || parsed.confidence < 30) {
      this.addReason(parsed, `Low confidence (${parsed.confidence}), rejected`)
      return null
    }

    return parsed
  }

  /**
   * Calculate confidence score based on detected patterns
   * @param {ParsedFilename} parsed
   * @returns {number}
   */
  calculateConfidence(parsed) {
    let score = 0

    // Base: has episode (core anime pattern) - STRONGEST
    if (parsed.episode) {
      score += 35  // Increased from 20
    }

    // Strong indicator: has sub group
    if (parsed.subGroup) {
      score += 25  // Increased from 20
    }

    // Moderate indicator: has version marker
    if (parsed.version) {
      score += 15
    }

    // Weak indicator: episode number in typical anime range
    if (parsed.episode && parsed.episode >= 1 && parsed.episode <= 26) {
      score += 10
    }

    // Has title (base score)
    if (parsed.title) {
      score += 10
    }

    // Check for anime keywords in filename
    const keywordCount = countAnimeKeywords(this.basename)
    if (keywordCount > 0) {
      score += keywordCount * 5 // Each keyword adds 5 points
    }

    // Penalty: no episode means not anime
    if (!parsed.episode) {
      score -= PATTERN_SCORES.ANIME.noSeasonEpisode
    }

    // Cap at 100
    return Math.min(Math.max(score, 0), 100)
  }
}
