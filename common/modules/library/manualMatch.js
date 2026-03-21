import MediaResolver from '@/modules/resolver/MediaResolver.js'
import { search as globalSearch, key as searchKey } from '@/modules/sections.js'
import { page } from '@/modules/navigation.js'
import { applyManualMatch } from '@/modules/library/LibraryIngest.js'
import { toast } from 'svelte-sonner'

const searchDefaults = {
  genre: [],
  genre_not: [],
  tag: [],
  tag_not: [],
  format: [],
  format_not: [],
  status: [],
  status_not: [],
  season: '',
  sort: ''
}

function basename(value) {
  return String(value || '').split(/[\\/]/).pop() || ''
}

function inferYear(value) {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/)
  return match?.[0] || ''
}

function inferFormat(mediaType) {
  if (mediaType === 'movie') return ['Movies']
  if (mediaType === 'tv') return ['TV Shows']
  if (mediaType === 'anime') return ['Anime']
  return []
}

function getInitialHints(item) {
  const file = item?.preferredFile || item
  const fileName = basename(file?.absolutePath || file?.canonicalPath || item?.canonicalTitle || '')
  const parsedTitle = MediaResolver.cleanFileName(fileName)
  const parsedYear = inferYear(fileName)
  const mediaType = item?.mediaType && item.mediaType !== 'unknown' ? item.mediaType : null
  return {
    query: parsedTitle || item?.canonicalTitle || '',
    year: parsedYear,
    format: inferFormat(mediaType)
  }
}

export function startLibraryManualMatch(item) {
  const hints = getInitialHints(item)
  const returnPage = page.value === page.LIBRARY_SEARCH ? page.LIBRARY_SEARCH : page.LIBRARY

  globalSearch.set({
    ...structuredClone(searchDefaults),
    search: hints.query,
    year: hints.year,
    format: hints.format,
    clearNext: true,
    fileEdit: (media) => {
      toast.promise(applyManualMatch(item, media), {
        loading: 'Matching library file...',
        success: () => {
          globalSearch.set({ ...structuredClone(searchDefaults) })
          searchKey.set({})
          page.navigateTo(returnPage)
          return 'Library file matched.'
        },
        error: (error) => error?.message || 'Failed to match library file.'
      })
    }
  })
  searchKey.set({})
  page.navigateTo(page.SEARCH)
}
