# Shiru — Phase 4 Implementation Plan

**Phase**: 4 — Extension System Update  
**Status**: 📋 Ready to implement  
**Date**: 2026-02-02  
**Target Completion**: 2026-02-03 (1 day)  

---

## Overview

Phase 4 updates the extension system to support multiple media types (anime, TV shows, movies) while maintaining backward compatibility with existing anime-only extensions. This bridges the gap between the **title resolution system (Phase 3)** and the **UI adaptations (Phase 5)**.

### Goals

- ✅ Define extended `TorrentQuery` interface supporting multiple media types
- ✅ Update `SourceConfig` manifest to declare media type and ID support
- ✅ Create backward compatibility layer (anime extensions still work as-is)
- ✅ Update extension loading and query building to use new interface
- ✅ Provide migration guide for extension developers
- ✅ Test backward compatibility with existing anime extensions

### Why This Matters

Currently, extensions (torrent sources) are designed for anime searches only. With Phase 4:
- Extensions can declare what media types they support (`['anime']`, `['tv', 'movie']`, or `['anime', 'tv', 'movie']`)
- They can declare what ID systems they accept (`anilist`, `imdb`, `tmdb`, `tvdb`)
- The core system routes queries to appropriate extensions based on media type
- Developers can write extensions once and reuse for multiple media types

---

## Current State (Baseline)

### Existing TorrentQuery Interface

```typescript
// Current (anime-only)
interface TorrentQuery {
  titles: string[]
  anilist?: number
  anidb?: number
  episode?: number
  episodeCount?: number
}
```

### Existing SourceConfig

```typescript
interface SourceConfig {
  id: string
  name: string
  version: string
  nsfw?: boolean
  speed?: 'slow' | 'medium' | 'fast'
  accuracy?: 'low' | 'medium' | 'high'
}
```

### Extension Loading

Extensions are loaded from `extensions/` folder and queried via:
```javascript
const results = await extension.search(torrentQuery)
```

**Problem**: No media type awareness. Extensions assume anime always.

---

## Phase 4 Tasks

### Task 1: Extended TorrentQuery Interface

**File**: `extensions/index.d.ts` (or create new type definition)

**Description**: Update TorrentQuery to support all media types while maintaining backward compatibility.

#### 1.1 New Interface Definition

```typescript
/**
 * Media identifiers from multiple providers
 */
interface MediaIds {
  anilist?: number           // AniList ID (anime)
  mal?: number               // MyAnimeList ID (anime)
  anidb?: number             // AniDB ID (anime)
  imdb?: string              // IMDB ID (movies/TV) - format: tt1234567
  tmdb?: number              // TMDB ID (movies/TV)
  tvdb?: number              // TVDB ID (TV shows)
  trakt?: number             // Trakt ID (TV shows)
  slug?: string              // Trakt slug (e.g., 'breaking-bad')
}

/**
 * Extended query for extensions supporting multiple media types
 * Backward compatible with anime-only extensions
 */
interface TorrentQuery {
  // Media type (NEW - optional for backward compatibility, defaults to 'anime')
  mediaType?: 'anime' | 'tv' | 'movie'
  
  // All available identifiers (NEW)
  ids?: Partial<MediaIds>
  
  // Search titles (existing, kept for compatibility)
  titles: string[]           // ['Title', 'Title English', 'Title Romaji']
  
  // Media year/release info (NEW - optional)
  year?: number
  
  // Episode/Season info (existing anime fields + new TV fields)
  season?: number            // For TV shows (NEW)
  episode?: number           // Existing for anime, repurposed for TV
  episodeCount?: number      // Existing
  
  // Quality preferences (NEW - optional)
  resolution?: '2160' | '1080' | '720' | '480' | ''
  
  // Exclusions (NEW - optional)
  exclusions?: string[]      // ['x264', 'hardsubbed', 'dubbed']
  
  // Legacy anime fields (kept for backward compatibility)
  anilist?: number           // DEPRECATED - use ids.anilist instead
  anidb?: number             // DEPRECATED - use ids.anidb instead
}
```

#### 1.2 Migration Path for Extensions

**Old query** (anime-only):
```javascript
{
  titles: ['Attack on Titan'],
  anilist: 16498,
  episode: 5
}
```

**New query** (can handle all types):
```javascript
{
  mediaType: 'anime',        // NEW
  ids: {
    anilist: 16498,
    anidb: 1234              // OPTIONAL
  },
  titles: ['Attack on Titan'],
  episode: 5
  // Still supports old fields for compatibility:
  // anilist: 16498,
}
```

