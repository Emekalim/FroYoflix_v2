import { anilistClient, seasons, currentSeason, currentYear } from '@/modules/anilist.js'
import { animeSchedule } from '@/modules/anime/animeschedule.js'
import { cache, caches } from '@/modules/cache.js'
import { malDubs } from '@/modules/anime/animedubs.js'
import { writable } from 'simple-store-svelte'
import { settings } from '@/modules/settings.js'
import { RSSManager } from '@/modules/rss.js'
import { debounce } from '@/modules/util.js'
import Helper from '@/modules/helper.js'
import Debug from 'debug'
import WPC from '@/modules/wpc.js'
const debug = Debug('ui:sections')

const lastSearched = cache.getEntry(caches.HISTORY, 'lastSearched')
export const hasNextPage = writable(true)
export const key = writable({})
export const search = writable(lastSearched || { genre: [], genre_not: [], tag: [], tag_not: [], format: [], format_not: [], status: [], status_not: [] })
search.subscribe(value => {
  if (!value.clearNext) {
    const searched = {...value}
    delete searched.load
    delete searched.preview
    cache.setEntry(caches.HISTORY, 'lastSearched', searched)
  }
})

const hideStatus = ['CURRENT', 'REPEATING', 'COMPLETED', 'DROPPED']
const format = ['TV', 'MOVIE']
const status_not = ['NOT_YET_RELEASED', 'CANCELLED']

// Default placeholder images for TMDB results
const DEFAULT_COVER_IMAGE = './404_cover.png'
const DEFAULT_BANNER_IMAGE = './404_banner.png'

// TMDB Genre caching system - prevents redundant API calls
const tmdbGenreCache = {
  movie: null,
  tv: null,
  lastFetch: {}
}

/**
 * Fetches and caches TMDB genres for a given type
 * Caches persist for the session, reducing API calls from 100s to ~2
 * @param {string} type - 'movie' or 'tv'
 * @returns {Promise<object>} - Genre map {id: normalizedName}
 */
async function fetchAndCacheTMDBGenres(type) {
  // Return cached genres if available
  if (tmdbGenreCache[type]) {
    debug(`Using cached TMDB genres for ${type}`)
    return tmdbGenreCache[type]
  }

  const tmdbApiKey = window.__TMDB_API_KEY__
  if (!tmdbApiKey) {
    debug('TMDB API key not available, returning empty genre map')
    return {}
  }

  try {
    const genreUrl = new URL(`https://api.themoviedb.org/3/genre/${type}/list`)
    genreUrl.searchParams.append('api_key', tmdbApiKey)
    
    const response = await fetch(genreUrl.toString())
    if (!response.ok) {
      debug(`Failed to fetch TMDB genres for ${type}: ${response.status}`)
      return {}
    }

    const data = await response.json()
    
    // Normalize genre names (Science Fiction -> Sci-Fi)
    const genreMap = data.genres.reduce((acc, g) => {
      acc[g.id] = g.name === 'Science Fiction' ? 'Sci-Fi' : g.name
      return acc
    }, {})

    // Cache the genre map
    tmdbGenreCache[type] = genreMap
    tmdbGenreCache.lastFetch[type] = Date.now()
    debug(`Cached TMDB genres for ${type}: ${Object.keys(genreMap).length} genres`)
    
    return genreMap
  } catch (e) {
    debug(`Error fetching TMDB genres for ${type}: ${e.message}`)
    return {}
  }
}

export default class SectionsManager {
  constructor (data = []) {
    this.sections = []
    for (const section of data) this.add(section)
  }

  /**
   * @param {object} data
   */
  add (data) {
    if (!data) return
    const { title, variables = {}, type, load = SectionsManager.createFallbackLoad(variables, type), preview = writable() } = data
    const section = { ...data, load, title, preview, variables }
    this.sections.push(section)
    return section
  }

  clear() {
    this.sections = []
  }

  static createFallbackLoad (variables, type) {
    return (page = 1, perPage = 50, search = variables) => {
      const res = (search.hideSubs ? malDubs.dubLists.value : Promise.resolve()).then(dubLists => {
        const hideSubs = search.hideSubs ? { idMal: dubLists?.dubbed } : {}
        if ((search.hideMyAnime || search.showMyAnime) && Helper.isAuthorized()) {
          return Helper.userLists(search).then(_res => {
            if (!_res?.data && _res?.errors) throw _res.errors[0]
            let animeFilter = {}
            const hasHideSubs = Object.keys(hideSubs)?.length > 0
            const targetLists = Helper.isAniAuth() ? _res.data.MediaListCollection.lists : _res.data.MediaList
            const statusFilter = search.hideMyAnime ? search.hideStatus : search.showStatus
            const userAnimeIds = Array.from(new Set(Helper.isAniAuth() ? targetLists.filter(({ status }) => statusFilter.includes(status)).flatMap(list => list.entries.map(({ media }) => hasHideSubs ? media.idMal : media.id)) : targetLists.filter(({ node }) => statusFilter.includes(Helper.statusMap(node.my_list_status.status))).map(({ node }) => node.id))).filter(Boolean)
            // anilist queries do not support mix and match, you have to use the same id includes as excludes, id_not_in cannot be used with idMal_in.
            if (search.hideMyAnime) animeFilter = userAnimeIds?.length ? (Helper.isAniAuth() ? { [hasHideSubs ? 'idMal_not' : 'id_not']: userAnimeIds.filter(Boolean) } : { idMal_not: userAnimeIds }) : {}
            else if (search.showMyAnime) animeFilter = userAnimeIds?.length ? { id: userAnimeIds.filter(Boolean) } : {}
            return SectionsManager.searchByMediaType({ page, perPage, ...hideSubs, ...animeFilter, ...SectionsManager.sanitiseObject(search) })
          })
        }
        return SectionsManager.searchByMediaType({ page, perPage, ...hideSubs, ...SectionsManager.sanitiseObject(search) })
      })
      return SectionsManager.wrapResponse(res, perPage, type)
    }
  }

