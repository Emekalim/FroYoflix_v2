# Provider Abstraction Layer — Phase 1 Complete

**Status**: ✅ Phase 1 Implementation Complete  
**Date**: 2026-02-02

## What Was Built

### Core Files

1. **`types.d.ts`** - TypeScript type definitions for all providers
   - `Media` interface (unified media model)
   - `MediaProvider` interface (provider contract)
   - `Episode`, `Season`, `UserList` interfaces
   - `SearchFilters`, `ProgressUpdate` interfaces

2. **`BaseProvider.js`** - Abstract base class
   - All providers inherit from this
   - Defines required methods that must be implemented
   - Provides default error handling

3. **`index.js`** - Provider Registry & Factory
   - `getProvider(id, config)` - Get provider instance
   - `getProvidersForMediaType(type)` - Get providers for media type
   - `searchMultiple(query, type, providers)` - Multi-provider fallback search
   - `registerProvider(id, ProviderClass)` - Register custom providers
   - `getAllProviders()` - List all registered providers

### Provider Implementations

#### AniList Provider (`anilist/`)
- **`AniListProvider.js`** - Wraps existing AniList module
- **`mapper.js`** - Maps AniList data → unified Media model

#### MyAnimeList Provider (`mal/`)
- **`MALProvider.js`** - Wraps existing MyAnimeList module
- **`mapper.js`** - Maps MAL data → unified Media model

#### TMDB Provider (`tmdb/`)
- **`TMDBProvider.js`** - Placeholder for Phase 2

#### Trakt Provider (`trakt/`)
- **`TraktProvider.js`** - Placeholder for Phase 2

### Testing

- **`__tests__.js`** - Test suite validating Phase 1 implementation

---

## Folder Structure

```
common/modules/providers/
├── types.d.ts                     # Type definitions
├── BaseProvider.js                # Abstract base class
├── index.js                       # Registry & factory
├── __tests__.js                   # Tests
├── anilist/
│   ├── AniListProvider.js
│   └── mapper.js
├── mal/
│   ├── MALProvider.js
│   └── mapper.js
├── tmdb/
│   └── TMDBProvider.js            # Phase 2
├── trakt/
│   └── TraktProvider.js           # Phase 2
└── README.md                      # This file
```

---

## Usage Examples

### Basic Provider Usage

```javascript
import { getProvider } from './modules/providers/index.js'

// Get AniList provider
const anilist = getProvider('anilist')

// Search for anime
const results = await anilist.search('Demon Slayer')
console.log(results)
// → [{ id: '..', title: { default: 'Demon Slayer' }, ... }]

// Get media details
const media = await anilist.getById(21)
console.log(media.title.default) // → "One Punch Man"
```

### Get Providers for Media Type

```javascript
import { getProvidersForMediaType } from './modules/providers/index.js'

// Get all anime providers
const animeProviders = getProvidersForMediaType('anime')
console.log(animeProviders) // → ['anilist', 'mal']

// Get all TV providers (Phase 2)
const tvProviders = getProvidersForMediaType('tv')
console.log(tvProviders) // → [] (empty until Phase 2)
```

### Multi-Provider Fallback Search

```javascript
import { searchMultiple } from './modules/providers/index.js'

// Search across providers in order
const { provider, results } = await searchMultiple(
  'Attack on Titan',
  'anime',
  ['anilist', 'mal']
)

console.log(`Results from: ${provider}`)
console.log(`Found ${results.length} anime`)
```

---

## Key Design Decisions

### 1. **Lazy Import of Existing Modules**
Instead of requiring AniList/MAL at import time, providers lazy-load them:
```javascript
async _getAniList() {
  if (this._anilistModule) return this._anilistModule
  this._anilistModule = await import('../../anilist.js')
  return this._anilistModule
}
```

**Benefit**: Existing code is not touched; providers wrap existing functionality.

### 2. **Unified Media Model**
All providers map their responses to a common `Media` interface:
- `anilist.title.romaji` → `media.title.romaji`
- `mal.images.jpg.image_url` → `media.poster`
- `tmdb.poster_path` → `media.poster` (Phase 2)

**Benefit**: UI only needs to know one model; switching providers is seamless.

### 3. **Provider Registry**
Central `index.js` manages all providers:
- Prevents circular imports
- Supports dynamic registration
- Enables fallback strategies

**Benefit**: Easy to add new providers without modifying existing code.

### 4. **Error Handling**
Methods throw clear errors if not implemented:
```javascript
async getTrending() {
  throw new Error(`getTrending() not implemented for ${this.id}`)
}
```

**Benefit**: Clear error messages during development; easy to spot missing implementations.

---

## Backward Compatibility

✅ **100% backward compatible** with existing anime functionality:

- Existing `anilist.js` module is **not modified**
- Existing `myanimelist.js` module is **not modified**
- Existing code calling `anilist.search()` continues working
- New provider abstraction layer is **completely optional**

To migrate existing code to providers:
```javascript
// Old way (still works)
import * as anilist from './anilist.js'
const results = await anilist.search('query')

// New way (recommended)
import { getProvider } from './providers/index.js'
const anilist = getProvider('anilist')
const results = await anilist.search('query')
```

---

## Testing Phase 1

Run the test suite:

```javascript
import { runProviderTests } from './modules/providers/__tests__.js'
await runProviderTests()
```

Expected output:
```
🧪 Running Provider Tests...

✓ Test 1: Available Providers
  Found 2 providers: anilist, mal

✓ Test 2: Providers for Anime
  Anime providers: anilist, mal

✓ Test 3: Providers for TV
  TV providers: (none in Phase 1)

✓ Test 4: Instantiate AniList Provider
  Provider ID: anilist
  Provider Name: AniList
  Media Types: anime

✓ Test 5: Instantiate MAL Provider
  Provider ID: mal
  Provider Name: MyAnimeList
  Media Types: anime

✓ Test 6: Provider Interface Validation
  ✓ search()
  ✓ getById()
  ✓ getEpisodes()
  ✓ isAuthenticated()

✅ All Phase 1 tests passed!
```

---

## What's Next (Phase 2)

1. Implement `TMDBProvider` with:
   - Movie search via TMDB API
   - TV show search via TMDB API
   - Episode/season data fetching

2. Implement `TraktProvider` with:
   - User watchlist syncing
   - Progress tracking
   - User lists

3. Register TMDB/Trakt in provider registry:
   ```javascript
   registerProvider('tmdb', TMDBProvider)
   registerProvider('trakt', TraktProvider)
   ```

4. Update `getProvidersForMediaType()` to return TMDB/Trakt for TV/movie types

---

## File Dependencies

```
index.js (registry)
├── AniListProvider.js
│   └── mapper.js
│   └── anilist.js (existing module)
├── MALProvider.js
│   └── mapper.js
│   └── myanimelist.js (existing module)
├── TMDBProvider.js (Phase 2)
└── TraktProvider.js (Phase 2)
```

---

## Integration Points

To use the provider system elsewhere in Shiru:

```javascript
// In search.js
import { searchMultiple } from './providers/index.js'

export async function searchMedia(query, type) {
  const { provider, results } = await searchMultiple(query, type)
  return results
}

// In ViewMedia.js
import { getProvider } from './providers/index.js'

export async function loadMedia(id, providerName) {
  const provider = getProvider(providerName)
  return await provider.getById(id)
}
```

---

## Notes

- **AniList/MAL remain the default anime providers**
- **Provider wrapping is transparent** to existing code
- **No breaking changes** to existing functionality
- **Ready for Phase 2 TMDB/Trakt integration**
- **Extensible for third-party providers** via `registerProvider()`
