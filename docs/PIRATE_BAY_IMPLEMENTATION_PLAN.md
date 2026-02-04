# PirateBay Source Query Formatting Implementation Plan

## Current State Analysis

### What the Worker Sends
The worker (`worker.js`) calls source methods based on flags and the source receives the full `options` object:

```
options = {
  mediaType: 'anime' | 'tv' | 'movie',
  titles: ['Title', 'Alt Title', ...],
  episode: number,           // Episode for anime/TV single episodes
  season: number,            // Season number for TV shows
  year: number,              // Release year (useful for movies)
  ids: { anilist, imdb, tmdb, tvdb, ... },
  // ... other fields
}
```

### Current Problem
The piratebaysrc `_search()` method unconditionally appends episode:
```javascript
if (episode) query += ` ${episode.toString().padStart(2, "0")}`
```

This causes:
- **Movies**: "Inception 01" (wrong - year 2010 becomes 01)
- **TV Shows**: "ShowName 05" (wrong - needs "S02E05" format)
- **Anime**: "AnimeName 01" (correct - but episode-only format)

### Worker Routing Behavior
```
Worker._querySource() decides which methods to call:
├─ Always calls: source.single(options)
├─ If movie=true: calls source.movie(options)
└─ If batch=true: calls source.batch(options)
```

**Key insight:** For piratebaysrc, the routing flags don't align well with what's needed:
- Movies: `movie=true, batch=false` → `single()` + `movie()` both called
- TV shows (single episode): `movie=false, batch=false` → only `single()` called
- TV shows (batch): `movie=false, batch=true` → `single()` + `batch()` called

## Implementation Strategy

### Approach: Refactor Worker + Source-Specific Query Formatting

**Rationale:**
- Remove unnecessary method complexity: `single()` and `batch()` are sufficient
- `movie()` method was redundant and added confusion
- Source already receives `mediaType` in options for intelligent query formatting
- Different sources can format differently (e.g., TPB vs Nyaa)
- Keeps query formatting logic close to API usage

### Implementation Steps

#### 1. **Update Worker.js** (Remove `movie()` Call)

In `worker.js` `_querySource()` method, remove the movie conditional:

**Before:**
```javascript
const promises = []
promises.push(source.single(options))
if (movie) promises.push(source.movie(options))
if (batch) promises.push(source.batch(options))
```

**After:**
```javascript
const promises = []
promises.push(source.single(options))
if (batch) promises.push(source.batch(options))
```

This simplifies the routing logic:
- `single()` → handles anime (default) + TV episodes (mediaType=tv) + movies (mediaType=movie)
- `batch()` → placeholder for future batch implementations

#### 2. **Update PirateBay Source Methods**

Modify piratebaysrc to route by mediaType in `single()`:

```javascript
async single({ titles, episode, season, mediaType, year }) {
  if (!titles?.length) return []
  return this._search(titles[0], { episode, season, mediaType, year })
}

async batch(options) {
  // Placeholder for future batch implementations
  return []
}

async movie(options) {
  // Kept for API compatibility, delegates to single()
  return this.single(options)
}
```

#### 3. **Implement mediaType-Specific Query Formatting**

In piratebaysrc `_search()`, intelligently format based on media type:

```javascript
async _search(title, { episode, season, mediaType, year }) {
  let query = title.replace(/[^\w\s-]/g, " ").trim()
  
  // Apply media-specific query formatting
  switch (mediaType) {
    case 'movie':
      // Movies: append year if available
      if (year) query += ` ${year}`
      break
      
    case 'tv':
      // TV Shows: format as S##E## (season/episode)
      if (season && episode) {
        query += ` S${season.toString().padStart(2, "0")}E${episode.toString().padStart(2, "0")}`
      } else if (episode) {
        // Default to S01 if season not provided
        query += ` S01E${episode.toString().padStart(2, "0")}`
      }
      break
      
    case 'anime':
    default:
      // Anime: keep current behavior (episode only)
      if (episode) query += ` ${episode.toString().padStart(2, "0")}`
  }
  
  const url = this.base + encodeURIComponent(query)
  const res = await fetch(url)
  if (!res.ok) return []
  
  const data = await res.json()
  if (!Array.isArray(data)) return []
  
  // ... return formatted results
}
```

#### 4. **Handle Edge Cases**

- **TV Show Without Season Info**: Default to S01 if season not provided
- **Movie Without Year**: Just use title (year is optional)
- **Anime Default**: Falls through to anime formatting in default case
- **Backward Compatibility**: `movie()` stays for external sources that override it

## Data Flow After Implementation

