# TMDB Compatibility - Quick Implementation Checklist

## Phase 1: TMDB Data Mapping [sections.js]
- [ ] Line ~160: Add `episodes: type === 'tv' ? (item.number_of_episodes || 0) : 1`
- [ ] Line ~161: Add `duration: type === 'tv' ? null : (item.runtime || null)`
- [ ] Line ~145: Change `type: type === 'tv' ? 'ANIME' : 'ANIME'` → `type: type === 'tv' ? 'TV' : 'MOVIE'`
- [ ] Line ~165+: Add stub fields:
  - [ ] `mediaListEntry: null`
  - [ ] `relations: { edges: [] }`
  - [ ] `recommendations: { edges: [] }`
  - [ ] `stats: { scoreDistribution: [] }`
  - [ ] `airingSchedule: { nodes: [] }`
  - [ ] `streamingEpisodes: []`
  - [ ] `nextAiringEpisode: null`
- [ ] Verify: `isAdult: item.adult || false` exists

## Phase 2: DetailsModal.svelte Updates
- [ ] Line 46: Wrap `watched` - add `media?.source !== 'TMDB' &&`
- [ ] Line 47: Wrap `userProgress` - add `media?.source !== 'TMDB' &&`
- [ ] Line 49: Wrap `recommendations` - add `media?.source !== 'TMDB' &&`
- [ ] Lines 87-88: Wrap mediaListEntry check - add `media?.source !== 'TMDB' &&`
- [ ] Line 255: Wrap stats - add `media?.source !== 'TMDB' &&`
- [ ] Line 329: Wrap entire Relations section with `{#if staticMedia?.source !== 'TMDB'...}`
- [ ] Lines 342-345: Wrap Recommendations section with `{#if staticMedia?.source !== 'TMDB'...}`

## Phase 3: FullCard.svelte Updates
- [ ] Line 45: Wrap mediaListEntry - add `media?.source !== 'TMDB' &&`
- [ ] Line 65: Change `media.isAdult` → `media?.isAdult`
- [ ] Line 102: Wrap stats - add `media?.source !== 'TMDB' &&`

## Phase 4: Details.svelte Updates
- [ ] Lines 20-30: Add `skipIfTMDB: true` flags to AniList-only properties (studios, english, romaji, native, season)
- [ ] Add filter in render: Filter detailsMap by `!d.skipIfTMDB || media?.source !== 'TMDB'`
- [ ] Add check in getProperty: Skip AniList-only properties for TMDB

## Phase 5: Testing
### TV Show (TMDB)
- [ ] Search "Breaking Bad"
- [ ] Click card → Modal opens
- [ ] Shows: "Format: TV Series" + "Episodes: 62"
- [ ] NO console errors

### Movie (TMDB)
- [ ] Search "Stranger: Mukou Hadan"
- [ ] Click card → Modal opens
- [ ] Shows: "Format: Movie" + "Length: 103 min"
- [ ] NO console errors

### Anime (AniList)
- [ ] Search anime title
- [ ] Click card → Modal opens
- [ ] Shows: Relations + Recommendations ✅
- [ ] User tracking visible (if logged in) ✅
- [ ] NO console errors

### Browser Console
- [ ] No "Cannot read property" errors
- [ ] No "{#each} only works" errors
- [ ] No "info.mount is not a function" errors

## Notes
- **Total time:** ~95 minutes
- **Risk level:** Low (existing logic, just wrappers)
- **Reversible:** Yes, straightforward rollback
- **Testing:** Manual UI testing required
