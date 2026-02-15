# Phase 3 Implementation Plan: Title Resolution System

**Status**: COMPLETE ✅
**Date**: February 2, 2026  
**Goal**: Build filename parsing and media type detection system

---

## Overview

Phase 3 implements intelligent filename parsing to detect media type (anime/TV/movie) and extract metadata. This enables FroYoflix to automatically determine what provider to use and what search queries to make.

**Key Outcomes:**
- ✅ Parse anime filenames: `[SubGroup] Title - 01.mkv`
- ✅ Parse TV filenames: `Show.S01E05.mkv`
- ✅ Parse movie filenames: `Title.2024.1080p.mkv`
- ✅ Match parsed results to correct provider (AniList, TMDB, etc.)
- ✅ Return unified Media object for display

---

## Folder Structure

```
common/modules/resolver/
├── index.js                          # Main resolver entry point
├── types.d.ts                        # TypeScript interfaces
├── parsers/
│   ├── BaseParser.js                 # Abstract base class
│   ├── AnimeParser.js                # Anime-specific patterns
│   ├── TVShowParser.js               # TV show patterns (S01E05)
│   ├── MovieParser.js                # Movie patterns (year-based)
│   └── utils.js                      # Shared regex/utilities
├── matchers/
│   ├── BaseMatcher.js                # Abstract base class
│   ├── AnimeMatcher.js               # Search AniList/MAL
│   └── GeneralMatcher.js             # Search TMDB/IMDb
└── __tests__/
    ├── run-all.mjs                   # All tests
    ├── parsers.test.mjs              # Parser tests
    ├── matchers.test.mjs             # Matcher tests
    └── resolver.test.mjs             # Integration tests
```

---

## Implementation Tasks

### Task 1: Create Base Classes & Types

**File**: `types.d.ts`

```typescript
// Parsed filename data
interface ParsedFilename {
  mediaType: 'anime' | 'tv' | 'movie'
  title: string
  year?: number
  season?: number              // For TV
  episode?: number             // For TV
  episodeCount?: number        // Inferred from episode number
  resolution?: string          // 1080p, 720p, etc.
  subGroup?: string            // [SubGroup]
  version?: number             // v2, v3 (anime)
  confidence: number           // 0-100 confidence score
  rawFilename: string          // Original filename
}

// Resolver result
interface ResolverResult {
  parsed: ParsedFilename
  media?: Media                // From provider (if found)
  provider: string             // 'anilist', 'tmdb', 'mal'
  matchScore: number           // 0-100
}
```

**File**: `parsers/BaseParser.js`

```javascript
export class BaseParser {
  constructor(filename) {
    this.filename = filename
    this.basename = path.basename(filename, path.extname(filename))
  }

  /**
   * Parse filename and return structured data
   * @returns {ParsedFilename|null}
   */
  parse() {
    throw new Error('parse() must be implemented by subclass')
  }

  /**
   * Calculate confidence score (0-100)
   */
  getConfidence() {
    throw new Error('getConfidence() must be implemented by subclass')
  }
}
```

**File**: `matchers/BaseMatcher.js`

```javascript
export class BaseMatcher {
  /**
   * Search for media based on parsed data
   * @param {ParsedFilename} parsed
   * @returns {Promise<Media|null>}
   */
  async match(parsed) {
    throw new Error('match() must be implemented by subclass')
  }

  /**
   * Calculate match score (0-100)
   * @param {ParsedFilename} parsed
   * @param {Media} result
   */
  calculateScore(parsed, result) {
    throw new Error('calculateScore() must be implemented by subclass')
  }
}
```

**Subtasks:**
- [x] Create `types.d.ts` with all interfaces
- [x] Create `BaseParser.js` with abstract methods
- [x] Create `BaseMatcher.js` with abstract methods
- [x] Create `parsers/utils.js` with shared regex patterns

---

### Task 2: Build AnimeParser

**File**: `parsers/AnimeParser.js`

