<script>
  import { cache } from '@/modules/cache.js'
  import { getCanonicalTitle } from '@/modules/library/pathSanitizer.js'
  import { libraryRepository, libraryVersion } from '@/modules/library/LibraryRepository.js'
  import { loadedTorrent, seedingTorrents, stagingTorrents } from '@/modules/torrent.js'
  import { openLibraryItemDetails, playLibraryItem, playLibraryShowItem } from '@/modules/library/playback.js'
  import { getProvider } from '@/modules/providers/index.js'
  import GeneralMatcher from '@/modules/resolver/matchers/GeneralMatcher.js'
  import MovieParser from '@/modules/resolver/parsers/MovieParser.js'
  import LibraryCard from '@/routes/library/components/LibraryCard.svelte'
  import LibraryPosterItem from '@/routes/library/components/LibraryPosterItem.svelte'
  import { debounce } from '@/modules/util.js'

  export let search
  export let key

  let results = []
  let filters = search.value

  const posterCards = new Map()
  const hydratedMediaIds = new Set()
  const movieMatcher = new GeneralMatcher()

  function basename(value) {
    return String(value || '').split(/[\\/]/).pop() || ''
  }

  function dirname(value) {
    const normalized = String(value || '').replace(/[\\/]+$/g, '')
    const parts = normalized.split(/[\\/]/)
    if (parts.length <= 1) return normalized
    parts.pop()
    return parts.join('/') || '/'
  }

  function hasPoster(media) {
    return !!(media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium)
  }

  function isPlaceholderMedia(media) {
    return !!(media?.__libraryPlaceholder || media?.coverImage?.extraLarge === './404_cover.png')
  }

  function getRecoveryProvider(item) {
    if (item?.provider === 'anilist' || item?.mediaType === 'anime') return 'anilist'
    if (item?.provider === 'tmdb' || item?.mediaType === 'movie' || item?.mediaType === 'tv') return 'tmdb'
    return null
  }

  function getLookupSource(item) {
    const filePath = item?.preferredFile?.absolutePath || item?.preferredFile?.canonicalPath || item?.absolutePath || ''
    if (item?.mediaType === 'movie') {
      return basename(dirname(filePath)) || basename(filePath) || item?.canonicalTitle || ''
    }
    return basename(filePath) || item?.canonicalTitle || ''
  }

  function buildPlaceholderMedia(item, provider) {
    const title = item?.canonicalTitle || getCanonicalTitle(item?.media || item?.mediaSnapshot) || 'Unknown Title'
    const format = item?.mediaType === 'tv' ? 'TV' : item?.mediaType === 'anime' ? 'TV' : 'MOVIE'
    const year = item?.media?.year || item?.mediaSnapshot?.year || null
    return {
      id: item?.mediaId || `${provider || 'local'}:${item?.itemId}`,
      title: { userPreferred: title, romaji: title, english: title, native: title },
      mediaType: item?.mediaType,
      source: provider === 'tmdb' ? 'TMDB' : provider === 'anilist' ? 'AniList' : 'LOCAL',
      format,
      type: format,
      year,
      seasonYear: year,
      coverImage: { extraLarge: './404_cover.png', large: './404_cover.png', medium: './404_cover.png', color: null },
      bannerImage: './404_banner.png',
      genres: [],
      tags: [],
      mediaListEntry: null,
      relations: { edges: [] },
      recommendations: { edges: [] },
      stats: { scoreDistribution: [] },
      airingSchedule: { nodes: [] },
      nextAiringEpisode: null,
      __libraryPlaceholder: true
    }
  }

  async function recoverTmdbMedia(item) {
    const provider = getProvider('tmdb')
    if (item?.provider === 'tmdb' && item?.mediaId) {
      return provider.getById(item.mediaId, item?.mediaType === 'tv' ? 'tv' : 'movie')
    }
    if (item?.mediaType === 'movie') {
      const rawSource = getLookupSource(item)
      const parsed = new MovieParser(rawSource).parse() || new MovieParser(item?.canonicalTitle || rawSource).parse() || {
        mediaType: 'movie', title: item?.canonicalTitle || rawSource, year: item?.media?.year || null
      }
      const res = await provider.search(parsed.title, { type: 'movie', year: parsed.year || undefined, limit: 10 })
      if (!res?.length) return null
      let best = null; let bestScore = -1
      for (const r of res) {
        const score = movieMatcher.calculateScore(parsed, r)
        if (score > bestScore) { bestScore = score; best = r }
      }
      return bestScore >= 60 ? best : null
    }
    if (item?.mediaType === 'tv') {
      const res = await provider.search(item?.canonicalTitle || getLookupSource(item), { type: 'tv', limit: 10 })
      return res?.[0] || null
    }
    return null
  }

  async function recoverAniListMedia(item) {
    const provider = getProvider('anilist')
    if (item?.provider === 'anilist' && item?.mediaId) return provider.getById(item.mediaId)
    const res = await provider.search(item?.canonicalTitle || getLookupSource(item), { limit: 10 })
    return res?.[0] || null
  }

  async function ensurePosterMedia(item) {
    const media = item?.media || item?.mediaSnapshot
    const mediaId = media?.id || item?.mediaId || item?.itemId
    if (!mediaId || hydratedMediaIds.has(mediaId)) return
    hydratedMediaIds.add(mediaId)
    if (media) await cache.updateMedia([media])
    try {
      const providerId = getRecoveryProvider(item)
      let fetched = null
      if (providerId === 'anilist') {
        fetched = item?.provider === 'anilist' && item?.mediaId && !isPlaceholderMedia(media)
          ? await cache.requestMedia(item.mediaId)
          : await recoverAniListMedia(item)
      } else if (providerId === 'tmdb') {
        fetched = await recoverTmdbMedia(item)
      }
      if (fetched && item?.itemId) {
        await libraryRepository.resolveImportedItemMetadata(item.itemId, {
          provider: providerId,
          mediaId: fetched.id,
          mediaType: item?.mediaType,
          canonicalTitle: getCanonicalTitle(fetched),
          mediaSnapshot: fetched
        })
      } else if (item?.itemId && !isPlaceholderMedia(media)) {
        await libraryRepository.saveMediaSnapshot(item.itemId, buildPlaceholderMedia(item, providerId))
      }
    } catch (err) {
      console.warn('[Library] Failed to hydrate media for', item?.itemId, err)
    }
  }

  function usePosterCard(item) {
    const media = item?.media || item?.mediaSnapshot
    return item?.statusSummary === 'imported' &&
      !!media?.id &&
      hasPoster(media) &&
      !!(media?.title || media?.name)
  }

  function shouldShowLoadingCard(item) {
    return item?.statusSummary === 'imported' &&
      !!item?.itemId &&
      !!getRecoveryProvider(item) &&
      !isPlaceholderMedia(item?.media || item?.mediaSnapshot) &&
      !usePosterCard(item)
  }

  function getPosterCard(item) {
    const k = item?.itemId || item?.fileId || item?.infoHash
    const media = item?.media || item?.mediaSnapshot
    const marker = `${media?.id || ''}:${item?.updatedAt || ''}:${item?.statusSummary || ''}`
    const existing = posterCards.get(k)
    if (existing?.marker === marker) return existing.card
    const card = { type: 'small', data: Promise.resolve(media) }
    posterCards.set(k, { marker, card })
    return card
  }

  function openPosterItem(item) {
    if (item?.libraryShow || item?.mediaType === 'movie' || item?.mediaType === 'anime') {
      openLibraryItemDetails(item)
      return
    }
    playLibraryItem(item)
  }

  function mapIncomingTorrent(torrent) {
    return {
      itemId: `incoming:${torrent.infoHash}`,
      infoHash: torrent.infoHash,
      canonicalTitle: torrent.name,
      mediaType: 'unknown',
      statusSummary: 'incoming',
      preferredFile: null,
      subtitles: [],
      watch: null,
    }
  }

  function refreshResults() {
    const repoResults = libraryRepository.listItems({
      section: filters.section || undefined,
      query: filters.title || '',
      mediaType: filters.mediaType || undefined,
      status: filters.status || undefined,
      subtitles: filters.subtitles === 'yes' ? true : false,
      watchState: filters.watchState || undefined,
      season: filters.season || undefined,
      sort: filters.sort || 'recent',
    })
    const incoming = [
      ...($loadedTorrent?.infoHash ? [$loadedTorrent] : []),
      ...$stagingTorrents,
      ...$seedingTorrents.filter((torrent) => torrent.incomplete),
    ]
      .filter(Boolean)
      .map(mapIncomingTorrent)

    if (filters.section === 'incoming' || filters.status === 'incoming') {
      const query = String(filters.title || '').trim().toLowerCase()
      const filteredIncoming = incoming.filter((item) => !query || item.canonicalTitle?.toLowerCase().includes(query))
      results = filters.section === 'incoming'
        ? filteredIncoming
        : [...filteredIncoming, ...repoResults]
      return
    }

    results = repoResults
  }

  function syncFilters() {
    search.set({ ...filters })
  }

  const invalidate = debounce(() => {
    $key = {}
    syncFilters()
    refreshResults()
  }, 150)

  $: filters = $search
  $: {
    $libraryVersion
    $loadedTorrent
    $stagingTorrents
    $seedingTorrents
    filters
    refreshResults()
  }
  $: results
    .filter((item) => usePosterCard(item) || shouldShowLoadingCard(item))
    .forEach((item) => { ensurePosterMedia(item) })