  /**
   * Fetch results from TMDB API
   * @param {object} variables - Search variables (search, page, year, etc.)
   * @param {string} type - Media type: 'tv' or 'movie'
   * @returns {Promise<object>} - TMDB results in standardized format
   */
  static async fetchTMDB(variables = {}, type = 'tv') {
    const searchQuery = variables.search || ''
    
    // Use environment variable set by the app - TMDB API key must be configured
    const tmdbApiKey = window.__TMDB_API_KEY__
    if (!tmdbApiKey) {
      debug('TMDB API key not available (window.__TMDB_API_KEY__ not set), showing empty results')
      return {
        data: {
          Page: {
            pageInfo: { hasNextPage: false },
            media: []
          }
        }
      }
    }

    // Use cached genres instead of fetching them every time
    // This reduces API calls from 100s per day to ~2
    const genreMap = await fetchAndCacheTMDBGenres(type)

    let url
    
    // Determine which endpoint to use based on whether we have genre filters
    const hasGenreFilters = (variables.genre && variables.genre.length > 0) || (variables.genre_not && variables.genre_not.length > 0)
    
    // If we have genre filters, use discover endpoint (which supports genre filtering)
    // Otherwise use search or trending
    if (hasGenreFilters && searchQuery) {
      // Use discover endpoint for genre-filtered searches
      url = new URL(`https://api.themoviedb.org/3/discover/${type}`)
      url.searchParams.append('query', searchQuery)
      debug(`Using discover endpoint for ${type} with genre filters`)
      
      // Add genre IDs to the request
      if (variables.genre && variables.genre.length > 0) {
        // Find genre IDs that match our filter genres
        const genreIds = Object.entries(genreMap)
          .filter(([id, name]) => variables.genre.includes(name))
          .map(([id]) => id)
        if (genreIds.length > 0) {
          url.searchParams.append('with_genres', genreIds.join('|'))
        }
      }
    } else if (hasGenreFilters && !searchQuery) {
      // Use discover endpoint for genre filtering without search
      url = new URL(`https://api.themoviedb.org/3/discover/${type}`)
      debug(`Using discover endpoint for ${type} with genre filters (no search)`)
      
      // Add genre IDs to the request
      if (variables.genre && variables.genre.length > 0) {
        const genreIds = Object.entries(genreMap)
          .filter(([id, name]) => variables.genre.includes(name))
          .map(([id]) => id)
        if (genreIds.length > 0) {
          url.searchParams.append('with_genres', genreIds.join('|'))
        }
      }
    } else if (!searchQuery) {
      // No search query and no genre filters - use trending endpoint
      url = new URL(`https://api.themoviedb.org/3/trending/${type}/week`)
      debug(`No search query, using trending endpoint for ${type}`)
    } else {
      // Search query without genre filters - use search endpoint
      url = new URL(`https://api.themoviedb.org/3/search/${type}`)
      url.searchParams.append('query', searchQuery)
    }
    
    url.searchParams.append('api_key', tmdbApiKey)
    if (variables.year) url.searchParams.append('year', variables.year)
    url.searchParams.append('page', variables.page || 1)

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Map TMDB results to simplified Media format
    const media = (data.results || []).map(item => ({
      id: item.id,
      title: {
        romaji: item.title || item.name,
        english: item.title || item.name,
        native: item.title || item.name,
        userPreferred: item.title || item.name
      },
      coverImage: {
        extraLarge: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : DEFAULT_COVER_IMAGE,
        large: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : DEFAULT_COVER_IMAGE,
        medium: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : DEFAULT_COVER_IMAGE,
        color: null
      },
      bannerImage: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : DEFAULT_BANNER_IMAGE,
      format: type === 'tv' ? 'TV' : 'MOVIE',
      type: type === 'tv' ? 'TV' : 'MOVIE',
      status: 'UNKNOWN',
      description: item.overview,
      seasonYear: item.release_date ? parseInt(item.release_date.substring(0, 4)) : null,
      startDate: item.release_date ? { year: parseInt(item.release_date.substring(0, 4)), month: parseInt(item.release_date.substring(5, 7)) || 1, day: parseInt(item.release_date.substring(8, 10)) || 1 } : null,
      endDate: null,
      totalEpisodes: item.number_of_episodes || 0,
      episodes: type === 'tv' ? (item.number_of_episodes || 0) : 1,
      duration: type === 'tv' ? null : (item.runtime || null),
      trailer: {
        id: null,
        site: 'youtube'
      },
      genres: (item.genre_ids || []).map(id => genreMap[id]).filter(Boolean),
      averageScore: item.vote_average ? Math.round(item.vote_average * 10) : null,
      popularity: item.popularity,
      isAdult: item.adult || false,
      source: 'TMDB',
      tmdbId: item.id,
      // Stub AniList-only fields to prevent component crashes
      mediaListEntry: null,
      relations: { edges: [] },
      recommendations: { edges: [] },
      stats: { scoreDistribution: [] },
      airingSchedule: { nodes: [] },
      streamingEpisodes: [],
      nextAiringEpisode: null,
      tags: []
    }))

    // Filter by genre if specified in variables (for client-side fallback)
    // This is mainly for genre_not filtering, since genre filtering is handled by the API
    let filteredMedia = media.filter(item => {
      // If genre_not filter is specified, check that item does NOT have ANY of the excluded genres
      if (variables.genre_not && variables.genre_not.length > 0) {
        const itemGenres = (item.genres || []).map(g => g.trim().toLowerCase())
        const excludeGenres = variables.genre_not.map(g => g.trim().toLowerCase())
        const hasExcludedGenre = excludeGenres.some(genre => itemGenres.includes(genre))
        if (hasExcludedGenre) return false
      }
      
      return true
    }).filter(Boolean)
    
    await cache.updateMedia(filteredMedia)

    return {
      data: {
        Page: {
          pageInfo: {
            hasNextPage: data.page < data.total_pages
          },
          media: filteredMedia
        }
      }
    }
  }

