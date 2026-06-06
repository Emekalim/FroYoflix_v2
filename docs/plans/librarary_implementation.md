# Enhanced Library Feature Plan

## Context
FroYo currently has no managed library — downloaded files land wherever `torrentPathNew` points with no indexing, no structured layout, and no UI surface for offline browsing. This plan implements a **managed filesystem + IndexedDB index** that makes the offline experience feel like a parallel offline version of Home + Search. The original plan (`547d59d4` in Gemini brain) correctly identifies the goal; this document adds precise integration points, reusable code hooks, and execution details found by codebase analysis.

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `common/modules/navigation.js` | Add `page.LIBRARY` route constant |
| `common/modules/cache.js` | Add `LIBRARY` IndexedDB store to `caches` object (line 26–42) |
| `common/modules/settings.js` | Add `libraryPath` setting (defaults to `torrentPathNew` or fallback) |
| `common/modules/util.js` | Reuse `subtitleExtensions`, `subRx`, `videoExtensions`, `videoRx` (lines 745–749) |
| `common/modules/torrent.js` | Hook into torrent `'completed'` event to trigger ingest pipeline (lines 232–240) |
| `electron/src/main/app.js` | Add IPC handlers: `library:move`, `library:scan`, `library:hash` |
| `common/routes/Router.svelte` | Add `page.LIBRARY` dispatch block (after line 48) |

## New Files to Create

| File | Purpose |
|------|---------|
| `common/modules/library/LibraryRepository.js` | IndexedDB CRUD layer for library records |
| `common/modules/library/LibraryIngest.js` | Ingest pipeline: resolve → canonicalize → commit |
| `common/modules/library/pathSanitizer.js` | Cross-platform safe filename builder |
| `common/modules/library/fastHash.js` | First+last 1MB file hasher (partial read) |
| `common/routes/library/LibraryPage.svelte` | Library home (carousels, identical shell to HomePage) |
| `common/routes/library/LibrarySearch.svelte` | Library grid (offline filters, reuses SearchPage grid) |

---

## Phase 1 — Filesystem Layout

### Managed Folder Structure
Under `settings.libraryPath` (defaults to `torrentPathNew`):
```
Movies/<Title (Year)>/<Title (Year)>.<ext>
Movies/<Title (Year)>/Subtitles/<Title (Year)>.<lang>.<ext>
Shows/<Title>/Season 01/<Title> - S01E01.<ext>
Anime/<Title>/Season 01/<Title> - S01E01.<ext>
.froyo/incoming/<infoHash>/         ← active downloads land here
.froyo/library-metadata/            ← poster cache, NFO files
```

### pathSanitizer.js
Build canonical paths using provider-resolved `title.userPreferred` (fallback chain: `english` → `romaji` → `native` → `default` from `common/modules/providers/types.d.ts`). Strip chars illegal on Windows/macOS/Linux: `/ \ : * ? " < > |`. Zero-pad season/episode. Multi-episode: `E01-E02`.

### Incoming Directory Override (Electron)
The `torrentPathNew` setting already flows through to `client/core/webtorrent.js:50` and `webtorrent.js:280`. For library-managed downloads, redirect the WebTorrent `path` option to `.froyo/incoming/<infoHash>/` rather than the root. This requires passing a `libraryManaged: true` flag through the torrent add IPC path.

---

## Phase 2 — IndexedDB Store

### Add `LIBRARY` store to `cache.js`
In the `caches` object (line 26–42), add:
```javascript
LIBRARY: { key: 'library', database: true }
```
Use the existing `cache.get/set/putMany/remove` API — no schema migration needed since IndexedDB version bump automatically creates the new object store on next open.

### LibraryRepository.js Interface
```javascript
// Record shape
{
  libraryItemId: string,     // "<provider>:<mediaId>:<season>:<episode>"
  fileId: string,            // makeHash(`${infoHash}:${fileName}:${size}`) — reuse from webtorrent.js:174
  mediaType: 'anime'|'tv'|'movie',   // from MEDIA_TYPES in mediaType.js
  provider: 'anilist'|'tmdb',
  mediaId: string|number,
  season: number|null,
  episode: number|null,
  episodeRange: { first, last }|null,
  canonicalTitle: string,
  videoPath: string,          // absolute canonical path
  subtitlePaths: string[],
  sourcePath: string,         // original torrent/drop path
  sourceKind: 'torrent'|'manual',
  status: 'incoming'|'imported'|'missing'|'unmatched',
  importedAt: number,         // Date.now()
  mtime: number,
  size: number,
  fastHash: string            // first+last 1MB hash (see fastHash.js)
}
```

