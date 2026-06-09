# Project Improvements Tracker

This document tracks major feature implementations, architectural improvements, and the future roadmap. It serves as a central reference for comparing **Implementation Plans** vs **Actual Code**.

## ✅ Completed Improvements

### 1. Multi-Media Support (Media Extension Overhaul)
**Goal:** Extend FroYo to support TV Shows, Movies, and mixed media types while preserving Anime functionality.
-   **Core Plans:** [Media Extension Plan](archive/MEDIA_EXTENSION_PLAN.md), [TMDB Analysis](archive/TMDB_COMPATIBILITY_ANALYSIS.md)
-   **Status:** **Phases 1-4 Complete**.
-   **Key Implementations:**
    -   **Provider Abstraction:** Created unified `MediaProvider` interface and `common/modules/providers` registry to handle AniList, MAL, TMDB, and Trakt side-by-side.
    -   **TMDB Integration:** Implemented `fetchTMDB` in `sections.js` with "Recommended Option C" compatibility strategy (stubbing AniList fields) to prevent UI crashes.
    -   **Title Resolution:** Added `common/modules/resolver` with `AnimeParser`, `TVShowParser`, and `MovieParser` to intelligently route file searches based on naming patterns (e.g., "S01E05" vs "2024").
    -   **Unified Search & UI:** Consolidated redundant media type tabs into a single **Format Dropdown** (`searchByMediaType` refactor) and added Trailer support for TMDB items.

### 2. Robust HLS Playback & Smart Fallback
**Goal:** Prevent indefinite buffering/crashes on corrupted HEVC files.
-   **Plan:** Smart Fallback Implementation Plan
-   **Status:** **Fully Implemented**.
-   **Deviations:** Added active `stderr` monitoring in `transcoder.js` to detect "Error submitting packet to decoder" hangs and force-kill (`SIGKILL`) the process, triggering the `HandBrakeCLI` repair pipeline.
-   **Follow-up Hardening (2026-06-09):** Repair gating now survives intentional stop handoffs until the termination handlers consume them, and non-decoder/non-corruption exits no longer trigger HandBrake on healthy files.

### 3. HLS Caching Architecture
**Goal:** Enable seeking, persistence, and efficient streaming.
-   **Plan:** [HLS Caching Plan](archive/HLS_CACHING_PLAN.md)
-   **Status:** **Implemented**.
-   **Implementation:**
    -   Transcode artifacts stored in `temp/froyo-transcode/{hash}`.
    -   Stateless serving of HLS playlists via `transcoder.js`.
    -   Persistent caching using content-based hashing (`filepath` + `mtime`).

### 4. Search & Performance Optimizations
**Goal:** Improve responsiveness and reduce API usage.
-   **Status:** **Implemented**.
-   **Features:**
    -   **TMDB Genre Caching:** `sections.js` caches genre lists per session, reducing API calls by ~99%.
    -   **Format Dropdown:** Refactored search routing to support single or multi-format queries efficiently.
    -   **(2026-06-09)** Torrent manager empty-state polish: `common/routes/torrentManager/TorrentPage.svelte` now shows `No downloads.` when no torrents exist instead of rendering a fake placeholder row with `0 B`, `0.0%`, and empty status values.

### 5. Rebranding to FroYo
**Goal:** Transition from "Shiru" to "FroYo" for consistent branding.
-   **Status:** **Fully Implemented**.
-   **Key Implementations:**
    -   **Core Configs:** Updated `package.json`, `capacitor.config.js`, and electron configs.
    -   **Android Native:** Migrated `watch/shiru` directory structure to `watch/froyo`, updated `AndroidManifest.xml`, `strings.xml`, `build.gradle`, and `NativeBridge.java`.
    -   **Refactored Deep Links:** Converted all `shiru://` protocol handlers and links to `froyo://`.
    -   **UI Polish:** Updated all visible text, links, and the Update Modal to reflect the new brand.

