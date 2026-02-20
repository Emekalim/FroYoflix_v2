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
    -   Stateless stateless serving of HLS playlists via `transcoder.js`.
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

### 6. Fast-Seeking (Feasibility Analysis)
**Goal:** Reduce seek latency by starting transcoding at the requested timestamp instead of linear processing.
-   **Current Architecture:**
    -   `ffmpeg` starts at `00:00:00` and processes sequentially.
    -   Playlist (`m3u8`) grows linearly.
    -   **Pros:** Simple implementation, perfect for "Start from beginning".
    -   **Cons:** Seeking forward (e.g., to 45:00) requires waiting for `ffmpeg` to process everything from 00:00 to 45:00.
-   **Proposed Solution (On-Demand Transcoding):**
    -   Detect seek requests (via HLS playlist query or custom API).
    -   Kill current `ffmpeg` process.
    -   Start new `ffmpeg` process with seeek parameter: `-ss <timestamp>`.
-   **Challenges:**
    1.  **Playlist Continuity:**
        -   The standard HLS player expects a contiguous playlist. If we jump, we must insert `#EXT-X-DISCONTINUITY` tag.
        -   Sequence numbers must be managed carefully to avoid player confusion.
    2.  **Segment Alignment:**
        -   New segments starting at 45:00 must be perfectly aligned with the HLS grid (e.g., if segments are 10s, 45:00 is exactly segment #270).
        -   If `ffmpeg` starts at 45:00.500 due to keyframe snapping, the segment name/timestamp might drift, causing playback glitches.
    3.  **Buffer Gaps:**
        -   Seeking back would require *another* restart unless we maintain multiple active transcodes (heavy on CPU) or merge playlists (very complex).
    4.  **Browser Caching:**
        -   If `segment_270.ts` is generated from a linear scan vs a seek scan, the binary data might differ slightly (due to encoding context). Local caching might serve the wrong version.
-   **Verdict:** **High Complexity / High Risk**.
    -   **Recommendation:** Stick to linear transcoding for now. If seek performance becomes critical, investigate **Stream Copying** (remuxing without re-encoding) which is 100x faster but requires the source codec to be compatible (often invalid for MKV -> MP4 flows).

### 7. Auto-Updater System (Conceptual Implementation)
**Goal:** Establish a functional auto-update pipeline for FroYo, iterating on the legacy Shiru architecture.
-   **Context:**
    -   FroYo currently lacks a fully functional update mechanism.
    -   We are porting and adapting functionality from the legacy Shiru codebase, but significant infrastructure setup is required.
-   **Planned Implementation:**
    -   **Foundation:** Configure `electron-updater` with robust error handling (preventing crashes on private/network failures).
    -   **Infrastructure:** Set up release publishing workflows (GitHub Actions or equivalent).
    -   **User Experience:** Implement "checking," "downloading," and "restart to install" UI flows that were present in Shiru but are missing or broken in FroYo.
