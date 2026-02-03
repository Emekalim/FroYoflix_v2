## Extension Manifest Guide

### Overview

Each extension must provide a manifest (`extension.json` or via `config` property) that declares:
- What media types it supports (anime, TV, movies)
- What ID systems it can use for searching
- Its capabilities and limitations
- Quality metrics

### Manifest Structure

```json
{
  "id": "unique-extension-id",
  "name": "Display Name",
  "version": "1.0.0",
  "description": "What this extension does",
  "mediaTypes": ["anime"],
  "supportedIds": ["anilist", "anidb"],
  "nsfw": false,
  "speed": "moderate",
  "accuracy": "medium",
  "features": {
    "supportsQualityFilter": true,
    "supportsExclusions": true,
    "supportsSeasonSpecific": false
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., 'nyaa-si', '1337x') |
| `name` | string | Display name shown to users |
| `version` | string | Semantic version (e.g., '1.0.0') |
| `mediaTypes` | string[] | Supported types: 'anime' \| 'tv' \| 'movie' |
| `supportedIds` | string[] | ID types: 'anilist' \| 'mal' \| 'anidb' \| 'imdb' \| 'tmdb' \| 'tvdb' \| 'trakt' |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | — | What the extension does |
| `nsfw` | boolean | false | Contains adult content |
| `speed` | string | 'moderate' | 'fast' \| 'moderate' \| 'slow' |
| `accuracy` | string | 'medium' | 'high' \| 'medium' \| 'low' |
| `features` | object | {} | Capability flags |

### Features Object

Declares what advanced features the extension supports:

```typescript
{
  supportsQualityFilter?: boolean    // Respects resolution parameter
  supportsExclusions?: boolean       // Respects exclusions parameter
  supportsSeasonSpecific?: boolean   // Handles S##E## for TV shows
}
```

---

## Manifest Examples

### Example 1: Anime-Only Extension

**Type**: Nyaa.si (anime tracker)

```json
{
  "id": "nyaa-si",
  "name": "Nyaa.si",
  "version": "1.0.0",
  "description": "Anime torrent tracker - searches Nyaa.si for anime releases",
  "mediaTypes": ["anime"],
  "supportedIds": ["anilist", "anidb", "mal"],
  "nsfw": false,
  "speed": "fast",
  "accuracy": "high",
  "features": {
    "supportsQualityFilter": true,
    "supportsExclusions": true,
    "supportsSeasonSpecific": false
  }
}
```

**How it works**:
- Only accepts anime queries (`mediaType === 'anime'`)
- Only uses anime IDs (anilist, anidb, mal)
- Returns empty array for TV/movie queries
- Can filter by resolution (e.g., 1080p preferred)
- Can exclude terms (e.g., avoid x264)

**Query it would receive**:
```javascript
{
  mediaType: 'anime',
  ids: { anilist: 16498 },
  titles: ['Attack on Titan'],
  episode: 5,
  resolution: '1080'
}
```

---

### Example 2: General Torrent Provider

**Type**: 1337x (supports all types)

```json
{
  "id": "1337x",
  "name": "1337x",
  "version": "2.0.0",
  "description": "General torrent provider supporting anime, TV shows, and movies",
  "mediaTypes": ["anime", "tv", "movie"],
  "supportedIds": ["anilist", "imdb", "tmdb", "tvdb"],
  "nsfw": false,
  "speed": "moderate",
  "accuracy": "medium",
  "features": {
    "supportsQualityFilter": true,
    "supportsExclusions": true,
    "supportsSeasonSpecific": true
  }
}
```

**How it works**:
- Accepts anime, TV, and movie queries
- Uses both anime IDs (anilist) and general IDs (imdb, tmdb, tvdb)
- Handles season-specific searches for TV
- Can filter quality and exclusions

**Query examples it would receive**:

Anime:
```javascript
{ mediaType: 'anime', ids: { anilist: 16498 }, titles: ['Attack on Titan'], episode: 5 }
```

TV:
```javascript
{ mediaType: 'tv', ids: { tmdb: 1396, imdb: 'tt0903747' }, titles: ['Breaking Bad'], season: 1, episode: 5 }
```

Movie:
```javascript
{ mediaType: 'movie', ids: { imdb: 'tt1375666', tmdb: 27205 }, titles: ['Inception'], year: 2010 }
```

---

### Example 3: TV/Movie Only Extension

**Type**: RARBG (TV and movie tracker)

```json
{
  "id": "rarbg",
  "name": "RARBG",
  "version": "1.0.0",
  "description": "TV and movie torrent provider - RARBG",
  "mediaTypes": ["tv", "movie"],
  "supportedIds": ["imdb", "tmdb"],
  "nsfw": false,
  "speed": "slow",
  "accuracy": "high",
  "features": {
    "supportsQualityFilter": true,
    "supportsExclusions": true,
    "supportsSeasonSpecific": true
  }
}
```

**How it works**:
- Only accepts TV and movie queries
- Ignores anime queries (returns empty array)
- Only uses IMDB and TMDB IDs
- Filters anime IDs (anilist) automatically
- High accuracy for TV/movies

**Query it would receive**:
```javascript
// After filtering - anime IDs removed
{
  mediaType: 'tv',
  ids: { tmdb: 1396, imdb: 'tt0903747' },  // anilist field removed if present
  titles: ['Breaking Bad'],
  season: 1,
  episode: 5
}
```

---

### Example 4: NSFW Anime Extension

**Type**: Sukebei (adult anime tracker)

```json
{
  "id": "sukebei",
  "name": "Sukebei Nyaa",
  "version": "1.0.0",
  "description": "NSFW anime torrent tracker - searches Sukebei for adult anime releases",
  "mediaTypes": ["anime"],
  "supportedIds": ["anilist", "anidb", "mal"],
  "nsfw": true,
  "speed": "fast",
  "accuracy": "high",
  "features": {
    "supportsQualityFilter": true,
    "supportsExclusions": true,
    "supportsSeasonSpecific": false
  }
}
```

**How it works**:
- Only accepts anime queries
- Marked as NSFW (users can enable/disable in settings)
- Same ID support as Nyaa
- Users can filter NSFW sources from UI

---

## Loading Manifests

The registry loads manifests in this order (first found wins):

1. **External manifest file**: `extension.json` in extension folder
2. **Inline config**: `extension.config` property in code
3. **Fallback defaults**: If neither above exists:
   ```javascript
   {
     id: 'extension-id',
     name: 'Extension Name',
     version: '1.0.0',
     mediaTypes: ['anime'],  // backward compat default
     supportedIds: ['anilist', 'anidb', 'mal'],  // backward compat default
     nsfw: false,
     speed: 'moderate',
     accuracy: 'medium'
   }
   ```

---

## Backward Compatibility

**Legacy extensions** (without manifest) are automatically given:

```json
{
  "mediaTypes": ["anime"],
  "supportedIds": ["anilist", "anidb", "mal"]
}
```

This ensures old anime-only extensions continue working without modification.

---

## Migration Path

### Stage 1: Add to Existing Extension

For existing extensions like Nyaa, add `extension.json`:

```bash
SourceExtensions/shiru/sources/nyaasrc/
├── index.js
└── extension.json  ← ADD THIS
```

### Stage 2: New Extension Features

When adding TV/movie support:

1. Update `mediaTypes` to include new types
2. Update `supportedIds` for new ID types
3. Implement search logic for new types
4. Bump `version`

### Stage 3: Update Settings

Users can then:
- Enable/disable each extension separately
- Choose which extensions to use per media type
- Filter by NSFW/speed/accuracy
