# FroYoflix Caching Architecture

**Overview**: Comprehensive guide to current caching system and considerations for Phase 5+ development

---

## Cache System Architecture

### Storage Layers

**Layer 1: In-Memory (Writable Stores)**
- Instant access via Svelte reactive stores
- Automatically synchronized with IndexedDB
- Lost on page reload (IndexedDB restored on app init)

**Layer 2: IndexedDB (Persistent)**
- Per-user database (named by user ID)
- 15 object stores (collections)
- Survives browser restarts
- Batch write optimization to reduce transaction overhead

### Cache Types

| Cache Name | Type | Persisted | Purpose |
|------------|------|-----------|---------|
| **GENERAL** | DB | ✓ | Settings, torrent state, theme, app config |
| **QUERIES** | DB | ✓ | Search results with expiry timestamps |
| **MAPPINGS** | DB | ✓ | ID mappings (AniList ↔ MAL ↔ TMDB, etc) |
| **MEDIA_CACHE** | DB | ✓ | Denormalized media metadata (anime, shows, movies) |
| **USER_LISTS** | DB | ✓ | User's watch lists, reading lists, custom lists |
| **NOTIFICATIONS** | DB | ✓ | Last notification times, RSS feed state |
| **HISTORY** | DB | ✓ | Last search, watch history, preferences |
| **COMPOUND** | Memory | ✗ | Temporary combined queries |
| **EXTENSIONS** | Memory | ✗ | Loaded extension code and state |
| **EPISODES** | Memory | ✗ | Episode data during playback |
| **FOLLOWING** | Memory | ✗ | User's followed anime |
| **RECOMMENDATIONS** | Memory | ✗ | Anime recommendations |
| **SEARCH_IDS** | Memory | ✗ | ID-based search results |
| **SEARCH** | Memory | ✗ | General search results |
| **RSS** | Memory | ✗ | RSS feed items |

---

## Current Caching Patterns

### Pattern 1: Configuration & Settings Cache

```javascript
// common/modules/settings.js
let storedSettings = cache.getEntry(caches.GENERAL, 'settings')
export const settings = writable(storedSettings || {...defaults})

// Auto-persist on change
settings.subscribe(value => cache.setEntry(caches.GENERAL, 'settings', value))

// Result: User preferences survive app restart
```

### Pattern 2: Search Result Caching with Expiry

```javascript
// Before searching, check cache
const cached = await cache.cachedEntry(caches.QUERIES, searchKey)
if (cached) return cached  // Return cached results

// If not cached, perform query
const results = await anilistClient.search(query)

// Cache with 24-hour expiry
const expiry = Date.now() + 24 * 60 * 60 * 1000
await cache.cacheEntry(caches.QUERIES, searchKey, vars, results, expiry)
```

**Key Feature**: Expiry timestamps prevent stale data while reducing API calls

### Pattern 3: Media Denormalization

```javascript
// Queries return media IDs: [42, 9969, 1234]
// Cache stores full media objects in MEDIA_CACHE
mediaCache.value = {
  42: { id: 42, title: 'Attack on Titan', score: 8.5, ... },
  9969: { id: 9969, title: 'Steins;Gate', score: 9.0, ... },
  ...
}

// Query results reference via ID, resolve from mediaCache
const result = { data: { Page: { media: [42, 9969] } } }
// When displaying: result.data.Page.media.map(id => mediaCache.value[id])
```

**Benefit**: Single copy of each media object, saves space

### Pattern 4: Batch Writing

```javascript
// Multiple writes queued:
cache.setEntry(GENERAL, 'stagingTorrents', [...])
cache.setEntry(GENERAL, 'seedingTorrents', [...])
cache.setEntry(GENERAL, 'completedTorrents', [...])

// Internally:
// 1. Writes collected for ~10 seconds
// 2. Single IndexedDB transaction commits all
// 3. Reduces database contention
```

**Benefit**: Improves performance with multiple rapid writes

### Pattern 5: Torrent State Persistence

```javascript
// Torrent manager state stored in GENERAL cache
const loadedTorrent = cache.getEntry(caches.GENERAL, 'loadedTorrent')
const stagingTorrents = cache.getEntry(caches.GENERAL, 'stagingTorrents')
const seedingTorrents = cache.getEntry(caches.GENERAL, 'seedingTorrents')
const completedTorrents = cache.getEntry(caches.GENERAL, 'completedTorrents')

// On app restart, these are restored automatically
// User's torrent state is exactly as they left it
```

---

## Cache Read Flow

