<script>
  import { click, dragScroll } from '@/modules/click.js'
  import { cache } from '@/modules/cache.js'
  import { getCanonicalTitle } from '@/modules/library/pathSanitizer.js'
  import libraryRepository from '@/modules/library/LibraryRepository.js'
  import { openLibraryItemDetails, playLibraryItem } from '@/modules/library/playback.js'
  import { page } from '@/modules/navigation.js'
  import { getProvider } from '@/modules/providers/index.js'
  import GeneralMatcher from '@/modules/resolver/matchers/GeneralMatcher.js'
  import MovieParser from '@/modules/resolver/parsers/MovieParser.js'
  import { openLibrarySearch } from '@/modules/library/searchState.js'
  import LibraryCard from '@/routes/library/components/LibraryCard.svelte'
  import LibraryPosterItem from '@/routes/library/components/LibraryPosterItem.svelte'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'

  export let title
  export let items = []
  export let section = ''

  let scrollContainer
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
    const type = format
    const year = item?.media?.year || item?.mediaSnapshot?.year || null
    return {
      id: item?.mediaId || `${provider || 'local'}:${item?.itemId}`,
      title: {
        userPreferred: title,
        romaji: title,
        english: title,
        native: title
      },
      mediaType: item?.mediaType,
      source: provider === 'tmdb' ? 'TMDB' : provider === 'anilist' ? 'AniList' : 'LOCAL',
      format,
      type,
      year,
      seasonYear: year,
      coverImage: {
        extraLarge: './404_cover.png',
        large: './404_cover.png',
        medium: './404_cover.png',
        color: null
      },
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
        mediaType: 'movie',
        title: item?.canonicalTitle || rawSource,
        year: item?.media?.year || item?.mediaSnapshot?.year || null
      }
      const results = await provider.search(parsed.title, {
        type: 'movie',
        year: parsed.year || undefined,
        limit: 10
      })
      if (!results?.length) return null

      let bestResult = null
      let bestScore = -1
      for (const result of results) {
        const score = movieMatcher.calculateScore(parsed, result)
        if (score > bestScore) {
          bestScore = score
          bestResult = result
        }
      }
      return bestScore >= 60 ? bestResult : null
    }

    if (item?.mediaType === 'tv') {
      const results = await provider.search(item?.canonicalTitle || getLookupSource(item), {
        type: 'tv',
        limit: 10
      })
      return results?.[0] || null
    }

    return null
  }

  async function recoverAniListMedia(item) {
    const provider = getProvider('anilist')
    if (item?.provider === 'anilist' && item?.mediaId) {
      return provider.getById(item.mediaId)
    }

    const query = item?.canonicalTitle || getLookupSource(item)
    const results = await provider.search(query, { limit: 10 })
    return results?.[0] || null
  }

  function usePosterCard(item) {
    const media = item?.media || item?.mediaSnapshot
    return item?.statusSummary === 'imported' &&
      !!media?.id &&
      hasPoster(media) &&
      !!(media?.title || media?.name)
  }

  function getPosterCard(item) {
    const key = item?.itemId || item?.fileId || item?.infoHash
    const media = item?.media || item?.mediaSnapshot
    const marker = `${media?.id || ''}:${item?.updatedAt || ''}:${item?.statusSummary || ''}`
    const existing = posterCards.get(key)
    if (existing?.marker === marker) return existing.card

    const card = {
      type: 'small',
      data: Promise.resolve(media)
    }
    posterCards.set(key, { marker, card })
    return card
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
    } catch {}
  }

  function shouldShowLoadingCard(item) {
    return item?.statusSummary === 'imported' &&
      !!item?.itemId &&
      !!getRecoveryProvider(item) &&
      !isPlaceholderMedia(item?.media || item?.mediaSnapshot) &&
      !usePosterCard(item)
  }

  function openSection() {
    openLibrarySearch({ section, title: '' })
    page.navigateTo(page.LIBRARY_SEARCH)
  }

  function scroll(direction) {
    if (!scrollContainer) return
    scrollContainer.scrollBy({
      left: direction === 'right' ? scrollContainer.offsetWidth : -scrollContainer.offsetWidth,
      behavior: 'smooth'
    })
  }

  $: items
    .filter((item) => usePosterCard(item) || shouldShowLoadingCard(item))
    .forEach((item) => { ensurePosterMedia(item) })

  function openPosterItem(item) {
    if (item?.libraryShow || item?.mediaType === 'movie') {
      openLibraryItemDetails(item)
      return
    }
    playLibraryItem(item)
  }
</script>

<span class='d-flex px-20 align-items-end text-decoration-none'>
  <div class='font-scale-24 font-weight-semi-bold glow text-muted pointer' aria-hidden='true' use:click={openSection}>{title}</div>
  <div class='ml-auto pr-5 pl-5 font-size-12 glow text-muted pointer btn d-flex align-items-center justify-content-center' aria-hidden='true' use:click={() => scroll('left')}><ChevronLeft strokeWidth='3' size='2rem' /></div>
  <div class='pr-5 pl-5 ml-10 font-size-12 glow text-muted pointer btn d-flex align-items-center justify-content-center' aria-hidden='true' use:click={() => scroll('right')}><ChevronRight strokeWidth='3' size='2rem' /></div>
</span>

<div class='position-relative'>
  <div class='pb-10 w-full d-flex flex-row justify-content-start gallery' use:dragScroll bind:this={scrollContainer}>
    {#each items as item (item.itemId || item.fileId || item.infoHash)}
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
        <div class='mr-15'>
          <LibraryCard {item} compact={true} />
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .btn {
    border-radius: 2rem;
  }
  .gallery {
    overflow-x: scroll;
    flex-shrink: 0;
    min-height: 25rem;
    cursor: grab;
    padding: 0 2rem 0.5rem 2rem;
  }
  .gallery :global(.item.small-card) {
    width: 19rem !important;
  }
  .gallery::-webkit-scrollbar {
    display: none;
  }
  .gallery :global(.small-card-ct:first-child) :global(.absolute-container) {
    left: -45% !important;
  }
  .gallery :global(.small-card-ct:last-child):not(:only-child) :global(.absolute-container) {
    right: -45% !important;
  }
  .position-relative .gallery::after {
    content: '';
    position: absolute;
    right: 0;
    height: 100%;
    width: 8rem;
    z-index: 30;
    background: var(--section-end-gradient);
    pointer-events: none;
  }
</style>
