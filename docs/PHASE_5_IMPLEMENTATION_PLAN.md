# Phase 5: UI Adaptations for Multi-Media Extension System

**Objective**: Update UI to leverage Phase 4 multi-media extension system  
**Start Date**: February 2, 2026  
**Previous Phase**: Phase 4 (✅ Complete: registry.js, compatibility.js, all tests passing)

---

## Current UI Architecture (Two-Layer System)

**Layer 1: Metadata Preview** (Providers)
- SearchPage shows media with metadata (AniList, TMDB, Trakt, MAL)
- Click card → DetailsModal shows full details
- Currently anime-only

**Layer 2: Torrent Search** (Extensions)
- Click "Play" button in DetailsModal → TorrentModal opens
- TorrentModal searches extensions for torrent sources
- Shows seeders, leechers, file sizes
- Links to magnet/torrent files

---

## Phase 5 Scope (Extending Both Layers)

### **Layer 1 Changes: Multi-Media Metadata Search**
- Add Anime/TV/Movie tabs in SearchPage
- Route searches to appropriate providers per media type
- Show media metadata for selected type

### **Layer 2 Changes: Multi-Media Torrent Search**
- Update TorrentModal to use Phase 4 registry
- Query extensions that support current media type
- Show extension sources alongside torrent results

---

## Implementation Strategy

This plan follows a **progressive compatibility verification** approach:
1. **Verify basic integration works** before adding features
2. **Confirm anime search still works** (backward compatibility)
3. **Add TV/Movie support** to metadata layer
4. **Integrate extensions** into torrent layer
5. **Test each step** before proceeding to next

This prevents breaking existing anime search while building new multi-media support.

---

## Phase 5 - Task Breakdown

### **Task 1: Create Media Type Store**

**Objective**: Add media type awareness without breaking existing anime search

**Files to Create**:
- `common/modules/mediaType.js` - Writable store for current media type (default: 'anime')

**Deliverables**:
```javascript
// mediaType.js exports
export const mediaType = writable('anime') // 'anime' | 'tv' | 'movie'
```

**Success Criteria**:
- [ ] mediaType store initialized with 'anime' default
- [ ] Can be imported and subscribed to anywhere
- [ ] Persists across page navigation (use cache)

**Testing**:
```javascript
// Test 1: Import and subscribe
import { mediaType } from '@/modules/mediaType.js'
mediaType.subscribe(value => console.log(value)) // 'anime'

// Test 2: Update value
mediaType.set('tv')
// Should trigger subscriber → 'tv'

// Test 3: Persist across reload
mediaType.set('movie')
// Close and reopen app → Should remember 'movie'
```

**Risk**: None - new module only

---

### **Task 2: Add MediaTypeTabs to SearchPage**

**Objective**: Add Anime/TV/Movie tabs to allow switching search type

**Files to Create**:
- `common/routes/search/components/MediaTypeTabs.svelte` - Tab selector

**Files to Modify**:
- `common/routes/search/SearchPage.svelte` - Include tabs

**Deliverables**:
- [ ] Tabs visible at top of search results
- [ ] Clicking tab updates mediaType store
- [ ] Current tab highlighted
- [ ] SearchPage re-renders based on media type

**Success Criteria**:
- [ ] Default tab is "Anime"
- [ ] Clicking "TV" updates mediaType → search updates
- [ ] Clicking "Movie" updates mediaType → search updates
- [ ] No breaking changes to anime search

**Testing**:
```javascript
// Test 1: Default tab
// Should: Anime tab highlighted

// Test 2: Click TV
// Should: TV tab highlighted, search updates

// Test 3: Results change per type
// Anime: Metadata from AniList
// TV: Metadata from TMDB
// Movie: Metadata from TMDB
```

**Risk**: Low - UI component only

**Blocking on**: Task 1 ✅

---

### **Task 3: Update sections.js for Multi-Media Providers**

**Objective**: Route metadata searches to correct provider per media type

**Files to Modify**:
- `common/modules/sections.js` - Add provider routing logic

**Current Code** (always uses AniList):
```javascript
return anilistClient.search({ page, perPage, ...filters })
```

**New Code** (routes by media type):
```javascript
// Pseudo-code
if (mediaType === 'anime') {
  return anilistClient.search(filters)
} else if (mediaType === 'tv' || mediaType === 'movie') {
  return tmdbClient.search(filters)  // NEW: Use TMDB for TV/Movies
}
```

**Deliverables**:
- [ ] Anime searches still use AniList
- [ ] TV/Movie searches use TMDB
- [ ] Results formatted for Card components
- [ ] Metadata includes provider info

