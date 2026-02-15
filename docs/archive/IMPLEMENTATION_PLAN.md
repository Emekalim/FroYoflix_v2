# TMDB Compatibility Implementation Plan

## Objective
Enable TV Shows and Movies (from TMDB) to display properly in the details modal without errors, leveraging existing UI logic.

## Timeline
- **Phase 1:** Fix TMDB data mapping (30 min)
- **Phase 2:** Update DetailsModal for safe access (20 min)
- **Phase 3:** Update FullCard for safe defaults (10 min)
- **Phase 4:** Update Details component (15 min)
- **Phase 5:** Testing & validation (20 min)

**Total: ~95 minutes**

---

## Phase 1: Fix TMDB Data Mapping [CRITICAL]

### File: `/common/modules/sections.js`

**Current State (Lines 125-180):**
```javascript
const media = (data.results || []).map(item => ({
  id: item.id,
  title: { ... },
  coverImage: { ... },
  bannerImage: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : DEFAULT_BANNER_IMAGE,
  format: type === 'tv' ? 'TV' : 'MOVIE',
  type: type === 'tv' ? 'ANIME' : 'ANIME',  // BUG: Always ANIME
  status: 'UNKNOWN',
  description: item.overview,
  seasonYear: item.release_date ? parseInt(item.release_date.substring(0, 4)) : null,
  startDate: item.release_date ? { year: parseInt(...), month: parseInt(...), day: parseInt(...) } : null,
  endDate: null,
  totalEpisodes: item.number_of_episodes || 0,
  genres: [],
  averageScore: item.vote_average ? Math.round(item.vote_average * 10) : null,
  popularity: item.popularity,
  source: 'TMDB',
  tmdbId: item.id
}))
```

**Required Changes:**

1. **Add `episodes` field** (determines if series or movie)
   - TV: `episodes: item.number_of_episodes || 0`
   - Movie: `episodes: 1`

2. **Add `duration` field** (displays for movies)
   - TV: `duration: null`
   - Movie: `duration: item.runtime || null`

3. **Fix `type` field** (should reflect actual type)
   - TV: `type: 'TV'`
   - Movie: `type: 'MOVIE'`

4. **Add stub AniList fields** (prevent component crashes)
   - `mediaListEntry: null`
   - `relations: { edges: [] }`
   - `recommendations: { edges: [] }`
   - `stats: { scoreDistribution: [] }`
   - `airingSchedule: { nodes: [] }`
   - `streamingEpisodes: []`
   - `nextAiringEpisode: null`

5. **Ensure `isAdult` field** (already exists, just verify)
   - `isAdult: item.adult || false`

### Implementation Details

**Location:** Lines ~155-170 in mapping function

```javascript
// BEFORE:
const media = (data.results || []).map(item => ({
  id: item.id,
  // ... existing fields ...
  type: type === 'tv' ? 'ANIME' : 'ANIME',  // ← REMOVE
  totalEpisodes: item.number_of_episodes || 0,
  // ← ADD DURATION HERE
  // ← ADD EPISODES HERE
  // ← ADD STUBS HERE
}))

// AFTER:
const media = (data.results || []).map(item => ({
  id: item.id,
  // ... existing fields ...
  type: type === 'tv' ? 'TV' : 'MOVIE',     // ← FIX
  episodes: type === 'tv' ? (item.number_of_episodes || 0) : 1,  // ← NEW
  duration: type === 'tv' ? null : (item.runtime || null),       // ← NEW
  totalEpisodes: item.number_of_episodes || 0,
  // ← ADD STUBS
  mediaListEntry: null,
  relations: { edges: [] },
  recommendations: { edges: [] },
  stats: { scoreDistribution: [] },
  airingSchedule: { nodes: [] },
  streamingEpisodes: [],
  nextAiringEpisode: null,
}))
```

**Verification:**
- ✅ TV show: `episodes: 12`, `duration: null` → Shows "Episodes: 12"
- ✅ Movie: `episodes: 1`, `duration: 103` → Shows "Length: 103 min"
- ✅ All stub fields prevent `undefined` access errors

---

## Phase 2: Update DetailsModal Component

### File: `/common/modals/details/DetailsModal.svelte`

**Changes Required:**

#### 2A: Wrap mediaListEntry Access (Lines 46-47)

**Current:**
```javascript
$: watched = media?.mediaListEntry?.status === 'COMPLETED'
$: userProgress =  ['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(media?.mediaListEntry?.status) && media?.mediaListEntry?.progress
```

