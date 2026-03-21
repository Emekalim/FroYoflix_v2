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

### 5. Rebranding to FroYo
**Goal:** Transition from "Shiru" to "FroYo" for consistent branding.
-   **Status:** **Fully Implemented**.
-   **Key Implementations:**
    -   **Core Configs:** Updated `package.json`, `capacitor.config.js`, and electron configs.
    -   **Android Native:** Migrated `watch/shiru` directory structure to `watch/froyo`, updated `AndroidManifest.xml`, `strings.xml`, `build.gradle`, and `NativeBridge.java`.
    -   **Refactored Deep Links:** Converted all `shiru://` protocol handlers and links to `froyo://`.
    -   **UI Polish:** Updated all visible text, links, and the Update Modal to reflect the new brand.

---

## 🚧 Partial / In-Progress

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
    -   ✅ **(2026-03-21)** Fixed season detection in `LibraryIngest.js` — added regex fallback (`SxxExx`) when the resolver doesn't return an explicit season number, preventing all TV episodes defaulting to season 1.
    -   ✅ **(2026-03-21)** Enhanced `LibrarySearch.svelte` with live poster hydration — unmatched/placeholder items auto-query the provider API (AniList or TMDB) using filename/folder heuristics so search results show real artwork instead of blank cards.
    -   ✅ **(2026-03-21)** Added `computeAllSections(limit)` to `LibraryRepository` — replaces 6 separate `listItems()` calls (6 × O(n) scans) with a single shared scan + version-keyed result cache (O(1) on re-navigation). Cache is invalidated atomically on every `setRaw` write.
    -   ✅ **(2026-03-21)** Added `LibraryLoading.svelte` full-screen overlay — shown immediately on page mount while `computeAllSections` runs in a deferred `setTimeout(0)`, eliminating the ~2 s blank freeze before first paint.
    -   ⚠️ Electron-first delivery: Android-side filesystem integration is still future work.
    -   ⚠️ Validation is currently limited to targeted unit testing for canonical path generation; broader repo lint/build tooling was unavailable in this workspace.
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

---

## Future Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and investigations.
