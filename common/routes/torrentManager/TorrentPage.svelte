<script context='module'>
  import { writable } from 'simple-store-svelte'
  import { click } from '@/modules/click.js'
  import WPC from '@/modules/wpc.js'
  import { matchPhrase } from '@/modules/util.js'
  import { settings } from '@/modules/settings.js'
  import { status } from '@/modules/networking.js'
  import { loadedTorrent, completedTorrents, seedingTorrents, stagingTorrents } from '@/modules/torrent.js'
  import ErrorCard from '@/components/cards/ErrorCard.svelte'
  import TorrentCard from '@/routes/torrentManager/components/TorrentCard.svelte'
  import { Search, RefreshCw, TriangleAlert, Package, Percent, Activity, Scale, Gauge, CloudDownload, CloudUpload, Sprout, Magnet, Timer } from 'lucide-svelte'
  const rescanning = writable(true)
  WPC.listen('rescan_done', () => rescanning.value = false)
</script>
<script>
  export let miniplayerPadding = ''

  let searchText = ''
  let filteredLoaded = false
  let filteredStaging = []
  let filteredSeeding = []
  let filteredCompleted = []
  let disableRescan = false
  let hasAnyTorrents = false
  let hasVisibleTorrents = false

  function filterResults(results, searchText) {
    const dedupe = results.filter((torrent, index, arr) => arr.findIndex(_torrent => _torrent.infoHash === torrent.infoHash) === index)
    if (!searchText?.length) return dedupe
    return dedupe.filter(({ name }) => matchPhrase(searchText, name, 0.4, false, true)) || []
  }
  
  // Consolidated reactive block: compute all filtered results together
  $: {
    filteredLoaded = matchPhrase(searchText, $loadedTorrent?.name, 0.4, false, true)
    filteredStaging = filterResults($stagingTorrents, searchText) || []
    filteredSeeding = filterResults($seedingTorrents, searchText) || []
    filteredCompleted = filterResults($completedTorrents, searchText) || []
  }
  
  // Separate reactive block: disableRescan depends on store state
  $: disableRescan = ($seedingTorrents?.length + $stagingTorrents?.length + 1) >= settings.value.seedingLimit && !settings.value.torrentPersist
  
  $: hasAnyTorrents = !!($loadedTorrent?.infoHash || $stagingTorrents?.length || $seedingTorrents?.length || $completedTorrents?.length)
  $: hasVisibleTorrents = !!(
    ((!searchText?.length || filteredLoaded) && $loadedTorrent?.infoHash) ||
    filteredStaging.length ||
    filteredSeeding.length ||
    filteredCompleted.length
  )
</script>

