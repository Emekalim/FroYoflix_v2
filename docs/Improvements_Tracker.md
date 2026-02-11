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
-   **Plan:** [Smart Fallback Implementation Plan](../.gemini/antigravity/brain/c1a3742c-7f4d-45a9-94ca-baa87f1c35d0/implementation_plan.md)
-   **Status:** **Fully Implemented**.
-   **Deviations:** Added active `stderr` monitoring in `transcoder.js` to detect "Error submitting packet to decoder" hangs and force-kill (`SIGKILL`) the process, triggering the `HandBrakeCLI` repair pipeline.

### 3. HLS Caching Architecture
**Goal:** Enable seeking, persistence, and efficient streaming.
-   **Plan:** [HLS Caching Plan](HLS_CACHING_PLAN.md)
-   **Status:** **Implemented**.
-   **Implementation:**
    -   Transcode artifacts stored in `temp/froyo-transcode/{hash}`.
    -   Stateless stateless serving of HLS playlists via `transcoder.js`.
    -   Persistent caching using content-based hashing (`filepath` + `mtime`).

### 4. Search & Performance Optimizations
**Goal:** Improve responsiveness and reduce API usage.
-   **Status:** **Implemented**.
-   **Features:**
    -   **TMDB Genre Caching:** `sections.js` caches genre lists per session, reducing API calls by ~99%.
    -   **Format Dropdown:** Refactored search routing to support single or multi-format queries efficiently.

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

---

## 🚀 Future Roadmap

### 1. Local Library Management System
**Goal:** Database-backed local media library.
-   **Planned Features:**
    -   SQLite Database to store file metadata.
    -   Background Scanner Service.
    -   Metadata Linking (Auto-match files to TMDB/AniList).
    -   Safe Renaming Utility.
    -   **Persistent Transcode Storage**: Setting to save repaired/transcoded files alongside originals to prevent re-encoding. Include setting to allow user toggle on or of keeping repaired/trasncoded files, alongside originals.

### 2. Advanced Subtitle Support
**Goal:** Client-side rendering of ASS/SSA/PGS subtitles.
-   **Plan:** Extract subtitles to WebVTT to reduce server-side burning and transcoding CPU load.

### 3. Pirate Bay Query Formatting
**Goal:** Optimize search queries for non-anime content.
-   **Plan:** [Pirate Bay Implementation Plan](PIRATE_BAY_IMPLEMENTATION_PLAN.md)
-   **Details:** Update `worker.js` and `piratebaysrc` to format queries differently for TV ("Show S01E01") vs Movies ("Movie Year").

### 4. Jobs & Repair UI
**Goal:** Visualize background processes like downloads and repairs.
-   **Plan:** Transform "Downloads" tab into a "Jobs" dashboard.
-   **Features:**
    -   Real-time progress bars for HandBrake repairs.
    -   Download status and speed.
    -   Queue management.
    -   **Repair Cache Management**: LRU eviction or manual clearing for `froyo-repair` to manage disk usage.

### 5. Transcoding Active Streams (Investigation)
**Goal:** Apply repair logic to *downloading* torrents for "Play While Downloading".
-   **Current Behavior:** Active torrents bypass the transcoder/repair pipeline entirely (streamed via WebTorrent). If corrupted, they crash the player.
-   **Cons:**
    -   **Double Failure:** Fighting network lag + file corruption simultaneously.
    -   **Seek Issues:** HandBrake requires a complete file to write a valid MP4 header (MOOV atom). Repairing a growing file is unstable.
    -   **Performance:** 4x CPU load (Download + Repair + Transcode + Stream).
-   **Pros:**
    -   Seamless "Click & Play" experience even for broken releases.
-   **Note on Healthy Files:**
    -   Standard `.mkv` files (not corrupted) *can* technically be streamed while downloading by piping them through the standard FFmpeg HLS transcoder (not the HandBrake repair pipeline).
    -   This would require updating the **Torrent Engine** to serve streams via the Transcoder proxy instead of raw HTTP.
-   **Conclusion:** Prioritize "Download First -> Auto-Repair" over "Live Repair".