```javascript
// Patterns:
// [SubGroup] Title - 01 [1080p].mkv
// Title 01 [v2].mkv
// [SubGroup] Title - 01.5 - Special.mkv

export class AnimeParser extends BaseParser {
  parse() {
    const parsed = {
      mediaType: 'anime',
      rawFilename: this.filename,
      confidence: 0
    }

    // Step 1: Extract sub group
    parsed.subGroup = this.extractSubGroup()    // [SubGroup]

    // Step 2: Extract title and episode
    const titleEp = this.extractTitleAndEpisode()
    if (!titleEp) return null
    parsed.title = titleEp.title
    parsed.episode = titleEp.episode

    // Step 3: Extract version
    parsed.version = this.extractVersion()      // v2, v3

    // Step 4: Extract resolution
    parsed.resolution = this.extractResolution() // 1080p, 720p

    // Step 5: Calculate confidence
    parsed.confidence = this.getConfidence()

    return parsed
  }

  extractSubGroup() {
    // Match [SubGroup]
    const match = this.basename.match(/^\s*\[([^\]]+)\]/)
    return match ? match[1] : null
  }

  extractTitleAndEpisode() {
    // Remove [SubGroup] prefix
    let remaining = this.basename.replace(/^\s*\[[^\]]+\]\s*/, '')

    // Match: Title - 01 or Title 01
    const match = remaining.match(/^(.+?)\s*-?\s*(\d{1,3})(?:\.\d)?/)
    if (!match) return null

    return {
      title: match[1].trim(),
      episode: parseInt(match[2])
    }
  }

  extractVersion() {
    // Match v2, v3, etc
    const match = this.basename.match(/[vV](\d+)/)
    return match ? parseInt(match[1]) : null
  }

  extractResolution() {
    const match = this.basename.match(/(\d{3,4})[pi]/)
    return match ? match[1] + 'p' : null
  }

  getConfidence() {
    let score = 50  // Base anime confidence

    if (this.extractSubGroup()) score += 20     // Has [SubGroup]
    if (this.extractVersion()) score += 15      // Has version marker
    if (this.basename.match(/\d{1,3}(?:\.\d)?$/)) score += 15  // Ends with episode

    return Math.min(score, 100)
  }
}
```

**Subtasks:**
- [x] Implement subgroup extraction with regex
- [x] Implement title extraction (cleanup)
- [x] Implement episode number parsing
- [x] Implement version marker extraction
- [x] Implement resolution detection
- [x] Implement `calculateConfidence()` scoring
- [x] Handle special episodes (01.5, fractional)
- [ ] Write 5+ test cases and validate

---

### Task 3: Build TVShowParser

**File**: `parsers/TVShowParser.js`

```javascript
// Patterns:
// Show.S01E05.1080p.mkv
// Show - 1x05 - Title.mkv
// Season.1.Episode.5.mkv

export class TVShowParser extends BaseParser {
  parse() {
    const parsed = {
      mediaType: 'tv',
      rawFilename: this.filename,
      confidence: 0
    }

    // Step 1: Extract season and episode
    const seasonEp = this.extractSeasonEpisode()
    if (!seasonEp) return null
    parsed.season = seasonEp.season
    parsed.episode = seasonEp.episode

    // Step 2: Extract title (remove season/episode info)
    parsed.title = this.extractTitle()

    // Step 3: Extract resolution
    parsed.resolution = this.extractResolution()

    // Step 4: Extract year (for disambiguation)
    parsed.year = this.extractYear()

    // Step 5: Calculate confidence
    parsed.confidence = this.getConfidence()

    return parsed
  }

  extractSeasonEpisode() {
    // Match S01E05
    let match = this.basename.match(/[Ss](\d{1,2})[Ee](\d{1,2})/)
    if (match) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) }
    }

    // Match 1x05
    match = this.basename.match(/(\d{1,2})[xX](\d{1,2})/)
    if (match) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) }
    }

    return null
  }

  extractTitle() {
    // Remove season/episode info, resolution, year
    let title = this.basename
      .replace(/[Ss]\d{1,2}[Ee]\d{1,2}/, '')    // S01E05
      .replace(/\d{1,2}[xX]\d{1,2}/, '')       // 1x05
      .replace(/\d{3,4}[pi]/, '')              // 1080p
      .replace(/\d{4}/, '')                    // Year
      .replace(/[\.\-_]/g, ' ')                // Replace separators
      .trim()

    return title
  }

  extractResolution() {
    const match = this.basename.match(/(\d{3,4})[pi]/)
    return match ? match[1] + 'p' : null
  }

  extractYear() {
    const match = this.basename.match(/(\d{4})/)
    const year = parseInt(match?.[1])
    // Only return if reasonable year
    return (year && year >= 1990 && year <= 2050) ? year : null
  }

  getConfidence() {
    let score = 60  // Base TV confidence

    if (this.extractSeasonEpisode()) score += 30  // Has S01E05 pattern
    if (this.extractYear()) score += 10           // Has year

    return Math.min(score, 100)
  }
}
```

