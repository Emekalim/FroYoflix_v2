# Search Engine V1 Implementation Tracker

## Status
- Current state: `IN PROGRESS`
- Iteration owner: `Codex`
- Scope: Electron-only built-in search engine for `Nyaa`, `YTS`, `showRSS`, and `Torrent Downloads`

## Decisions Locked
- Desktop-first only for this iteration
- Internal rollout flag only, no user-facing toggle yet
- Electron main-process IPC is the fetch path
- No silent fallback to the old hosted/extension path while the flag is enabled
- Future trackers are added as built-in adapter modules, not remote extension scripts

## Checklist
- [x] Create implementation plan doc
- [x] Create cross-session implementation tracker
- [x] Add internal settings flag
- [x] Add common search-engine query builder and registry
- [x] Add Electron IPC search-engine service
- [x] Add Nyaa adapter
- [x] Add YTS adapter
- [x] Add Torrent Downloads adapter
- [x] Add showRSS adapter
- [x] Integrate built-in path into torrent search flow
- [x] Add common search-engine tests
- [x] Add Electron search-engine parser tests
- [x] Validate behavior manually in Electron runtime
- [x] Replace the initial TV/movie source mix after live tracker review
- [x] Broaden anime query handling with batch fallback and wider episode variants
- [x] Review `SourceExtensions_2` query-generation heuristics and apply a cleanup pass to built-in query ordering

## Next Steps
- Validate consolidated movie results in the torrent modal with `YTS + Torrent Downloads`
- Validate TV episode search quality with `showRSS + Torrent Downloads` on both recent and older episodes
- Capture any live showRSS title-matching misses and tighten show selection if needed
- Decide whether to keep dormant `1337x` / `EZTV` adapters for future optional use or remove them after rollout
- Consider a later scoring pass that uses tracker-specific “primary title only” behavior for especially noisy sources without changing the shared query contract

## Blockers
- None currently

## Verification Log
- Standalone Node test coverage added for query building, runtime gating, and tracker parsing
- Electron app launched successfully on April 9, 2026 with the built-in search engine code included in the main bundle
- Temporary startup smoke run in Electron main process confirmed live tracker responses:
  - `Nyaa`: 5 results for `Frieren: Beyond Journey's End` episode-style search
  - `1337x`: 8 results for `Dune (2021)` movie-style search
- Temporary smoke instrumentation was removed immediately after verification
- Parser coverage now includes `YTS` and `EZTV` adapters alongside `Nyaa` and `1337x`
- Live source review on April 9, 2026 found:
  - `KickassTorrents`: challenge-blocked, not suitable for direct integration
  - `EZTV`: intermittently challenge-blocked
  - `showRSS`: reachable and exposes per-show RSS feeds
  - `Torrent Downloads`: reachable and exposes search RSS feeds
- Parser coverage now also includes `showRSS` and `Torrent Downloads`
- Nyaa now falls back from batch queries to episode queries and the built-in query builder now emits both padded and unpadded anime episode variants
- `SourceExtensions_2` review confirmed a useful TV fallback pattern (`S01E##` when season is missing) and reinforced using a more opinionated primary query order; that logic is now reflected in the shared query builder
- Anime/Nyaa query execution now follows an explicit staged plan from the builder instead of inventing extra adapter-side terms; exact padded episode searches run first, broader title-only searches run later, and batch mode now stays batch-only instead of falling back to single-episode searches
- Torrent playback now uses a strict `uri` contract end-to-end instead of overloading `link`; stale episode/RSS callers and protocol handlers were updated on April 10, 2026, and torrent cards now guard against missing filenames so malformed rows no longer spam `undefined.replace`
- Raw hash validation now requires full 40-character info-hashes; previous `8-40` acceptance let impossible identifiers through the queue/download path, which surfaced as `Invalid torrent identifier` in WebTorrent during staged downloads
- Desktop library playback now triggers embedded text-subtitle extraction for local files before player initialization; extracted sidecars are written into the managed `Subtitles/` folder and registered in the library subtitle store so the normal subtitle loader can surface them on the same play session

## Deviations
- Parsing is implemented with small targeted HTML parsing helpers rather than a larger Jackett-style definition runtime
- The first iteration keeps built-in tracker selection fixed by media type instead of a configurable provider UI
- The original `EZTV + 1337x` TV/movie mix was replaced after live accessibility review with `showRSS + Torrent Downloads` for TV and `YTS + Torrent Downloads` for movies
- The shared query builder now prioritizes preferred titles and exact query shapes first, instead of treating all title variants as equally important
- The Nyaa adapter now trusts the query builder's staged anime plan and only falls back to broader searches when earlier exact stages fail; batch mode no longer falls back to singles, and Unicode query sanitizing now preserves non-Latin anime terms