**Key derivation:** Use `libraryItemId` as the IndexedDB key (composite of provider+mediaId+season+ep). For multi-file queries, maintain a secondary `fileId → libraryItemId` lookup entry.

**Reuse:** `makeHash()` from `client/core/webtorrent.js:174` is already used for `fileHash` — import the same hashing utility for `fileId`.

---

## Phase 3 — Ingest Pipeline

### Trigger Point
Hook into the existing torrent `'completed'` event handler in `common/modules/torrent.js` (lines 232–240). The handler currently stores `{ infoHash, name, size, progress, magnetURI, date }` — extend it to also fire an ingest job when `libraryManaged` flag is set.

### LibraryIngest.js Flow
```
1. Receive: { infoHash, files[], torrentPath }
2. For each file:
   a. If videoRx.test(file.name) → run MediaResolver.resolveFileMedia(fileName)
      - MediaResolver.js is at common/modules/resolver/MediaResolver.js (already exists)
      - Returns { media, episode, season, mediaType, provider, failed }
   b. If subRx.test(file.name) → mark as subtitle sidecar, defer to step 4
   c. Build canonicalPath via pathSanitizer.js
3. Atomic move via IPC: library:move { src, dest } (Electron: rename if same volume, else copy+rename+delete)
4. Match subtitle sidecars to video by basename, move to Subtitles/ subfolder
5. Write LibraryRepository record with status='imported'
6. On failure: leave in .froyo/incoming/, write record with status='unmatched'
```

**Cross-volume moves (Electron):** In `electron/src/main/app.js`, the `library:move` IPC handler uses `fs.rename()` first; if it throws `EXDEV` (cross-device), fall back to `fs.copyFile()` → verify size → `fs.unlink()`. Use `.tmp_froyo` extension during copy to avoid partial-file playback.

**Capacitor/Android:** File system ops go through `@capacitor/filesystem` plugin. The same LibraryIngest.js logic works but the IPC call is replaced with Capacitor's FS API. Scope to Electron first; add an adapter layer later.

### Manual Drop Support
Watch `.froyo/incoming/manual/` using `fs.watch()` (Electron) or a periodic scan on focus. On new files, run the same ingest flow with `sourceKind: 'manual'`.

---

## Phase 4 — Library UI

### Route Addition (`navigation.js`)
Add `LIBRARY` constant alongside existing page constants. Register in Router.svelte dispatch block.

### LibraryPage.svelte (Home-style)
Shell is identical to `HomePage.svelte` — reuse `HomeSection.svelte` carousel component verbatim (no changes needed). Build sections using same `SectionsManager.add({ title, variables, load, preview })` pattern (sections.js lines 91–134). Each section's `load()` function queries `LibraryRepository` instead of AniList/TMDB.

**Sections and their `load()` sources:**
| Section | Query |
|---------|-------|
| Continue Watching | `status='imported'` + `mediaListEntry.status='CURRENT'` |
| Recently Added | `status='imported'` ORDER BY `importedAt` DESC |
| Movies | `mediaType='movie'` AND `status='imported'` |
| Shows | `mediaType='tv'` AND `status='imported'` |
| Anime | `mediaType='anime'` AND `status='imported'` |
| Incoming Downloads | `status='incoming'` (live torrent progress overlay) |
| Unmatched Files | `status='unmatched'` |

**Section title click:** Already handled — `HomeSection.svelte` lines 34–36 navigate to SearchPage passing the `load` function. Library sections follow the same pattern, navigating to `LibrarySearch.svelte` instead (pass a `libraryMode: true` flag to differentiate).

**Card reuse:** Library items that have resolved `mediaId` render as existing `SmallCard` or `FullCard` — pass the same `data: Promise<Media>` shape loaded from `LibraryRepository` + cached metadata. Unmatched/incoming items need a lightweight new card variant or adapted `EpisodeCard` (already shows confidence/similarity scores suitable for unmatched display).

### LibrarySearch.svelte (Grid-style)
Reuse `SearchPage.svelte` grid + infinite scroll logic. Replace `SearchBar.svelte` filters with library-specific offline filters using `CustomDropdown.svelte` (highest-import component, no changes needed):