**TV show query**:
```javascript
{
  mediaType: 'tv',
  ids: {
    tmdb: 1396,
    tvdb: 81189
  },
  titles: ['Breaking Bad'],
  season: 1,
  episode: 5,
  resolution: '1080'
}
```

**Movie query**:
```javascript
{
  mediaType: 'movie',
  ids: {
    imdb: 'tt1375666',
    tmdb: 27205
  },
  titles: ['Inception'],
  year: 2010,
  resolution: '1080'
}
```

---

### Task 2: Updated SourceConfig Manifest

**File**: `extensions/<extension-id>/extension.json` or in extension metadata

**Description**: Extensions declare their capabilities in manifest.

#### 2.1 New SourceConfig Interface

```typescript
interface SourceConfig {
  id: string
  name: string
  version: string
  
  // NEW: Declare supported media types
  // Default: ['anime'] for backward compatibility
  mediaTypes: ('anime' | 'tv' | 'movie')[]
  
  // NEW: Declare supported ID types
  // Extensions only receive IDs they can use
  supportedIds: ('anilist' | 'mal' | 'anidb' | 'imdb' | 'tmdb' | 'tvdb' | 'trakt')[]
  
  // Existing fields
  nsfw?: boolean
  speed?: 'slow' | 'medium' | 'fast'
  accuracy?: 'low' | 'medium' | 'high'
  
  // NEW: Optional features
  features?: {
    supportsQualityFilter?: boolean    // Can use resolution param
    supportsExclusions?: boolean       // Can use exclusions param
    supportsSeasonSpecific?: boolean   // Can target specific TV seasons
  }
}
```

#### 2.2 Example Manifests

**Anime-only extension** (backward compatible):
```json
{
  "id": "nyaa-si",
  "name": "Nyaa.si",
  "version": "1.0.0",
  "mediaTypes": ["anime"],
  "supportedIds": ["anilist", "anidb", "mal"]
}
```

**General torrent provider** (supports all types):
```json
{
  "id": "1337x",
  "name": "1337x",
  "version": "2.0.0",
  "mediaTypes": ["anime", "tv", "movie"],
  "supportedIds": ["anilist", "imdb", "tmdb", "tvdb"],
  "features": {
    "supportsQualityFilter": true,
    "supportsExclusions": true
  }
}
```

**TV/Movie specific** (new extension):
```json
{
  "id": "rarbg",
  "name": "RARBG",
  "version": "1.0.0",
  "mediaTypes": ["tv", "movie"],
  "supportedIds": ["imdb", "tmdb"],
  "features": {
    "supportsQualityFilter": true,
    "supportsSeasonSpecific": true
  }
}
```

---

### Task 3: Backward Compatibility Layer

**File**: `extensions/compatibility.js`

**Description**: Automatically adapt old-style queries and extensions to work with new system.

#### 3.1 Query Adapter

```javascript
/**
 * Converts old anime-only query to new format
 * Backward compatibility helper
 */
export function adaptLegacyQuery(query) {
  // If already new format, return as-is
  if (query.mediaType) {
    return query
  }

  // If has anilist/anidb, it's anime
  if (query.anilist || query.anidb || query.mal) {
    return {
      mediaType: 'anime',
      ids: {
        anilist: query.anilist,
        anidb: query.anidb,
        mal: query.mal
      },
      titles: query.titles,
      episode: query.episode,
      episodeCount: query.episodeCount,
      // Keep legacy fields for ultra-old extensions
      anilist: query.anilist,
      anidb: query.anidb
    }
  }

  // Default to anime if no type specified
  return {
    mediaType: 'anime',
    ids: {},
    titles: query.titles,
    episode: query.episode,
    episodeCount: query.episodeCount
  }
}

/**
 * Strips IDs that extension doesn't support
 */
export function filterQueryForExtension(query, extension) {
  if (!extension.config.supportedIds) {
    // Old extension - only pass anime IDs
    return {
      ...query,
      ids: {
        anilist: query.ids?.anilist,
        anidb: query.ids?.anidb,
        mal: query.ids?.mal
      }
    }
  }

  // New extension - filter to supported IDs
  const filtered = {}
  extension.config.supportedIds.forEach(id => {
    if (query.ids?.[id]) {
      filtered[id] = query.ids[id]
    }
  })

  return {
    ...query,
    ids: filtered
  }
}
```