**After:**
```javascript
$: watched = media?.source !== 'TMDB' && media?.mediaListEntry?.status === 'COMPLETED'
$: userProgress = media?.source !== 'TMDB' && ['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(media?.mediaListEntry?.status) && media?.mediaListEntry?.progress
```

#### 2B: Safe Recommendations Access (Line 49)

**Current:**
```javascript
$: recommendations = staticMedia && anilistClient.recommendations({ id: staticMedia.id })
```

**After:**
```javascript
$: recommendations = staticMedia?.source !== 'TMDB' && anilistClient.recommendations({ id: staticMedia.id })
```

#### 2C: Safe mediaListEntry in Play Function (Lines 87-88)

**Current:**
```javascript
if (media?.mediaListEntry) {
  const { status, progress } = media.mediaListEntry
```

**After:**
```javascript
if (media?.source !== 'TMDB' && media?.mediaListEntry) {
  const { status, progress } = media.mediaListEntry
```

#### 2D: Wrap Relations Section (Line 329)

**Current:**
```svelte
<ToggleList list={ staticMedia.relations?.edges?.filter(({ node, relationType }) => relationType !== 'CHARACTER' && node.type === 'ANIME' && node.format !== 'MUSIC' && !(settings.value.adult === 'none' && node.isAdult) && !(settings.value.adult !== 'hentai' && node.genres?.includes('Hentai')) && !missingIds.includes(node.id)).sort((a, b) => (a.node.seasonYear || Infinity) - (b.node.seasonYear || Infinity)) } promise={searchIDS} let:item let:promise title='Relations'>
```

**After:** Wrap entire section
```svelte
{#if staticMedia?.source !== 'TMDB' && staticMedia.relations?.edges?.length}
  <ToggleList list={ staticMedia.relations?.edges?.filter(...).sort(...) } promise={searchIDS} let:item let:promise title='Relations'>
    ...
  </ToggleList>
{/if}
```

#### 2E: Wrap Recommendations Section (Lines 342-345)

**Current:**
```svelte
{#await recommendations then res}
  {#if res?.data?.Media?.recommendations?.edges?.length}
    <ToggleList list={ media.recommendations?.edges?.filter(...).sort(...) } promise={searchIDS} let:item let:promise title='Recommendations'>
```

**After:**
```svelte
{#if staticMedia?.source !== 'TMDB'}
  {#await recommendations then res}
    {#if res?.data?.Media?.recommendations?.edges?.length}
      <ToggleList list={ media.recommendations?.edges?.filter(...).sort(...) } promise={searchIDS} let:item let:promise title='Recommendations'>
```

#### 2F: Wrap Stats/Reviews (Line 255)

**Current:**
```svelte
{#if staticMedia.averageScore && staticMedia.stats?.scoreDistribution}
```

**After:**
```svelte
{#if staticMedia?.source !== 'TMDB' && staticMedia.averageScore && staticMedia.stats?.scoreDistribution}
```

---

## Phase 3: Update FullCard Component

### File: `/common/components/cards/FullCard.svelte`

**Good News:** This component already uses optional chaining! Only minor updates needed.

**Changes Required:**

#### 3A: Safe mediaListEntry Access (Line 45)

**Current:**
```svelte
{#if media.mediaListEntry?.status}
```

**After:**
```svelte
{#if media?.source !== 'TMDB' && media.mediaListEntry?.status}
```

#### 3B: Safe isAdult Access (Line 65)

**Current:**
```svelte
{#if media.isAdult}
```

**After:**
```svelte
{#if media?.isAdult}
```

#### 3C: Safe stats Access (Line 102+)

**Current:**
```svelte
{#if media.stats?.scoreDistribution}
  <span class='badge pl-5 pr-5'>{anilistClient.reviews(media)} Reviews</span>
{/if}
```

**After:**
```svelte
{#if media?.source !== 'TMDB' && media.stats?.scoreDistribution}
  <span class='badge pl-5 pr-5'>{anilistClient.reviews(media)} Reviews</span>
{/if}
```

---

## Phase 4: Update Details Component

### File: `/common/modals/details/components/Details.svelte`

**Current:** Shows all metadata fields, some AniList-only

**Changes Required:**

#### 4A: Filter TMDB Results in Details Map (Lines 20-30)

**Current:** Shows all fields including AniList-specific ones

**After:** Add conditional check in property getter

```javascript
async function getProperty (property, media) {
  // Add at start: Skip AniList-only properties for TMDB
  const anilistOnly = ['episode', 'english', 'romaji', 'native', 'idMal']
  if (anilistOnly.includes(property) && media?.source === 'TMDB') {
    return false
  }
  
  // ... rest of existing logic
}
```