**Success Criteria**:
- [ ] Anime search unchanged (same results)
- [ ] TV search shows TV shows from TMDB
- [ ] Movie search shows movies from TMDB
- [ ] Cards display correctly for each type

**Testing**:
```javascript
// Test 1: Anime tab
search('Attack on Titan') 
// Should: Return AniList metadata, display anime cards

// Test 2: TV tab
search('Breaking Bad')
// Should: Return TMDB metadata, display TV show cards

// Test 3: Movie tab
search('Inception')
// Should: Return TMDB metadata, display movie cards
```

**Risk**: Low-Medium
- **Issue**: TMDB API calls may vary from AniList format
- **Mitigation**: Already have TMDBProvider from Phase 1
- **Fallback**: Keep AniList for anime, use existing TMDB logic

**Blocking on**: Task 2 ✅

---

### **Task 4: Update SearchBar for Adaptive Filters**

**Objective**: Show different filters based on media type

**Files to Modify**:
- `common/routes/search/components/SearchBar.svelte` - Conditional filters per media type

**Design**:
```svelte
<!-- Current: All anime filters -->
<!-- Target: Conditional filters -->
{#if $mediaType === 'anime'}
  <AnimeFilters />  <!-- genre, tag, season, format -->
{:else if $mediaType === 'tv'}
  <TVFilters />     <!-- network, status -->
{:else if $mediaType === 'movie'}
  <MovieFilters />  <!-- genre, year -->
{/if}
```

**Deliverables**:
- [ ] Anime tab shows: genre, tag, season, format filters
- [ ] TV tab shows: simplified filters (network, status)
- [ ] Movie tab shows: simplified filters (genre, year)
- [ ] Filters reset when switching media type

**Success Criteria**:
- [ ] Filters change when switching media type
- [ ] Search still works with new filter set
- [ ] Anime search unchanged

**Testing**:
```javascript
// Test 1: Anime tab
// Should: Show all anime-specific filters

// Test 2: Switch to TV tab
// Should: Hide anime filters, show TV filters

// Test 3: Search with TV filters
// Should: Pass correct filters to TMDB provider
```

**Risk**: Low

**Blocking on**: Task 3 ✅

---

### **Task 5: Update TorrentModal for Multi-Media Extension Search**

**Objective**: Use Phase 4 registry to search for torrents instead of hardcoded extensions

**Files to Modify**:
- `common/modals/torrent/TorrentModal.svelte` - Route to registry based on media type
- `common/modals/torrent/components/TorrentResults.svelte` - Display results with source info

**Current Flow**:
```
DetailsModal (anime details only)
  ↓ Click "Play" 
  ↓ Pass media + episode
  ↓ TorrentResults searches extensions
  → Display torrent results
```

**New Flow**:
```
DetailsModal (anime/tv/movie details)
  ↓ Click "Play" or "Find Sources"
  ↓ Pass media + mediaType
  ↓ Call registry.queryExtensions() with media type
  → Route to extensions that support media type
  → Display torrent results with extension source
```

**Deliverables**:
- [ ] TorrentModal detects media type from context
- [ ] Calls registry.queryExtensions() instead of hardcoded search
- [ ] Shows which extension provided each result
- [ ] Works for anime, TV, and movies

**Success Criteria**:
- [ ] Anime torrent search still works (backward compat)
- [ ] TV torrent search works (routes to RARBG, 1337x, etc)
- [ ] Movie torrent search works
- [ ] Extension source visible for each result

**Testing**:
```javascript
// Test 1: Anime episode search
playAnime(media, episode)
// Should: Search extensions for anime episode torrent

// Test 2: TV episode search
playTV(media, episode)
// Should: Search extensions for TV episode torrent

// Test 3: Movie search
playMovie(media)
// Should: Search extensions for movie torrent

// Test 4: Results show source
// Should: Display "Found on Nyaa", "Found on RARBG", etc
```

**Risk**: Medium
- **Issue**: Phase 4 registry designed for anime, need to verify it works for TV/movies
- **Mitigation**: Test compatibility in Task 7
- **Fallback**: Keep separate extension handlers per type if needed

**Blocking on**: Task 4 ✅

---

### **Task 6: Add Extension Selector to TorrentModal**

**Objective**: Let users choose which extensions to search for torrents

**Files to Create**:
- `common/modules/extensionPreferences.js` - Store per-media-type extension preferences
- `common/modals/torrent/components/ExtensionSelector.svelte` - UI to select extensions

