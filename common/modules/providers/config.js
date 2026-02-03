// @ts-check
/**
 * Environment Configuration Loader
 * Loads API keys and settings from .env file
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * Load environment variables from .env file
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  const envPath = resolve(__dirname, '..', '..', '.env')
  
  try {
    const content = readFileSync(envPath, 'utf-8')
    const config = {}
    
    // Parse .env file
    content.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return
      
      const [key, ...valueParts] = line.split('=')
      const cleanKey = key.trim()
      const value = valueParts.join('=').trim()
      
      // Remove quotes if present
      config[cleanKey] = value.replace(/^["']|["']$/g, '')
    })
    
    return config
  } catch (error) {
    console.warn('⚠️  .env file not found at', envPath)
    console.warn('Create a .env file with TMDB_API_KEY and TRAKT_CLIENT_ID')
    return {}
  }
}

/**
 * Get configuration value with validation
 * @param {string} key - Configuration key
 * @param {boolean} required - Whether this key is required
 * @returns {string} Configuration value
 * @throws {Error} If required key is missing
 */
export function getConfig(key, required = false) {
  const config = loadConfig()
  const value = config[key] || process.env[key]
  
  if (required && !value) {
    throw new Error(`Missing required configuration: ${key}`)
  }
  
  return value || ''
}

/**
 * Validate that all required configs are present
 * @throws {Error} If any required config is missing
 */
export function validateConfig() {
  const required = ['TMDB_API_KEY', 'TRAKT_CLIENT_ID']
  const config = loadConfig()
  
  const missing = required.filter(key => !config[key] && !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration:\n` +
      missing.map(key => `  - ${key}`).join('\n') +
      `\n\nAdd these to your .env file or set as environment variables`
    )
  }
}

// Export config for use
const config = loadConfig()

export default {
  tmdbApiKey: config.TMDB_API_KEY || process.env.TMDB_API_KEY,
  traktClientId: config.TRAKT_CLIENT_ID || process.env.TRAKT_CLIENT_ID,
  traktAccessToken: config.TRAKT_ACCESS_TOKEN || process.env.TRAKT_ACCESS_TOKEN,
  nodeEnv: config.NODE_ENV || process.env.NODE_ENV || 'development',
  
  loadConfig,
  getConfig,
  validateConfig
}
