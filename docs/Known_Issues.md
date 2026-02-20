# Known & Resolved Issues

> **Scope:** Development-time issues — bugs found during local development, test failures, and non-critical behavioral quirks.
> Add new issues here. For issues that only appear in production builds (packaged app), use `production_known_issues.md`.
>
> **Status tags:** `RESOLVED` · `IN PROGRESS` · `MONITORING` · `BLOCKED`
>
> **Adding an entry:** Include file paths and line numbers, the root cause, and any failed approaches tried.

This document tracks technical hurdles, their root causes, and implemented solutions.

## ✅ Resolved Issues

### 1. HEVC Playback & Transcoding Stalls
> **Status**: **RESOLVED**
> **Resolution**: Implemented Smart Fallback with HandBrake repair + Persistent Storage.
> **Implementation**: See [Improvements Tracker - Item 2 & 4](./Improvements_Tracker.md)

**Issue Description:**
Video playback buffers indefinitely or freezes at a specific timestamp (approx. 30:00) for certain HEVC (H.265) encoded files. Transcoding logs reveal critical decoder errors at this point.

**Symptoms:**
- **Playback**: Video plays normally until ~30 minutes, then buffers forever or freezes on a single frame.
- **Transcoder**: 
    - **Hardware Mode (`videotoolbox`)**: Fails with `Error submitting packet to decoder` and aborts.
    - **Software Mode (`libx264` + `hevc` decoder)**:
        - Without error flags: Freezes/loops on the last valid frame or outputs empty (1KB) segments.
        - With aggressive error flags (`+discardcorrupt`): Still crashes with `Invalid data found when processing input`.
- **Logs**:
    ```text
    [FFmpeg] [hevc @ 0x...] Error parsing NAL unit #0.
    [FFmpeg] [vist#0:0/hevc @ 0x...] Error submitting packet to decoder: Invalid data found when processing input
    ```

**Technical Root Cause:**
The source file contains **severe bitstream corruption (`Invalid NAL unit`)** around the 30-minute mark. 
- **FFmpeg's `hevc` decoder** is strict and considers this corruption fatal, causing the demuxer or decoder to abort the entire stream processing.
- **Hardware Decoders (VideoToolbox)** are even stricter and often crash or reset the hardware pipe when encountering invalid NAL units (as noted in FFmpeg regression tickets).

**Why VLC Plays It (Detailed Breakdown):**
VLC Media Player's resilience comes from its unique architecture around **libavcodec**:
1.  **Custom Packetizers**: VLC uses its own "packetizer" modules that sit *before* the decoder. These modules analyze the raw bitstream (NAL units in HEVC) and can fix timestamps, discard invalid data, or repackage frames *before* passing them to `libavcodec`. FFmpeg's `hevc` decoder often receives the raw stream directly from the file demuxer.
2.  **Error Concealment**: VLC enables specific `libavcodec` flags like `AV_CODEC_FLAG2_FAST` and internal error concealment strategies that prioritize *showing something* over showing *correct* data. Standard FFmpeg builds often default to strict correctness.
3.  **Frame Dropping**: When VLC detects a corrupted frame, it silently drops it and immediately renders the *previous* frame again until the next valid keyframe arrives. FFmpeg's transcoding pipeline tries to decode every frame to maintain sync, leading to the crashes/freezes we see.

**OS Isolation & Cross-Platform Analysis:**
-   **Partially**: The specific crash `Error submitting packet to decoder` was triggered by **VideoToolbox**, which is the hardware acceleration framework exclusive to **macOS**.
-   **Ideally**: On **Windows** (using `DXVA2`/`D3D11VA`) or **Linux** (`VAAPI`/`NVDEC`), the hardware driver *might* handle the corruption more gracefully (e.g., showing a green block instead of crashing), or it might crash just as hard.
-   **Software Reality**: However, since our *software* decoding attempt (`libx264` + standard `hevc` decoder) also failed with `Invalid data` on macOS, this indicates the **bitstream corruption is severe enough to crash the standard cross-platform FFmpeg decoder**. Therefore, this file would likely fail on Windows and Linux FFmpeg builds as well.

**Implemented Solution:**
**Smart Fallback** to `HandBrakeCLI` has been implemented in [transcoder.js](../electron/src/main/transcoder.js). It detects the decoder crash, kills the FFmpeg process, and triggers a repair.