</script>

<div class='bg-dark h-full w-full overflow-y-scroll overflow-x-hidden'>
  <form class='container-fluid py-20 px-md-50 bg-dark pb-0 position-sticky top-0 search-container z-40' on:input={invalidate}>
    <div class='row'>
      <div class='col-lg col-12 p-10 d-flex flex-column justify-content-end'>
        <div class='pb-10 font-weight-semi-bold font-scale-24'>Title</div>
        <input type='search' class='form-control bg-dark-light text-capitalize rounded-1 text-truncate' autocomplete='off' spellcheck='false' bind:value={filters.title} placeholder='Search your library' />
      </div>
      <div class='col p-10 d-flex flex-column justify-content-end'>
        <div class='pb-10 font-weight-semi-bold font-scale-24'>Format</div>
        <select class='form-control bg-dark-light' bind:value={filters.mediaType}>
          <option value=''>All</option>
          <option value='movie'>Movies</option>
          <option value='tv'>Shows</option>
          <option value='anime'>Anime</option>
        </select>
      </div>
      <div class='col p-10 d-flex flex-column justify-content-end'>
        <div class='pb-10 font-weight-semi-bold font-scale-24'>Status</div>
        <select class='form-control bg-dark-light' bind:value={filters.status}>
          <option value=''>All</option>
          <option value='imported'>Imported</option>
          <option value='incoming'>Incoming</option>
          <option value='missing'>Missing</option>
          <option value='unmatched'>Unmatched</option>
        </select>
      </div>
      <div class='col p-10 d-flex flex-column justify-content-end'>
        <div class='pb-10 font-weight-semi-bold font-scale-24'>Watch</div>
        <select class='form-control bg-dark-light' bind:value={filters.watchState}>
          <option value=''>Any</option>
          <option value='continue'>Continue Watching</option>
          <option value='completed'>Completed</option>
        </select>
      </div>
      <div class='col p-10 d-flex flex-column justify-content-end'>
        <div class='pb-10 font-weight-semi-bold font-scale-24'>Subtitles</div>
        <select class='form-control bg-dark-light' bind:value={filters.subtitles}>
          <option value=''>Any</option>
          <option value='yes'>Has Subtitles</option>
        </select>
      </div>
      <div class='col p-10 d-flex flex-column justify-content-end'>
        <div class='pb-10 font-weight-semi-bold font-scale-24'>Sort</div>
        <select class='form-control bg-dark-light' bind:value={filters.sort}>
          <option value='recent'>Recently Added</option>
          <option value='watch'>Last Played</option>
          <option value='title'>Title</option>
        </select>
      </div>
    </div>
  </form>

  <div class='px-20 py-20 results-grid'>
    {#key $key}
      {#if results.length}
        {#each results as item (item.itemId || item.fileId)}
          {#if usePosterCard(item)}
            <LibraryPosterItem
              {item}
              card={getPosterCard(item)}
              variables={{ section: true, fileEdit: () => openPosterItem(item), altFileEdit: () => {} }}
            />
          {:else if shouldShowLoadingCard(item)}
            <LibraryPosterItem
              {item}
              card={{ type: 'small', data: new Promise(() => {}) }}
              variables={{ section: true }}
            />
          {:else}
            <LibraryCard {item} />
          {/if}
        {/each}
      {:else}
        <div class='text-muted px-20 py-40 w-full'>No library results match the current filters.</div>
      {/if}
    {/key}
  </div>
</div>

<style>
  .results-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1.2rem;
    align-content: start;
  }
  .results-grid :global(.library-poster-item) {
    flex-shrink: 0;
    margin-right: 0 !important;
    width: 19rem;
  }
  .results-grid :global(.library-poster-item) :global(.item.small-card) {
    width: 19rem !important;
  }
  .results-grid :global(.library-card) {
    width: min(100%, 34rem);
    flex-shrink: 0;
  }
</style>
