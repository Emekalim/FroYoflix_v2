# Subtitle Implementation Plan

**Goal**: Enable searching, downloading, and linking subtitles from SubSource.net AP to local library files, AND selecting existing local subtitles.

## User Review Required
> [!IMPORTANT]
> **API Key**: Settings must allow inputting the SubSource API Key.
> **Storage Strategy**: Subtitles downloaded as sidecar files (e.g., `Movie.en.srt`).
> **Local Discovery**: The player will automatically list any compatible subtitle files found in the same folder as the media.

## Proposed Changes

### 1. Backend Services

#### [NEW] `electron/src/main/services/subtitleService.js`
- **Purpose**: SubSource API handler & Local File Scanner.
- **Methods**:
    - `search(query, imdbId)`: Calls `/movies/search`.
    - `listFiles(movieId, filters)`: Calls `/subtitles`.
    - `download(subtitleId, destinationPath)`: Calls `/subtitles/{id}/download`.
        - Saves as `MovieName.lang.srt`.
    - `listLocal(videoFilePath)`: **[NEW]**
        - Scans directory of `videoFilePath`.
        - Returns list of matching sidecar files (e.g., `.srt`, `.vtt`).

#### [MODIFY] `electron/src/main/ipc.js`
- **Handlers**:
    - `subtitles:search-for-file`: Auto-searches API.
    - `subtitles:download`: Downloads file.
    - `subtitles:get-local`: (filePath) -> Returns list of local subtitle tracks.

### 2. Frontend UI

#### [MODIFY] `common/routes/player/VideoPlayer.svelte`
- **Player Menu Update**:
    - Add a **"Subtitles"** section (or Dropdown).
    - **Content**:
        - List detected local subtitles (e.g., "English", "Spanish", "Unknown").
        - **"Off"** option.
        - **"Add Subtitles..."** button -> Opens `SubtitleSelectionModal`.
- **Logic**:
    - On load, call `subtitles:get-local` to populate the list.
    - If user selects a local file, load it into the player.
    - If user downloads a new one, refresh the list and auto-select.

#### [NEW] `common/components/player/SubtitleSelectionModal.svelte`
- **Context**: Search & Download flow.
- **UI**: Search bar, Language Filter, Results List, Download Action.

## Verification
1.  **Local Discovery**: Place a `.srt` file next to a movie manually. Open player. Check "Subtitles" menu lists it.
2.  **Selection**: Select the local subtitle. Verify it displays.
3.  **Turn Off**: Select "Off". Verify subtitles disappear.
4.  **Download Flow**: Use "Add Subtitles...", download one. Verify it appears in the list and is selected.
