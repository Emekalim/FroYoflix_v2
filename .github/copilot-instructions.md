## Codebase navigation

This project uses `roam` for codebase comprehension. Always prefer roam over Glob/Grep/Read exploration.

Before modifying any code:
1. First time in the repo: `roam understand` then `roam tour`
2. Find a symbol: `roam search <pattern>`
3. Before changing a symbol: `roam preflight <name>` (blast radius + tests + fitness)
4. Need files to read: `roam context <name>` (files + line ranges, prioritized)
5. Debugging a failure: `roam diagnose <name>` (root cause ranking)
6. After making changes: `roam diff` (blast radius of uncommitted changes)

Additional: `roam health` (0-100 score), `roam impact <name>` (what breaks),
`roam pr-risk` (PR risk), `roam file <path>` (file skeleton).

Run `roam --help` for all commands. Use `roam --json <cmd>` for structured output.
# Project Architecture

## Project Overview

- **Files:** 294
- **Symbols:** 2102
- **Edges:** 3840
- **Languages:** javascript (92), svelte (79), markdown (34), json (15), yaml (9), typescript (8), java (4), css (3)

## Directory Structure

| Directory | Files | Primary Language |
|-----------|-------|------------------|
| `common/` | 178 | svelte |
| `capacitor/` | 37 | javascript |
| `docs/` | 27 | markdown |
| `electron/` | 16 | javascript |
| `.github/` | 12 | yaml |
| `./` | 9 | json |
| `patches/` | 5 |  |
| `extensions/` | 5 | json |
| `client/` | 5 | javascript |

## Entry Points

- `capacitor/src/main/app.js`
- `common/modules/providers/index.js`
- `common/modules/resolver/index.js`
- `common/modules/tmdb/index.js`
- `electron/src/main/app.js`

## Key Abstractions

Top symbols by importance (PageRank):

| Symbol | Kind | Location |
|--------|------|----------|
| `map map(data, mediaType)` | method | `common/modules/providers/tmdb/mapper.js:16` |
| `includes function includes(value1, value2)` | function | `common/components/CustomDropdown.svelte:43` |
| `App class App` | class | `electron/src/main/app.js:20` |
| `TorrentClient class TorrentClient extends WebTorrent` | class | `client/core/webtorrent.js:17` |
| `set function set(userID, cache, key, value)` | function | `common/modules/cache.js:120` |
| `resolve async resolve(filename)` | method | `common/modules/resolver/index.js:46` |
| `AnilistClient class AnilistClient` | class | `common/modules/anilist.js:155` |
| `Helper class Helper` | class | `common/modules/helper.js:14` |
| `click function click(node, cb = noop)` | function | `common/modules/click.js:60` |
| `close function close()` | function | `common/modals/details/DetailsModal.svelte:57` |
| `Debug class Debug` | class | `capacitor/src/main/debugger.js:25` |
| `isValidNumber function isValidNumber(value)` | function | `common/modules/util.js:41` |
| `App class App` | class | `capacitor/src/main/app.js:17` |
| `error console.error = function(...args)` | function | `common/modules/debug.js:25` |
| `send async send(type, data, transfer)` | method | `common/modules/torrent.js:40` |

## Architecture

- **Dependency layers:** 20
- **Cycles (SCCs):** 21
- **Layer distribution:** L0: 1012 symbols, L1: 205 symbols, L2: 160 symbols, L3: 140 symbols, L4: 48 symbols

## Testing

**Test directories:** `capacitor/android/app/src/test/`, `common/modules/__tests__/`, `common/modules/extensions/__tests__/`, `common/modules/providers/__tests__/`, `common/modules/resolver/__tests__/`
- **Test files:** 17
- **Source files:** 277
- **Test-to-source ratio:** 0.06

## Coding Conventions

Follow these conventions when writing code in this project:

- **Functions:** Use `camelCase` (83% of 555 functions)
- **Classes:** Use `PascalCase` (100% of 59 classes)
- **Imports:** Prefer absolute imports (100% are cross-directory)
- **Test files:** *.test.*

## Complexity Hotspots

Average function complexity: 11.4 (1152 functions analyzed)

Functions with highest complexity (consider refactoring):

| Function | Complexity | Location |
|----------|-----------|----------|
| `resolveFileAnime` | 426 | `common/modules/anime/animeresolver.js:355` |
| `handleMessage` | 392 | `client/core/webtorrent.js:439` |
| `filterTags` | 357 | `common/components/CustomDropdown.svelte:48` |
| `load` | 323 | `common/modals/details/components/EpisodeList.svelte:95` |
| `handleFiles` | 263 | `common/components/MediaHandler.svelte:841` |
| `fallbackSearch` | 221 | `common/modules/anilist.js:916` |
| `findInCurrent` | 187 | `common/components/MediaHandler.svelte:63` |
| `getPaginatedMediaList` | 187 | `common/modules/helper.js:268` |
| `setHash` | 176 | `common/modules/anime/animehash.js:29` |
| `createSections` | 176 | `common/modules/sections.js:498` |

## Domain Keywords

- **Package:** froyo
- **Description:** Manage your personal media library, organize your collection, and stream your content in real time, no waiting required!
- **Top domain terms:** media, progress, search, torrent, extension, episodes, episode, anime, extensions, entry, cache, play, provider, file, user, calculate, results, source, notifications, authenticated

## Core Modules

Most-imported modules (everything depends on these):

| Module | Imported By | Symbols Used |
|--------|-------------|--------------|
| `capacitor/src/main/debugger.js` | 67 files | 151 |
| `common/modules/cache.js` | 66 files | 238 |
| `common/components/CustomDropdown.svelte` | 61 files | 122 |
| `common/modules/util.js` | 55 files | 202 |
| `common/modules/click.js` | 47 files | 61 |
| `common/modules/settings.js` | 47 files | 69 |
| `common/modules/providers/tmdb/mapper.js` | 46 files | 83 |
| `common/modules/anilist.js` | 45 files | 100 |
| `common/types.d.ts` | 40 files | 63 |
| `common/modules/navigation.js` | 36 files | 65 |