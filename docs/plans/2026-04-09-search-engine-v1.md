# FroYo Native Search Engine V1

## Goal
Replace the hosted torrent-search dependency for the desktop app with a FroYo-native search engine that uses two built-in trackers:

- `Nyaa` for anime
- `1337x` for TV shows and movies

This iteration is Electron-only and is gated behind an internal settings flag so the existing extension-backed path remains intact during rollout.

## Architecture
- `common/modules/search-engine/`
  - Builds normalized search payloads from FroYo media data
  - Chooses the built-in tracker for the current media type
  - Calls Electron IPC and returns a source-to-promise map compatible with the torrent modal
- `electron/src/main/search-engine/`
  - Receives normalized search requests over IPC
  - Runs built-in tracker adapters
  - Returns normalized FroYo torrent results and source-level errors
- Existing downstream behavior remains unchanged after search:
  - AniTomy parsing
  - dedupe
  - optional peer scraping
  - sorting
  - autoplay selection

## V1 Tracker Scope
### Anime
- `Nyaa`
- Search modes: single episode, batch, movie fallback

### TV / Movie
- `1337x`
- Search modes: episode, season pack, movie

## Internal Interfaces
### Common query payload
- `mediaType: 'anime' | 'tv' | 'movie'`
- `titles: string[]`
- `ids?: { anilist?, mal?, anidb?, imdb?, tmdb?, tvdb?, trakt? }`
- `season?: number | string`
- `episode?: number | string`
- `episodeCount?: number`
- `year?: number`
- `resolution: '2160' | '1080' | '720' | '540' | '480' | ''`
- `exclusions: string[]`
- `batch: boolean`
- `movie: boolean`
- `variants`

### IPC response
- `results: Result[]`
- `errors: { message: string }[]`
- `meta: { trackerIds: string[] }`

### Normalized result shape
- `title`
- `link`
- `hash`
- `seeders`
- `leechers`
- `downloads`
- `size`
- `date`
- `type?: 'batch' | 'best' | 'alt'`
- `source: { id: string, name: string }`

## Rollout
- Add `settings.useBuiltInSearchEngine` with default `false`
- Only use the built-in engine when:
  - the flag is enabled
  - runtime is Electron
  - media type is supported by the built-in registry
- No silent fallback to the old path when the flag is enabled

## Acceptance Criteria
- Anime episode searches produce usable results from Nyaa
- TV episode searches produce usable results from 1337x
- Movie searches produce usable results from 1337x
- Existing torrent modal behavior still works after search returns
- Extension source UI remains unchanged

## Verification
- `node common/modules/search-engine/__tests__/run-all.mjs`
- `node electron/src/main/search-engine/__tests__/run-all.mjs`
- `node common/modules/extensions/__tests__/run-all.mjs`
