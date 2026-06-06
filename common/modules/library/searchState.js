import { writable } from 'simple-store-svelte'

export const librarySearch = writable({
  title: '',
  mediaType: '',
  status: '',
  subtitles: '',
  watchState: '',
  sort: 'recent',
  season: '',
  section: ''
})

export const librarySearchKey = writable({})

export function openLibrarySearch(overrides = {}) {
  librarySearch.set({
    title: '',
    mediaType: '',
    status: '',
    subtitles: '',
    watchState: '',
    sort: 'recent',
    season: '',
    section: '',
    ...overrides
  })
  librarySearchKey.set({})
}
