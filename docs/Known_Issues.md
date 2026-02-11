# Known & Resolved Issues

This document tracks technical hurdles, their root causes, and implemented solutions.

## ✅ Resolved Issues

### 1. HEVC Playback & Transcoding Stalls
> **Status**: **RESOLVED**
> **Resolution**: Implemented Smart Fallback with HandBrake repair + Persistent Storage.
> **Implementation**: See [Improvements Tracker - Item 2 & 4](../.gemini/antigravity/brain/c1a3742c-7f4d-45a9-94ca-baa87f1c35d0/improvements_tracker.md)

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
**Smart Fallback** to `HandBrakeCLI` has been implemented in [transcoder.js](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/electron/src/main/transcoder.js). It detects the decoder crash, kills the FFmpeg process, and triggers a repair.

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

