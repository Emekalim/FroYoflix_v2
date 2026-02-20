# Project Improvements Tracker

This document tracks major feature implementations, architectural improvements, and the future roadmap. It serves as a central reference for comparing **Implementation Plans** vs **Actual Code**.

## ✅ Completed Improvements

### 1. Multi-Media Support (Media Extension Overhaul)
**Goal:** Extend FroYo to support TV Shows, Movies, and mixed media types while preserving Anime functionality.
-   **Core Plans:** [Media Extension Plan](MEDIA_EXTENSION_PLAN.md), [TMDB Analysis](TMDB_COMPATIBILITY_ANALYSIS.md)
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
-   **Plan:** [HLS Caching Plan](HLS_CACHING_PLAN.md)
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

### 1. Intelligent Bitrate Selection
**Goal:** Allow users to choose video quality (e.g., 720p) to save bandwidth/CPU.
-   **Status:** **Frontend Only**.
-   **Current State:**
    -   ✅ **Frontend:** `PlayerPage.svelte` includes the 1080p/720p/480p UI.
    -   ❌ **Backend:** `transcoder.js` currently ignores the `quality` parameter.

### 2. TV Schedule Integration
**Goal:** Show upcoming TV episodes in a calendar view.
-   **Status:** **Partial / Rolled Back**.
-   **Context:** Backend logic exists in `sections.js` (`fetchTVSchedule`), but frontend integration was rolled back due to debugging complications. Code remains available for future re-integration.

### 3. TMDB Recommendations Interaction
**Goal:** Make TMDB recommendation cards interactive (clickable) like AniList cards.
-   **Status:** **In Progress**.
-   **Current State:**
    -   ❌ **Static:** Recommendations are currently static images without click handlers.
    -   **Plan:** Implementation Plan
    -   **Implementation:**
        -   Update `tmdb-api.js` to return formatted `Media` objects.
        -   Update `DetailsModal.svelte` to use `SmallCard` for TMDB items.

---

## Future Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and investigations.