### Movie Search
```
Handler: mediaType='movie', year=2010, episode=undefined, season=undefined
  ↓
Worker: calls source.single() + source.movie()
  ↓
PirateBay.single({ ..., mediaType: 'movie', year: 2010 }):
  → _search('Inception', undefined, undefined, 'movie', 2010)
  → query = 'Inception 2010'
  → API: /api/piratebay/Inception%202010
  ✓ Correct!

PirateBay.movie({ ..., mediaType: 'movie', year: 2010 }):
  → same result as single()
```

### TV Show Search (Specific Episode)
```
Handler: mediaType='tv', season=2, episode=5, year=2008
  ↓
Worker: calls source.single()
  ↓
PirateBay.single({ ..., mediaType: 'tv', season: 2, episode: 5 }):
  → _search('Breaking Bad', 5, 2, 'tv', 2008)
  → query = 'Breaking Bad S02E05'
  → API: /api/piratebay/Breaking%20Bad%20S02E05
  ✓ Correct!
```

### Anime Search (Unchanged)
```
Handler: mediaType='anime', episode=1
  ↓
Worker: calls source.single()
  ↓
PirateBay.single({ ..., mediaType: 'anime', episode: 1 }):
  → _search('Jujutsu Kaisen', 1, undefined, 'anime')
  → query = 'Jujutsu Kaisen 01'
  → API: /api/piratebay/Jujutsu%20Kaisen%2001
  ✓ Correct!
```

## Advantages of This Approach

✅ **Encapsulation**: Query formatting logic lives with the source that knows the API  
✅ **Flexibility**: Each source can format queries differently  
✅ **No Worker Changes**: Worker routing stays the same  
✅ **Backward Compatible**: Anime queries work unchanged  
✅ **Uses Existing Data**: mediaType, year, season already passed in options  
✅ **Testable**: Can test query formatting per media type independently  

## Disadvantages

❌ **Code Duplication**: All three methods (single/batch/movie) extract same fields  
❌ **Complexity**: More logic in _search()  
❌ **Not Generic**: Other sources might need similar pattern implemented  

## Alternative Rejected Approaches

### Alternative 1: Worker Routes by mediaType
- **Rejected because**: Would require new abstract methods like `searchMovie()`, `searchTVEpisode()` on all sources
- **Problem**: Breaks API compatibility with existing anime-only sources

### Alternative 2: Handler Builds Query String
- **Rejected because**: Query formatting is source-specific (different APIs need different formats)
- **Problem**: Handler would need to know all source-specific formatting rules

### Alternative 3: Remove Episode Completely for Non-Anime
- **Rejected because**: Would break anime searches and require massive refactor
- **Problem**: Current architecture was designed around anime (single=1 episode, batch=multiple)

## Implementation Checklist

- [ ] Update worker.js: Remove `if (movie) promises.push(source.movie(options))`
- [ ] Update piratebaysrc `single()` to route by mediaType and call `_search()` with context object
- [ ] Keep piratebaysrc `batch()` as placeholder returning empty array
- [ ] Keep piratebaysrc `movie()` for backward compatibility (delegates to `single()`)
- [ ] Implement switch statement in `_search()` for media-type-specific formatting
- [ ] Test movie search: "Inception" → should query "Inception 2010"
- [ ] Test TV search: "Breaking Bad S02E05" → should query "Breaking Bad S02E05"
- [ ] Test anime search: "Jujutsu Kaisen 01" → should query "Jujutsu Kaisen 01"
- [ ] Verify no regression: other sources (nyaasrc, sukebeisrc) still work
- [ ] Update any external custom extensions that override `movie()` to match new pattern
- [ ] Update documentation/comments in source file

## Worker Changes Required

**File**: `common/modules/extensions/worker.js`  
**Method**: `_querySource()`  
**Lines to Remove**:
```javascript
if (movie) promises.push(source.movie(options))
```

**Rationale**: The routing happens via `mediaType` in `single()` now, so calling `movie()` separately is redundant.

## External Source Updates Required

Any custom extensions that implement `movie()` should be updated to follow the new pattern:
1. Implement `single()` with mediaType routing
2. Keep `batch()` as placeholder
3. Keep `movie()` for backward compatibility (optional)

Example from piratebaysrc can be used as reference implementation.

## Migration Path for External Sources

1. **Phase 1** (Current): Update worker to remove movie() call, update piratebaysrc
2. **Phase 2** (Later): Update other built-in sources (nyaasrc, sukebeisrc) if they need movie support
3. **Phase 3** (Optional): External sources update on their own timeline
