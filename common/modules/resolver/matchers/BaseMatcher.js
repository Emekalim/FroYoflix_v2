// @ts-check
/**
 * BaseMatcher - Abstract base class for media matchers
 * All matchers (AnimeMatcher, GeneralMatcher) extend this
 *
 * @typedef {import('../types').ParsedFilename} ParsedFilename
 * @typedef {import('../types').Media} Media
 */

/**
 * Abstract base class for all media matchers
 */
export default class BaseMatcher {
  /**
   * Search for media based on parsed filename data
   * Must be implemented by subclass
   * 
   * @param {ParsedFilename} parsed
   * @returns {Promise<Media|null>}
   */
  async match(parsed) {
    throw new Error('match() must be implemented by subclass')
  }

  /**
   * Calculate match score between parsed data and search result
   * Must be implemented by subclass
   * 
   * @param {ParsedFilename} parsed
   * @param {Media} result
   * @returns {number} 0-100 score
   */
  calculateScore(parsed, result) {
    throw new Error('calculateScore() must be implemented by subclass')
  }

  /**
   * Helper: Check if two strings are similar (fuzzy match)
   * Removes special characters and checks for substring matches
   * 
   * @param {string} str1
   * @param {string} str2
   * @returns {boolean}
   */
  isSimilar(str1, str2) {
    const clean1 = str1.toLowerCase().replace(/[^\w\s]/g, '').trim()
    const clean2 = str2.toLowerCase().replace(/[^\w\s]/g, '').trim()
    
    // Exact match after cleaning
    if (clean1 === clean2) return true
    
    // Substring match (one contains the other)
    if (clean1.includes(clean2) || clean2.includes(clean1)) return true
    
    // Check first word match (for long titles)
    const words1 = clean1.split(/\s+/)
    const words2 = clean2.split(/\s+/)
    if (words1[0] === words2[0] && words1[0].length > 2) return true
    
    return false
  }

  /**
   * Helper: Extract year from date string or number
   * @param {string|Date|number|undefined} dateValue
   * @returns {number|null}
   */
  extractYear(dateValue) {
    if (!dateValue) return null
    
    if (dateValue instanceof Date) {
      return dateValue.getFullYear()
    }
    
    if (typeof dateValue === 'string') {
      const match = dateValue.match(/(\d{4})/)
      return match ? parseInt(match[1]) : null
    }
    
    if (typeof dateValue === 'number' && dateValue > 1000) {
      return dateValue
    }
    
    return null
  }

  /**
   * Helper: Check if years are close enough (within tolerance)
   * @param {number|null} year1
   * @param {number|null} year2
   * @param {number} tolerance - Default 1 year
   * @returns {boolean}
   */
  yearsMatch(year1, year2, tolerance = 1) {
    if (!year1 || !year2) return false
    return Math.abs(year1 - year2) <= tolerance
  }

  /**
   * Helper: Calculate string similarity using Levenshtein distance
   * @param {string} str1
   * @param {string} str2
   * @returns {number} 0-1, where 1 is perfect match
   */
  stringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    
    if (s1 === s2) return 1
    
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    
    if (longer.length === 0) return 1
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Helper: Calculate Levenshtein distance (edit distance)
   * @param {string} s1
   * @param {string} s2
   * @returns {number}
   */
  levenshteinDistance(s1, s2) {
    const costs = []
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j
        } else if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          }
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
      if (i > 0) costs[s2.length] = lastValue
    }
    return costs[s2.length]
  }
}
