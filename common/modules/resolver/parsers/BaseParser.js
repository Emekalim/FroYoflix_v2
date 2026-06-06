// @ts-check
/**
 * BaseParser - Abstract base class for filename parsers
 * All parsers (AnimeParser, TVShowParser, MovieParser) extend this
 *
 * @typedef {import('../types').ParsedFilename} ParsedFilename
 */

/**
 * Browser-compatible path utilities
 */
function basename(filepath, ext = '') {
  const name = filepath.split(/[/\\]/).pop() || ''
  if (ext && name.endsWith(ext)) {
    return name.slice(0, -ext.length)
  }
  return name
}

function extname(filepath) {
  const name = filepath.split(/[/\\]/).pop() || ''
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(lastDot) : ''
}

/**
 * Abstract base class for all filename parsers
 */
export default class BaseParser {
  /**
   * @param {string} filename - Full path to the file
   */
  constructor(filename) {
    this.filename = filename
    this.basename = basename(filename, extname(filename))
  }

  /**
   * Parse the filename and return structured data
   * Must be implemented by subclass
   * 
   * @returns {ParsedFilename|null}
   */
  parse() {
    throw new Error('parse() must be implemented by subclass')
  }

  /**
   * Calculate confidence score for this parsing (0-100)
   * Must be implemented by subclass
   * 
   * @returns {number}
   */
  getConfidence() {
    throw new Error('getConfidence() must be implemented by subclass')
  }

  /**
   * Helper: Check if string matches regex
   * @param {string} str
   * @param {RegExp} regex
   * @returns {RegExpMatchArray|null}
   */
  match(str, regex) {
    return str.match(regex)
  }

  /**
   * Helper: Extract from regex with group index
   * @param {string} str
   * @param {RegExp} regex
   * @param {number} groupIndex
   * @returns {string|null}
   */
  extract(str, regex, groupIndex = 1) {
    const match = str.match(regex)
    return match ? match[groupIndex] : null
  }

  /**
   * Helper: Parse number from string
   * @param {string|null} str
   * @returns {number|null}
   */
  parseNumber(str) {
    if (!str) return null
    const num = parseInt(str, 10)
    return isNaN(num) ? null : num
  }

  /**
   * Helper: Clean title text (remove dots, dashes, extra spaces)
   * @param {string} str
   * @returns {string}
   */
  cleanTitle(str) {
    return str
      .replace(/[.\-_]/g, ' ')           // Replace separators with space
      .replace(/[;:]/g, '')              // Remove semicolons and colons
      .replace(/\s+/g, ' ')              // Collapse multiple spaces
      .trim()
  }

  /**
   * Helper: Add debug reason
   * @param {ParsedFilename} parsed
   * @param {string} reason
   */
  addReason(parsed, reason) {
    if (!parsed.reasons) parsed.reasons = []
    parsed.reasons.push(reason)
  }
}
