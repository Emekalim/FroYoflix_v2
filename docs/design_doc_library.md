# Design Document: Local Library Architecture

## Overview
Moving FroYoflix from a "Search on Demand" model to a **Hybrid Persistent Library** model.
-   **Primary**: Instant local library browsing.
-   **Fallback**: If a show/movie doesn't exist locally, it falls back to the existing Torrent Modal for streaming.

## 1. Core Architecture

### A. The "Library Service" (Main Process)
A generic service running in the Electron backend (`electron/src/main/library/`).
-   **Scanner**: Recursively walks watched directories.
-   **Watcher**: Uses `chokidar` to listen for file additions/deletions in real-time.
-   **Queue**: Manages a concurrency-limited queue for resolving new files.

### B. Database Strategy: SQLite vs. JSON

We need to choose a persistent store.

| Feature | JSON File (lowdb/steno) | SQLite (better-sqlite3) |
| :--- | :--- | :--- |
| **Complexity** | Low. Just reading/writing a text file. | Medium. Requires SQL queries and schema migrations. |
| **Performance** | Fast reads (in-memory). Slow writes (rewrite entire file). | Fast reads/writes. optimized for partial updates. |
| **Scalability** | Poor. Performance degrades >5,000 files. | Excellent. Handles 100k+ files easily. |
| **Querying** | Manual JS filtering (slow for complex sorts). | efficient SQL (`SELECT * FROM files WHERE year > 2020`). |
| **Migration** | Difficult to move to a real DB later. | Easy. SQL is standard (migrating to Postgres is trivial). |
| **Cost** | Free. | Free (Embedded). |

> **Recommendation**: **SQLite**.
> Why? It offers superior performance for filtering/sorting (essential for a library UI), allows massive scalability without easy refactors later, and is the industry standard for desktop apps (VS Code, Plex, etc.).

### C. The Schema
```typescript
interface LibraryEntry {
  id: string;             // UUID
  path: string;           // Absolute path

  // Parsed Metadata
  parsedTitle: string;
  season?: number;
  episode?: number;
  year?: string;
  resolution?: string;
  sourceGroup?: string;

  // Resolution Status
  isResolved: boolean;   // True if matched to online metadata
  isLocked: boolean;     // If true, auto-scanner won't overwrite manual edits

  // Linked Metadata (Lightweight)
  mediaId?: number;      // Anilist ID or TMDB ID
  mediaType: 'anime' | 'movie' | 'tv';
  provider: 'anilist' | 'tmdb';

  addedAt: number;       // Timestamp
}
```
**Metadata Caching Rule**: We primarily store the `mediaId` and `provider`.
-   **Images**: We **will** cache posters and backdrops locally (saved to `userData/images` or similar) for offline browsing performance.
-   **Text Metadata**: Synopsis, cast, and detailed info are fetched on-the-fly when the user selects the item.

## 2. Feature: Renamer Module

To ensure a clean library, we introduce a **Renamer Module**.

**Workflow: "Safe & Explicit"**
1.  **Strict Rules**: The system generates a proposed rename ONLY if the match confidence is **High (>90%)**.
2.  **User Review**: The user selects "Organize Library" -> sees a "Preview Changes" modal.
    *   *Left Column*: Current Filename
    *   *Right Column*: Proposed New Name
    *   *Checkbox*: Approve individual changes.
3.  **Execution**: On confirmation, the system moves the file and updates the database path atomically.

**Naming Standards (Configurable):**
*   **Anime**: `{Title} S{Season}E{Episode}` (e.g., `Attack on Titan S01E05.mkv`)
    *   *Note*: Falls back to absolute numbering if S/E unavailable.
*   **TV Shows**: `{Title} - S{Season}E{Episode}` (e.g., `Breaking Bad - S01E05.mkv`)
*   **Movies**: `{Title} ({Year})` (e.g., `Inception (2010).mkv`)

## 3. Implementation Steps

### Phase 1: The Scanner & Store
1.  Setup `better-sqlite3`.
2.  Implement `LibraryScanner`.
3.  Hook up `scan-folder` IPC to populate the DB.

### Phase 2: Metadata Linking
1.  Iterate over stored files.
2.  Run `TitleResolver.resolve()` (Reuse existing module).
3.  Update `LibraryEntry` with `mediaId`.

### Phase 3: The UI
1.  **Grid View**: Tabs for **All**, **Series**, **Movies**, **Anime**.
2.  **Unmatched View**: A dedicated table showing files with `isResolved: false`.
    *   Leverages [TitleResolver](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/common/modules/resolver/index.js#28-190) to show "Best Guesses" with low confidence.
    *   Allows manual search/override (like Plex "Fix Match").

### Phase 4: Renamer
1.  Add `renamer.ts` module with dry-run support.
2.  Create "Organize Library" Modal in Frontend.
