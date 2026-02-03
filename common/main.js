import 'quartermoon/css/quartermoon-variables.css'
import '@fontsource-variable/nunito'
import { cacheReady } from '@/modules/cache.js'
import '@/css.css'
import '@/themes.css'
import '@/typography.css'

// Initialize TMDB API key from environment - required for TV/movie searches
// Set from Electron preload process
window.__TMDB_API_KEY__ = window.__TMDB_API_KEY__ || (window.env?.TMDB_API_KEY) || ''

try {
  await cacheReady()
  const { default: App } = await import('./App.svelte')
  new App({ target: document.body })
} catch (error) {
  console.error('[main.js] Fatal error:', error)
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace; background: #1a1a1a;"><h1>Error loading app</h1><pre>${error.message}</pre></div>`
}
