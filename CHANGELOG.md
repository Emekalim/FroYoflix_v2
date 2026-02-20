# Changelog

All notable changes to FroYo are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

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