  /**
   * Merge and rank results from multiple sources by popularity/trending
   * @param {array} anilistResults - Results from AniList
   * @param {array} tmdbTvResults - Results from TMDB TV
   * @param {array} tmdbMovieResults - Results from TMDB Movies
   * @returns {array} - Merged and sorted results
   */
  static mergeAndRankResults(anilistResults = [], tmdbTvResults = [], tmdbMovieResults = []) {
    // Combine all results
    const allResults = [...anilistResults, ...tmdbTvResults, ...tmdbMovieResults]
    
    // Normalize popularity scores across sources
    // AniList: trending is typically 0-1000, popularity is 0-100+
    // TMDB: popularity is typically 0-1000+
    const normalizedResults = allResults.map(item => {
      let normalizedPopularity = 0
      
      if (item.source === 'TMDB') {
        // TMDB uses popularity as is (0-1000+)
        normalizedPopularity = item.popularity || 0
      } else {
        // AniList: use trending first, fall back to averageScore
        // Trending is more up-to-date than overall popularity
        if (item.trending) {
          normalizedPopularity = item.trending
        } else if (item.averageScore) {
          // averageScore is 0-100, scale it up to match TMDB range
          normalizedPopularity = (item.averageScore / 100) * 100
        }
      }
      
      return {
        ...item,
        _sortScore: normalizedPopularity
      }
    })
    
    // Sort by normalized popularity score (descending)
    return normalizedResults.sort((a, b) => (b._sortScore || 0) - (a._sortScore || 0))
  }

  /**
   * Route metadata searches to correct provider based on format
   * @param {object} variables - Search variables (includes format array)
   * @returns {Promise<any>} - Search result (AniList or TMDB format)
   */
  static async searchByMediaType(variables = {}) {
    try {
      // Get format from variables, ensure it's an array
      let format = variables.format || []
      // Handle case where format might be a string instead of array
      if (typeof format === 'string') {
        format = format ? [format] : []
      }
      
      debug(`searchByMediaType - format received: ${JSON.stringify(format)}`)
      
      // Normalize format values: handle both old display names and new keys
      // Map: 'Anime' -> 'Anime', 'MOVIE' -> 'Movies', 'TV' -> 'TV Shows'
      const normalizedFormats = format.map(f => {
        if (f === 'MOVIE') return 'Movies'
        if (f === 'TV') return 'TV Shows'
        return f
      })
      
      // Default to all formats if empty (treat none selected as all 3 selected)
      const selectedFormats = normalizedFormats.length === 0 ? ['Anime', 'Movies', 'TV Shows'] : normalizedFormats

      // Route based on selected format(s)
      // Single format selections
      if (selectedFormats.length === 1) {
        if (selectedFormats.includes('Anime')) {
          debug('Routing to AniList (Anime only)')
          const anilistVars = { ...variables }
          delete anilistVars.format
          delete anilistVars.format_not
          return anilistClient.search(anilistVars)
        } else if (selectedFormats.includes('TV Shows')) {
          debug('Routing to TMDB TV (TV Shows only)')
          return this.fetchTMDB(variables, 'tv')
        } else if (selectedFormats.includes('Movies')) {
          debug('Routing to TMDB Movie (Movies only)')
          return this.fetchTMDB(variables, 'movie')
        }
      }
      
      // Multi-format selections - query all selected sources in parallel
      debug(`Multiple formats selected: ${selectedFormats.join(', ')} - merging results with popularity ranking`)
      
      const promises = []
      
      if (selectedFormats.includes('Anime')) {
        const anilistVars = { ...variables }
        delete anilistVars.format
        delete anilistVars.format_not
        promises.push(
          anilistClient.search(anilistVars)
            .then(result => (result?.data?.Page?.media || []))
            .catch(error => {
              debug(`AniList search failed: ${error.message}`)
              return []
            })
        )
      } else {
        promises.push(Promise.resolve([]))
      }
      
      if (selectedFormats.includes('TV Shows')) {
        promises.push(
          this.fetchTMDB(variables, 'tv')
            .then(result => (result?.data?.Page?.media || []))
            .catch(error => {
              debug(`TMDB TV search failed: ${error.message}`)
              return []
            })
        )
      } else {
        promises.push(Promise.resolve([]))
      }
      
      if (selectedFormats.includes('Movies')) {
        promises.push(
          this.fetchTMDB(variables, 'movie')
            .then(result => (result?.data?.Page?.media || []))
            .catch(error => {
              debug(`TMDB Movie search failed: ${error.message}`)
              return []
            })
        )
      } else {
        promises.push(Promise.resolve([]))
      }
      
      // Wait for all queries to complete
      const [anilistResults, tvResults, movieResults] = await Promise.all(promises)
      
      // Merge and sort by popularity
      const mergedMedia = this.mergeAndRankResults(anilistResults, tvResults, movieResults)
      
      return {
        data: {
          Page: {
            pageInfo: { hasNextPage: false },
            media: mergedMedia
          }
        }
      }
    } catch (error) {
      debug(`Search failed: ${error.message}`)
      // Fall back to empty results instead of crashing
      return {
        data: {
          Page: {
            pageInfo: { hasNextPage: false },
            media: []
          }
        }
      }
    }
  }