**Design**:
```svelte
<!-- ExtensionSelector.svelte -->
<div class="extension-selector">
  <label>Search with:</label>
  {#each registry.getExtensionsForMediaType($mediaType) as ext}
    <input type="checkbox" checked={isSelected(ext)} />
    <span>{ext.name}</span>
  {/each}
</div>
```

**Deliverables**:
- [ ] Extension selector visible in TorrentModal
- [ ] Can enable/disable extensions per media type
- [ ] Selected extensions saved to preferences
- [ ] Only selected extensions queried

**Success Criteria**:
- [ ] Shows available extensions for current media type
- [ ] Can toggle extensions on/off
- [ ] Preferences persist
- [ ] Search uses only selected extensions

**Testing**:
```javascript
// Test 1: Open torrent modal for anime
// Should: Show extensions that support anime

// Test 2: Uncheck an extension
// Should: Not search that extension

// Test 3: Switch to TV and back to anime
// Should: Remember which were checked for anime
```

**Risk**: Low

**Blocking on**: Task 5 ✅

---

### **Task 7: Create Multi-Media Compatibility Test Suite**

**Objective**: Verify both layers (metadata + torrent) work for anime/tv/movie

**Files to Create**:
- `common/modules/__tests__/phase-5-integration.test.mjs` - Comprehensive tests

**Test Coverage**:
```javascript
/* Test Suite: Phase 5 Integration */

// Group 1: Backward Compatibility (ANIME UNCHANGED)
- Anime search produces same results
- Anime details modal works
- Anime torrent search unchanged
- Can still play anime

// Group 2: Metadata Layer (Multi-Media)
- TV search returns TV shows from TMDB
- Movie search returns movies from TMDB
- Filters adapt per media type
- Details modal works for all types

// Group 3: Torrent Layer (Multi-Media)
- Anime torrent search uses registry
- TV torrent search uses registry
- Movie torrent search uses registry
- Extension sources displayed
- Results grouped by extension

// Group 4: UI Responsiveness
- Media type tabs switch all layers
- Filters update per media type
- TorrentModal reflects media type
- Extension selector shows correct options

// Group 5: Edge Cases
- No results for type → graceful error
- Extension unavailable → fallback to others
- Mixed format results → display correctly
```

**Deliverables**:
- [ ] 50+ integration tests covering all flows
- [ ] All tests passing before moving to Task 8
- [ ] Backward compatibility verified (anime unchanged)
- [ ] All new features verified working

**Success Criteria**:
- [ ] All 50+ tests passing
- [ ] No breaking changes to existing anime features
- [ ] Both layers work for all media types
- [ ] Edge cases handled

**Testing**:
```bash
cd /Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix
node common/modules/__tests__/phase-5-integration.test.mjs
# Expected: 50+ tests passing, 0 failing
```

**Risk**: Low - tests only

**Blocking on**: Task 6 ✅

---

### **Task 8: Add Extension Settings Page**

**Objective**: Centralized settings for managing extensions per media type

**Files to Create**:
- `common/routes/settings/ExtensionSettings.svelte` - Extension management tab
- Update `common/routes/settings/SettingsPage.svelte` - Add tab

**Design**:
```svelte
<!-- ExtensionSettings.svelte -->
<h2>Torrent Extensions</h2>

{#each ['anime', 'tv', 'movie'] as type}
  <section>
    <h3>{type}</h3>
    {#each getExtensionsForType(type) as ext}
      <div>
        <h4>{ext.name}</h4>
        <p>{ext.description}</p>
        <toggle bind:enabled={prefs[type][ext.name]} />
      </div>
    {/each}
  </section>
{/each}
```

**Deliverables**:
- [ ] Settings page shows all extensions
- [ ] Extensions grouped by media type
- [ ] Shows capabilities and supported ID types
- [ ] Can enable/disable independently per type
- [ ] Changes reflected in search immediately

**Success Criteria**:
- [ ] All extensions visible with metadata
- [ ] Can manage per media type
- [ ] Preferences persist
- [ ] Changes take effect immediately

**Testing**:
```javascript
// Test 1: Open settings
// Should: Show all extensions grouped by type

// Test 2: Disable for TV
// Should: TV search doesn't use disabled extension

// Test 3: Restart app
// Should: Preferences restored
```

**Risk**: Low

**Blocking on**: Task 7 ✅

---

### **Task 9: Documentation & Production Readiness**

**Objective**: Final documentation, edge cases, production deployment

**Files to Update**:
- `docs/agent.md` - Update with Phase 5 features
- `common/routes/search/SearchPage.svelte` - Add JSDoc comments
- `common/modals/torrent/TorrentModal.svelte` - Add JSDoc comments

