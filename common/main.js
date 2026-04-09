import 'quartermoon/css/quartermoon-variables.css'
import '@fontsource-variable/nunito'
import { cacheReady, cache, caches } from '@/modules/cache.js'
import '@/css.css'
import '@/themes.css'
import '@/typography.css'
import { decrypt } from '@/modules/cipher.js'

try {
  await cacheReady()
  // Initialize TMDB API key: prefer user-stored encrypted key, fall back to build-time env
  const storedSettings = cache.getEntry(caches.GENERAL, 'settings') || {}
  decrypt(storedSettings.tmdbApiKey || '').then(stored => {
    window.__TMDB_API_KEY__ = stored || window.env?.TMDB_API_KEY || ''
  })
  const { default: App } = await import('./App.svelte')
  new App({ target: document.body })
} catch (error) {
  console.error('[main.js] Fatal error:', error)
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace; background: #1a1a1a;"><h1>Error loading app</h1><pre>${error.message}</pre></div>`
}
