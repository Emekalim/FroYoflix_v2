# FroYo Roadmap

Future features and investigations under consideration. These are not committed to any release.

## Planned Features

### 1. Local Library Management System
**Goal:** Database-backed local media library.
-   **Planned Features:**
    -   SQLite Database to store file metadata.
    -   Background Scanner Service.
    -   Metadata Linking (Auto-match files to TMDB/AniList).
    -   Safe Renaming Utility.
    -   **Persistent Transcode Storage**: Setting to save repaired/transcoded files alongside originals to prevent re-encoding. Include setting to allow user toggle on or off keeping repaired/transcoded files, alongside originals.

### 2. Advanced Subtitle Support
**Goal:** Client-side rendering of ASS/SSA/PGS subtitles.
-   **Plan:** Extract subtitles to WebVTT to reduce server-side burning and transcoding CPU load.

### 3. Pirate Bay Query Formatting
**Goal:** Optimize search queries for non-anime content.
-   **Plan:** [Pirate Bay Implementation Plan](archive/PIRATE_BAY_IMPLEMENTATION_PLAN.md)
-   **Details:** Update `worker.js` and `piratebaysrc` to format queries differently for TV ("Show S01E01") vs Movies ("Movie Year").

### 4. Jobs & Repair UI
**Goal:** Visualize background processes like downloads and repairs.
-   **Plan:** Transform "Downloads" tab into a "Jobs" dashboard.
-   **Features:**
    -   Real-time progress bars for HandBrake repairs.
    -   Download status and speed.
    -   Queue management.
    -   **Repair Cache Management**: LRU eviction or manual clearing for `froyo-repair` to manage disk usage.

### 7. Auto-Updater System (Conceptual Implementation)
**Goal:** Establish a functional auto-update pipeline for FroYo, iterating on the legacy Shiru architecture.
-   **Context:**
    -   FroYo currently lacks a fully functional update mechanism.
    -   We are porting and adapting functionality from the legacy Shiru codebase, but significant infrastructure setup is required.
-   **Planned Implementation:**
    -   **Foundation:** Configure `electron-updater` with robust error handling (preventing crashes on private/network failures).
    -   **Infrastructure:** Set up release publishing workflows (GitHub Actions or equivalent).
    -   **User Experience:** Implement "checking," "downloading," and "restart to install" UI flows that were present in Shiru but are missing or broken in FroYo.

## Under Investigation

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
    -   Start new `ffmpeg` process with seek parameter: `-ss <timestamp>`.
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