  static wrapResponse (res, length, type) {
    res.then(res => {
      hasNextPage.value = res?.data?.Page.pageInfo.hasNextPage
    })
    return Array.from({ length }, (_, i) => ({ type, data: SectionsManager.fromPending(res, i) }))
  }

  static async fromPending (_arr, i) {
    const arr = await _arr
    if (!arr) return null
    const { data, errors } = arr
    if (!data && errors) throw errors[0]
    return data?.Page.media[i]
  }

  static sanitiseObject = Helper.sanitiseObject
}

// list of all possible home screen sections
export const sections = writable(createSections() || [])
const updateStores = [
  { store: writable(structuredClone(settings.value.homeSections)), key: 'homeSections', wpc: true },
  { store: writable(structuredClone(settings.value.customSections)), key: 'customSections' },
  { store: writable(structuredClone(settings.value.rssFeedsNew)), key: 'rssFeedsNew' }
]
const debounceUpdate = debounce((value) => {
  let updated = false
  for (const { store, key, wpc } of updateStores) {
    if (JSON.stringify(store.value) !== JSON.stringify(value[key])) {
      if (!updated) {
        for (const section of sections.value) clearInterval(section.interval)
        sections.value = createSections()
        updated = true
      }
      if (wpc) WPC.send('remap-sections')
      store.set(structuredClone(value[key]))
    }
  }
}, 3_000)
settings.subscribe((value) => debounceUpdate(value))

