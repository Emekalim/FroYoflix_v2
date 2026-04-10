import { getTrackerAdapter } from './registry.js'
import { trackerError } from './utils.js'

function getSearchMethod(query) {
  if (query?.movie || query?.mediaType === 'animeMovie') return 'searchMovie'
  if (query?.batch) return 'searchBatch'
  return 'searchSingle'
}

export function registerSearchEngineHandlers(ipcMain) {
  ipcMain.handle('search-engine:query', async (_event, { trackerId, query }) => {
    const adapter = getTrackerAdapter(trackerId)
    if (!adapter) {
      return {
        results: [],
        errors: [trackerError(`Unknown built-in source '${trackerId}'.`)],
        meta: { trackerIds: trackerId ? [trackerId] : [] }
      }
    }

    if (!adapter.mediaTypes.includes(query?.mediaType)) {
      return {
        results: [],
        errors: [trackerError(`Source ${adapter.name} does not support media type '${query?.mediaType}'.`)],
        meta: { trackerIds: [adapter.id] }
      }
    }

    const SEARCH_TIMEOUT_MS = 30_000
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Source ${adapter.name} timed out after ${SEARCH_TIMEOUT_MS / 1000}s`)), SEARCH_TIMEOUT_MS)
      )
      const results = await Promise.race([adapter[getSearchMethod(query)](query), timeout])
      return {
        results,
        errors: results.length ? [] : [trackerError(`Source ${adapter.name} found no results.`)],
        meta: { trackerIds: [adapter.id] }
      }
    } catch (error) {
      return {
        results: [],
        errors: [trackerError(error?.message || `Source ${adapter.name} failed.`)],
        meta: { trackerIds: [adapter.id] }
      }
    }
  })
}