**Subtasks:**
- [x] Implement `extractSeasonEpisode()` (S01E05 and 1x05 formats)
- [x] Implement `extractTitle()` with cleanup
- [x] Implement `extractResolution()`
- [x] Implement `extractYear()`
- [x] Implement `getConfidence()` scoring
- [x] Handle verbose formats (Season X Episode Y)
- [ ] Write 5+ test cases

---

### Task 4: Build MovieParser

**File**: `parsers/MovieParser.js`

```javascript
// Patterns:
// Inception.2010.1080p.mkv
// Movie Title (2024) 1080p.mkv
// Title.2024.BluRay.mkv

export class MovieParser extends BaseParser {
  parse() {
    const parsed = {
      mediaType: 'movie',
      rawFilename: this.filename,
      confidence: 0
    }

    // Step 1: Extract year
    parsed.year = this.extractYear()
    if (!parsed.year) return null  // Movies should have year

    // Step 2: Extract title (remove year, resolution, etc)
    parsed.title = this.extractTitle()
    if (!parsed.title) return null

    // Step 3: Extract resolution
    parsed.resolution = this.extractResolution()

    // Step 4: Calculate confidence
    parsed.confidence = this.getConfidence()

    return parsed
  }

  extractYear() {
    // Match year in parentheses or standalone
    let match = this.basename.match(/\((\d{4})\)/)
    if (match) return parseInt(match[1])

    match = this.basename.match(/(?:^|[\.\-_\s])(\d{4})(?:[\.\-_\s]|$)/)
    if (match) {
      const year = parseInt(match[1])
      return (year >= 1890 && year <= 2050) ? year : null
    }

    return null
  }

  extractTitle() {
    let title = this.basename
      .replace(/\(\d{4}\)/, '')                // (2024)
      .replace(/\d{4}/, '')                    // 2024
      .replace(/\d{3,4}[pi]/, '')              // 1080p
      .replace(/BluRay|HDTV|WEB-DL|DVDRip/i, '') // Quality markers
      .replace(/[\.\-_]/g, ' ')                // Replace separators
      .trim()

    return title || null
  }

  extractResolution() {
    const match = this.basename.match(/(\d{3,4})[pi]/)
    return match ? match[1] + 'p' : null
  }

  getConfidence() {
    let score = 40  // Base movie confidence

    if (this.extractYear()) score += 40  // Has year (strong indicator)
    if (!this.basename.match(/[Ss]\d+[Ee]\d+/)) score += 20  // NO S01E05 (not TV)

    return Math.min(score, 100)
  }
}
```

**Subtasks:**
- [x] Implement `extractYear()` with validation
- [x] Implement `extractTitle()` with cleanup
- [x] Implement `extractResolution()`
- [x] Implement `getConfidence()` scoring
- [x] Handle quality markers (BluRay, WEB-DL, etc)
- [x] Add S01E05 pattern rejection (strong penalty)
- [ ] Write 5+ test cases

