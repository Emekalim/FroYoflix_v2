<script>
  import { onMount } from 'svelte'
  import { settings } from '@/modules/settings.js'
  import { loadedTorrent, seedingTorrents, stagingTorrents } from '@/modules/torrent.js'
  import { libraryRepository, libraryVersion } from '@/modules/library/LibraryRepository.js'
  import { rebuildLibrary } from '@/modules/library/LibraryIngest.js'
  import LibrarySection from '@/routes/library/components/LibrarySection.svelte'
  import { toast } from 'svelte-sonner'
  import { Clapperboard, RefreshCw } from 'lucide-svelte'

  let sections = []
  let librarySections = []
  let incomingSection = { title: 'Incoming Downloads', section: 'incoming', items: [] }

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
    librarySections = [
      { title: 'Continue Watching', section: 'continue', items: libraryRepository.listSection('continue', 20) },
      { title: 'Recently Added', section: 'recent', items: libraryRepository.listSection('recent', 20) },
      { title: 'Movies', section: 'movies', items: libraryRepository.listSection('movies', 20) },
      { title: 'Shows', section: 'shows', items: libraryRepository.listSection('shows', 20) },
      { title: 'Anime', section: 'anime', items: libraryRepository.listSection('anime', 20) },
      { title: 'Unmatched Files', section: 'unmatched', items: libraryRepository.listSection('unmatched', 20) },
    ].filter((section) => section.items.length > 0)
  }

  async function rebuild() {
    toast.promise(rebuildLibrary(), {
      loading: 'Rebuilding library...',
      success: 'Library rebuild complete.',
      error: (error) => error?.message || 'Library rebuild failed.',
    })
  }

  onMount(() => {
    refreshLibrarySections()
    refreshIncomingSection()
  })
  $: {
    $libraryVersion
    refreshLibrarySections()
  }
  $: {
    $loadedTorrent
    $stagingTorrents
    $seedingTorrents
    refreshIncomingSection()
  }
  $: sections = [...librarySections, ...(incomingSection.items.length ? [incomingSection] : [])]
</script>

<div class='h-full w-full overflow-y-scroll overflow-x-hidden library-root'>
  <div class='library-hero px-30 py-30 d-flex align-items-end justify-content-between'>
    <div>
      <div class='d-flex align-items-center mb-10'>
        <Clapperboard size='2.8rem' class='mr-10' />
        <h2 class='m-0'>Library</h2>
      </div>
      <p class='m-0 text-muted wm-800'>Browse your managed downloads like an offline Home page. Everything here comes from the local library index under <b>{$settings.torrentPathNew}</b>.</p>
    </div>
    <button type='button' class='btn btn-primary d-flex align-items-center justify-content-center flex-shrink-0 mt-20 mt-md-0' on:click={rebuild}>
      <RefreshCw size='1.7rem' class='mr-10' />Rebuild Library
    </button>
  </div>

  <div class='d-flex flex-column h-full w-full mt-10 pb-30'>
    {#if sections.length}
      {#each sections as section (section.section)}
        <LibrarySection title={section.title} section={section.section} items={section.items} />
      {/each}
    {:else}
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
