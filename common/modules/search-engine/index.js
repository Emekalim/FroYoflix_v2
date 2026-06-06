import { IPC } from '../bridge.js'
import { buildBuiltInSearchQuery } from './query-builder.js'
import { getBuiltInTrackersForMediaType } from './registry.js'
export { isElectronRuntime, shouldUseBuiltInSearchEngine } from './runtime.js'

export async function searchWithBuiltInEngine({ media, episode, season, batch = false, movie = false, resolution = '' }) {
  const query = buildBuiltInSearchQuery({ media, episode, season, batch, movie, resolution })
  const trackers = getBuiltInTrackersForMediaType(query.mediaType)
  const results = new Map()

  if (!trackers.length) {
    results.set('built-in', {
      name: 'Built-in Search',
      promise: Promise.resolve({
        results: [],
        errors: [{ message: `Built-in search does not support media type '${query.mediaType}'.` }]
      })
    })
    return results
  }

  for (const tracker of trackers) {
    const promise = IPC.invoke('search-engine:query', {
      trackerId: tracker.id,
      query
    })
      .then(response => ({
        results: Array.isArray(response?.results) ? response.results : [],
        errors: Array.isArray(response?.errors) ? response.errors : []
      }))
      .catch(error => ({
        results: [],
        errors: [{ message: error?.message || `Built-in source ${tracker.name} failed.` }]
      }))

    results.set(tracker.id, {
      name: tracker.name,
      promise
    })
  }

  return results
}