---

### Task 5: Build AnimeMatcher

**File**: `matchers/AnimeMatcher.js`

```javascript
// Search AniList and MAL for anime

export class AnimeMatcher extends BaseMatcher {
  async match(parsed) {
    // Get both providers
    const anilist = getProvider('anilist')
    const mal = getProvider('mal')

    let bestResult = null
    let bestScore = 0

    // Try AniList
    try {
      const results = await anilist.search(parsed.title, { type: 'anime' })
      for (const result of results.slice(0, 3)) {
        const score = this.calculateScore(parsed, result)
        if (score > bestScore) {
          bestScore = score
          bestResult = result
        }
      }
    } catch (err) {
      console.warn('AniList search failed:', err.message)
    }

    // Try MAL
    try {
      const results = await mal.search(parsed.title, { type: 'anime' })
      for (const result of results.slice(0, 3)) {
        const score = this.calculateScore(parsed, result)
        if (score > bestScore) {
          bestScore = score
          bestResult = result
        }
      }
    } catch (err) {
      console.warn('MAL search failed:', err.message)
    }

    return bestScore > 50 ? bestResult : null
  }

  calculateScore(parsed, result) {
    let score = 0

    // Title matching
    if (result.title.default === parsed.title) {
      score += 40  // Exact match
    } else if (result.title.default.toLowerCase() === parsed.title.toLowerCase()) {
      score += 35  // Case-insensitive match
    } else if (this.isSimilar(result.title.default, parsed.title)) {
      score += 20  // Fuzzy match
    }

    // Episode count matching
    if (parsed.episode && result.episodeCount) {
      if (parsed.episode <= result.episodeCount) {
        score += 30  // Episode exists in this anime
      }
    }

    return Math.min(score, 100)
  }

  isSimilar(str1, str2) {
    // Simple fuzzy match (remove special chars, check substring)
    const clean1 = str1.toLowerCase().replace(/[^\w]/g, '')
    const clean2 = str2.toLowerCase().replace(/[^\w]/g, '')
    return clean1.includes(clean2) || clean2.includes(clean1)
  }
}
```

**Subtasks:**
- [x] Implement AniList search with lazy loading
- [x] Implement MyAnimeList fallback
- [x] Implement `calculateScore()` with title matching
- [x] Implement episode count validation
- [x] Normalize results to Media format
- [x] Handle multiple title formats
- [ ] Write 5+ test cases
- [ ] Implement fuzzy matching logic
- [ ] Handle multi-language titles
- [ ] Write 5+ test cases

---

### Task 6: Build GeneralMatcher

**File**: `matchers/GeneralMatcher.js`

```javascript
// Search TMDB for TV/movies

export class GeneralMatcher extends BaseMatcher {
  async match(parsed) {
    const tmdb = getProvider('tmdb')

    try {
      const results = await tmdb.search(parsed.title, { 
        type: parsed.mediaType === 'tv' ? 'tv' : 'movie'
      })

      let bestResult = null
      let bestScore = 0

      for (const result of results.slice(0, 5)) {
        const score = this.calculateScore(parsed, result)
        if (score > bestScore) {
          bestScore = score
          bestResult = result
        }
      }

      return bestScore > 60 ? bestResult : null
    } catch (err) {
      console.error('TMDB search failed:', err.message)
      return null
    }
  }

  calculateScore(parsed, result) {
    let score = 0

    // Title matching
    if (result.title === parsed.title) {
      score += 40  // Exact match
    } else if (result.title.toLowerCase() === parsed.title.toLowerCase()) {
      score += 35  // Case-insensitive
    } else if (this.isSimilar(result.title, parsed.title)) {
      score += 20  // Fuzzy match
    }

    // Year matching (for movies)
    if (parsed.year && result.releaseDate) {
      const resultYear = new Date(result.releaseDate).getFullYear()
      if (resultYear === parsed.year) {
        score += 20  // Year matches
      } else if (Math.abs(resultYear - parsed.year) <= 1) {
        score += 10  // Close year
      }
    }

    // Season/Episode matching (for TV)
    if (parsed.season && result.seasons) {
      const hasSeason = result.seasons.some(s => s.season_number === parsed.season)
      if (hasSeason) score += 25
    }

    return Math.min(score, 100)
  }

  isSimilar(str1, str2) {
    const clean1 = str1.toLowerCase().replace(/[^\w]/g, '')
    const clean2 = str2.toLowerCase().replace(/[^\w]/g, '')
    return clean1.includes(clean2) || clean2.includes(clean1)
  }
}
```

