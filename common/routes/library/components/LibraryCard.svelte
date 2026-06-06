<script>
  import { click } from '@/modules/click.js'
  import { page } from '@/modules/navigation.js'
  import { startLibraryManualMatch } from '@/modules/library/manualMatch.js'
  import { openLibraryItemDetails, playLibraryItem, playLibraryShowItem } from '@/modules/library/playback.js'
  import { openLibrarySearch } from '@/modules/library/searchState.js'
  import LibraryItemMenu from '@/routes/library/components/LibraryItemMenu.svelte'
  import { Play, Search, Captions, CircleDashed, CircleAlert, CircleCheckBig } from 'lucide-svelte'

  export let item
  export let compact = false

  let itemMenu

  function statusLabel() {
    if (item?.statusSummary === 'incoming') return 'Incoming'
    if (item?.statusSummary === 'missing') return 'Missing'
    if (item?.statusSummary === 'unmatched') return 'Unmatched'
    return 'Imported'
  }

  function playItem() {
    if (item?.libraryShow) {
      playLibraryShowItem(item)
      return
    }
    playLibraryItem(item)
  }

  function openSection() {
    if (item?.statusSummary === 'unmatched') {
      startLibraryManualMatch(item)
      return
    }
    if (item?.libraryShow || item?.mediaType === 'movie' || item?.mediaType === 'anime') {
      openLibraryItemDetails(item)
      return
    }
    openLibrarySearch({
      title: item.canonicalTitle || '',
      mediaType: item.mediaType === 'unknown' ? '' : item.mediaType,
    })
    page.navigateTo(page.LIBRARY_SEARCH)
  }
</script>

<div
  class:compact
  class="library-card bg-dark-light rounded-10 p-15 d-flex flex-column justify-content-between"
  on:contextmenu|preventDefault|stopPropagation={() => itemMenu?.openMenu()}
>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-10">
      <div class="d-flex align-items-center gap-10">
        <span class="badge badge-primary text-uppercase">{statusLabel()}</span>
        {#if item.subtitles?.length}
          <span class="text-muted d-flex align-items-center gap-5"><Captions size="1.5rem" />{item.subtitles.length}</span>
        {/if}
      </div>
      <LibraryItemMenu bind:this={itemMenu} {item} />
    </div>
    <div class="font-weight-semi-bold font-scale-20 line-height-1 mb-5 title">{item.canonicalTitle}</div>
    <div class="text-muted font-scale-14 mb-5">
      {#if item.mediaType === 'movie'}
        Movie
      {:else if item.libraryShow}
        TV Show
      {:else if item.episode}
        Season {item.season || 1} Episode {item.episode}
      {:else if item.mediaType === 'unknown'}
        Download
      {:else}
        {item.mediaType}
      {/if}
    </div>
    {#if item.watch && !item.watch.completed}
      <div class="text-warning font-scale-13 mb-5">Continue at {item.watch.percent || 0}%</div>
    {/if}
    <div class="text-muted font-scale-13 path">{item.preferredFile?.absolutePath || item.absolutePath}</div>
  </div>

  <div class="d-flex align-items-center mt-15">
    <button type="button" class="btn btn-primary d-flex align-items-center justify-content-center" use:click={playItem} disabled={(!item.preferredFile?.absolutePath && !item.infoHash) || item.statusSummary === 'missing'}>
      <Play size="1.6rem" class="mr-5" />Play
    </button>
    <button type="button" class="btn btn-secondary ml-10 d-flex align-items-center justify-content-center" use:click={openSection}>
      <Search size="1.6rem" class="mr-5" />{item?.statusSummary === 'unmatched' ? 'Match' : 'More'}
    </button>
    <div class="ml-auto text-muted status-icon">
      <svelte:component this={item.statusSummary === 'missing' ? CircleAlert : item.statusSummary === 'incoming' ? CircleDashed : CircleCheckBig} size="1.6rem" />
    </div>
  </div>
</div>

<style>
  .library-card {
    min-height: 19rem;
    width: 100%;
    min-width: 26rem;
    border: 1px solid var(--dark-border-color);
  }
  .library-card.compact {
    min-width: 22rem;
    width: 22rem;
  }
  .title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .path {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  .status-icon {
    min-width: 1.6rem;
  }
</style>