```
1. Component requests data (e.g., search('Anime'))
   ↓
2. Check in-memory cache first
   - If valid (not expired), return immediately
   - If missing or expired, continue
   ↓
3. Fetch from source (API, extension, etc)
   ↓
4. Process results
   - Denormalize media → MEDIA_CACHE
   - Store query result → QUERIES
   - Extract mappings → MAPPINGS
   ↓
5. Return to component
   ↓
6. In-memory store notifies IndexedDB batch writer
   - Changes batched for ~1.5 seconds
   - Single transaction commits all changes
```

---

## Cache Write Flow

```
Component changes data
   ↓
Update writable store (in-memory)
   ↓
Subscription triggered
   ↓
Compare with previous value (deep equality check)
   ↓
If changed:
  - Enqueue to batch writer
  - Store in cacheMap (in-memory reference)
   ↓
Batch writer flushes after delay
   ↓
Single IndexedDB transaction writes all changes
   ↓
If transaction fails:
  - Retry with exponential backoff
  - If still failing, keep in-memory (not lost)
```

---

## Expiry & Invalidation

### Query Result Expiry

```javascript
// Queries cached with 24-hour expiry (typical)
cacheEntry(cache, key, vars, data, Date.now() + 24 * 60 * 60 * 1000)

// When retrieving:
if (Date.now() < cachedEntry.expiry) {
  return cachedEntry.data  // Fresh
} else {
  return null  // Expired, refetch
}
```

### Manual Invalidation

```javascript
// When user modifies their list:
cache.reset(caches.USER_LISTS)  // Clear all user lists
cache.setEntry(caches.GENERAL, 'loadedTorrent', {})  // Clear current torrent

// Or delete specific entries:
cache.remove(caches.QUERIES, ['search_key_1', 'search_key_2'])
```

### Auto Invalidation (On Offline)

```javascript
// When app goes offline, stale cache used
// When app comes online, fresh data fetched
if (status.value.match(/offline/i)) {
  return cachedEntry(cache, key, true)  // Ignore expiry
}
```

---

## Recovery & Error Handling

### Corrupted Cache Recovery

```javascript
// If cache.js fails to load (corrupted):
try {
  data = await loadAll(userID, cacheKey)
} catch (error) {
  // Attempt recovery
  const recovered = await recoverCache(userID, cacheKey)
  if (recovered.length > 0) {
    // Restore recovered entries
    await reset(userID, cacheKey)
    await putMany(userID, cacheKey, Object.entries(recovered))
  }
}
```

**Feature**: Individual entries recovered if possible, preventing total data loss

---

## Current Issues & Considerations for Phase 5

### 1. **Extension Code Caching (In-Memory Only)**

**Current**: Extension code stored in memory-only EXTENSIONS cache
- Lost on app reload
- No persistence

**Impact for Phase 5**:
- When adding TV/movie extensions, extension code will be re-fetched on every app restart
- Consider caching extension manifests in MEDIA_CACHE or new cache store
- Performance trade-off: storage vs startup speed

**Recommendation**:
```javascript
// Phase 5+: Store extension metadata
caches.EXTENSION_MANIFESTS = { key: 'extension_manifests', database: true }

// Cache extension capabilities, supported IDs, etc
cache.cacheEntry(
  caches.EXTENSION_MANIFESTS,
  'nyaa_manifest',
  null,
  manifestData,
  Date.now() + 7 * 24 * 60 * 60 * 1000  // 1 week
)
```

### 2. **Torrent Result Caching (Not Currently Used)**

**Current**: Torrent search results not cached
- Extensions queried fresh every time
- No result caching

**Impact for Phase 5**:
- TV/movie torrent searches could benefit from caching (many searches for same show)
- But: Torrent availability changes frequently (seeders, leechers vary)
- Short expiry needed (1-2 hours?)

**Recommendation**:
```javascript
// Phase 5+: Cache torrent results briefly
const torrentKey = `${mediaType}:${title}:${season}:${episode}`
const cached = await cache.cachedEntry(caches.QUERIES, torrentKey)
if (cached && Date.now() < cached.expiry) return cached

// Query extensions
const results = await registry.queryExtensions(query)

// Cache for 1 hour (shorter than metadata queries)
await cache.cacheEntry(
  caches.QUERIES,
  torrentKey,
  null,
  results,
  Date.now() + 60 * 60 * 1000
)
```

### 3. **Multi-Media Metadata Caching**

**Current**: Only anime metadata cached (AniList)
- MEDIA_CACHE full of anime objects
- TV/movie caching will mix types