**Update (2026-02-11): Repair Loop & Performance**
> **Status**: **RESOLVED**
> **Issue**: Repair would loop indefinitely because the repaired file was deleted with cache.
> **Fix**: Implemented `froyo-repair` persistent directory.
> **Optimization**: Repaired files are now **Stream Copied** (`-c copy`) for instant playback.

**Repair Performance & Limitations:**
-   **Speed**: The `HandBrakeCLI` repair process performs a full re-encode to ensure a clean file structure. On typical hardware, this occurs at ~25-30fps (approx. 0.5x - 1x realtime), meaning a 2-hour movie may take 1-2 hours to repair.
-   **No Concurrent Streaming**: Users *cannot* watch the video while it is being repaired. The repair process must complete fully before HLS segmentation can begin on the safe file.
-   **Future Work**:
    -   Optimizing HandBrake presets (e.g., `Super Fast` or `Ultrafast`).
    -   Enabling hardware acceleration for the repair step itself.


### 2. Untrack Deletes Files
> **Status**: **RESOLVED**
> **Resolution**: Separated "Untrack" (safe) and "Delete" (destructive) actions.
> **Implementation**: Updated backend to support `deleteData` flag; added explicit "Delete" button in UI.

**Issue Description:**
The "Untrack" option in the torrent modal previously removed the torrent from the client **and** deleted the downloaded files from the disk without warning.

**Technical Root Cause:**
The `untrack` function unconditionally sent a message to the torrent worker which called `remove` with `{ destroyStore: true }`. This was a legacy default behavior that equated "untracking" with "complete removal".

**Implemented Solution:**
1.  **Backend**: Updated `untrack(hash, deleteData)` to accept a boolean flag. The worker now uses this flag to determine whether to pass `destroyStore: true` (delete files) or `destroyStore: false` (keep files).
2.  **Frontend**:
    -   **Untrack**: Now calls `untrack(hash, false)`. It removes the torrent from the client list but **preserves** user data.
    -   **Delete**: New red button added. Calls `untrack(hash, true)` to explicitly delete the torrent and its data.


### 3. Torrent Modal Inaccurate Metadata
> **Status**: **RESOLVED**
> **Resolution**: Fixed string size parsing and normalized date handling in `handler.js`.
> **Implementation**: Updated `normalizeResult` to correctly parse string-based file sizes and invalid date formats.

**Issue Description:**
The Torrent Modal displayed search results with "0 B" size and incorrect dates because the application failed to parse specific metadata formats returned by extensions.

**Technical Root Cause:**
The `normalizeResult` function in `handler.js` failed to parse string-based size fields (e.g., "1.81 GiB") and non-standard date strings, causing them to default to zero or the current time.

**Implemented Solution:**
Updated the result normalization logic to:
1.  **Sizes**: Detect and parse string-based size fields into bytes.
2.  **Dates**: Parse various date string formats and handle edge cases (like year 2001 defaults) to ensure accurate upload dates are displayed.

### 4. Persistent Zombie FFmpeg Processes
> **Status**: **RESOLVED**
> **Resolution**: implemented Explicit Lifecycle Management.
> **Implementation**: 
> 1.  **Backend**: `transcoder.js` now includes a `safeCleanup()` method to kill zombie processes from previous runs/versions on startup. Added `DELETE /stop` endpoint.
> 2.  **Frontend**: `PlayerPage` now calls `/stop` when switching videos, but *allows* background transcoding when navigating away (removed `onDestroy` kill).
> 3.  **Resumption**: Added safety check to restart transcoding if a playlist exists but the process is dead (stalled state).

**Issue Description:**
`ffmpeg` processes spawned for HLS transcoding persist even after the user quits the app or previous versions left "zombie" processes (e.g., from legacy "Shiru" builds).

**Technical Root Cause:**
Lack of explicit process termination signals from the frontend and no startup cleanup logic to handle orphaned processes from crashed/force-quit sessions.

---

### 5. HandBrake Repair Triggered by Stop (False Positive)
> **Status**: **RESOLVED**
> **Resolution**: Implemented "Intentional Stop" State Tracking.
> **Implementation**: Updated `transcoder.js` to track explicit stop requests and ignore resulting `SIGKILL` errors.

**Issue Description:**
Stopping playback or closing the application inadvertently triggered the "Smart Fallback" `HandBrakeCLI` repair mechanism, causing high CPU usage on a healthy file.