**Deliverables**:
- [ ] All Phase 5 code fully documented with JSDoc
- [ ] agent.md updated with new flows
- [ ] README updated with multi-media features
- [ ] Error handling for all edge cases
- [ ] Production deployment checklist

**Success Criteria**:
- [ ] Code documented
- [ ] All behaviors explained
- [ ] Edge cases documented
- [ ] Ready for users

**Testing**:
```bash
# Full manual test - both layers
1. Open app → Default anime search works ✓
2. Click anime episode → TorrentModal shows torrent sources ✓
3. Click TV tab → Show TV results from TMDB ✓
4. Click TV episode → TorrentModal searches TV extensions ✓
5. Click Movie tab → Show movies from TMDB ✓
6. Click movie → TorrentModal searches movie extensions ✓
7. Open settings → Extension preferences work ✓
8. Restart app → Everything persists ✓
```

**Risk**: Low - documentation only

**Blocking on**: Task 8 ✅

---

## Verification Checkpoints

### **Checkpoint 1: After Task 3**
✓ Anime search still works exactly as before  
✓ No breaking changes to existing code  
✓ Provider routing logic confirmed working

### **Checkpoint 2: After Task 4**
✓ Media type tabs visible and functional  
✓ Filters adapt per media type  
✓ Search responds correctly to media type changes

### **Checkpoint 3: After Task 6**
✓ TorrentModal uses registry for all media types  
✓ Extension sources visible in torrent results  
✓ Extension selector works for TorrentModal

### **Checkpoint 4: After Task 7**
✓ All 50+ integration tests passing  
✓ Backward compatibility verified  
✓ Both layers (metadata + torrent) work for all types

### **Final Checkpoint: After Task 9**
✓ Phase 5 production ready  
✓ All documentation complete  
✓ Ready to merge to main

---

## Architecture Diagrams

### **Layer 1: Metadata Search (Providers)**
```
SearchPage
  ↓ select media type
  ↓ enter search query
  ↓
MediaTypeTabs (Anime | TV | Movie)
  ↓
sections.js (routes based on mediaType)
  ├─ Anime → anilistClient.search()
  └─ TV/Movie → tmdbClient.search()
  ↓
Card components (show metadata)
  ↓ click card
  ↓
DetailsModal (full details for selected media)
```

### **Layer 2: Torrent Search (Extensions)**
```
DetailsModal (anime/tv/movie details)
  ↓ click "Play" or "Find Sources"
  ↓
TorrentModal
  ↓ pass media + mediaType
  ↓
registry.queryExtensions()
  ├─ Anime → Extensions supporting anime
  ├─ TV → Extensions supporting TV
  └─ Movie → Extensions supporting movies
  ↓
TorrentResults (show torrent sources)
  ├─ Seeders/leechers
  ├─ Size
  ├─ Extension source
  └─ Magnet link
```

---

## Risk Summary

| Task | Risk | Mitigation |
|------|------|-----------|
| 1 | None | New module only |
| 2 | Low | UI component only |
| 3 | Low | Use existing TMDB provider |
| 4 | Low | Simplify filters, add gradually |
| 5 | Medium | Test registry with TV/movies in Task 7 |
| 6 | Low | Use existing extension logic |
| 7 | Low | Use Phase 4 test mocks |
| 8 | Low | Follow existing settings pattern |
| 9 | Low | Document as we go |

---

## Timeline Estimate

- **Task 1-2**: 1 hour (store + tabs)
- **Task 3-4**: 2 hours (provider routing + filters)
- **Task 5-6**: 3 hours (torrent modal + extension selector)
- **Task 7-8**: 3 hours (testing + settings)
- **Task 9**: 1 hour (polish & docs)

**Total: 10-11 hours** (or 1 focused day)

---

## Success Criteria (Phase 5 Complete)

- [ ] All 9 tasks completed
- [ ] All 50+ integration tests passing
- [ ] Anime search works exactly as before (backward compat)
- [ ] TV search shows TMDB results
- [ ] Movie search shows TMDB results
- [ ] Anime torrent search works via registry
- [ ] TV torrent search works via registry
- [ ] Movie torrent search works via registry
- [ ] Extension selector works in TorrentModal
- [ ] Settings page complete
- [ ] Code fully documented
- [ ] Ready for Phase 6 (Performance Optimization)

---

## Next Phase: Phase 6 - Performance Optimization

After Phase 5 is complete and production-ready:
- Batch search optimization
- Worker pooling for parallel queries
- Cache compression for torrent metadata
- Lazy loading of extensions
- Search latency tracking and monitoring

