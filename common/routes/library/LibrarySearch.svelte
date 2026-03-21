<script>
  import { libraryRepository, libraryVersion } from '@/modules/library/LibraryRepository.js'
  import { loadedTorrent, seedingTorrents, stagingTorrents } from '@/modules/torrent.js'
  import LibraryCard from '@/routes/library/components/LibraryCard.svelte'
  import { debounce } from '@/modules/util.js'

  export let search
  export let key

  let results = []
  let filters = search.value

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
      subtitles: filters.subtitles || false,
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
        <div class='pb-10 font-weight-semi-bold font-scale-24'>Sort</div>
        <select class='form-control bg-dark-light' bind:value={filters.sort}>
          <option value='recent'>Recently Added</option>
          <option value='watch'>Last Played</option>
          <option value='title'>Title</option>
        </select>
      </div>
      <div class='col-auto p-10 d-flex align-items-end'>
        <label class='d-flex align-items-center mb-10 text-muted pointer'>
          <input type='checkbox' class='mr-10' bind:checked={filters.subtitles} />
          Has subtitles
        </label>
      </div>
    </div>
  </form>

  <div class='w-full d-grid d-md-flex flex-wrap flex-row px-40 py-20 justify-content-center align-content-start'>
    {#key $key}
      {#if results.length}
        {#each results as item (item.itemId || item.fileId)}
          <div class='grid-card mb-20'><LibraryCard {item} /></div>
        {/each}
      {:else}
        <div class='text-muted px-20 py-40'>No library results match the current filters.</div>
      {/if}
    {/key}
  </div>
</div>

<style>
  .d-grid {
    grid-template-columns: repeat(auto-fill, minmax(28rem, 1fr));
  }
  .grid-card {
    width: min(100%, 36rem);
  }
</style>
