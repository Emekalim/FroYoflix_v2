import { expose, proxy } from 'comlink'

/** @typedef {import('../../../extensions').TorrentQuery} Options */
/** @typedef {import('../../../extensions').TorrentResult} Result */
/** @typedef {import('../../../extensions/sources/abstract.js').default} AbstractSource */

class Worker {
  id
  source
  cache = new Map()

  /**
   * Load and validate the source from code
   * @param {string} id
   * @param {object} module
   * @param {{bypassCORS: boolean}} opts
   * @returns {Promise<{ validated: true } | { validated: false, error: string }>}
   */
  async initialize(id, module, opts) {
    try {
      let source
      if (id.startsWith('extension:')) source = (await import(/* webpackIgnore: true */ module)).default
      else {
        const blob = new Blob([module], { type: 'application/javascript' })
        const blobUrl = URL.createObjectURL(blob)
        source = (await import(/* webpackIgnore: true */ blobUrl)).default
      }
      this.id = id
      this.source = source

      let validated = false
      if (opts.bypassCORS) {
        try { validated = await this.source.validate() } catch {}
        if (!validated) {
          globalThis.fetch = createBridge() // hacky Android workaround for Access-Control-Allow-Origin error.
          validated = await this.source.validate()
        }
      } else validated = await this.source.validate()
      if (!validated) return { validated: false, error: 'The content source appears to be unreachable.' }

      return { validated: true }
    } catch (err) {
      return { validated: false, error: err.message }
    }
  }

  /**
   * @param {Options} options
   * @param {{ movie: boolean, batch: boolean }} types
   * @param {boolean} online
   * @param {{enabled: boolean}} sourceOptions
   */
  async query (options, types, online, sourceOptions) {
    /** @type {Promise<{ results: Result[], errors: string[] }>[]} */
    const promises = []
    if (!sourceOptions?.enabled) return { results: [], errors: [{ message: 'Extension is not enabled.. skipping...' }] }

    const cacheKey = JSON.stringify({ options, types })
    const cached = this.cache.get(cacheKey)
    if (cached && (((Date.now() - cached.timestamp) <= 90000) || !online)) {
      console.debug(`worker:${this.id} The previously cached extension results are less than two minutes old, returning cached results...`)
      return cached.query
    }

    promises.push(this._querySource(this.source, options, types))
    /** @type {Result[]} */
    const results = []
    const errors = []
    for (const res of await Promise.all(promises)) {
      results.push(...res.results)
      errors.push(...res.errors)
    }
    const noResults = (!online || (!results?.length && !errors?.length)) ? [{ message: 'Source ' + this.id + ' found no results.' }] : null
    if (online && !errors?.length) this.cache.set(cacheKey, { query: { results, errors: noResults || errors }, timestamp: Date.now() })
    return { results, errors: noResults || errors }
  }

  /**
   * @param {AbstractSource} source
   * @param {Options} options
   * @param {{ movie: boolean, batch: boolean }} types
   * @returns {Promise<{ results: Result[], errors: string[] }>}
   */
  async _querySource (source, options, { movie, batch }) {
    console.log(`[worker] _querySource called for source ${this.id}`)
    console.log(`[worker] options.titles:`, options.titles)
    console.log(`[worker] options.mediaType:`, options.mediaType)
    console.log(`[worker] Full options object:`, JSON.stringify(options, null, 2))
    
    const promises = []
    promises.push(source.single(options))
    console.debug(source.base)
    if (batch) promises.push(source.batch(options))

    const results = []
    const errors = []
    for (const result of await Promise.allSettled(promises)) {
      if (result.status === 'fulfilled') {
        results.push(...result.value)
      } else {
        console.debug('[worker] Promise rejected:', result.reason?.message)
        // Only add error if we have no results from any method
        // Single error doesn't fail the entire source if we got results from another method
      }
    }

    // Only include errors if we got no results at all
    if (results.length === 0) {
      errors.push('Source ' + this.id + ' found no results')
    }
    console.log(`[worker] _querySource results collected:`, results.length, `errors:`, errors.length)
    console.log("[worker] results:", results)
    console.log("[worker] errors:", errors)
    return { results, errors }
  }

  async validate() {
    return !!(await this.source.validate())
  }

  terminate() {
    self.close()
  }
}

/**
 * Creates a simple fetch bridge for workers that forwards requests to the main thread.
 * Used for bypassing CORS by letting the main thread perform the request.
 *
 * @returns {function(string, RequestInit=): Promise<{ok: boolean, status: number, text: function(): Promise<string>, json: function(): Promise<any>}>}
 * A function that works like fetch but runs through the main thread.
 */
function createBridge() {
  const pending = new Map()
  let counter = 0

  /**
   * Handles fetch results sent back from the main thread.
   * Matches them to pending requests and resolves/rejects accordingly.
   */
  self.addEventListener('message', (event) => {
    const { type, requestId, ok, status, text, json, error } = event.data || {}
    if (type !== 'RESULT') return
    if (!pending.has(requestId)) return
    const { resolve, reject } = pending.get(requestId)
    pending.delete(requestId)
    if (error) reject(new Error(error))
    else  resolve({ ok, status, text: async () => text, json: async () => json })
  })

  /** Sends a fetch request to the main thread and waits for the result. */
  return async function bridge(url, options = {}) {
    const requestId = `fetch-${++counter}`
    postMessage({ type: 'FETCH', requestId, url, options })
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }))
  }
}

expose(proxy(new Worker()))