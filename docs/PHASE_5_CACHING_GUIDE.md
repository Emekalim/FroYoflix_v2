# Phase 5 Caching Checklist & Integration Points

This document ensures Phase 5 implementation properly integrates with existing caching system.

---

## Task-by-Task Caching Considerations

### Task 1: Media Type Store
```javascript
// common/modules/mediaType.js
import { writable } from 'simple-store-svelte'
import { cache, caches } from '@/modules/cache.js'

// Load from cache on init
const stored = cache.getEntry(caches.GENERAL, 'mediaType')
export const mediaType = writable(stored || 'anime')

// Persist on change
mediaType.subscribe(value => {
  cache.setEntry(caches.GENERAL, 'mediaType', value)
})
```

**Caching Impact**: Minimal
- Single string value
- Existing pattern from themes.js

---

### Task 2: MediaTypeTabs Component
**Caching Impact**: None
- Pure UI component
- Uses mediaType store (already persisting)

---

### Task 3: sections.js Multi-Provider Routing
```javascript
// Don't cache individual provider queries differently
// Use existing QUERIES cache for all providers
const cached = await cache.cachedEntry(caches.QUERIES, searchKey)

// All metadata goes through same caching:
// Anime → AniList → QUERIES cache → MEDIA_CACHE denormalization
// TV → TMDB → QUERIES cache → MEDIA_CACHE (namespaced)
// Movie → TMDB → QUERIES cache → MEDIA_CACHE (namespaced)
```

**Caching Impact**: Medium
- Need namespacing for multi-media denormalization
- Recommendation: Use source prefix in media ID
  ```javascript
  // Instead of: mediaCache.value[42]
  // Use: mediaCache.value['anilist_42'] or mediaCache.value['tmdb_tv_1234']
  ```

---

### Task 4: Adaptive Filters
**Caching Impact**: Low
- Filter state already persists via HISTORY cache
- Filters are UI only, don't need new caching

---

### Task 5: TorrentModal Registry Integration
```javascript
// Consider caching torrent results briefly
// Current: Not cached at all
// Phase 5: Could cache 1-2 hour expiry

const torrentCacheKey = `torrent_${mediaType}_${title}_${season}_${ep}`
const cached = await cache.cachedEntry(caches.QUERIES, torrentCacheKey)
if (cached) return cached

// Query extensions
const results = await registry.queryExtensions(query)

// Cache for 1 hour (short expiry - availability changes)
await cache.cacheEntry(
  caches.QUERIES,
  torrentCacheKey,
  null,
  results,
  Date.now() + 60 * 60 * 1000
)
```

**Caching Impact**: Medium
- New cache type: torrent results
- Short expiry (1-2 hours) recommended
- Consider: Seeders change frequently, so short TTL essential

---

### Task 6: Extension Selector
```javascript
// Store extension preferences in GENERAL cache
import { cache, caches } from '@/modules/cache.js'

const defaultPrefs = {
  anime: [],  // User hasn't selected, use all
  tv: [],
  movie: []
}

export const extensionPreferences = writable(
  cache.getEntry(caches.GENERAL, 'extensionPreferences') || defaultPrefs
)

extensionPreferences.subscribe(value => {
  cache.setEntry(caches.GENERAL, 'extensionPreferences', value)
})
```

