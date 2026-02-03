# TMDB Compatibility Analysis & Resolution Strategy

## Overview
The FroYoFlix application now supports three media sources via the format dropdown:
- **Anime** → AniList API (full features)
- **TV Shows** → TMDB API
- **Movies** → TMDB API

However, TMDB results are incompatible with the current UI components because they lack critical data fields that AniList provides.

## Problem Description

### Current Issue
When users select "TV Shows" or "Movies" and click a result card to view details:
1. Error: `{#each} only works with iterable values` - attempting to iterate over undefined arrays
2. Error: `info.mount is not a function` - attempting to call missing callbacks
3. Root cause: Components expect AniList data structure but receive TMDB structure

### Data Structure Comparison

#### AniList Results Include:
- `mediaListEntry` (user's list status/progress)
- `relations` (spinoffs, sequels, prequels)
- `recommendations` (similar anime)
- `airingSchedule` (episode release dates)
- `streamingEpisodes` (where to watch)
- `nextAiringEpisode` (next episode info)
- `stats` (score distribution)
- `isAdult` (content rating)
- `idMal` (MyAnimeList ID)
- Plus 50+ other fields

#### TMDB Results Currently Include (Simplified Mapping):
```javascript
{
  id, title, coverImage, bannerImage, format, type, status, 
  description, seasonYear, startDate, endDate, totalEpisodes, 
  genres, averageScore, popularity, source, tmdbId
}
```

#### Missing from TMDB Results:
- `mediaListEntry` - No user account integration available
- `relations` - TMDB doesn't provide relation data
- `recommendations` - TMDB provides recommendations but differently structured
- `airingSchedule` - No episode schedule data
- `streamingEpisodes` - No streaming info
- `nextAiringEpisode` - Minimal future episode info
- `stats` - No score distribution
- `isAdult` - TMDB has `adult` flag (boolean)

## Affected Components

### Critical (Breaks Details Modal)
1. **[DetailsModal.svelte](../common/modals/details/DetailsModal.svelte)**
   - Line 46: `media?.mediaListEntry?.status === 'COMPLETED'` (AniList only)
   - Line 47: `media?.mediaListEntry?.status` checks (AniList only)
   - Line 51: `staticMedia.relations?.edges` (TMDB doesn't have relations)
   - Line 51: `recommendations?.data?.Media?.recommendations?.edges` (wrong structure for TMDB)
   - Line 87-88: Attempts to destructure `media.mediaListEntry` (missing for TMDB)
   - Line 107: Uses `cachedMedia?.mediaListEntry?.progress` (TMDB doesn't have)
   - Line 255: `staticMedia.stats?.scoreDistribution` (TMDB doesn't have)
   - Line 329: `staticMedia.relations?.edges?.filter(...)` (loops over undefined)
   - Line 342-345: `recommendations?.edges?.filter(...)` (wrong structure)

2. **[FullCard.svelte](../common/components/cards/FullCard.svelte)**
   - Line 45: `media.mediaListEntry?.status` (not available for TMDB)
   - Line 56: `media.isAdult` (TMDB has different field)
   - Line 102+: Tries to access `media.stats?.scoreDistribution` (doesn't exist)

### Important (Should Handle Gracefully)
3. **[EpisodeList.svelte](../common/modals/details/components/EpisodeList.svelte)**
   - Expects `airingSchedule` data (TMDB doesn't provide)
   - Expects episode metadata matching AniList format

4. **[TorrentResults.svelte](../common/modals/torrent/components/TorrentResults.svelte)**
   - Line 263: Uses `nextAiringEpisode?.episode` (TMDB doesn't have this structure)
   - References `media.episodes` (TMDB uses `totalEpisodes`)

5. **[NotificationsModal.svelte](../common/modals/NotificationsModal.svelte)**
   - Multiple uses of `mediaListEntry` (AniList only, not applicable to TMDB)

6. **[SchedulePage.svelte](../common/routes/SchedulePage.svelte)**
   - Line 48+: Uses `airingSchedule?.nodes` (TMDB doesn't have)

## Resolution Options

### ✅ Recommended: Option C - Conditional Rendering + Smart Defaults
**Pros:**
- Maintains full functionality for AniList
- Provides graceful degradation for TMDB
- Minimal component changes
- User can still view basic details for TV/Movies
- Can add TMDB-specific features in future

**Cons:**
- Some UI elements will be hidden/disabled for TMDB
- Relations/Recommendations won't show for TV/Movies

**Implementation:**
1. Add `source` field to distinguish AniList vs TMDB results
2. Wrap AniList-specific sections with `{#if media.source !== 'TMDB'}`
3. Add stub values for required fields to prevent crashes
4. Hide/disable features that require AniList (list tracking, relations)

### Rejected: Option A - Disable Details View for TMDB
**Cons:** 
- TV/Movie cards would be non-interactive
- Poor UX - can't view more info
- Defeats purpose of adding TV/Movie support

### Rejected: Option B - Enrich TMDB Data with Additional API Calls
**Cons:**
- TMDB API doesn't provide equivalent data
- Would require external APIs (possibly paid)
- Performance impact

### Rejected: Option D - Create Separate TMDB Details View
**Cons:**
- Duplicates 90% of DetailsModal logic
- Maintenance nightmare
- Complex state management

### Rejected: Option E - Convert TMDB to AniList Format
**Cons:**
- Not possible - TMDB data structure fundamentally different
- Would require massive data enrichment

## Implementation Plan

### Phase 1: Add Data Source Tracking
- Update [sections.js](../common/modules/sections.js) TMDB mapping to include `source: 'TMDB'`
- Ensure AniList results include `source: 'ANILIST'`

### Phase 2: Add Stub Values to TMDB Mapping
```javascript
// Add these to TMDB mapping in sections.js
mediaListEntry: null,
relations: { edges: [] },
recommendations: { edges: [] },
stats: { scoreDistribution: [] },
isAdult: item.adult || false,
episodes: item.number_of_episodes || null,
airingSchedule: { nodes: [] },
streamingEpisodes: [],
nextAiringEpisode: null,
```

### Phase 3: Update DetailsModal.svelte
1. Wrap all mediaListEntry access in `{#if media.source !== 'TMDB'}`
2. Wrap relations section: `{#if media.source !== 'TMDB' && media.relations?.edges?.length}`
3. Wrap recommendations section: `{#if media.source !== 'TMDB' && media.recommendations?.edges?.length}`
4. Wrap stats section: `{#if media.stats?.scoreDistribution?.length}`
5. Add note for TMDB results: "This feature is only available for anime"

### Phase 4: Update FullCard.svelte
1. Safe access to `mediaListEntry`: `media.source !== 'TMDB' && media.mediaListEntry?.status`
2. Safe access to `isAdult`: Use nullish coalescing
3. Safe access to `stats`: Check length before rendering

### Phase 5: Update EpisodeList.svelte
1. Check if `airingSchedule?.nodes?.length` exists
2. Show "No schedule information available" for TMDB

### Phase 6: Update TorrentResults.svelte
1. Use `nextAiringEpisode?.episode` with fallback
2. Use `media.episodes || media.totalEpisodes`

### Phase 7: Update NotificationsModal.svelte
1. Skip mediaListEntry checks for TMDB sources
2. Conditionally render user progress features

## Expected Outcomes

### After Implementation
✅ TV/Movie results can be searched and displayed as cards
✅ Clicking TV/Movie cards opens details modal without crashing
✅ Details modal shows basic info (title, description, genres, rating, etc.)
✅ Relations/Recommendations sections hidden for TMDB (graceful degradation)
✅ AniList anime functionality unchanged
✅ No infinite loops or "only iterable values" errors

### Maintained Features for TV/Movies
- Title, cover image, description
- Genres, rating, year, status
- Episode count (for TV shows)
- Search and browse functionality

### Unavailable Features for TV/Movies (Gracefully Hidden)
- User list status tracking (AniList only)
- Related media/sequels (AniList only)
- Recommendations (TMDB has different structure)
- Airing schedule (AniList only)
- Streaming episodes info (different from TMDB)
- User reviews/stats (AniList only)
- Torrent search (still works but basic)

## Files to Modify
1. `/common/modules/sections.js` - Add stub values to TMDB mapping
2. `/common/modals/details/DetailsModal.svelte` - Add conditional rendering
3. `/common/components/cards/FullCard.svelte` - Safe property access
4. `/common/modals/details/components/EpisodeList.svelte` - Handle missing data
5. `/common/modals/torrent/components/TorrentResults.svelte` - Fallback values
6. `/common/modals/NotificationsModal.svelte` - TMDB checks (lower priority)
7. `/common/routes/SchedulePage.svelte` - TMDB checks (lower priority)

## Testing Strategy
1. Search for and select a TV show → verify details modal opens
2. Search for and select a movie → verify details modal opens
3. Verify no errors in browser console
4. Verify AniList anime still works with all features
5. Check that hidden sections are not visible for TMDB
6. Test with various TV shows (different episode counts, airing status)