function createSections () {
  const sectionFormat = (title) => (settings.value.homeSections.find(([t]) => t === title)?.[2] || [])
  const createSection = (section, variables = {}, staticSort) => ({ ...section, ...(section.sort && staticSort ? { sort: 'N/A' } : {}), variables: { ...variables, sort: settings.value.homeSections.find(([t]) => !staticSort && t === section.title)?.[1] ?? section.sort, ...(Array.isArray(sectionFormat(section.title)) && sectionFormat(section.title).length > 0 ? { format : sectionFormat(section.title) } : {}) } })
  return [
    // RSS feeds
    ...settings.value.rssFeedsNew.filter(([title, url]) => url).map(([title, url]) => {
      const section = {
        title,
        sort: 'N/A',
        format: ['N/A'],
        load: (page = 1, perPage = 12) => RSSManager.getMediaForRSS(page, perPage, url),
        preview: writable(RSSManager.getMediaForRSS(1, 12, url)),
        variables: { disableSearch: true },
        isRSS: true
      }

      // update every 30 seconds
      section.interval = setInterval(async () => {
        try {
          if (await RSSManager.getContentChanged(1, 12, url)) {
            section.preview.value = RSSManager.getMediaForRSS(1, 12, url, true)
          }
        } catch (error) {
          debug(`Failed to update RSS feed for ${url} at the scheduled interval, this is likely a temporary connection issue:`, JSON.stringify(error))
        }
      }, 30000)

      return section
    }),
    // official episode releases section
    ...['Dubbed Releases', 'Subbed Releases', ...(settings.value.adult === 'hentai' ? ['Hentai Releases'] : [])].map((title) => {
      const type = title.includes('Subbed') ? 'Sub' : title.includes('Dubbed') ? 'Dub' : 'Hentai'
      return {
        title,
        sort: 'N/A',
        format: !title.includes('Hentai') ? ['TV', 'MOVIE', 'OVA', 'ONA'] : ['OVA'],
        variables: { disableSearch: true },
        isRSS: true,
        isSchedule: true,
        load: (page = 1, perPage = 50) => animeSchedule.getMediaForRSS(page, perPage, type),
        preview: writable(animeSchedule.getMediaForRSS(1, 50, type)),
      }
    }),
    // user specific sections
    createSection({ title: 'Sequels You Missed', sort: 'POPULARITY_DESC', format: [], hide: !Helper.isAuthorized() || Helper.isMalAuth(),
      load: (page = 1, perPage = 50, variables = {}) => {
        if (Helper.isMalAuth()) return {} // not going to bother handling this, see below.
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = res.data.MediaListCollection.lists.find(({ status }) => status === 'COMPLETED')?.entries
          const excludeIds = res.data.MediaListCollection.lists.reduce((filtered, { status, entries }) => { return (['CURRENT', 'REPEATING', 'COMPLETED', 'DROPPED', 'PAUSED'].includes(status)) ? filtered.concat(entries) : filtered}, []).map(({ media }) => media.id).filter(Boolean) || []
          if (!mediaList) return {}
          const ids = mediaList.flatMap(({ media }) => media.relations.edges.filter(edge => edge.relationType === 'SEQUEL')).map(({ node }) => node.id).filter(Boolean)
          if (!ids.length) return {}
          return anilistClient.searchIDS({ page, perPage, id: ids, id_not: excludeIds, ...SectionsManager.sanitiseObject(variables), status: ['FINISHED', 'RELEASING'] })
        })
        return SectionsManager.wrapResponse(res, perPage)
      } // disable this section when authenticated with MyAnimeList. API for userLists fail to return relations and likely will never be fixed on their end.
    }, { userList: true, missedList: true, disableHide: true }),
    createSection({ title: 'Stories You Missed', sort: 'POPULARITY_DESC', format: [], hide: !Helper.isAuthorized() || Helper.isMalAuth(),
      load: (page = 1, perPage = 50, variables = {}) => {
        if (Helper.isMalAuth()) return {} // same as Sequels You Missed
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = res.data.MediaListCollection.lists.find(({ status }) => status === 'COMPLETED')?.entries
          const excludeIds = res.data.MediaListCollection.lists.reduce((filtered, { status, entries }) => { return (['CURRENT', 'REPEATING', 'COMPLETED', 'DROPPED', 'PAUSED'].includes(status)) ? filtered.concat(entries) : filtered}, []).map(({ media }) => media.id).filter(Boolean) || []
          if (!mediaList) return {}
          const ids = mediaList.flatMap(({ media }) => media.relations.edges.filter(edge => !['SEQUEL', 'CHARACTER', 'OTHER'].includes(edge.relationType))).map(({ node }) => node.id).filter(Boolean)
          if (!ids.length) return {}
          return anilistClient.searchIDS({ page, perPage, id: ids, id_not: excludeIds, ...SectionsManager.sanitiseObject(variables), status: ['FINISHED', 'RELEASING'] })
        })
        return SectionsManager.wrapResponse(res, perPage)
      } // disable this section when authenticated with MyAnimeList. API for userLists fail to return relations and likely will never be fixed on their end.
    }, { userList: true, missedList: true, disableHide: true }),
    createSection({ title: 'Continue Watching', sort: 'UPDATED_TIME_DESC', format: [], hide: !Helper.isAuthorized(),
      load: (page = 1, perPage = 50, variables = {}) => {
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          let mediaList = Helper.isAniAuth() ? res.data.MediaListCollection.lists.reduce((filtered, { status, entries }) => (status === 'CURRENT' || status === 'REPEATING') ? filtered.concat(entries) : filtered, []) : res.data.MediaList.filter(({ node }) => (node.my_list_status.status === Helper.statusMap('CURRENT') || node.my_list_status.is_rewatching))
          if (!mediaList) return {}
          return animeSchedule.dubAiringLists.value.then(airing => {
            if (settings.value.preferDubs) {
              const ids = []
              mediaList.forEach(watchMedia => {
                const media = watchMedia?.media || watchMedia?.node
                const matchingAiring = airing?.find(item => (watchMedia?.media ? item?.media?.media?.id : item?.media?.media?.idMal) === media?.id)
                if (matchingAiring && (media?.mediaListEntry || media?.my_list_status)) {
                  const episodes = matchingAiring?.media?.media?.airingSchedule?.nodes
                  const progress = (media?.mediaListEntry?.progress || media?.my_list_status?.num_episodes_watched || 0) - (matchingAiring?.media?.media?.zeroEpisode ? 1 : 0)
                  const episodeNumber = episodes?.[episodes.length > 1 ? episodes.length - 1 : 0]?.episode - (new Date(episodes?.[episodes.length > 1 ? episodes.length - 1 : 0]?.airingAt) > new Date() ? 1 : 0)
                  if ((progress === (episodeNumber + (media.episodes && (episodeNumber === media.episodes) ? 1 : 0))) && ((media?.status === 'RELEASING' || media?.status === 'currently_airing') || !(progress >= media?.num_episodes))) ids.push(media?.id)
                }
              })
              mediaList = mediaList.filter(media => !ids.includes(media?.media?.id || media?.node?.id))
            }
            return animeSchedule.subAiringLists.value.then(airing => {
              if (Helper.isMalAuth()) {
                const ids = []
                mediaList.forEach(watchMedia => {
                  const media = watchMedia?.node
                  const matchingAiring = airing?.find(item => item?.idMal === media?.id)
                  if (matchingAiring && media?.my_list_status) {
                    const now = Date.now() / 1000
                    const episodes = matchingAiring?.airingSchedule?.nodes || []
                    const closest = episodes.sort((a, b) => Math.abs(a.airingAt - now) - Math.abs(b.airingAt - now))[0]
                    const highestEpisode = Math.max(...episodes.filter(ep => ep.airingAt === closest?.airingAt)?.map(ep => ep.episode))
                    const episodeNumber = closest ? closest.airingAt > now ? highestEpisode - 1 : highestEpisode : null
                    if (media?.my_list_status?.num_episodes_watched >= (episodeNumber || media?.num_episodes)) ids.push(media?.id)
                  }
                })
                mediaList = mediaList.filter(media => !ids.includes(media?.media?.id || media?.node?.id))
              }
              return Helper.getPaginatedMediaList(page, perPage, variables, mediaList)
            })
          })
        })
        return SectionsManager.wrapResponse(res, perPage)
      }
    }, { userList: true, continueWatching: true, disableHide: true, status_not }),
    createSection({ title: 'Watching List', sort: 'UPDATED_TIME_DESC', format: [], hide: !Helper.isAuthorized(),
      load: (page = 1, perPage = 50, variables = {}) => {
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = Helper.isAniAuth()
            ? res.data.MediaListCollection.lists.find(({ status }) => status === 'CURRENT')?.entries
            : res.data.MediaList.filter(({ node }) => node.my_list_status.status === Helper.statusMap('CURRENT'))
          if (!mediaList) return {}
          return Helper.getPaginatedMediaList(page, perPage, variables, mediaList)
        })
        return SectionsManager.wrapResponse(res, perPage)
      }
    }, { userList: true, disableHide: true, status_not }),
    createSection({ title: 'Rewatching List', sort: 'UPDATED_TIME_DESC', format: [], hide: !Helper.isAuthorized(),
      load: (page = 1, perPage = 50, variables = {}) => {
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = Helper.isAniAuth()
            ? res.data.MediaListCollection.lists.find(({ status }) => status === 'REPEATING')?.entries
            : res.data.MediaList.filter(({ node }) => node.my_list_status.status === Helper.statusMap('REPEATING'))
          if (!mediaList) return {}
          return Helper.getPaginatedMediaList(page, perPage, variables, mediaList)
        })
        return SectionsManager.wrapResponse(res, perPage)
      }
    }, { userList: true, disableHide: true, status_not }),
    createSection({ title: 'Completed List', sort: 'UPDATED_TIME_DESC', format: [], hide: !Helper.isAuthorized(),
      load: (page = 1, perPage = 50, variables = {}) => {
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = Helper.isAniAuth()
            ? res.data.MediaListCollection.lists.find(({ status }) => status === 'COMPLETED')?.entries
            : res.data.MediaList.filter(({ node }) => node.my_list_status.status === Helper.statusMap('COMPLETED'))
          if (!mediaList) return {}
          return Helper.getPaginatedMediaList(page, perPage, variables, mediaList)
        })
        return SectionsManager.wrapResponse(res, perPage)
      }
    }, { userList: true, completedList: true, disableHide: true, status_not }),
    createSection({ title: 'Planning List', sort: 'POPULARITY_DESC', format: [], hide: !Helper.isAuthorized(),
      load: (page = 1, perPage = 50, variables = {}) => {
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = Helper.isAniAuth()
            ? res.data.MediaListCollection.lists.find(({ status }) => status === 'PLANNING')?.entries
            : res.data.MediaList.filter(({ node }) => node.my_list_status.status === Helper.statusMap('PLANNING'))
          if (!mediaList) return {}
          return Helper.getPaginatedMediaList(page, perPage, variables, mediaList)
        })
        return SectionsManager.wrapResponse(res, perPage)
      }
    }, { userList: true, planningList: true, disableHide: true, status_not }),
    createSection({ title: 'Paused List', sort: 'UPDATED_TIME_DESC', format: [], hide: !Helper.isAuthorized(),
      load: (page = 1, perPage = 50, variables = {}) => {
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = Helper.isAniAuth()
            ? res.data.MediaListCollection.lists.find(({ status }) => status === 'PAUSED')?.entries
            : res.data.MediaList.filter(({ node }) => node.my_list_status.status === Helper.statusMap('PAUSED'))
          if (!mediaList) return {}
          return Helper.getPaginatedMediaList(page, perPage, variables, mediaList)
        })
        return SectionsManager.wrapResponse(res, perPage)
      }
    }, { userList: true, disableHide: true, status_not }),
    createSection({ title: 'Dropped List', sort: 'UPDATED_TIME_DESC', format: [], hide: !Helper.isAuthorized(),
      load: (page = 1, perPage = 50, variables = {}) => {
        const res = Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          const mediaList = Helper.isAniAuth()
            ? res.data.MediaListCollection.lists.find(({ status }) => status === 'DROPPED')?.entries
            : res.data.MediaList.filter(({ node }) => node.my_list_status.status === Helper.statusMap('DROPPED'))
          if (!mediaList) return {}
          return Helper.getPaginatedMediaList(page, perPage, variables, mediaList)
        })
        return SectionsManager.wrapResponse(res, perPage)
      }
    }, { userList: true, droppedList: true, disableHide: true, status_not }),
    // common, non-user specific sections
    createSection({ title: 'Popular This Season', sort: 'POPULARITY_DESC', format }, { season: currentSeason, year: currentYear, hideMyAnime: settings.value.hideMyAnime, hideStatus, status_not }, true),
    createSection({ title: 'Upcoming Next Season', sort: 'POPULARITY_DESC', format }, { season: seasons[(seasons.indexOf(currentSeason) + 1) % seasons.length], year: (currentYear + (currentSeason === 'FALL' ? 1 : 0)), hideMyAnime: settings.value.hideMyAnime, hideStatus, status: ['NOT_YET_RELEASED'], status_not: ['CANCELLED'] }),
    createSection({ title: 'Trending Now', sort: 'TRENDING_DESC', format }, { hideMyAnime: settings.value.hideMyAnime, hideStatus, status_not }, true),
    createSection({ title: 'All Time Popular', sort: 'POPULARITY_DESC', format }, { hideMyAnime: settings.value.hideMyAnime, hideStatus, status_not }, true),
    ...settings.value.customSections.map(([title, genres, tags, genre_not, tag_not]) => createSection({ title, sort: 'TRENDING_DESC', format }, { ...(genres?.length > 0 ? { genre: genres } : {}), ...(tags?.length > 0 ? { tag: tags } : {}), hideMyAnime: settings.value.hideMyAnime, hideStatus, status_not }))
  ]
}