**Caching Impact**: Low
- Simple preference object
- Existing pattern from settings.js
- No expiry needed (preferences don't expire)

---

### Task 7: Integration Tests
**Caching Impact**: Test coverage
- Verify cache loads on app init
- Verify preferences persist across reload
- Verify media type preference saved/restored
- Test torrent result caching (if implemented in Task 5)

---

### Task 8: Extension Settings Page
**Caching Impact**: Low
- Reads from extensionPreferences (already persisting)
- Updates trigger automatic persistence

---

### Task 9: Documentation
**Caching Impact**: Documentation only
- Update agent.md with new cache entries
- Document multi-media ID namespacing
- Explain short expiry for torrent results

---

## Multi-Media ID Namespacing (CRITICAL)

### Problem
```javascript
// Before: All media stored by numeric ID
mediaCache.value[42]  // Could be anime or movie

// AniList anime ID 42 vs TMDB movie ID 42 conflict!
```

### Solution Option 1: String Keys with Source Prefix
```javascript
// Namespace by source
mediaCache.value['anilist_42']     // Anime
mediaCache.value['tmdb_tv_1234']   // TV show
mediaCache.value['tmdb_movie_5678'] // Movie
mediaCache.value['tvdb_91239']     // TV alternative ID

// When storing:
const key = `${source}_${id}`
mediaCache.value[key] = { ...data, source }

// When retrieving:
const data = mediaCache.value[`anilist_${anilistId}`]
```

### Solution Option 2: Split Caches
```javascript
// Or: Separate object stores per media type
caches.MEDIA_ANIME = { key: 'media_anime', database: true }
caches.MEDIA_TV = { key: 'media_tv', database: true }
caches.MEDIA_MOVIES = { key: 'media_movies', database: true }

// Usage:
mediaCache.value[42]  // Still numeric per cache
// But accessed from appropriate cache based on context
```

**Recommendation**: Use Option 1 (string keys) - simpler, less database overhead

---

## Torrent Result Caching Decision

### Current State
- Torrent results NOT cached
- Fresh search every time

### Phase 5 Options

**Option A: No Caching**
- ✅ Simple, no new logic
- ❌ Slower UX for repeated searches
- ❌ Higher extension load

**Option B: Cache 1-2 Hours**
- ✅ Improves UX for binge-watching (same show, multiple episodes)
- ✅ Reduces extension load
- ✅ Short expiry prevents stale results
- ❌ Slightly more complex (but follows existing pattern)

**Option C: Cache with Conditional TTL**
- ✅ Longer cache for unpopular content
- ✅ Shorter cache for popular content
- ❌ More complex logic

**Recommendation**: Option B for Phase 5
- Start simple, add Option C in Phase 6 if performance analysis shows benefit
- Use existing `cache.cacheEntry()` pattern

---

## Checklist for Phase 5 Implementation

### Before Starting
- [ ] Review this document with team
- [ ] Decide on media ID namespacing (Option 1 or 2)
- [ ] Decide on torrent caching (Option A, B, or C)

### During Implementation
- [ ] Task 1: Use existing cache patterns for mediaType store
- [ ] Task 3: Apply namespacing when storing TV/movie metadata
- [ ] Task 5: If caching torrent results, use existing cacheEntry() function
- [ ] Task 6: Follow settings.js pattern for extension preferences
- [ ] Task 7: Include cache-related tests
  - Verify preferences persist
  - Verify media type persists
  - Verify torrent cache expiry (if implemented)

### After Implementation
- [ ] Update agent.md with caching notes
- [ ] Document ID namespacing pattern
- [ ] Add cache warming strategy (load commonly used caches)

---

## Performance Expectations

### App Startup
- Current: 100-200ms cache load
- Phase 5: 150-250ms (more data, but worth it)

### Search Performance
- Anime search: ~50ms cache hit (unchanged)
- TV search: ~50ms cache hit (same caching)
- Torrent search: 
  - Cache hit: <5ms
  - No cache: 1-5s (parallel extensions)

### Storage
- Current IndexedDB: ~50-100MB (anime-only)
- Phase 5: ~100-200MB (anime + TV + movies)
- Still well under IndexedDB limits (GB range)

---

## Migration Strategy (If Needed Later)

If Phase 5 or Phase 6 needs to migrate existing anime cache:

```javascript
// 1. Load old cache
const oldAnimecache = await loadAll(userID, caches.MEDIA_CACHE)

// 2. Transform to new schema
const newCache = {}
Object.entries(oldAnimeCache).forEach(([id, media]) => {
  newCache[`anilist_${id}`] = media
})

// 3. Clear old and write new
await reset(userID, caches.MEDIA_CACHE)
await putMany(userID, caches.MEDIA_CACHE, Object.entries(newCache))
```

---

## Summary

| Aspect | Phase 5 Status | Notes |
|--------|---|---|
| mediaType persistence | Ready | Use existing GENERAL cache |
| Preference persistence | Ready | Use existing GENERAL cache |
| Multi-media metadata caching | Requires Decision | Namespace IDs by source |
| Torrent result caching | Optional | Short expiry recommended |
| Extension code caching | Not recommended | Keep in-memory only |
| Cache recovery | Ready | No changes needed |
| Batch writing | Ready | Auto-optimization works |

**Bottom line**: Existing caching system ready for Phase 5. Main decision: ID namespacing strategy.

