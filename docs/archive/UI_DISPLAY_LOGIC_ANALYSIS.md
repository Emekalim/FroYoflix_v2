# UI Display Logic Analysis: Episodes vs Duration Handling

## Overview
The FroYoFlix UI already has intelligent logic to display media information differently based on content type. This is exactly what we need for TMDB TV Shows and Movies.

## Key Discovery: Format-Based Conditional Rendering

### Current Implementation Pattern

The UI uses this pattern in **multiple components** to handle format differences:

```svelte
{#if maxEp > 1 || (maxEp !== 1 && ['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(media.mediaListEntry?.status) && media.mediaListEntry?.progress)}
  <!-- Show Episodes -->
  <span class='badge pl-5 pr-5'>
    ... Episodes info
  </span>
{:else if media.duration}
  <!-- Show Duration/Length -->
  <span class='badge pl-5 pr-5'>
    {media.duration + ' Minutes'}
  </span>
{/if}
```

### How It Works

**For Anime Series:**
- `maxEp` = number of episodes (via `getMediaMaxEp()`)
- Shows: "Episodes: 12"
- Icon: Clapperboard

**For Anime Movies:**
- `maxEp` = 1
- `media.duration` exists (e.g., 103 minutes)
- Shows: "Length: 103 min"
- Icon: Timer

## Components Using This Logic

### 1. [FullCard.svelte](../common/components/cards/FullCard.svelte) (Lines 56-68)
**Location:** Card display on search/browse pages
**Logic:**
```svelte
{#if maxEp > 1 || (maxEp !== 1 && ['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(media.mediaListEntry?.status) && media.mediaListEntry?.progress)}
  <span class='badge pl-5 pr-5'>
    {['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(media.mediaListEntry?.status) && media.mediaListEntry?.progress ? media.mediaListEntry.progress + ' / ' : ''}{maxEp && maxEp !== 0 && !(media.mediaListEntry?.progress > maxEp) ? maxEp : '?'} Episodes
  </span>
{:else if media.duration}
  <span class='badge pl-5 pr-5'>
    {media.duration + ' Minutes'}
  </span>
{/if}
```
**Features:**
- Displays user progress if tracking is active
- Shows "?" if episode count unknown
- Handles both episodes and duration

### 2. [DetailsModal.svelte](../common/modals/details/DetailsModal.svelte) (Lines 224-240)
**Location:** Detailed view modal
**Logic:**
```svelte
{#if staticMedia.episodes !== 1}
  {@const maxEp = getMediaMaxEp(staticMedia)}
  <div class='d-flex flex-row mt-10'>
    <Clapperboard class='mx-10' size='2.2rem' />
    <span class='mr-20'>
      Episodes: {maxEp && maxEp !== 0 ? maxEp : '?'}
    </span>
  </div>
{:else if staticMedia.duration}
  <div class='d-flex flex-row mt-10'>
    <Timer class='mx-10' size='2.2rem' />
    <span class='mr-20'>
      Length: {staticMedia.duration + ' min'}
    </span>
  </div>
{/if}
```
**Features:**
- Uses different icons (Clapperboard vs Timer)
- More spacious layout than cards
- Cleaner formatting with icon labels

### 3. [Details.svelte](../common/modals/details/components/Details.svelte) (Lines 1-98)
**Location:** Technical details section in modal
**Purpose:** Displays additional metadata like status, studio, source, country, etc.
**Currently:** AniList-specific but structured for generic media info

## Data Fields Currently Used

### For Episode Display
```javascript
maxEp = getMediaMaxEp(media)  // Returns episode count
media.episodes                // Raw AniList field
media.mediaListEntry?.progress // User's watched episodes
```

### For Duration Display
```javascript
media.duration               // Stored in minutes (integer)
media.episodes === 1         // Check if it's a movie (1 episode = movie)
```

### Supporting Fields
```javascript
media.format                 // 'TV', 'MOVIE', 'OVA', 'SPECIAL'
media.averageScore           // Rating percentage
media.stats?.scoreDistribution // For reviews count
media.isAdult                // Content rating
media.status                 // FINISHED, RELEASING, NOT_YET_RELEASED
```

## TMDB Compatibility - Current vs Needed

### Current TMDB Mapping (sections.js)
```javascript
episodes: item.number_of_episodes || 0,  // Only for TV
format: type === 'tv' ? 'TV' : 'MOVIE',
type: type === 'tv' ? 'ANIME' : 'ANIME',  // BUG: Always ANIME
```