#### 3.2 Extension Adapter

```javascript
/**
 * Wraps old extension to provide new interface
 */
export function wrapLegacyExtension(extension) {
  return {
    config: {
      ...extension.config,
      mediaTypes: extension.config.mediaTypes || ['anime'],
      supportedIds: extension.config.supportedIds || ['anilist', 'anidb', 'mal']
    },
    
    search: async (query) => {
      // Adapt query to what extension expects
      const adapted = adaptQueryForExtension(query, extension)
      
      // Call original search
      return extension.search(adapted)
    }
  }
}

/**
 * Adapts new query to old format for legacy extensions
 */
function adaptQueryForExtension(query, extension) {
  // If extension is new-style, use new query as-is
  if (extension.config.supportedIds) {
    return filterQueryForExtension(query, extension)
  }

  // If extension is old-style anime, convert to old format
  return {
    titles: query.titles,
    anilist: query.ids?.anilist,
    anidb: query.ids?.anidb,
    mal: query.ids?.mal,
    episode: query.episode,
    episodeCount: query.episodeCount
  }
}
```

---

### Task 4: Extension Registry & Routing

**File**: `extensions/registry.js` (NEW)

**Description**: Route queries to appropriate extensions based on media type.

#### 4.1 Extension Registry

```javascript
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { wrapLegacyExtension } from './compatibility.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Registry of loaded extensions
 */
const extensions = new Map()

/**
 * Load all extensions from folders
 */
export async function loadExtensions() {
  const extensionsDir = path.join(__dirname, 'sources')
  
  if (!fs.existsSync(extensionsDir)) {
    console.warn('No extensions directory found')
    return
  }

  const folders = fs.readdirSync(extensionsDir)
  
  for (const folder of folders) {
    try {
      const extPath = path.join(extensionsDir, folder)
      const stat = fs.statSync(extPath)
      
      if (!stat.isDirectory()) continue
      
      // Try to load extension
      const indexPath = path.join(extPath, 'index.js')
      if (!fs.existsSync(indexPath)) continue
      
      const module = await import(`file://${indexPath}`)
      const extension = module.default || module
      
      // Get config from extension or manifest
      const config = extension.config || {}
      const manifestPath = path.join(extPath, 'extension.json')
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        Object.assign(config, manifest)
      }
      
      // Ensure config has defaults
      config.id = config.id || folder
      config.name = config.name || folder
      config.mediaTypes = config.mediaTypes || ['anime']
      config.supportedIds = config.supportedIds || ['anilist', 'anidb', 'mal']
      
      // Wrap if needed for legacy support
      const wrapped = {
        config,
        search: extension.search || extension.default?.search
      }
      
      extensions.set(config.id, wrapped)
      console.log(`✓ Loaded extension: ${config.name} (${config.mediaTypes.join(', ')})`)
    } catch (error) {
      console.warn(`✗ Failed to load extension ${folder}:`, error.message)
    }
  }
}

/**
 * Get extensions that support a media type
 */
export function getExtensionsForMediaType(mediaType) {
  return Array.from(extensions.values()).filter(ext => {
    return ext.config.mediaTypes.includes(mediaType) || 
           ext.config.mediaTypes.includes('anime') // anime extensions support anime
  })
}

/**
 * Get extensions that support specific ID type
 */
export function getExtensionsForId(idType) {
  return Array.from(extensions.values()).filter(ext => {
    const ids = ext.config.supportedIds || []
    return ids.includes(idType)
  })
}

/**
 * Query all appropriate extensions
 */
export async function queryExtensions(query) {
  const appropriateExts = getExtensionsForMediaType(query.mediaType || 'anime')
  
  const results = []
  
  for (const extension of appropriateExts) {
    try {
      const extResults = await extension.search(query)
      results.push({
        extension: extension.config.id,
        results: extResults || []
      })
    } catch (error) {
      console.warn(`Extension ${extension.config.id} search failed:`, error.message)
    }
  }
  
  return results
}

/**
 * Get all loaded extensions
 */
export function getAllExtensions() {
  return Array.from(extensions.values())
}

/**
 * Get extension by ID
 */
export function getExtension(id) {
  return extensions.get(id)
}