### 6. Electron Updater Refactor
**Goal:** Make desktop updates a first-class subsystem with a stable main-process service, preload API, and renderer state model.
-   **Status:** **Implemented**.
-   **Key Implementations:**
    -   Moved Electron update orchestration into `electron/src/main/updater/`, with policy, state transitions, and install handoff owned by the main process.
    -   Replaced renderer polling and ad hoc update events with a single updater state snapshot plus `updater:state-changed`.
    -   Added a dedicated `window.updater` preload API and a shared renderer updater store for `UpdateModal`, Settings, and sidebar badges.
     -   Added dev-only updater test support through `electron/dev-app-update.yml` plus `FROYO_FORCE_DEV_UPDATES` / `FROYO_SIMULATE_DEV_UPDATE` overrides and the `electron/package.json` `start:update-test` script.
     -   Switched macOS release packaging to a universal updater ZIP to avoid architecture-specific checksum mismatches during desktop updates.
     -   Added release-note publishing automation so the `CHANGELOG.md` entry for each tag becomes the GitHub Release body consumed by FroYo's update dialog.
     -   Moved macOS `ffmpeg` and `ffprobe` packaging off host-specific `node_modules` binaries and into a CI download + `lipo` assembly step so release builds bundle deterministic universal binaries.
     -   Split macOS CI into an Intel x64 build job and an Apple Silicon arm64 build job, then merged those app bundles into the published universal release artifact.

### 7. Playback Navigation State Cleanup
**Goal:** Make the shared Now Playing / Last Watched nav entry follow the correct player-vs-details behavior for both active playback and retained history state.
-   **Status:** **Implemented**.
-   **Key Implementations:**
    -   `common/modules/nowPlayingNavigation.js` now routes retained `display` playback state through the details modal instead of reusing the active Now Playing maximize/toggle flow.
    -   `common/components/navigation/Sidebar.svelte` and `common/components/navigation/Navbar.svelte` now treat `Last Watched` as a details-modal shortcut, while active playback still uses the full-player/miniplayer toggle logic and icon states.
    -   `common/modals/details/DetailsModal.svelte` now ignores retained `Last Watched` state when checking for current playback, so replaying the same media re-enters the normal play flow and restores active Now Playing behavior.

---