- **Text search** — filter `canonicalTitle` in IndexedDB
- **Media Type** — `MEDIA_TYPES` values from `mediaType.js`
- **Status** — `incoming | imported | missing | unmatched`
- **Watch Status** — maps to AniList `mediaListEntry.status`
- **Has Subtitles** — `subtitlePaths.length > 0`
- **Bulk Retry Match** — button in Unmatched section calls `LibraryIngest.resolveFile()` for each unmatched record

---

## Phase 5 — Playback Integration

Update playback resolution priority in the player path (current entry point: `playActive()` calls):

1. Cached direct stream URL (existing)
2. **`LibraryRepository.findByMediaEpisode(mediaId, episode)` → `videoPath`** ← NEW
3. Active incoming torrent stream URL (existing)
4. Torrent engine repair (existing)

The library lookup (step 2) must be a fast IndexedDB read — no API call.

---

## Phase 6 — Orphan Sweeper

Add `LibraryScanState` routine (called on app focus or manual trigger):
- Load all `status='imported'` records from `LibraryRepository`
- For each, check file existence via `library:exists` IPC (Electron) or Capacitor FS
- If missing: update `status='missing'` in IndexedDB, surface in UI
- If found but path changed: re-run fastHash comparison to auto-heal index

---

## Reusable Utilities (Do Not Duplicate)

| Utility | File | Lines |
|---------|------|-------|
| `videoRx`, `videoExtensions` | `common/modules/util.js` | 748–749 |
| `subRx`, `subtitleExtensions` | `common/modules/util.js` | 745–746 |
| `makeHash()` (for fileId) | `client/core/webtorrent.js` | ~174 |
| `matchKeys()` / `cleanText()` | `common/modules/util.js` | 328 |
| `MEDIA_TYPES` | `common/modules/mediaType.js` | 60 |
| `MediaResolver.resolveFileMedia()` | `common/modules/resolver/MediaResolver.js` | 34 |
| `cache.get/set/putMany/remove` | `common/modules/cache.js` | 101–196 |
| `cache.createBatchWriter()` | `common/modules/cache.js` | 279–368 |
| `CustomDropdown.svelte` | `common/components/CustomDropdown.svelte` | — |
| `HomeSection.svelte` | `common/routes/home/components/HomeSection.svelte` | — |
| `SectionsManager` | `common/modules/sections.js` | 91–134 |
| `storageQuota` / `statfs` | `electron/src/background/background.js` | 4–7 |

---

## Incremental Build Order

1. `pathSanitizer.js` + unit tests (pure function, no deps)
2. `LibraryRepository.js` + add LIBRARY cache store in `cache.js`
3. `fastHash.js` — IPC stub on Electron, Capacitor FS on mobile
4. `LibraryIngest.js` — wire into torrent `'completed'` in `torrent.js`
5. Electron IPC handlers (`library:move`, `library:scan`, `library:exists`, `library:hash`)
6. `LibraryPage.svelte` + route in `navigation.js` + `Router.svelte`
7. `LibrarySearch.svelte` with offline filters
8. Playback priority update
9. Orphan sweeper

---

## Verification

### Automated Tests (follow existing pattern in `common/modules/__tests__/`)
```
node common/modules/library/__tests__/pathSanitizer.test.mjs
  - Titles with illegal chars, year formats, multi-episode, unicode
node common/modules/library/__tests__/LibraryRepository.test.mjs
  - Mock IndexedDB: insert, query by status/type, fastHash lookup, update status
```

### Manual
1. **Ingest:** Start a torrent download → confirm files appear in `.froyo/incoming/<infoHash>/` → complete → verify atomic move to `Movies/` or `Anime/` canonical path, `.froyo/incoming/` entry gone.
2. **Offline mode:** Disconnect network → open app → Library Home renders all 7 sections from IndexedDB instantly.
3. **Conflict:** Copy same movie with different size into library root → UI shows conflict/upgrade prompt.
4. **Missing file:** Delete an imported file via Finder/Explorer → relaunch → Library shows `missing` badge, no crash.
5. **Unmatched retry:** Drop a file with an unusual name that fails resolution → it appears in Unmatched → click Bulk Retry after restoring internet → resolves correctly.
6. **Playback:** Click play on a Library item → player opens from local `videoPath` without torrent engine lookup.