**Symptoms:**
-   User navigating away from a video or closing the app caused a background `HandBrakeCLI` process to start.
-   Logs showed `ffmpeg was killed with signal SIGKILL` followed by `Critical failure detected. Initiating Smart Fallback repair...`.

**Technical Root Cause:**
The `error` event handler in `transcoder.js` was designed to catch *decoder crashes* which often manifest as the process killing itself (or being killed by the OS) with `SIGKILL`. The handler did not distinguish between an **unintentional crash** (which needs repair) and an **intentional stop** (triggered by `stop()` or the `/stop` endpoint) which also uses `SIGKILL` for immediate termination.

**Implemented Solution:**
1.  **State Tracking**: Introduced `this.intentionalStops = new Set()` in the `Transcoder` class.
2.  **Flagging**: When `stop()` or `DELETE /stop` is called, the specific file hash is added to `intentionalStops` *before* sending the kill signal.
3.  **Conditional Handling**: The `error` handler now checks `if (this.intentionalStops.has(hash))` before triggering the repair logic. If found, the error is ignored, and the hash is removed from the set.

### 6. Genre Filter Mismatch (TMDB)
> **Status**: **RESOLVED**
> **Resolution**: Implemented Strict Filtering & Advanced Genre Mapping.
> **Implementation**: Updated [sections.js](../common/modules/sections.js) to map AniList genres to TMDB equivalents (e.g., Action -> Action & Adventure) and enforcing strict filtering on API and client side.

**Issue Description:**
Movies and TV Shows appeared in genre filters (e.g., "Sports", "Mecha", "Sci-Fi") but did not have that specific genre tag listed on their details page. This was due to:
1.  **Genre Mapping Gaps**: TMDB uses combined genres for TV (e.g., "Action & Adventure") while AniList uses separate ones.
2.  **Fallback Behavior**: When no matching genre ID was found (e.g., "Mecha"), the API request fell back to "Trending", returning irrelevant popular shows.

**Implemented Solution:**
1.  **Strict Filtering**: If a user selects a genre and no matching TMDB ID exists, the system now returns **0 results** instead of falling back to trending.
2.  **Smart Mapping**:
    -   Mapped `Action`, `Adventure` -> `Action & Adventure` (TV)
    -   Mapped `Sci-Fi`, `Fantasy` -> `Sci-Fi & Fantasy` (TV)
    -   Mapped `War` -> `War & Politics` (TV)
3.  **Client-Side Parity**: Updated client-side filtering to respect these mappings even when using the search endpoint.

## Known Issues
### 1. Player State Glitch on Error
> **Status**: **MONITORING**
> **Resolution**: Implemented robust cleanup in `PlayerPage.svelte` (try/finally, src removal).
> **Note**: Needs robust testing across various error scenarios before closing.

**Issue Description:**
If a video fails to play (e.g., transcoding error or network issue), the player may get "stuck" in a broken state. Subsequent attempts to play *any* video (even healthy ones) fail because the previous video's state is not fully cleared. This often manifests as the player unexpectedly opening the Torrent Modal instead of playing a local file.

**Symptoms:**
-   After a playback error, clicking another episode results in an infinite loading spinner or black screen.
-   The player debug logs might show it trying to attach to the *previous* HLS instance or video source.
-   **Specific Behavior**: The `<video>` element trigger an `ended` event immediately upon error/load failure. This event is bound to `tryPlayNext()`, which attempts to play the next episode. If the playlist state is invalid (due to the error), `playNext` falls back to `openTorrentModal()`, confusing the user.

**Technical Root Cause:**
1.  **Event Listener Race Condition**: The `<video>` tag has `on:ended={tryPlayNext}`. When `setCurrent` fails or the video source is invalid, the browser or HLS.js may fire `ended`.
2.  **Improper Cleanup**: `hls.destroy()` is called at the *start* of `setCurrent`, but if an error occurs *during* setup (transcoder failure), the old HLS instance might still be attached or ghost events might fire.
3.  **Persistent Src**: The `video.src` attribute is not forcibly cleared (`removeAttribute`) before starting a new HLS load, causing the player to potentially try reloading the broken URL.

**Implemented Fix:**
-   Wrapped `setCurrent` in `try...catch...finally`.
-   Explicitly destroying `hls` and removing `video.src` at start.
-   Preventing ghost state by nullifying variables on error.












