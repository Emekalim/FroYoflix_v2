// @ts-check
/**
 * Environment Configuration Loader
 * Browser-compatible version that uses environment variables
 * For Electron/Node.js, env vars are injected at build time via webpack DefinePlugin
 */

/**
 * Get configuration value from environment
 * @param {string} key - Configuration key
 * @param {string} defaultValue - Default value if not found
 * @returns {string} Configuration value
 */
export function getConfig(key, defaultValue = '') {
  // In browser/Electron, these are injected by webpack DefinePlugin
  // In Node.js tests, they come from process.env
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key]
  }

  // Check window object for browser-injected configs
  // @ts-ignore - __ENV__ is injected at build time
  if (typeof window !== 'undefined') {
    if (window.__ENV__ && window.__ENV__[key]) {
      // @ts-ignore
      return window.__ENV__[key]
    }

    // Fallback for specific keys that might be set directly on window
    if (key === 'TMDB_API_KEY' && window.__TMDB_API_KEY__) {
      return window.__TMDB_API_KEY__
    }
  }

  return defaultValue
}

/**
 * Validate that all required configs are present
 * @param {string[]} required - Array of required config keys
 * @throws {Error} If any required config is missing
 */
export function validateConfig(required = ['TMDB_API_KEY']) {
  const missing = required.filter(key => !getConfig(key))

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing configuration:\n` +
      missing.map(key => `  - ${key}`).join('\n') +
      `\n\nSet these as environment variables or in your build config`
    )
  }
}

// Export config object with getters
export default {
  get tmdbApiKey() {
    return getConfig('TMDB_API_KEY', '')
  },
  get traktClientId() {
    return getConfig('TRAKT_CLIENT_ID', '')
  },
  get traktAccessToken() {
    return getConfig('TRAKT_ACCESS_TOKEN', '')
  },
  get nodeEnv() {
    return getConfig('NODE_ENV', 'development')
  },

  getConfig,
  validateConfig
}
