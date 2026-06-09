<!-- # Changelog

All notable changes to FroYo are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) -->

## [1.1.0] - 2026-06-09

### Improved
- Added Chromecast playback support with receiver discovery, remote play/pause/seek/volume controls, subtitle carryover improvements, and more reliable cast-to-local handoff behavior.
- Managed downloads now default to `Downloads/Froyo Library` on first initialization, keep torrent data by default, and include clearer torrent manager states, labels, and empty-state messaging.
- Changes made to improve playback and navigation user experience across local library playback, torrent playback, and the shared Now Playing / Last Watched entry.

### Fixed

- Resolved a playback glitch that could leave the buffering overlay stuck during direct MP4 playback.
- Resolved playback glitches that could send Last Watched / Now Playing to the wrong screen or leave the nav entry stuck in Last Watched mode after replaying the same title.
- Fixed torrent playback handoff issues so stopping playback no longer incorrectly drops active incomplete downloads from managed torrent state.

## [1.0.3] - 2026-06-08

### Improved

- Desktop updates on macOS now fall back to downloading the release ZIP directly when the app is still unsigned, so you can replace the app manually instead of hitting a failed in-app install.

### Fixed

- Fixed a production desktop crash where YouTube playback could fail if the local embed helper server had not finished binding to a port yet.
- Fixed release reruns on existing tags so mac assets can be replaced instead of being silently skipped by the publish step.

## [1.0.2] - 2026-06-06

### Added

- Managed Library browsing for your locally available titles, with faster offline access to movies and shows you already have.
- Better local subtitle handling on desktop, including extraction of embedded text subtitles from supported media files.

### Improved

- Faster local playback startup, with a clearer loading experience while FroYo prepares a stream.
- More reliable desktop update flow, including a redesigned update dialog with clearer status states and actions.
- Better library matching and playback routing for locally managed content.

### Fixed

- Fixed multiple local-play glitches that could open the torrent flow instead of starting available library content.
- Fixed season detection and metadata matching issues that made some library items appear incorrectly.
- Fixed several updater and release issues that could make desktop updates fail or show incomplete release notes.

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
