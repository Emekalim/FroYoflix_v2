// @ts-check
/**
 * TitleResolver - Main orchestrator for filename resolution
 * 
 * Workflow:
 * 1. Parse filename with all 3 parsers (get confidence scores)
 * 2. Sort parsers by confidence (highest first)
 * 3. For each parser (in confidence order):
 *    - Try matcher with that media type
 *    - If score > 80% → return (high confidence, done!)
 *    - If score > 70% → return (medium confidence)
 * 4. Try all again at 60% threshold
 * 5. If all fail → flag for user input
 * 
 * @typedef {import('./types.js').ParsedFilename} ParsedFilename
 * @typedef {import('./types.js').ResolverResult} ResolverResult
 */

import AnimeParser from './parsers/AnimeParser.js'
import TVShowParser from './parsers/TVShowParser.js'
import MovieParser from './parsers/MovieParser.js'
import AnimeMatcher from './matchers/AnimeMatcher.js'
import GeneralMatcher from './matchers/GeneralMatcher.js'

/**
 * TitleResolver - Resolves filenames to media with auto-cycling
 */
export class TitleResolver {
  constructor() {
    this.parsers = [AnimeParser, TVShowParser, MovieParser]
    this.matchers = {
      anime: new AnimeMatcher(),
      tv: new GeneralMatcher(),
      movie: new GeneralMatcher(),
    }
  }

  /**
   * Main entry point: resolve filename to media
   * Auto-cycles through all parsers and matchers without user input
   * 
   * @param {string} filename - Full path to media file
   * @returns {Promise<ResolverResult>}
   * @throws {Error} If filename cannot be parsed at all
   */
  async resolve(filename) {
    console.log(`[Resolver] Starting resolution for: ${filename}`)

    // Step 1: Parse with all 3 parsers, collect results with confidence
    const allParses = []
    for (const ParserClass of this.parsers) {
      try {
        const parser = new ParserClass(filename)
        const parsed = parser.parse()

        if (parsed) {
          allParses.push({
            parsed,
            confidence: parsed.confidence,
            mediaType: parsed.mediaType,
          })
          console.log(`  [Parser] ${parsed.mediaType}: confidence ${parsed.confidence}`)
        }
      } catch (err) {
        console.warn(`  [Parser] ${ParserClass.name} error: ${err.message}`)
      }
    }

    if (allParses.length === 0) {
      throw new Error(`Could not parse filename: ${filename}`)
    }

    // Sort by confidence (highest first)
    allParses.sort((a, b) => b.confidence - a.confidence)
    console.log(`  [Resolver] Sorted parsers by confidence`)

    // Step 2: Try matchers with high confidence threshold (>80%)
    console.log(`  [Resolver] Step 1: Trying high confidence threshold (>80%)`)
    const highConfResult = await this.tryMatchers(allParses, 80)
    if (highConfResult) {
      console.log(`  [Resolver] ✓ Found high confidence match!`)
      return highConfResult
    }

    // Step 3: Try matchers with medium confidence threshold (>70%)
    console.log(`  [Resolver] Step 2: Trying medium confidence threshold (>70%)`)
    const mediumConfResult = await this.tryMatchers(allParses, 70)
    if (mediumConfResult) {
      console.log(`  [Resolver] ✓ Found medium confidence match!`)
      return mediumConfResult
    }

    // Step 4: Try matchers with low confidence threshold (>60%)
    console.log(`  [Resolver] Step 3: Trying low confidence threshold (>60%)`)
    const lowConfResult = await this.tryMatchers(allParses, 60)
    if (lowConfResult) {
      console.log(`  [Resolver] ⚠ Found low confidence match (manual verification recommended)`)
      return lowConfResult
    }

    // Step 5: All matchers failed - return best parse with user prompt flag
    console.log(`  [Resolver] ✗ All matchers failed, flagging for user input`)
    const bestParse = allParses[0]
    return {
      parsed: bestParse.parsed,
      media: null,
      provider: null,
      matchScore: 0,
      confidence: 'failed',
      userPromptRequired: true,
      message: `Could not find match for: ${bestParse.parsed.title}. User should manually select.`,
      attemptedParsers: allParses.map(p => ({
        type: p.mediaType,
        confidence: p.confidence,
        title: p.parsed.title,
      })),
    }
  }

  /**
   * Try all parsed results with matchers at given confidence threshold
   * @param {Array} allParses - All parsed results with confidence
   * @param {number} threshold - Minimum matcher score threshold (0-100)
   * @returns {Promise<ResolverResult|null>}
   * @private
   */
  async tryMatchers(allParses, threshold) {
    for (const { parsed } of allParses) {
      try {
        const matcher = this.matchers[parsed.mediaType]
        if (!matcher) {
          console.warn(`    [Matcher] No matcher for ${parsed.mediaType}`)
          continue
        }

        console.log(`    [Matcher] Trying ${parsed.mediaType} for: ${parsed.title}`)
        const media = await matcher.match(parsed)

        if (media) {
          const matchScore = matcher.calculateScore(parsed, media)
          console.log(`    [Matcher] Score: ${matchScore}`)

          if (matchScore >= threshold) {
            return {
              parsed,
              media,
              provider: this.getProviderForType(parsed.mediaType),
              matchScore,
              confidence: this.getConfidenceLevel(matchScore),
            }
          }
        }
      } catch (err) {
        console.warn(`    [Matcher] Error for ${parsed.mediaType}: ${err.message}`)
        continue
      }
    }

    return null
  }

  /**
   * Get provider name for media type
   * @param {string} mediaType - 'anime', 'tv', or 'movie'
   * @returns {string}
   * @private
   */
  getProviderForType(mediaType) {
    const providers = {
      anime: 'anilist',
      tv: 'tmdb',
      movie: 'tmdb',
    }
    return providers[mediaType] || 'unknown'
  }

  /**
   * Convert match score to confidence level
   * @param {number} score - 0-100
   * @returns {string}
   * @private
   */
  getConfidenceLevel(score) {
    if (score >= 80) return 'high'
    if (score >= 70) return 'medium'
    if (score >= 60) return 'low'
    return 'failed'
  }
}

// Export singleton instance
export default new TitleResolver()