/**
 * Fetch full TMDB TV show details to get accurate episode count
 * @param {number} tmdbId - TMDB TV show ID
 * @returns {Promise<Object | null>} Updated media object with episode count, or null if fetch fails
 */
export async function fetchTMDBVideos (tmdbId, mediaFormat = 'TV') {
  const tmdbApiKey = window.__TMDB_API_KEY__
  if (!tmdbApiKey || !tmdbId) return null

  try {
    const endpoint = mediaFormat === 'TV' ? 'tv' : 'movie'
    const url = new URL(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}/videos`)
    url.searchParams.append('api_key', tmdbApiKey)
    
    const response = await fetch(url.toString())
    if (!response.ok) return null
    
    const data = await response.json()
    const videos = data.results || []
    
    // Find official trailer/teaser on YouTube
    const official = videos.find(v => 
      v.site === 'YouTube' && 
      v.official && 
      ['Trailer', 'Teaser'].includes(v.type)
    )
    
    // Fallback to any trailer
    const fallback = videos.find(v => 
      v.site === 'YouTube' && 
      v.type === 'Trailer'
    )
    
    const video = official || fallback
    if (video?.key) {
      return { id: video.key, site: 'youtube' }
    }
    
    return null
  } catch (error) {
    debug('Error fetching TMDB videos:', error)
    return null
  }
}

export async function fetchTMDBTVDetails (tmdbId) {
  const tmdbApiKey = window.__TMDB_API_KEY__
  if (!tmdbApiKey || !tmdbId) return null

  try {
    const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`)
    url.searchParams.append('api_key', tmdbApiKey)
    
    const response = await fetch(url.toString())
    if (!response.ok) return null

    const data = await response.json()
    return {
      episodes: data.number_of_seasons ? Math.max(...(data.seasons?.map(s => s.episode_count || 0) || [0])) : data.number_of_episodes || 0,
      totalEpisodes: data.number_of_episodes || 0,
      seasons: data.number_of_seasons || 0
    }
  } catch (error) {
    debug('Error fetching TMDB TV details:', error)
    return null
  }
}

