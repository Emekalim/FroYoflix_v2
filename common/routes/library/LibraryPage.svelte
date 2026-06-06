<script>
  import { onMount, onDestroy } from 'svelte'
  import { settings } from '@/modules/settings.js'
  import { loadedTorrent, seedingTorrents, stagingTorrents } from '@/modules/torrent.js'
  import { libraryRepository, libraryVersion } from '@/modules/library/LibraryRepository.js'
  import { rebuildLibrary, refreshIncoming, sweepOrphanedFiles } from '@/modules/library/LibraryIngest.js'
  import LibrarySection from '@/routes/library/components/LibrarySection.svelte'
  import LibraryLoading from '@/routes/library/components/LibraryLoading.svelte'
  import { modal } from '@/modules/navigation.js'
  import { debounce } from '@/modules/util.js'
  import { toast } from 'svelte-sonner'
  import { Clapperboard, RefreshCw, RefreshCcw } from 'lucide-svelte'

  let loading = true
  let sections = []
  let librarySections = []
  let incomingSection = { title: 'Incoming Downloads', section: 'incoming', items: [] }
  let rootEl

  const refreshLibrarySectionsDebounced = debounce(() => {
    librarySections = libraryRepository.computeAllSections(20)
  }, 150)

  let sweepTimer
  let sweeping = false
  const scheduleSweepInteraction = debounce(() => scheduleOrphanSweep(), 250)

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

  function refreshIncomingSection() {
    const incoming = [
      ...($loadedTorrent?.infoHash ? [$loadedTorrent] : []),
      ...$stagingTorrents,
      ...$seedingTorrents.filter((torrent) => torrent.incomplete),
    ]
      .filter(Boolean)
      .map(mapIncomingTorrent)

    incomingSection = { title: 'Incoming Downloads', section: 'incoming', items: incoming }
  }

  function refreshLibrarySections() {
    librarySections = libraryRepository.computeAllSections(20)
  }

  async function rebuild() {
    toast.promise(rebuildLibrary(), {
      loading: 'Rebuilding library...',
      success: 'Library rebuild complete.',
      error: (error) => error?.message || 'Library rebuild failed.',
    })
  }

  async function refresh() {
    const skipInfoHashes = new Set()
    if ($loadedTorrent?.infoHash) skipInfoHashes.add($loadedTorrent.infoHash)
    for (const torrent of ($stagingTorrents || [])) {
      if (torrent?.infoHash) skipInfoHashes.add(torrent.infoHash)
    }
    for (const torrent of ($seedingTorrents || [])) {
      if (torrent?.incomplete && torrent?.infoHash) skipInfoHashes.add(torrent.infoHash)
    }

    toast.promise(
      refreshIncoming({ skipInfoHashes: Array.from(skipInfoHashes) }),
      {
        loading: 'Refreshing incoming downloads...',
        success: ({ imported = 0, unmatched = 0, ingested = 0 } = {}) => {
          const parts = []
          if (ingested) parts.push(`Ingested ${ingested} folder${ingested === 1 ? '' : 's'}`)
          if (imported) parts.push(`added ${imported} item${imported === 1 ? '' : 's'}`)
          if (unmatched) parts.push(`${unmatched} unmatched`)
          return parts.length ? `Refresh complete: ${parts.join(', ')}.` : 'Refresh complete: nothing new found.'
        },
        error: (error) => error?.message || 'Refresh failed.',
      }
    )
  }

  function runSweep() {
    if (sweeping) return
    sweeping = true
    sweepOrphanedFiles()
      .catch(error => console.warn('[Library] Orphan sweep failed:', error))
      .finally(() => {
        sweeping = false
      })
  }

  function scheduleOrphanSweep() {
    clearTimeout(sweepTimer)
    sweepTimer = setTimeout(() => {
      if (document.hidden) return
      if ($modal?.[modal.MINIMIZE_PROMPT]) return
      runSweep()
    }, 15_000)
    sweepTimer.unref?.()
  }

  function onVisibilityChange() {
    if (!document.hidden) scheduleOrphanSweep()
  }

  onMount(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    setTimeout(() => {
      refreshLibrarySections()
      refreshIncomingSection()
      loading = false
      scheduleOrphanSweep()
    }, 0)
    rootEl?.addEventListener('scroll', scheduleSweepInteraction, { passive: true })
    rootEl?.addEventListener('pointerdown', scheduleSweepInteraction, { passive: true })
    rootEl?.addEventListener('keydown', scheduleSweepInteraction)
  })

  onDestroy(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    clearTimeout(sweepTimer)
    rootEl?.removeEventListener('scroll', scheduleSweepInteraction)
    rootEl?.removeEventListener('pointerdown', scheduleSweepInteraction)
    rootEl?.removeEventListener('keydown', scheduleSweepInteraction)
  })
  $: {
    $libraryVersion
    if (!loading) refreshLibrarySectionsDebounced()
  }
  $: {
    $loadedTorrent
    $stagingTorrents
    $seedingTorrents
    refreshIncomingSection()
  }
  $: sections = [...librarySections, ...(incomingSection.items.length ? [incomingSection] : [])]
</script>

<div bind:this={rootEl} class='h-full w-full overflow-y-scroll overflow-x-hidden library-root position-relative'>

  {#if loading}
    <LibraryLoading />
  {/if}
  <div class='library-hero px-30 py-30 d-flex align-items-end justify-content-between'>
    <div>
      <div class='d-flex align-items-center mb-10'>
        <Clapperboard size='2.8rem' class='mr-10' />
        <h2 class='m-0'>Library</h2>
      </div>
      <p class='m-0 text-muted wm-800'>Browse your managed downloads like an offline Home page. Everything here comes from the local library index under <b>{$settings.torrentPathNew}</b>.</p>
    </div>
    <div class='d-flex flex-column flex-sm-row gap-10 flex-shrink-0 mt-20 mt-md-0'>
      <button type='button' class='btn btn-primary d-flex align-items-center justify-content-center' on:click={rebuild}>
        <RefreshCw size='1.7rem' class='mr-10' />Rebuild Library
      </button>
      <button type='button' class='btn btn-secondary d-flex align-items-center justify-content-center' on:click={refresh} title='Ingest completed incoming downloads'>
        <RefreshCcw size='1.7rem' class='mr-10' />Refresh
      </button>
    </div>
  </div>

  <div class='d-flex flex-column h-full w-full mt-10 pb-30'>
    {#if sections.length}
      {#each sections as section (section.section)}
        <LibrarySection title={section.title} section={section.section} items={section.items} />
      {/each}
    {:else if !loading}
      <div class='px-30 text-muted'>The library is empty. Start a download or rebuild the library after adding files under the managed root.</div>
    {/if}
  </div>
</div>

<style>
  .library-root {
    background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 20%);
  }
  .library-hero {
    min-height: 18rem;
    background:
      radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 30%),
      radial-gradient(circle at top left, rgba(14, 165, 233, 0.1), transparent 35%);
  }
  .wm-800 {
    max-width: 80rem;
  }
</style>