**Impact for Phase 5**:
- mediaCache will contain anime + TV shows + movies
- Object IDs might conflict (AniList ID 42 vs TMDB ID 42)
- Need namespacing: `{ anilist_42, tmdb_1234, tvdb_5678 }`

**Recommendation**:
```javascript
// Phase 5+: Namespace media by source
mediaCache.value = {
  'anilist_42': { ...animeData },
  'tmdb_tv_1234': { ...tvData },
  'tmdb_movie_5678': { ...movieData }
}

// Or split caches:
caches.MEDIA_ANIME = { key: 'media_anime', database: true }
caches.MEDIA_TV = { key: 'media_tv', database: true }
caches.MEDIA_MOVIES = { key: 'media_movies', database: true }
```

### 4. **Preferences & State Persistence**

**Current**: Search history, theme, settings in GENERAL cache
- Simple key-value storage
- Good for Phase 5 extension preferences

**Impact for Phase 5**:
- Extension preferences (enabled/disabled per media type) stored in GENERAL
- Media type preference stored in HISTORY
- Should work as-is

**Recommendation**:
```javascript
// Phase 5: Store in GENERAL cache (existing)
cache.setEntry(caches.GENERAL, 'extensionPreferences', {
  anime: ['nyaa', 'sukebei', '1337x'],
  tv: ['rarbg', '1337x'],
  movie: ['rarbg', 'yify']
})

cache.setEntry(caches.GENERAL, 'mediaType', 'anime')
```

---

## Database Schema (Current)

```javascript
// Each cache is an ObjectStore with structure:
ObjectStore: {
  keyPath: 'key',  // Primary key
  indexes: []
}

// Each entry:
{
  key: 'search_attack_on_titan',  // String key
  value: {
    data: { /* search results */ },
    expiry: 1707000000000,  // Timestamp when expires
    cachedAt: 1706000000000  // When cached
  }
}

// For simple entries (not queries):
{
  key: 'theme',
  value: '#1a1a1a'  // Direct value
}
```

---

## Performance Characteristics

### Current Benchmarks (Phase 1-3)

| Operation | Time | Notes |
|-----------|------|-------|
| App startup (cache load) | 100-200ms | IndexedDB read + store hydration |
| Search result return | <50ms | Cache hit (in-memory) |
| API search | 500-2000ms | Network + parsing |
| Cache write | 0ms | Queued batch (async) |
| IndexedDB commit | 50-100ms | Batch flush every 1.5-10s |

### Phase 5 Additions

**Expected changes**:
- Startup time: +50-100ms (more caches to load)
- Extension preference check: <5ms (small object)
- Torrent cache lookup: <5ms (in-memory)
- Registry query: 1-5s (parallel extension searches)

---

## Best Practices for Phase 5

### DO:
✅ Cache stable metadata (anime/TV/movie info doesn't change)  
✅ Use short expiry for volatile data (torrent seeders, availability)  
✅ Namespace IDs by source to avoid collisions  
✅ Use existing GENERAL cache for preferences  
✅ Leverage batch writing for multiple updates  

### DON'T:
❌ Cache extension code (memory only, or short expiry)  
❌ Cache torrent availability without short expiry  
❌ Mix different media types without namespacing  
❌ Store large objects without considering IndexedDB limits  
❌ Assume cache persists across browser data clear  

---

## Future Optimization (Phase 6)

### Cache Compression
```javascript
// Compress large result objects before storing
const compressed = compress(largeResultObject)
cache.setEntry(caches.QUERIES, key, compressed)

// Decompress on retrieval
const data = decompress(cachedEntry.value)
```

### Selective Caching
```javascript
// Only cache "important" searches
if (wasUserInitiated) {
  cache.cacheEntry(...)  // Cache user searches
} else {
  // Skip caching for auto-suggestions
}
```

### TTL Management
```javascript
// Adaptive expiry based on result count
const expiry = resultCount > 100 
  ? Date.now() + 7 * 24 * 60 * 60 * 1000  // 7 days for large results
  : Date.now() + 24 * 60 * 60 * 1000      // 1 day for small results
```

---

## Summary: What Phase 5 Should Know

1. **Cache structure is ready for multi-media** - Just need namespacing for IDs
2. **Extension preferences should go in GENERAL cache** - Already built for this
3. **Consider short-lived torrent result caching** - Will improve UX for repeated searches
4. **Don't cache volatile data** - Seeders/leechers change too frequently
5. **Batch writing already optimizes** - Multiple writes are grouped automatically
6. **Recovery mechanism is robust** - Corrupted data won't break the app

**No major cache refactoring needed for Phase 5** - existing system scales well. Just follow patterns established in Phases 1-3.