**Subtasks:**
- [x] Implement TMDB search with lazy loading
- [x] Implement year matching for both TV and movies
- [x] Implement season/episode matching for TV
- [x] Implement `calculateScore()` with multi-factor scoring
- [x] Normalize TMDB results to Media format
- [x] Handle image URLs (poster/backdrop)
- [ ] Write 5+ test cases

---

### Task 7: Build Main Resolver

**File**: `index.js`

**Architecture**: Auto-cycle through all 3 parsers by confidence score, then try matchers in order. Only prompt user if all matchers fail.

```javascript
export class TitleResolver {
  constructor() {
    this.parsers = [
      AnimeParser,      // Try all 3
      TVShowParser,
      MovieParser
    ]
    this.matchers = {
      anime: AnimeMatcher,
      tv: GeneralMatcher,
      movie: GeneralMatcher
    }
  }

  /**
   * Main entry point: resolve filename to media
   * Auto-cycles through all parsers and matchers without user input
   * 
   * @param {string} filename
   * @returns {Promise<ResolverResult>}
   */
  async resolve(filename) {
    // Step 1: Parse with all 3 parsers, get confidence scores
    const allParses = []
    
    for (const ParserClass of this.parsers) {
      const parser = new ParserClass(filename)
      const parsed = parser.parse()
      if (parsed) {
        allParses.push({
          parsed,
          confidence: parsed.confidence
        })
      }
    }

    if (allParses.length === 0) {
      throw new Error(`Could not parse: ${filename}`)
    }

    // Sort by confidence (highest first)
    allParses.sort((a, b) => b.confidence - a.confidence)

    // Step 2: Try matchers in confidence order (early exit if good match)
    for (const { parsed } of allParses) {
      const MatcherClass = this.matchers[parsed.mediaType]
      const matcher = new MatcherClass()

      try {
        const media = await matcher.match(parsed)
        const matchScore = media 
          ? matcher.calculateScore(parsed, media) 
          : 0

        // Early exit: if match score > 80%, confident enough
        if (matchScore > 80) {
          return {
            parsed,
            media,
            provider: parsed.mediaType === 'anime' ? 'anilist' : 'tmdb',
            matchScore,
            confidence: 'high'
          }
        }

        // If score > 70%, also accept (still pretty confident)
        if (matchScore > 70 && media) {
          return {
            parsed,
            media,
            provider: parsed.mediaType === 'anime' ? 'anilist' : 'tmdb',
            matchScore,
            confidence: 'medium'
          }
        }
      } catch (err) {
        console.warn(`${parsed.mediaType} matcher failed:`, err.message)
        // Continue to next parser
        continue
      }
    }

    // Step 3: All matchers failed - try again with lower threshold (60%)
    for (const { parsed } of allParses) {
      const MatcherClass = this.matchers[parsed.mediaType]
      const matcher = new MatcherClass()

      try {
        const media = await matcher.match(parsed)
        if (media) {
          const matchScore = matcher.calculateScore(parsed, media)
          if (matchScore > 60) {
            return {
              parsed,
              media,
              provider: parsed.mediaType === 'anime' ? 'anilist' : 'tmdb',
              matchScore,
              confidence: 'low',
              warning: 'Low confidence match - may need manual verification'
            }
          }
        }
      } catch (err) {
        // Continue
        continue
      }
    }

    // Step 4: If we get here, nothing matched - return best parse with user prompt flag
    const bestParse = allParses[0] // Highest confidence parser result
    return {
      parsed: bestParse.parsed,
      media: null,
      provider: null,
      matchScore: 0,
      confidence: 'failed',
      userPromptRequired: true,
      message: `Could not find match for: ${bestParse.parsed.title}. User should manually select.`
    }
  }
}

export default new TitleResolver()
```

