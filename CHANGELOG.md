# Changelog

All notable changes to FroYo are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [1.0.0] - 2026-02-20

### Added

- Multi-media support extending the app beyond anime to TV shows and movies via TMDB integration.
- Unified `MediaProvider` interface and `common/modules/providers` registry supporting AniList, MAL, TMDB, and Trakt side-by-side.
- Title resolution system (`common/modules/resolver`) with `AnimeParser`, `TVShowParser`, and `MovieParser` to intelligently route file searches by naming pattern.
- Trailer support for TMDB items surfaced through the Details modal.
- Format dropdown replacing separate media type tabs, consolidating search routing into a single `searchByMediaType` interface.
- HLS caching with persistent transcode storage in `temp/froyo-transcode/{hash}` keyed by filepath and mtime.
- Smart transcoding fallback: `HandBrakeCLI` repair pipeline triggered on decoder failure for corrupted HEVC files.
- Active `stderr` monitoring in `transcoder.js` to detect "Error submitting packet to decoder" hangs and force-kill the stalled FFmpeg process.
- TMDB genre caching at the session level in `sections.js`, reducing genre list API calls by approximately 99%.
- Home banner rotation logic to reduce redundant API calls by 50-90%.
- Separate "Untrack" (safe, keeps files) and "Delete" (destructive, removes files) actions in the torrent modal.
- `safeCleanup()` method in `transcoder.js` to kill orphaned FFmpeg processes from previous app runs on startup.
- `DELETE /stop` transcoder endpoint and resumption logic to restart a stalled transcode if a playlist exists but the process is dead.
- `intentionalStops` set in the `Transcoder` class to distinguish user-initiated stops from real decoder crashes.
- Jobs Dashboard UI with tabbed interface (Repairs/Downloads) showing background video repair processes with real-time progress tracking.
- Repair process visibility: Active, queued, completed, and failed repair categorization with individual progress cards displaying name, status, progress bar, speed, and ETA.
- Cache management widget with "Repair Cache Size" display and confirmation modal for clearing cached repaired files with 5-second timeout countdown.
- HandBrake video repair queue with regex-based progress parsing of output to extract ETA and speed metrics, supporting single-job concurrency with IPC message bridging.
- Backend IPC handlers (`get-active-repairs`, `get-repair-cache-size`, `clear-repair-cache`) with real-time progress broadcast via `webContents.send()` every 1 second.
- Frontend Svelte store (`common/modules/jobs.js`) for repair state management with native `ipcRenderer.on()` event listening and 500ms polling fallback.
- Repair card responsive layout with fixed-width columns (Name: 400px, Status: 80px, Progress: flex-1, Speed/ETA: 90px/110px) and proper text truncation for hash display.

### Changed

- Rebranded the application from Shiru to FroYo across `package.json`, `capacitor.config.js`, electron configs, `AndroidManifest.xml`, `strings.xml`, `build.gradle`, and `NativeBridge.java`.
- Migrated Android native directory structure from `watch/shiru` to `watch/froyo`.
- Converted all `shiru://` deep-link protocol handlers and internal links to `froyo://`.
- Updated all visible UI text and the Update Modal to reflect the FroYo brand.
- `untrack(hash, deleteData)` now accepts an explicit boolean flag so callers control whether downloaded files are deleted.

### Fixed

- HEVC playback stalling indefinitely due to severe bitstream corruption triggering fatal decoder errors in FFmpeg and VideoToolbox.
- Repair pipeline looping indefinitely because repaired files were deleted with the transcode cache; resolved by storing repairs in a persistent `froyo-repair` directory.
- `HandBrakeCLI` repair incorrectly triggered by an intentional user stop (SIGKILL) rather than a real decoder crash.
- "Untrack" action silently deleting downloaded files from disk without warning.
- Torrent modal displaying "0 B" file size and incorrect upload dates due to `normalizeResult` failing to parse string-based size fields and non-standard date strings.
- Persistent zombie FFmpeg processes surviving app restarts due to missing process lifecycle management.
- Genre filter returning irrelevant trending content instead of zero results when no TMDB genre ID matched the selected AniList genre (e.g., "Mecha", "Sports").
- AniList-to-TMDB genre mapping gaps causing TV shows to appear under incorrect genre filters (e.g., "Action" mapped to "Action & Adventure", "Sci-Fi" mapped to "Sci-Fi & Fantasy").
- `fluent-ffmpeg` missing in the production build because it was incorrectly listed in webpack `externals`, causing an immediate launch crash.
- FFmpeg binary not found in the packed app (`ENOENT`); resolved by adding the binary to `extraResources` in `electron/package.json` and updating `transcoder.js` to use `process.resourcesPath`.
- Unhandled promise rejection from `electron-updater`'s `checkForUpdates()` crashing the app on launch; resolved by adding `.catch(() => {})` in `updater.js`.
- Cache widget misalignment in the Jobs/Repairs tab where the "Clear" button and "Repair Cache Size" text were not vertically aligned. Fixed by adding `actionClass="cache-action"` prop to ConfirmButton, positioning the Clear button at `top: 50px` with modal buttons appearing seamlessly above it (`top: 20px`), anchoring the cache size text with `align-self: flex-start`, unifying button styling (Clear button now uses `btn-outline-secondary` to match Cancel button), setting button widths to 120px for consistency, and applying CSS `position: absolute !important` to blockify the `display: contents` action-container per CSS spec.
