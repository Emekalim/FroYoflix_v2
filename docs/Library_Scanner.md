# Implementation Plan - Local Library Search (Node.js Port)

This document outlines the detailed technical approach to replicating the `seanime` local library search functionality in `FroYoflix` (Electron/Node.js).

> [!IMPORTANT]
> **Key Difference**: Unlike Seanime, this scanner supports **Anime, Movies, and TV Shows**. The parser and matcher are designed to handle broader naming conventions (e.g., standard Scene releases, "Movie (Year)" format).

## Goal
Enable `FroYoflix` to scan local directories for video files (Anime, Movies, TV), parse their filenames to extract metadata, and intelligently match them against a provided media list.

## User Review Required
> [!IMPORTANT]
> **Dependencies**: I recommend adding `string-similarity` (Sørensen-Dice) and `fast-levenshtein` (Levenshtein distance) to [package.json](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/package.json) to avoid re-implementing complex string algorithms.
> **Symlinks**: This implementation will explicitly follow symbolic links.

## Proposed Changes

I will create a modularized library scanner in `electron/src/main/library-scanner/`.

### 1. Data Structures (`types.ts`)

We will define TypeScript interfaces to ensure type safety across the scanning pipeline.

```typescript
export type MediaType = 'anime' | 'movie' | 'tv';

export interface ParsedInfo {
    original: string;
    title?: string;
    season?: number;
    episode?: number;
    part?: number;
    year?: string; // Critical for matching movies
    releaseGroup?: string;
    
    // Heuristic processing
    guessedType: MediaType; // Inferred from structure (e.g. S01E01 = tv/anime, (2023) = movie)
}

export interface LocalFile {
    path: string;
    name: string;
    parsedInfo: ParsedInfo;
    metadata: {
        mediaId?: number; // Matched ID (Anilist/TMDB)
        isLocked: boolean;
        isIgnored: boolean;
    };
}

export interface MediaEntry {
    id: number;
    type: MediaType; // filter matches by type
    title: {
        english?: string;
        romaji?: string;
        native?: string; // or original title for movies
    };
    synonyms: string[];
    releaseYear?: number; // Used for verifying movie matches
}
```

### 2. File System Scanner (`scanner.ts`)

**Functionality**: Recursively scan directories for video files.
**Key Features**:
*   **Extensions**: Filter for `['.mkv', '.mp4', '.avi', '.webm', '.flv', '.mov', '.wmv']`.
*   **Symlinks**: Use `fs.stat` and `fs.realpath` to follow symlinks.
*   **Concurrency**: Use `Promise.all` for parallel directory reading.

```typescript
// Signature
export async function scanDirectories(
    rootPaths: string[], 
    ignoredPaths: string[] = []
): Promise<string[]> { ... }
```

### 3. Universal Filename Parser (`parser.ts`)

**Functionality**: Extract metadata from filenames, supporting various naming standards.
**Strategy**: Implement a multi-pass parser.

#### Logic Flow:
1.  **Clean**: Remove brackets `[]`, parentheses [()](file:///Users/franklin/Documents/Workspace/PersonalProjects/seanime-main/internal/library/scanner/scan.go#48-471), and file extensions.
2.  **TV/Anime Heuristics**:
    *   Look for `S\d+E\d+`, `\d+x\d+`, `Ep \d+`.
    *   *If found*: Extract Season/Episode. Everything before acts as Title. Mark as `tv` or `anime`.
3.  **Movie Heuristics**:
    *   Look for [(YYYY)](file:///Users/franklin/Documents/Workspace/PersonalProjects/seanime-main/internal/library/scanner/scan.go#48-471) or `[YYYY]` or `YYYY` near the end of the string.
    *   *If found*: Extract Year. Everything before acts as Title. Mark as `movie`.
4.  **Anime Absolute Numbering Fallback**:
    *   Look for ` - \d+` or ` [A-F0-9]{8}` (CRC) patterns common in Anime.
5.  **Directory Context**:
    *   If inside a folder named `Season X`, infer TV show.
    *   If inside a folder named `Movie Name (Year)`, infer Movie.

```typescript
// Signature
export function parseLocalFile(filePath: string): ParsedInfo { ... }
```

### 4. Smart Media Matcher (`matcher.ts`)

**Functionality**: Link [LocalFile](file:///Users/franklin/Documents/Workspace/PersonalProjects/seanime-main/internal/library/anime/localfile.go#72-104) objects to `MediaEntry` objects.
**Algorithms**:

*   **Type Filtering**: Strict match on inferred type if high confidence (e.g., don't match a file with `S01E01` to a Movie entry).
*   **Year Verification (Movies)**:
    *   If both file and media have a year, enforce a ±1 year tolerance match.
*   **String Scoring**:
    1.  **Exact Match**: 1.0 score.
    2.  **Sørensen-Dice**: Calculate similarity.
    3.  **Levenshtein**: Fallback.
*   **Threshold**: > 0.8 for strong match.

```typescript
// Signature
export function matchFiles(
    files: LocalFile[], 
    mediaList: MediaEntry[]
): LocalFile[] { ... }
```

### 5. Electron Integration (`index.ts`)

Expose the functionality via IPC.

```typescript
ipcMain.handle('library:scan', async (event, rootPaths) => {
    // 1. Scan files
    const filePaths = await libraryScanner.scanDirectories(rootPaths);
    // 2. Parse metadata (heuristically determine Type)
    const localFiles = filePaths.map(libraryScanner.parseLocalFile);
    return localFiles;
});
```

## Verification Plan

### Automated Test Script (`test-scanner-universal.js`)
**Mock Data**:
*   **TV**: `Breaking Bad/Season 1/Breaking.Bad.S01E01.720p.mkv`
*   **Anime**: `[Group] Jujutsu Kaisen - 01 [1080p].mkv`
*   **Movie**: `Inception (2010).mp4`, `The Matrix 1999.mkv`

**Assertions**:
1.  `Breaking Bad...` -> Title: "Breaking Bad", Type: TV, S:1, E:1
2.  `Inception...` -> Title: "Inception", Type: Movie, Year: 2010
3.  `Jujutsu...` -> Title: "Jujutsu Kaisen", Type: Anime, E:1

### Manual Verification
1.  Run scanner against a mixed directory containing a Movie folder and a TV Show folder.
2.  Verify correct "Type" inference in the output.