export default {
  loadExtensions,
  queryExtensions,
  getExtensionsForMediaType,
  getExtensionsForId,
  getAllExtensions,
  getExtension
}
```

---

### Task 5: Extension Interface Update

**File**: `extensions/index.d.ts` (TypeScript definitions)

**Description**: Provide clear types for extension developers.

#### 5.1 Full Type Definitions

```typescript
/**
 * Extension System Type Definitions
 * Defines interfaces for query building, extension development, and compatibility
 */

// Media type enum
export type MediaType = 'anime' | 'tv' | 'movie'

// ID types supported across providers
export type IdType = 'anilist' | 'mal' | 'anidb' | 'imdb' | 'tmdb' | 'tvdb' | 'trakt'

/**
 * Media identifiers from multiple providers
 */
export interface MediaIds {
  anilist?: number
  mal?: number
  anidb?: number
  imdb?: string
  tmdb?: number
  tvdb?: number
  trakt?: number
  slug?: string
}

/**
 * TorrentQuery - sent to extensions
 * 
 * Usage examples:
 * 
 * // Anime query (backward compatible)
 * {
 *   mediaType: 'anime',
 *   ids: { anilist: 16498 },
 *   titles: ['Attack on Titan'],
 *   episode: 5
 * }
 * 
 * // TV show query
 * {
 *   mediaType: 'tv',
 *   ids: { tmdb: 1396, tvdb: 81189 },
 *   titles: ['Breaking Bad'],
 *   season: 1,
 *   episode: 5,
 *   resolution: '1080'
 * }
 * 
 * // Movie query
 * {
 *   mediaType: 'movie',
 *   ids: { imdb: 'tt1375666', tmdb: 27205 },
 *   titles: ['Inception'],
 *   year: 2010
 * }
 */
export interface TorrentQuery {
  // Media type - defaults to 'anime' for backward compatibility
  mediaType?: MediaType
  
  // Identifiers
  ids?: Partial<MediaIds>
  
  // Search titles - always provided
  titles: string[]
  
  // Release info
  year?: number
  
  // Episode/Season info
  season?: number           // For TV shows
  episode?: number          // For anime/TV
  episodeCount?: number     // Total episode count
  
  // Quality preferences
  resolution?: '2160' | '1080' | '720' | '480' | ''
  
  // Things to exclude in results
  exclusions?: string[]
  
  // Legacy fields - DEPRECATED but kept for backward compatibility
  anilist?: number
  anidb?: number
  mal?: number
}

/**
 * Torrent result from extension
 */
export interface TorrentResult {
  name: string              // Display name
  url: string               // Magnet link or download URL
  seeders?: number
  leechers?: number
  size?: string
  date?: string
}

/**
 * Source configuration - metadata about an extension
 */
export interface SourceConfig {
  // Required
  id: string                // Unique identifier (e.g., 'nyaa-si')
  name: string              // Display name
  version: string           // Semantic version
  
  // New fields - media type awareness
  mediaTypes: MediaType[]   // What types this extension supports
  supportedIds: IdType[]    // What ID systems this extension accepts
  
  // Optional
  nsfw?: boolean
  speed?: 'slow' | 'medium' | 'fast'
  accuracy?: 'low' | 'medium' | 'high'
  
  // Capabilities
  features?: {
    supportsQualityFilter?: boolean
    supportsExclusions?: boolean
    supportsSeasonSpecific?: boolean
  }
}

/**
 * Extension interface
 * Implement this to create a new extension
 */
export interface Extension {
  config: SourceConfig
  search(query: TorrentQuery): Promise<TorrentResult[]>
}

/**
 * Compatibility helpers
 */
export interface CompatibilityHelpers {
  adaptLegacyQuery(query: any): TorrentQuery
  filterQueryForExtension(query: TorrentQuery, extension: Extension): TorrentQuery
  wrapLegacyExtension(extension: any): Extension
}
```

---

### Task 6: Testing & Validation

**File**: `extensions/__tests__/` (NEW)

**Description**: Comprehensive tests for extension system changes.

#### 6.1 Test Structure

```
extensions/__tests__/
├── query.test.mjs           # TorrentQuery interface tests
├── compatibility.test.mjs   # Backward compatibility tests
├── registry.test.mjs        # Extension loading & routing
└── run-all.mjs              # Test runner
```

#### 6.2 Sample Test Cases

**Query Adapter Tests**:
```javascript
import { adaptLegacyQuery, filterQueryForExtension } from '../compatibility.js'