### 8. PlayerPage Logic-Module Refactor (Phase 1)
**Goal:** Reduce the size and coupling of `common/routes/player/PlayerPage.svelte` (the repo's highest-churn file) by extracting pure logic into testable modules, without behavior changes or UI markup extraction.
-   **Status:** **Implemented** (2026-06-09).
-   **Key Implementations:**
    -   Deleted dead code: commented Presentation API/P2P cast blocks, the `menubarOffset` no-op, and the always-falsy `getBurnIn(noSubs)` parameter.
    -   `common/modules/playback/chapters.js` — chapter skip detection, normalisation, and seekbar mapping (unit tested in `playbackChapters.test.mjs`). The `chapters` write-back stays in the component: the normalise pass returns a new array, so the JSON-compare guard is live behavior, not dead code.
    -   `common/modules/playback/discordActivity.js` — pure Discord RPC activity builders (`discordActivity.test.mjs`); the component keeps the IPC emit and hidden/empty-media guards.
    -   `common/modules/playback/progress.js` — deduplicated episode-identity query (was 3×) and media cache key (was 6×), plus clamp and autocomplete predicates (`playbackProgress.test.mjs`).
    -   `common/modules/playback/audioGain.js` — store-backed Web Audio boost manager with injected cache deps (`audioGain.test.mjs`); component consumes `$gain`/`$volume`/`$volumeBoosted`.
    -   `common/routes/player/components/thumbnails.js` — seekbar thumbnail generation factory, callback-bridged (`getBuffer`), markup handlers unchanged via thin wrappers.
    -   `common/routes/player/components/keybinds.js` — default keybind table + icon imports; component passes action callbacks and `isViewAnime` as a getter so reactive mutations stay component-side.
    -   `common/routes/player/components/immerse.js` — UI auto-hide state machine with preserved debounce timings (1.5s playing / 5s paused) and token cancellation.
-   **Result:** PlayerPage.svelte 4,361 → 3,645 lines (~16%); 4 new unit-test suites. Deeper reduction requires touching the hard-coupled zones (`setCurrent`/HLS lifecycle, cast reactive derivations, pagePause machine) or a UI subcomponent pass — both deliberately out of scope for this phase.
-   **Deviation from plan:** the chapters phase kept the `chapters = normalised` write-back (plan assumed the guard was dead; it is not, because `normaliseChapters` returns a new array after its internal `.map()`). The stretch phase (startup buffer waiters) was not attempted per plan guidance.

---

## 🚧 Partial / In-Progress

### 1. Native Desktop Torrent Search Engine
**Goal:** Replace the hosted torrent-search dependency on desktop with a FroYo-native built-in search engine.
-   **Status:** **In Progress**.
-   **Plan:** [`docs/plans/2026-04-09-search-engine-v1.md`](/Users/nebulark/Documents/Workspace/PersonalProjects/FroYoflix_v2/docs/plans/2026-04-09-search-engine-v1.md)
-   **Tracker:** [`docs/plans/2026-04-09-search-engine-v1-tracker.md`](/Users/nebulark/Documents/Workspace/PersonalProjects/FroYoflix_v2/docs/plans/2026-04-09-search-engine-v1-tracker.md)
-   **Architecture Audit:** [`docs/plans/2026-04-09-provider-architecture-audit.md`](/Users/nebulark/Documents/Workspace/PersonalProjects/FroYoflix_v2/docs/plans/2026-04-09-provider-architecture-audit.md)
-   **Current Scope:**
    -   Electron-only rollout behind internal `useBuiltInSearchEngine` flag.
    -   `Nyaa` for anime, `YTS + Torrent Downloads` for movies, and `showRSS + Torrent Downloads` for TV.
    -   Fetching/parsing moved into Electron main-process IPC handlers.
    -   Existing torrent modal ranking, AniTomy parsing, dedupe, and peer scraping preserved after search.
    -   Anime query generation now uses a staged plan tuned to the old extension's behavior: preferred exact episode searches first, broader fallbacks later, and strict batch-only searches when batch mode is enabled.
    -   Torrent launch/queue now uses a dedicated `uri` field instead of overloading `link`, and the remaining episode/RSS/protocol callers have been aligned to that contract.

### 1. Managed Offline Library
**Goal:** Replace full download-folder scans with a managed filesystem + local index for offline browsing and playback.
-   **Status:** **In Progress**.
-   **Plan:** [`docs/plans/librarary_implementation.md`](/Users/nebulark/Documents/Workspace/PersonalProjects/FroYoflix_v2/docs/plans/librarary_implementation.md)
-   **Current State:**
    -   ✅ Added IndexedDB `library` store support in `common/modules/cache.js` with DB version bump to `2`.
    -   ✅ Added Electron IPC handlers for `library:move`, `library:scan`, `library:exists`, and `library:hash` in `electron/src/main/app.js`.
    -   ✅ Added library repository / ingest / path sanitizer / search state modules under `common/modules/library/`.
    -   ✅ Redirected torrent cache storage to `.froyo/cache` and torrent payloads toward `.froyo/incoming/<infoHash>/`.
    -   ✅ Added Library navigation, Library Home, and Library Search routes with offline section/search UX.
    -   ✅ Added managed-library playback lookup and local watch-state updates in `MediaHandler.svelte` and `PlayerPage.svelte`.
    -   ✅ Added search-driven manual metadata matching for library files, including imported items with missing metadata and library card poster/menu actions for re-selecting metadata.
    -   ✅ Added grouped Library Show cards that open the existing show details/episode UI, with locally missing episodes rendered as disabled `Local version not available` entries.
    -   ✅ **(2026-04-10)** Added desktop embedded text-subtitle extraction for library playback — Electron now probes local media for text subtitle streams, extracts them into the canonical `Subtitles/` sidecar folder next to the managed file, and registers those files in the existing library subtitle store so normal sidecar subtitle playback can pick them up on the same session and future plays.
    -   ✅ **(2026-04-10)** Moved local-library subtitle extraction off the click-critical path and added a staged player startup overlay — opening a locally managed episode now navigates to the player immediately, shows a Netflix-style progress overlay while playback is being prepared, and lets extracted sidecar subtitles join the current session after the player is already open.
    -   ✅ **(2026-04-10)** Added a configurable built-in player startup buffer threshold — playback now waits for a default 30 seconds of prepared startup media before auto-starting, and the threshold is exposed in Player settings so it can be tuned or disabled (`0`) per user preference. For local HLS transcodes the startup loop now warms the transcoder during `/init` instead of waiting for the first playlist request to kick it off, reports explicit transcode phases through `/status`, treats the threshold as a minimum prepared-media requirement before attaching `hls.js`, and gives the player an explicit `startPosition` signal so brand-new playback starts at `0` while future resume logic can plug into the same path cleanly.
    -   ✅ **(2026-04-10)** Fixed the details-modal local play contract for library-backed TMDB movies — local-first playback lookup now uses the same normalized provider/media identity as library ingest (`tmdbId` for TMDB items) instead of relying on the display media object's transient `id`, which prevents first-click fallthrough into the torrent modal while metadata is still hydrating.
    -   ✅ **(2026-04-10)** Unified details-modal play routing so secondary `play-media` actions no longer bypass local availability — buttons that previously forced the torrent modal now flow through the same local-first `play(...)` decision path as `Watch Now`, keeping library-backed playback behavior consistent across controls.
    -   ✅ **(2026-04-10)** Updated the Windows GitHub release workflow to stage `ffprobe.exe` from the same FFmpeg archive as `ffmpeg.exe`, so packaged Windows builds have the explicit probe binary needed by subtitle extraction.
    -   ✅ **(2026-06-09)** Fixed a player buffering-overlay regression for direct MP4 playback in `common/routes/player/PlayerPage.svelte` — the spinner now clears as soon as the media clock is advancing with playable data instead of waiting only for the initial `loadeddata` / `canplay` / `playing` events, which could leave the overlay stuck until the next seek.
    -   ✅ **(2026-06-09)** Changed the default managed download root to `Downloads/Froyo Library` on Electron and enabled `torrentPersist` by default, with startup directory creation in `electron/src/main/app.js` plus renderer-side fallback/reset handling in `common/modules/settings.js`, `common/modules/util.js`, and `common/routes/settings/tabs/ClientTab.svelte`.
	    -   ✅ **(2026-06-09)** Cleaned up torrent manager download-state UX in `common/routes/torrentManager/TorrentPage.svelte` and `common/routes/torrentManager/components/TorrentCard.svelte` so active playback reads `Playing`, staged background torrents read `Queued`, persisted partials read `Paused`, and the menu actions now say `Pause Download` / `Resume Download`.
	    -   ✅ **(2026-06-09)** Unified torrent playback and queue transitions across `client/core/webtorrent.js`, `common/modules/torrent.js`, and the torrent UI components so `Stop Playing` and miniplayer close now stop playback without removing incomplete torrents from active downloads, lone queued torrents auto-start when playback is idle, and the torrent modal/button labels now use the same `Playing` / `Downloading` / `Queued` / `Seeding` / `Completed` / `Paused` vocabulary as the manager.
	    -   ✅ **(2026-06-09)** Completed the follow-up UIX cleanup: unmatched library files now sort by latest scan/import time, completed torrents prefer local library playback, no-device Cast shows an explicit empty receiver state, inactive Schedule/Watch Together nav icons are hidden, support links point to Buy Me a Coffee, Now Playing navigation is shared across desktop/mobile, missing local episodes can prompt into torrent search while online, and the torrent manager empty state is centered and authoritative.
    -   ✅ **(2026-03-21)** Fixed season detection in `LibraryIngest.js` — added regex fallback (`SxxExx`) when the resolver doesn't return an explicit season number, preventing all TV episodes defaulting to season 1.
    -   ✅ **(2026-03-21)** Enhanced `LibrarySearch.svelte` with live poster hydration — unmatched/placeholder items auto-query the provider API (AniList or TMDB) using filename/folder heuristics so search results show real artwork instead of blank cards.
    -   ✅ **(2026-03-21)** Added `computeAllSections(limit)` to `LibraryRepository` — replaces 6 separate `listItems()` calls (6 × O(n) scans) with a single shared scan + version-keyed result cache (O(1) on re-navigation). Cache is invalidated atomically on every `setRaw` write.
    -   ✅ **(2026-03-21)** Added `LibraryLoading.svelte` full-screen overlay — shown immediately on page mount while `computeAllSections` runs in a deferred `setTimeout(0)`, eliminating the ~2 s blank freeze before first paint.
    -   ⚠️ Electron-first delivery: Android-side filesystem integration is still future work.
    -   ⚠️ Validation is currently limited to targeted unit testing for canonical path generation, subtitle extraction plan generation, and startup state transitions; a fresh live Electron playback check for the new startup overlay and same-session subtitle hydration is still pending.
-   **Deviations From Original Draft:**
    -   Removed the separate `libraryPath` setting for v1 and anchored the managed library at `torrentPathNew` to reduce migration complexity.
    -   Avoided a transient `libraryManaged` flag by persisting the managed incoming path in torrent cache metadata instead.
    -   Rebuild now indexes both canonical managed folders and incoming folders so the library can recover from cache loss or manual repair scenarios.

### 2. Intelligent Bitrate Selection
**Goal:** Allow users to choose video quality (e.g., 720p) to save bandwidth/CPU.
-   **Status:** **Frontend Only**.
-   **Current State:**
    -   ✅ **Frontend:** `PlayerPage.svelte` includes the 1080p/720p/480p UI.
    -   ❌ **Backend:** `transcoder.js` currently ignores the `quality` parameter.

### 3. TV Schedule Integration
**Goal:** Show upcoming TV episodes in a calendar view.
-   **Status:** **Partial / Rolled Back**.
-   **Context:** Backend logic exists in `sections.js` (`fetchTVSchedule`), but frontend integration was rolled back due to debugging complications. Code remains available for future re-integration.

### 4. TMDB Recommendations Interaction
**Goal:** Make TMDB recommendation cards interactive (clickable) like AniList cards.
-   **Status:** **In Progress**.
-   **Current State:**
    -   ❌ **Static:** Recommendations are currently static images without click handlers.
    -   **Plan:** [Implementation Plan](archive/IMPLEMENTATION_PLAN.md)
    -   **Implementation:**
        -   Update `tmdb-api.js` to return formatted `Media` objects.
        -   Update `DetailsModal.svelte` to use `SmallCard` for TMDB items.

### 5. Chromecast Playback Foundation
**Goal:** Prepare the playback stack for a standalone Chromecast sender implementation without inheriting the deprecated external-player flow.
-   **Status:** **In Progress**.
-   **Current State:**
    -   ✅ **(2026-06-08)** Added canonical playback-domain modules in `common/modules/playback/source.js` and `common/modules/playback/session.js` so torrent and library playback now share a normalized `PlaybackSource` plus target-aware `PlaybackSessionState`.
    -   ✅ **(2026-06-08)** Refactored `common/components/MediaHandler.svelte` and `common/modules/library/playback.js` so library and torrent entrypoints begin builtin playback through the same source/session path and keep `nowPlaying` as a compatibility snapshot derived from the active source.
    -   ✅ **(2026-06-08)** Removed external-player settings, UI branches, and worker plumbing from `common/routes/player/PlayerPage.svelte`, `common/routes/settings/tabs/PlayerTab.svelte`, `common/modules/torrent.js`, and `client/core/webtorrent.js`.
    -   ✅ **(2026-06-08)** Added unit coverage for playback source/session normalization plus successful Electron `pnpm web:build` validation after the refactor.
    -   ✅ **(2026-06-08)** Replaced the abandoned in-renderer Cast SDK experiment with an Electron main-process sender bridge using native receiver discovery plus Cast V2 control in `electron/src/main/cast/service.js`.
    -   ✅ **(2026-06-08)** Added Cast-safe HLS routing for unsupported local files, including fallback from FroYo's multi-audio master playlist to the receiver-compatible embedded-audio playlist for Chromecast sessions.
    -   ✅ **(2026-06-08)** Preserved the currently selected local audio track at cast start by threading the chosen track index through the Cast load payload and transcoder cache/init flow.
    -   ✅ **(2026-06-08)** Added v1 Cast text-subtitle carryover for local sidecar/extracted subtitles: the selected text subtitle is converted to WebVTT on demand and attached as an active Cast text track at load time.
    -   ✅ **(2026-06-08)** Added Cast session remote controls in `electron/src/main/cast/service.js` and `common/routes/player/PlayerPage.svelte` so play/pause, seek, mute, and volume changes are routed to the active Cast receiver while the local player pauses and the UI reflects remote playback state.
    -   ✅ **(2026-06-09)** Fixed two Cast handoff regressions in `common/routes/player/PlayerPage.svelte` — seekbar clicks/drags now compute the Cast target time before any async pause request so Cast seeking no longer races against pointer release, and ending a Cast session now restores local playback from a renderer-side snapshot that preserves the remote paused/playing state, resume time, and last known duration until local metadata is available again.
    -   ⚠️ Active subtitle switching during an existing Cast session, full alternate-audio switching on the receiver, torrent-embedded subtitle carryover, and image-subtitle support (PGS/VobSub) remain future phases.

---

## Future Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and investigations.
