
# Implementation Plan: Local Library & Renamer

**Goal**: Implement a persistent local library with SQLite backing, metadata linking, and a safe renaming utility.

## Phase 1: Core Backend (Scanner & Database)
**Objective**: Recursively scan folders, persist files to SQLite, and track changes.

### 1. Dependencies
-   [ ] Install `better-sqlite3`, `chokidar`, `fs-extra`.
    -   *Note*: `better-sqlite3` requires compilation. Ensure electron-rebuild is handled or use a prebuilt binary approach if "native modules" issues arise.

### 2. Database Module
-   [ ] **[NEW]** `electron/src/main/library/database.js`
    -   Initialize SQLite DB (`library.db` in `userData`).
    -   Create tables: `files` (path, size, modified_time, parsed_metadata...), `settings` (library paths, renamer config).
    -   Export logic: `upsertFile`, `removeFile`, `getFiles`.

### 3. Scanner Service
-   [ ] **[NEW]** `electron/src/main/library/scanner.js`
    -   [scan(roots)](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/common/modules/folder-scanner.js#12-58): methods to walk directories (using `fs.readdir` + `stats`).
    -   Parsing integration: Import [MediaResolver](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/common/modules/resolver/MediaResolver.js#15-156) (from `common/modules/resolver/`) to extract S/E/Title during scan.
    -   Optimization: Only parse if file modified time > stored time.

### 4. Watcher Service
-   [ ] **[NEW]** `electron/src/main/library/watcher.js`
    -   Initialize `chokidar` on library roots.
    -   On [add](file:///Users/franklin/Documents/Workspace/PersonalProjects/seanime-main/internal/library/scanner/scan.go#481-532)/`unlink`: Call DB methods to keep library in sync real-time.

### 5. IPC Integration
-   [ ] **[MODIFY]** `electron/src/main/ipc.js` (or [main.js](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/common/main.js))
    -   Add handlers: `library:get-all`, `library:add-root`, `library:remove-root`, `library:scan-now`.

## Phase 2: Metadata Linking
**Objective**: Link local files to Media IDs (Anilist/TMDB) and cache images.

### 1. Linker Service
-   [ ] **[NEW]** `electron/src/main/library/linker.js`
    -   Function `resolveLibrary()`: Iterate DB where `mediaId` is NULL.
    -   Call `MediaResolver.resolveFileMedia()`.
    -   Update DB with `mediaId`, `provider`, `mediaType`.

### 2. Image Caching
-   **reuse**: Leverage `common/components/visual/SmartImage.svelte` logic / `tmdb-api.js` which already resolves image URLs.
-   **[NEW]** `electron/src/main/library/images.js`:
    -   *Logic*: Check if image exists locally. If not, download from the URL provided by TMDB/Anilist.
    -   *Storage*: Save to `userData/images/{mediaId}.jpg`.
    -   *Purpose*: Enable offline view (SmartImage can fallback to local path).

## Dependency Installation Guide
> **Note to User**: Please run the following commands to set up the environment before Phase 1.

```bash
# 1. Database (SQLite) and Native Build Tools
pnpm install better-sqlite3 fs-extra chokidar
pnpm add -D electron-rebuild

# 2. Rebuild for Electron
# This is critical for better-sqlite3 to work within Electron
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
```

## Phase 3: Frontend UI
**Objective**: View and manage the library.

### 1. Store
-   [ ] **[NEW]** `common/stores/libraryStore.js` (Svelte store)
    -   Syncs with backend via IPC.

### 2. Library Page
-   [ ] **[NEW]** `common/routes/library/LibraryPage.svelte`
    -   **Tabs**: All, Movies, TV, Anime.
    -   **Grid**: Display posters (from local cache).
    -   **Fallback**: "Add Folder" button if library empty.

### 3. Unmatched/Fix Match
-   [ ] **[NEW]** `common/routes/library/UnmatchedResults.svelte`
    -   List files where `mediaId` is missing.
    -   "Fix Match" modal to manually search TMDB/Anilist.

## Phase 4: Renamer Utility
**Objective**: Standardize filenames safely.

### 1. Renamer Engine
-   [ ] **[NEW]** `electron/src/main/library/renamer.js`
    -   Input: `file` object + `pattern` config.
    -   Output: `newPath`.
    -   Logic: Apply patterns (e.g., `{Title} ({Year})`) based on matched metadata.

### 2. UI Workflow
-   [ ] **[NEW]** `common/modals/RenamerPreviewModal.svelte`
    -   Fetch "Dry Run" results from backend.
    -   Show Diff View (Old -> New).
    -   "Apply" button triggers actual `fs.rename`.

## Verification
-   [ ] **Test Scanner**: Verify DB populates with correct Paths and Parsed Metadata.
-   [ ] **Test Linking**: Verify `mediaId` is correctly assigned for known test files.
-   [ ] **Test Renamer**: Verify files are moved/renamed physically and DB is updated without losing the entry.
