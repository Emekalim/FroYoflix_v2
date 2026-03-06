# Project Improvements Tracker

This document tracks major feature implementations, architectural improvements, and the future roadmap. It serves as a central reference for comparing **Implementation Plans** vs **Actual Code**.

## ✅ Completed Improvements

### Jobs & Repair UI
**Goal:** Implement background process visibility (HandBrake video repairs) and storage cache management with polished, aligned UI.
-   **Plan:** [Implementation Plan](file:///Users/franklin/.gemini/antigravity/brain/f3bd16ed-4554-46e5-94dd-061d53c88ba8/implementation_plan.md)
-   **Status:** **COMPLETED**
-   **Key Implementations:**
    -   `electron/src/main/transcoder.js`: Added regex progress parsing of HandBrake output to gather ETA/Speed % and added a single-job concurrency queue.
    -   `electron/src/main/app.js`: Added backend IPC handlers `get-active-repairs`, `get-repair-cache-size`, and `clear-repair-cache`. Broadcast repair-progress every 1 second via `webContents.send()`.
    -   `common/modules/jobs.js`: Created frontend Svelte store with proper event listener using native `ipcRenderer.on()` and 500ms polling fallback. Implemented repair categorization (active/queued/completed/errors).
    -   `common/routes/torrentManager/TorrentPage.svelte`: Migrated to "Jobs" tabbed UI (Repairs/Downloads). Implemented responsive column layout: Name (400px), Status (80px), Progress (flex-1), Speed/ETA (90px/110px fixed). Cache widget positioned on title line with `visibility: hidden` for layout stability.
    -   `common/routes/torrentManager/components/RepairCard.svelte`: Created repair progress card with centered Status text, flexible Progress bar, and truncated Name/Hash with proper vertical alignment.
    -   `common/components/navigation/Sidebar.svelte`: Renamed "Torrents" to "Jobs" with activity icon.
    -   **Cache Widget UI Polish:** Added `actionClass="cache-action"` prop to ConfirmButton for reliable CSS targeting. Fixed vertical alignment of Clear button (`top: 50px`) with modal buttons appearing directly above for seamless transition. Anchored "Repair Cache Size" text with `align-self: flex-start` to prevent movement when modal appears. Unified button styling (Clear button changed to `btn-outline-secondary` to match Cancel button). Set button widths to 120px for visual consistency. Applied `position: absolute !important` to action-container (blockified `display: contents` per CSS spec). Positioned modal at `top: 20px` so Cancel button aligns with Clear button position.
-   **Deviations:**
    - Replaced generic `fs.readdirSync` options for Node 18 compatibility during cache size calculation.
    - Used native `ipcRenderer.on()` instead of Bridge wrapper for event listening (Bridge wrapper doesn't forward data properly).
    - Added 500ms polling fallback to ensure continuous progress updates.
    - Redesigned column layout to Name: 400px fixed, Status: 80px centered, Progress: flex-1 (fills remaining space), Speed/ETA: fixed widths (90px/110px).
    - Font sizes: Name 1rem, Hash 0.9rem, Status 0.75rem to maintain readability while fitting on single lines.
-   **Blockers/Trade-offs:**
    - HandBrake emits progress on stdout AND stderr; managed via 1-second IPC throttles to prevent race conditions.
    - Column alignment required matching exact widths and padding across header and content divs for visual consistency.
-   **Related Issues/Dependencies:** N/A


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
    -   **Plan:** [Implementation Plan](archive/IMPLEMENTATION_PLAN.md)
    -   **Implementation:**
        -   Update `tmdb-api.js` to return formatted `Media` objects.
        -   Update `DetailsModal.svelte` to use `SmallCard` for TMDB items.

---

## Future Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and investigations.