describe('Query Adapter', () => {
  it('adapts old anime query to new format', () => {
    const oldQuery = {
      titles: ['Attack on Titan'],
      anilist: 16498,
      episode: 5
    }
    
    const adapted = adaptLegacyQuery(oldQuery)
    
    assert.equal(adapted.mediaType, 'anime')
    assert.equal(adapted.ids.anilist, 16498)
    assert.equal(adapted.episode, 5)
  })

  it('passes through new format queries unchanged', () => {
    const newQuery = {
      mediaType: 'tv',
      ids: { tmdb: 1396 },
      titles: ['Breaking Bad'],
      season: 1
    }
    
    const adapted = adaptLegacyQuery(newQuery)
    assert.deepEqual(adapted, newQuery)
  })

  it('filters IDs based on extension support', () => {
    const query = {
      mediaType: 'tv',
      ids: { tmdb: 1396, imdb: 'tt0903747', tvdb: 81189 },
      titles: ['Breaking Bad']
    }
    
    const extension = {
      config: { supportedIds: ['tmdb', 'imdb'] }
    }
    
    const filtered = filterQueryForExtension(query, extension)
    
    assert.equal(filtered.ids.tmdb, 1396)
    assert.equal(filtered.ids.imdb, 'tt0903747')
    assert.equal(filtered.ids.tvdb, undefined)
  })
})
```

**Backward Compatibility Tests**:
```javascript
describe('Backward Compatibility', () => {
  it('old anime extensions work with new system', async () => {
    const oldExtension = {
      config: { id: 'old-ext', name: 'Old' },
      search: async (query) => {
        // Old extension expects anilist, episode fields
        return []
      }
    }
    
    const wrapped = wrapLegacyExtension(oldExtension)
    
    assert.equal(wrapped.config.mediaTypes[0], 'anime')
    assert(wrapped.config.supportedIds.includes('anilist'))
    
    const results = await wrapped.search({
      mediaType: 'anime',
      ids: { anilist: 16498 },
      titles: ['Anime'],
      episode: 5
    })
    
    assert.deepEqual(results, [])
  })

  it('new extensions declare media type support', () => {
    const newExtension = {
      config: {
        id: '1337x',
        name: '1337x',
        mediaTypes: ['anime', 'tv', 'movie'],
        supportedIds: ['anilist', 'imdb', 'tmdb']
      }
    }
    
    assert(newExtension.config.mediaTypes.includes('tv'))
    assert(newExtension.config.supportedIds.includes('tmdb'))
  })
})
```

**Registry Tests**:
```javascript
describe('Extension Registry', () => {
  it('loads extensions from folders', async () => {
    await loadExtensions()
    const allExts = getAllExtensions()
    assert(allExts.length > 0)
  })

  it('routes anime queries to anime extensions', async () => {
    const animeExts = getExtensionsForMediaType('anime')
    assert(animeExts.some(e => e.config.mediaTypes.includes('anime')))
  })

  it('routes TV queries to appropriate extensions', async () => {
    const tvExts = getExtensionsForMediaType('tv')
    assert(tvExts.length >= 0) // May be empty if no TV extensions
  })

  it('queries appropriate extensions only', async () => {
    const results = await queryExtensions({
      mediaType: 'tv',
      ids: { tmdb: 1396 },
      titles: ['Breaking Bad']
    })
    
    // Should only query extensions that support 'tv'
    results.forEach(r => {
      const ext = getExtension(r.extension)
      assert(ext.config.mediaTypes.includes('tv'))
    })
  })
})
```

---

## File Structure & Impact

### New Files

| File | Purpose | Priority |
|------|---------|----------|
| `extensions/compatibility.js` | Legacy query/extension adapters | High |
| `extensions/registry.js` | Extension loading & routing | High |
| `extensions/index.d.ts` | Updated TypeScript definitions | High |
| `extensions/__tests__/query.test.mjs` | Query adapter tests | Medium |
| `extensions/__tests__/compatibility.test.mjs` | Backward compatibility tests | Medium |
| `extensions/__tests__/registry.test.mjs` | Registry tests | Medium |
| `extensions/__tests__/run-all.mjs` | Test runner | Medium |

### Modified Files

| File | Changes | Impact |
|------|---------|--------|
| `extensions/index.js` | Import registry, route queries | High |
| `extensions/sources/*/extension.json` | Add mediaTypes, supportedIds | Medium |
| Extension search functions | Accept new TorrentQuery format | Medium |

### Backward Compatibility Impact

- ✅ Existing anime extensions continue to work unchanged
- ✅ Old query format still accepted via adapter
- ✅ Legacy fields in TorrentQuery preserved
- ✅ Fallback routing for extensions without mediaTypes declared

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review current extension system in codebase
- [ ] Identify all existing extensions
- [ ] Document current extension interface

### Task 1: Extended Query Interface
- [ ] Create `TorrentQuery` interface with new fields
- [ ] Document all query field meanings
- [ ] Create migration guide for developers
- [ ] Validate backward compatibility fields

### Task 2: Source Config Manifest
- [ ] Create `SourceConfig` interface
- [ ] Add `mediaTypes` field
- [ ] Add `supportedIds` field
- [ ] Create example manifests for different extension types

### Task 3: Backward Compatibility Layer
- [ ] Implement `adaptLegacyQuery()`
- [ ] Implement `filterQueryForExtension()`
- [ ] Implement `wrapLegacyExtension()`
- [ ] Test with actual old extensions

### Task 4: Extension Registry & Routing
- [ ] Create extension registry
- [ ] Implement loading from folders
- [ ] Implement routing by media type
- [ ] Implement routing by ID type
- [ ] Implement query execution

### Task 5: TypeScript Definitions
- [ ] Write comprehensive `index.d.ts`
- [ ] Include usage examples
- [ ] Document deprecated fields
- [ ] Provide intellisense hints

### Task 6: Testing & Validation
- [ ] Write query adapter tests
- [ ] Write backward compatibility tests
- [ ] Write registry tests
- [ ] Test with existing extensions (should still work)
- [ ] Test with new query formats

### Documentation
- [ ] Create extension developer migration guide
- [ ] Create manifest template
- [ ] Create example TV extension
- [ ] Create example movie extension

---

## Implementation Timeline

| Stage | Tasks | Effort | Time |
|-------|-------|--------|------|
| 1 | Query interface, SourceConfig | 1-2 hrs | Morning |
| 2 | Compatibility layer | 1-2 hrs | Morning |
| 3 | Registry & routing | 1-2 hrs | Afternoon |
| 4 | TypeScript definitions | 30 min | Afternoon |
| 5 | Tests (6 test files) | 2-3 hrs | Afternoon |
| 6 | Documentation & examples | 1 hr | Evening |

**Total**: ~8-10 hours (can complete in 1 focused day)

---

## Integration with Phase 5

Once Phase 4 is complete, Phase 5 can use:

1. **Media-aware extension queries** — search for TV/movies through extensions
2. **Type-specific result routing** — show anime results from anime extensions, TV from TV extensions
3. **ID-based lookups** — resolve TMDB IDs to torrent results via extensions
4. **Feature detection** — UI can show quality filters only for extensions that support them

---

## Rollout Strategy

### Stage 1: Deploy (non-breaking)
1. Add new fields to TorrentQuery (optional)
2. Add compatibility layer (transparent)
3. Update extension registry
4. Deploy to users (all existing extensions continue working)

### Stage 2: Migrate Extensions (optional)
1. Update first-party extensions to declare mediaTypes/supportedIds
2. Provide migration guide for third-party developers
3. Add example extensions for TV/movie

### Stage 3: Deprecation (future)
1. After 2+ releases, deprecate old query format
2. Recommend all extensions update manifests
3. Phase out legacy field support (v2.0)

---

## Success Criteria

- ✅ All new TorrentQuery fields optional (backward compatible)
- ✅ Existing anime extensions work without modification
- ✅ New extensions can declare media type support
- ✅ System routes queries to appropriate extensions based on mediaType
- ✅ Extensions can declare supported ID types
- ✅ 15+ tests passing (query, compatibility, registry)
- ✅ Documentation and examples provided

---

## Next Steps After Phase 4

1. **Phase 5**: UI integrations
   - Add media type tabs to search interface
   - Route searches through appropriate extensions
   - Display results grouped by source

2. **Phase 5+**: Extension examples
   - Create sample TV extension (using TMDB data)
   - Create sample movie extension
   - Update documentation with new examples

3. **Future**: Advanced features
   - Extension marketplace with media type filtering
   - User preferences for extension order per media type
   - Smart quality/source recommendations

---

## References

- **MEDIA_EXTENSION_PLAN.md** — High-level strategy
- **PHASE_1_2_IMPLEMENTATION.md** — Provider layer (info only)
- **PHASE_3_IMPLEMENTATION_PLAN.md** — Resolver system
- Current extension examples in `extensions/sources/`