#### 4B: Wrap Specific Fields

**Current (Line 20-29):**
```javascript
const detailsMap = [
  { property: 'season', label: 'Season', icon: CalendarRange, custom: 'property' },
  { property: 'status', label: 'Status', icon: MonitorPlay },
  { property: 'studios', label: 'Studio', icon: Building2, custom: 'property' },
  // ... etc
]
```

**After:** Add `skipIfTMDB` flag
```javascript
const detailsMap = [
  { property: 'season', label: 'Season', icon: CalendarRange, custom: 'property' },
  { property: 'status', label: 'Status', icon: MonitorPlay },
  { property: 'studios', label: 'Studio', icon: Building2, custom: 'property', skipIfTMDB: true },
  // ... rest
]
```

Then in render logic:
```svelte
{#each detailsMap.filter(d => !(d.skipIfTMDB && media?.source === 'TMDB')) as detail}
  <!-- render detail -->
{/each}
```

---

## Phase 5: Testing & Validation

### 5A: Test TMDB TV Show Display

**Steps:**
1. Search for "Breaking Bad" (TV show)
2. Click result card
3. Verify:
   - ✅ Details modal opens without errors
   - ✅ Shows "Format: TV Series"
   - ✅ Shows "Episodes: 62"
   - ✅ Shows "Length:" NOT shown (correct, TV shows have no single length)
   - ✅ Cover image displays
   - ✅ Description visible
   - ✅ Relations section NOT shown (graceful degradation)
   - ✅ Recommendations section NOT shown
   - ✅ No console errors

### 5B: Test TMDB Movie Display

**Steps:**
1. Search for "Stranger: Mukou Hadan" (Movie - shown in attachment)
2. Click result card
3. Verify:
   - ✅ Details modal opens without errors
   - ✅ Shows "Format: Movie"
   - ✅ Shows "Length: 103 min" (NOT episodes)
   - ✅ Cover image displays
   - ✅ Description visible
   - ✅ Relations section NOT shown
   - ✅ Recommendations section NOT shown
   - ✅ No console errors

### 5C: Test Anime Still Works

**Steps:**
1. Search for "Osananajimi to wa Love Comedy ni Naranai" (Anime - shown in attachment)
2. Click result card
3. Verify:
   - ✅ Details modal opens
   - ✅ Shows "Format: TV Series"
   - ✅ Shows "Episodes: 12"
   - ✅ Relations section shown ✅
   - ✅ Recommendations section shown ✅
   - ✅ User tracking works (if logged in) ✅
   - ✅ No console errors

### 5D: Browser Console Check

```bash
# Expected: No errors
# May see: Normal warnings/info logs (okay)
# Should NOT see:
# - "Cannot read property 'edges' of undefined"
# - "{#each} only works with iterable values"
# - "info.mount is not a function"
```

---

## File Modification Summary

| File | Phase | Changes | Lines | Est. Time |
|------|-------|---------|-------|-----------|
| sections.js | 1 | Add episodes, duration, stubs, fix type | 125-180 | 10 min |
| DetailsModal.svelte | 2 | Wrap AniList-only logic | 46, 49, 87-88, 255, 329, 342-345 | 15 min |
| FullCard.svelte | 3 | Safe mediaListEntry/stats access | 45, 65, 102 | 5 min |
| Details.svelte | 4 | Filter AniList properties | 20-60, render | 10 min |
| Testing | 5 | Manual verification | - | 20 min |

---

## Success Criteria

✅ **All Criteria Met When:**
1. TV show card displays "Episodes: X" without errors
2. Movie card displays "Length: X min" without errors
3. Clicking either opens details modal successfully
4. No console errors about undefined properties
5. Anime still shows relations/recommendations
6. TMDB results don't show AniList-only sections
7. All icons and formatting correct
8. User progress tracking hidden for TMDB (graceful)

---

## Rollback Plan

If issues occur:
1. Revert sections.js to before Phase 1
2. Revert component changes in Phase 2-4
3. Check `/tmp/froyoflix.log` for errors
4. Verify cache is cleared (may need rebuild)

---

## Notes

- **No breaking changes** - AniList functionality untouched
- **Graceful degradation** - TMDB shows available info, hides unavailable features
- **Reusable pattern** - Same conditional logic usable for other external APIs
- **User-facing benefits** - TV/Movie support fully functional at UI level
- **Performance** - No additional API calls, only data mapping