<div class='bg-dark h-full w-full root status-transition {$$restProps.class}' class:pt-safe-area={$$restProps.class && !$status.match(/offline/i)} style={miniplayerPadding}>
  <div class='w-full status-transition' class:pl-20={$$restProps.class} class:pt-28px={$$restProps.class && !$status.match(/offline/i)}>
    <h4 class='font-weight-bold m-0 mb-10'>Manage Torrents</h4>
    <div class='d-flex align-items-center'>
      <div class='input-group wm-600'>
        <Search size='2.6rem' strokeWidth='2.5' class='position-absolute z-10 text-dark-light h-full pl-10 pointer-events-none' />
        <input
          type='search'
          class='form-control bg-dark-very-light pl-40 rounded-1 h-40 text-truncate'
          autocomplete='off'
          spellcheck='false'
          data-option='search'
          placeholder='Filter torrents by text, or manually specify one by pasting a magnet link or torrent file' disabled={$rescanning} bind:value={searchText} />
      </div>
      <button type='button' use:click={() => { if (!disableRescan) { $rescanning = true; window.dispatchEvent(new Event('rescan')) } }} disabled={disableRescan || $rescanning} title={disableRescan ? 'Enable Persist Files or Increase Seeding Limit' : $rescanning ? 'Rescanning Cache...' : 'Rescan Cache'} class='btn btn-primary d-flex align-items-center justify-content-center ml-20 mr-20 font-scale-16 h-full' class:cursor-wait={$rescanning}><RefreshCw class='mr-10' size='1.8rem' strokeWidth='2.5'/><span>Rescan</span></button>
    </div>
  </div>
  <div class='d-none' class:d-inline-block={disableRescan}>
    <div class='alert bg-warning border-warning-dim text-warning-very-dim p-10 pl-15 mt-10 mb-5 d-flex {$$restProps.class ? `ml-20` : ``}'>
      <TriangleAlert class='flex-shrink-0' size='1.8rem' />
      <span class='ml-10'>You've reached your pre-download limit. To pre-download more torrents, stop seeding some, increase your seeding limit, or enable Persist Files in Client Settings.</span>
    </div>
  </div>
  <div class='d-flex flex-column w-full text-wrap text-break-word font-scale-16 mt-20'>
    {#if hasVisibleTorrents || searchText?.length}
      <div class='d-flex flex-row mb-10 font-scale-18'>
        <div class='font-weight-bold p-5 ml-20 mw-150 flex-1 w-auto'>Name</div>
        <div class='font-weight-bold p-5 w-150 d-none d-md-block'><span class='d-none d-lg-block'>Size</span><Package class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150'><span class='d-none d-lg-block'>Progress</span><Percent class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150'><span class='d-none d-lg-block'>Status</span><Activity class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150 d-none d-md-block'><span class='d-none d-lg-block'>Ratio</span><Scale class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150 d-none d-md-block'><span class='d-none d-lg-block'>Down Speed</span><CloudDownload class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150 d-block d-md-none'><span class='d-none d-lg-block'>Speed</span><Gauge class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150 d-none d-md-block'><span class='d-none d-lg-block'>Up Speed</span><CloudUpload class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150'><span class='d-none d-lg-block'>Seeders</span><Sprout class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-150 d-none d-md-block'><span class='d-none d-lg-block'>Leechers</span><Magnet class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-115 d-none d-md-block'><span class='d-none d-lg-block'>ETA</span><Timer class='d-lg-none' size='2rem'/></div>
        <div class='font-weight-bold p-5 w-40 mr-5 mr-md-20 flex-shrink-0'/>
      </div>
    {/if}
    {#if hasVisibleTorrents}
      {#if !searchText?.length || filteredLoaded}
        {#if $loadedTorrent?.infoHash}
          <TorrentCard bind:data={$loadedTorrent} current={true} state='current' {disableRescan} />
        {/if}
      {/if}
      {#each filteredStaging as torrent (torrent.infoHash)}
        <TorrentCard data={torrent} state='staging' {disableRescan}/>
      {/each}
      {#each filteredSeeding as torrent (torrent.infoHash)}
        <TorrentCard data={torrent} state='seeding' {disableRescan}/>
      {/each}
      {#each filteredCompleted as torrent (torrent.infoHash)}
        <TorrentCard data={torrent} state='completed' completed={true} {disableRescan}/>
      {/each}
    {:else if !hasAnyTorrents && !searchText?.length}
      <div class='empty-state px-20 text-center'>
        <div class='empty-title text-white font-weight-bold'>Ooops!</div>
        <div class='empty-subtitle text-muted'>Nothing To See Here!</div>
        <div class='empty-help text-muted'>Downloads will appear here once a torrent is playing, downloading, seeding, or completed.</div>
      </div>
    {:else}
      <ErrorCard promise={{ errors: [ { message: 'found no results' }]}}/>
    {/if}
  </div>
</div>

<style>
  .empty-state {
    min-height: 45vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .empty-title {
    font-size: clamp(3.2rem, 5vw, 5.2rem);
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .empty-subtitle {
    margin-top: 1.6rem;
    font-size: clamp(1.8rem, 2.4vw, 2.6rem);
  }
  .empty-help {
    margin-top: 0.8rem;
    max-width: 58rem;
    font-size: 1.5rem;
  }
</style>
