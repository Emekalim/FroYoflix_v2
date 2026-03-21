# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Codebase Navigation

This project uses `roam` for codebase comprehension. Prefer roam over Glob/Grep/Read exploration.

Before modifying any code:
1. First time in the repo: `roam understand` then `roam tour`
2. Find a symbol: `roam search <pattern>`
3. Before changing a symbol: `roam preflight <name>` (blast radius + tests + fitness)
4. Need files to read: `roam context <name>` (files + line ranges, prioritized)
5. Debugging a failure: `roam diagnose <name>` (root cause ranking)
6. After making changes: `roam diff` (blast radius of uncommitted changes)

Additional: `roam health`, `roam impact <name>`, `roam pr-risk`, `roam file <path>`, `roam --json <cmd>`.

## Commands

This is a pnpm monorepo. Run all commands from within the relevant package directory (`electron/` or `capacitor/`), after `pnpm install --frozen-lockfile`.

### Desktop (Electron)

```bash
cd electron
pnpm start           # Dev: webpack build + webpack serve + electron
pnpm web:watch       # Watch and rebuild web assets only
pnpm web:build       # Production web build
pnpm electron:start  # Run Electron without rebuilding web
pnpm electron:build  # electron-builder only (skip web rebuild)
pnpm build           # Full production build (electron-builder)
pnpm publish         # Publish release to GitHub
```

### Mobile (Capacitor / Android)

```bash
cd capacitor
pnpm dev:start       # Dev: webpack serve + deploy to ADB device (requires connected device)
pnpm dev:android     # Deploy to connected ADB device (cap run android)
pnpm dev:adb-port    # Set ADB reverse port forwarding (tcp:5001)
pnpm build:native    # Linux: Docker build of native Node modules (first time only)
pnpm build:native-win  # Windows equivalent
pnpm build:web       # Webpack production build
pnpm build:app       # Full Android APK build
pnpm exec cap open android  # Open Android Studio
pnpm exec cap doctor        # Check for missing dependencies
```

### Linting

ESLint 9 is configured. Run from the relevant package directory:
```bash
pnpm exec eslint src/
```

### Tests

Tests use vanilla Node (no test framework). Run from the repo root:
```bash
node common/modules/__tests__/mediaType.test.mjs
node common/modules/extensions/__tests__/run-all.mjs
node common/modules/providers/__tests__/run-all.mjs
node common/modules/resolver/__tests__/run-all.mjs
```
Android tests live in `capacitor/android/app/src/test/` (run via Android Studio or Gradle).

## Architecture

FroYo is a cross-platform personal media manager with real-time torrent streaming, anime tracking, and an extension plugin system.

### Package Layout

| Package | Role |
|---------|------|
| `common/` | Shared Svelte UI, components, and all business logic |
| `electron/` | Desktop app shell (Electron 39); FFmpeg, Discord RPC, file system |
| `capacitor/` | Mobile app shell (Capacitor 6); Android foreground service, file picker |
| `client/` | WebTorrent wrapper with Matroska subtitle parsing |
| `extensions/` | Built-in extension source manifests |

### Key Layers

1. **UI** (`common/` — 79 Svelte files): `Router.svelte` dispatches to Home, Search, Player, Settings, Torrent Manager, Watch Together, and Schedule views. Modals handle Details, Torrents, Manager, Trailers, Updates, and Notifications.

2. **Business Logic** (`common/modules/`): media providers (TMDB mapper, AniList GraphQL client, RSS feeds), content resolution (anime episode/file matching via `animeresolver.js`), torrent management (`torrent.js` message bridge to `client/`), IndexedDB cache (`cache.js`), settings persistence (`settings.js`), and AniList/MAL progress syncing.

3. **Extension System** (`common/modules/extensions/`): Dynamically loaded plugins run in Web Workers via Comlink RPC. Supports `gh:`, `npm:`, HTTP(S), local file, and custom protocols. Manifest-based discovery with 7–14 day cache and offline fallback.

4. **Torrent Client** (`client/core/webtorrent.js`): `TorrentClient extends WebTorrent`. All IPC happens through `send()` message passing. The highest-complexity function (`handleMessage`, complexity 392) lives here.

5. **Platform Apps**: `electron/src/main/app.js` and `capacitor/src/main/app.js` are the respective entry points, handling platform lifecycle, FFmpeg transcoding (Electron), and Android foreground services (Capacitor).

### Most-Imported Modules

These are depended on by 45–67 files each — changes here have high blast radius:

- `common/modules/cache.js` — IndexedDB persistence layer
- `common/modules/util.js` — general utilities
- `common/modules/settings.js` — reactive settings store
- `common/modules/anilist.js` — AniList GraphQL client
- `common/modules/providers/tmdb/mapper.js` — TMDB data mapping
- `common/components/CustomDropdown.svelte` — core reusable UI component

### Complexity Hotspots

Be careful modifying these high-complexity functions:

| Function | Location |
|----------|----------|
| `resolveFileAnime` | `common/modules/anime/animeresolver.js:355` |
| `handleMessage` | `client/core/webtorrent.js:439` |
| `filterTags` | `common/components/CustomDropdown.svelte:48` |
| `load` | `common/modals/details/components/EpisodeList.svelte:95` |
| `handleFiles` | `common/components/MediaHandler.svelte:841` |

## Coding Conventions

- Functions: `camelCase`, Classes: `PascalCase`
- Imports use absolute paths with `@` (common), `@client`, and `webtorrent-client` webpack aliases — no relative paths across packages
- Test files use the `*.test.*` pattern

## Documentation Protocols

### Issues

- Document production issues (live users, data loss, critical failures) in `docs/production_known_issues.md`
- Document development/non-critical issues in `docs/Known_Issues.md`
- Use the status tags: **IN PROGRESS**, **RESOLVED**, **BLOCKED**
- Always include specific file paths and line numbers; document failed approaches to avoid retrying them

### Improvements / Features

- Check `docs/Improvements_Tracker.md` before starting any feature work
- Add or update entries there after each session, moving items between Completed / In-Progress / Future Roadmap
- Document deviations from the original plan with reasoning

### Commit Messages

- Keep first line under ~40 characters
- Use type prefix: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Reference issues when relevant: `fix: resolve notification crash (#123)`

## Prerequisites

- Node.js 22.21.1
- pnpm
- Docker (with WSL on Windows) — for Android native module builds
- ADB + Android Studio SDK 34 — for Android development
- Java 21 (JDK) — for Android builds
- Visual Studio 2022 — Windows only