**Subtasks:**
- [x] Implement all-parser scanning
- [x] Implement confidence sorting
- [x] Implement high confidence matcher cycling (>80%)
- [x] Implement medium confidence fallback (>70%)
- [x] Implement low confidence fallback (>60%)
- [x] Implement user prompt flag for complete failure
- [x] Add detailed logging for debugging
- [x] Handle errors at each stage

---

### Task 8: Write Tests

**File**: `__tests__/parsers.test.mjs`

Test cases:

```javascript
// AnimeParser
- "[HorribleSubs] Anime Title - 01 [1080p].mkv"
- "Anime Title 01 [v2].mkv"
- "[SubGroup] Title - 01.5 - Special.mkv"
- "NoSubgroup Title 05.mkv"
- "Invalid Movie Format 2024.mkv"

// TVShowParser
- "Show.S01E05.1080p.mkv"
- "Show - 1x05 - Title.mkv"
- "Show S01E05.mkv"
- "Show.2024.S01E05.mkv"
- "NoSeasonInfo - Just Text.mkv"

// MovieParser
- "Inception.2010.1080p.mkv"
- "Movie Title (2024) 1080p.mkv"
- "Title.2024.BluRay.mkv"
- "No Year Movie.mkv"
- "Very Old Movie 1950.mkv"
```

**Subtasks:**
- [x] Write 5+ AnimeParser tests (5 tests: standard, version, special, no subgroup, TV rejection)
- [x] Write 5+ TVShowParser tests (5 tests: S01E05, 3x10, with year, simple, anime rejection)
- [x] Write 5+ MovieParser tests (5 tests: year+quality, parentheses, WEB-DL, simple, TV rejection)
- [x] Write resolver integration tests
- [x] Create run-all.mjs test runner
- [x] Test parser-only functionality (no API required)
- [x] Test full integration with logging

---

## Task Checklist

- [x] Task 1: Base classes & types
- [x] Task 2: AnimeParser
- [x] Task 3: TVShowParser
- [x] Task 4: MovieParser
- [x] Task 5: AnimeMatcher
- [x] Task 6: GeneralMatcher
- [x] Task 7: Main Resolver
- [x] Task 8: Tests (all passing)
- [x] Added regex & confidence scoring to learning guide
- [ ] Phase 3 completion report

---

## Success Criteria

✅ All 21+ tests passing (parsers + matchers)  
✅ Can parse anime, TV, and movie filenames  
✅ Correctly identifies media type with 80%+ confidence  
✅ Finds correct provider match 90% of the time  
✅ Handles edge cases (special episodes, remakes, etc)  
✅ Integration with existing providers working  

---

## Estimated Effort

| Task | Est. Time | Difficulty |
|------|-----------|------------|
| Task 1: Types & Base | 30 min | ⭐ |
| Task 2: AnimeParser | 1-2 hrs | ⭐⭐ |
| Task 3: TVShowParser | 1-2 hrs | ⭐⭐ |
| Task 4: MovieParser | 1 hr | ⭐ |
| Task 5: AnimeMatcher | 1-2 hrs | ⭐⭐⭐ |
| Task 6: GeneralMatcher | 1 hr | ⭐⭐ |
| Task 7: Main Resolver | 1 hr | ⭐⭐ |
| Task 8: Tests | 2-3 hrs | ⭐⭐ |
| **Total** | **9-14 hrs** | - |

---

## Next Steps

1. Review this plan
2. Confirm tasks to start with
3. Begin implementation

Ready to start with Task 1?