### What's Missing for TV Shows
```javascript
duration: null,              // TV shows don't have single duration
episodes: 12,                // ✅ Already mapped as number_of_episodes
totalEpisodes: 12,           // Redundant with episodes
```

### What's Missing for Movies
```javascript
episodes: 1,                 // Should be set to 1 (triggers duration display)
duration: 120,               // MISSING - not currently mapped from TMDB
```

### TMDB Movie Response Includes
```json
{
  "runtime": 103,            // Movie duration in minutes ← USE THIS
  "vote_average": 7.9,       // Rating
  "adult": false,            // Content rating
  "release_date": "2007-09-22",
  "production_companies": [...], // Studio equivalent
  "genres": [...]
}
```

### TMDB TV Response Includes
```json
{
  "number_of_episodes": 12,  // Already mapped ✅
  "number_of_seasons": 1,
  "first_air_date": "2024-01-01",
  "vote_average": 8.1,
  "adult": false,
  "genres": [...]
}
```

## Implementation Strategy

### Phase 1: Fix TMDB Data Mapping (Minimal Changes)

**File: `/common/modules/sections.js` (Lines 125-180)**

Current state:
```javascript
const media = (data.results || []).map(item => ({
  id: item.id,
  title: { ... },
  // ... other fields ...
  format: type === 'tv' ? 'TV' : 'MOVIE',
  type: type === 'tv' ? 'ANIME' : 'ANIME',  // ← BUG
  status: 'UNKNOWN',
  totalEpisodes: item.number_of_episodes || 0,
  // ← MISSING: duration for movies!
}))
```

**Required changes:**
1. Add `duration` field mapping for movies
2. Add `episodes` field (set to totalEpisodes for TV, 1 for movies)
3. Fix `type` field (should match format)
4. Add stub fields for AniList compatibility

### Phase 2: Update Components for TMDB (Safe Defaults)

All three components already handle both scenarios! Just need to:
1. Ensure `media.duration` is populated for movies
2. Ensure `media.episodes` = 1 for movies (triggers duration display)
3. Ensure `media.episodes` = number_of_episodes for TV shows
4. Handle missing `mediaListEntry` gracefully (already has `?.` optional chaining)

### Phase 3: Handle AniList-Only Fields

Components already use optional chaining for:
```javascript
media.mediaListEntry?.status    // Safe for TMDB (will be null)
media.mediaListEntry?.progress  // Safe for TMDB (will be null)
media.stats?.scoreDistribution  // Safe for TMDB (will be null)
media.isAdult                   // Works for both (TMDB has adult flag)
```

## Summary: Why This Will Work

✅ **Episodes Display Logic:**
- TV Shows: `episodes > 1` → Shows episode count (TMDB: map number_of_episodes)
- Movies: `episodes === 1` → Falls through to duration (TMDB: map runtime)

✅ **Duration Display Logic:**
- Already implemented with `{:else if media.duration}`
- Just need TMDB movies to populate `duration: item.runtime`

✅ **Component Compatibility:**
- FullCard.svelte: Already handles both via conditional
- DetailsModal.svelte: Already has Episodes/Length toggle
- All AniList-specific fields use optional chaining
- No components hardcode AniList structure

✅ **Minimal Changes Needed:**
- Update TMDB mapping in sections.js (3 lines)
- Add stub values for AniList-only fields (1 line each)
- Test existing UI logic - NO component rewrites needed!

## Files to Modify

1. **[common/modules/sections.js](../common/modules/sections.js)** - Main mapping fix
   - Add `duration` for movies
   - Add `episodes` field
   - Fix `type` field
   - Add stub AniList fields

2. **[common/components/cards/FullCard.svelte](../common/components/cards/FullCard.svelte)** - Safe defaults only
   - Line 51: Already safe with optional chaining
   - No logic changes needed

3. **[common/modals/details/DetailsModal.svelte](../common/modals/details/DetailsModal.svelte)** - Safe defaults only
   - Lines 224-240: Already handles both cases
   - Wrap with `{#if media.source !== 'TMDB'}` for AniList-only sections

4. **[common/modals/details/components/Details.svelte](../common/modals/details/components/Details.svelte)** - Conditional rendering
   - Filter out AniList-specific properties for TMDB
   - Map generic properties (status, format, etc.)

## Testing Plan

1. Search for anime series → "Episodes: 12" displays ✅
2. Search for anime movie → "Length: 103 min" displays ✅
3. Search for TV show (TMDB) → "Episodes: 12" displays ✅
4. Search for movie (TMDB) → "Length: 120 min" displays ✅
5. Click cards to open details modal → Both formats work ✅
6. No console errors about undefined properties ✅