/**
 * Fetch TMDB episodes for a TV show and create metadata mapping like anime
 * @param {number} tmdbId - TMDB TV show ID
 * @returns {Promise<Object>} Episode metadata map {episodeNumber: {title, airDate, image, ...}}
 */
export async function fetchTMDBEpisodes (tmdbId, mediaFormat = 'TV') {
  const tmdbApiKey = window.__TMDB_API_KEY__
  if (!tmdbApiKey || !tmdbId) return {}

  try {
    // For movies, create a single episode entry for the movie itself
    if (mediaFormat === 'MOVIE') {
      const movieUrl = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`)
      movieUrl.searchParams.append('api_key', tmdbApiKey)
      
      const movieResponse = await fetch(movieUrl.toString())
      if (!movieResponse.ok) return {}
      
      const movieData = await movieResponse.json()
      return {
        1: {
          episode: '1',
          seasonNumber: 1,
          episodeNumber: 1,
          absoluteEpisodeNumber: 1,
          title: {
            en: movieData.title || null,
            ja: null,
            'x-jat': null
          },
          airDate: movieData.release_date || null,
          airdate: movieData.release_date || null,
          length: null,
          runtime: movieData.runtime || null,
          overview: movieData.overview || null,
          summary: movieData.overview || null,
          image: movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null,
          tmdbId: movieData.id
        }
      }
    }

    // Fetch TV details first to get season count
    const tvUrl = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`)
    tvUrl.searchParams.append('api_key', tmdbApiKey)
    const tvResponse = await fetch(tvUrl.toString())
    if (!tvResponse.ok) return {}

    const tvData = await tvResponse.json()
    const seasonCount = tvData.number_of_seasons || 0
    const episodes = {}
    let absoluteEpisodeNumber = 1

    // Fetch each season's episodes (Note: Season 0 is specials, usually skip or handle separately)
    for (let seasonNum = 1; seasonNum <= seasonCount; seasonNum++) {
      try {
        const seasonUrl = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNum}`)
        seasonUrl.searchParams.append('api_key', tmdbApiKey)
        
        const seasonResponse = await fetch(seasonUrl.toString())
        if (!seasonResponse.ok) continue

        const seasonData = await seasonResponse.json()
        const seasonEpisodes = seasonData.episodes || []

        for (const ep of seasonEpisodes) {
          episodes[absoluteEpisodeNumber] = {
            episode: absoluteEpisodeNumber.toString(),
            seasonNumber: seasonNum,
            episodeNumber: ep.episode_number,
            absoluteEpisodeNumber: absoluteEpisodeNumber,
            title: {
              en: ep.name || null,
              ja: null,
              'x-jat': null
            },
            airDate: ep.air_date || null,
            airdate: ep.air_date || null,
            length: null,
            runtime: ep.runtime || null,
            overview: ep.overview || null,
            summary: ep.overview || null,
            image: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
            tmdbId: ep.id
          }
          absoluteEpisodeNumber++
        }
      } catch (error) {
        debug(`Error fetching TMDB season ${seasonNum}:`, error)
        continue
      }
    }

    return episodes
  } catch (error) {
    debug('Error fetching TMDB episodes:', error)
    return {}
  }
}

/**
 * Fetch TV shows with upcoming air dates for schedule page
 * Queries TMDB for shows with next_episode_to_air data
 * 7-day cache TTL since TV schedules are relatively stable
 * @returns {Promise<Array>} Array of TV shows with next air date info
 */
export async function fetchTVSchedule() {
  const tmdbApiKey = window.__TMDB_API_KEY__
  if (!tmdbApiKey) {
    return []
  }

  try {
    // Check cache first - 7 day TTL for TV schedules
    const cacheKey = 'tv-schedule'
    const cachedData = cache.cachedEntry(caches.SEARCH, cacheKey)
    if (cachedData) {
      const cacheAge = Date.now() - (cachedData.timestamp || 0)
      if (cacheAge < 7 * 24 * 60 * 60 * 1000) { // 7 days
        return cachedData.data || []
      }
    }
    
    // Fetch currently airing TV shows
    const url = new URL('https://api.themoviedb.org/3/tv/on_the_air')
    url.searchParams.append('api_key', tmdbApiKey)
    url.searchParams.append('page', '1')
    url.searchParams.append('sort_by', 'popularity.desc')
    
    const response = await fetch(url.toString())
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const shows = data.results || []
    
    // For each show, fetch detailed info to get next_episode_to_air
    const enrichedShows = await Promise.all(shows.map(async (show) => {
      try {
        const detailUrl = new URL(`https://api.themoviedb.org/3/tv/${show.id}`)
        detailUrl.searchParams.append('api_key', tmdbApiKey)
        const detailResponse = await fetch(detailUrl.toString())
        if (detailResponse.ok) {
          const details = await detailResponse.json()
          return { ...show, next_episode_to_air: details.next_episode_to_air }
        }
      } catch (e) {
        // Silent fail on detail fetch
      }
      return show
    }))

    // Transform TMDB shows to match our media format
    const transformedShows = enrichedShows
      .map((show) => {
        // Use next_episode_to_air if available, otherwise use first_air_date
        const nextEp = show.next_episode_to_air
        const airDate = nextEp?.air_date || show.first_air_date
        if (!airDate) {
          return null
        }
        
        return {
          id: show.id,
          title: {
            userPreferred: show.name,
            romaji: null,
            english: null
          },
          name: show.name,
          idMal: null,
          coverImage: {
            extraLarge: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
            large: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
            medium: show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null,
            color: null
          },
          description: show.overview,
          status: 'RELEASING',
          format: 'TV',
          episodes: show.number_of_episodes,
          seasonYear: show.first_air_date ? new Date(show.first_air_date).getFullYear() : null,
          genres: [],
          averageScore: Math.round(show.vote_average * 10),
          airingSchedule: {
            nodes: nextEp ? [{
              episode: nextEp.episode_number,
              airingAt: Math.floor(new Date(nextEp.air_date + 'T00:00:00Z').getTime() / 1000)
            }] : [{
              episode: 1,
              airingAt: Math.floor(new Date(airDate + 'T00:00:00Z').getTime() / 1000)
            }]
          },
          tmdbId: show.id,
          nextEpisodeToAir: nextEp,
          popularity: show.popularity,
          voteAverage: show.vote_average,
          mediaListEntry: null
        }
      })
      .filter(show => show !== null)

    // Cache the results for 7 days
    cache.setEntry(caches.SEARCH, cacheKey, {
      data: transformedShows,
      timestamp: Date.now()
    })

    return transformedShows
  } catch (error) {
    // Try to return cached data even if expired
    const cachedData = cache.cachedEntry(caches.SEARCH, 'tv-schedule')
    return cachedData?.data || []
  }
}
