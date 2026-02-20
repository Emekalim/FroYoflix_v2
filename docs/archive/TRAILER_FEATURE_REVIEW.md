# YouTube/Trailer Feature Review - Anime vs TMDB

## Current Implementation (Anime)

### Data Source
- **AniList GraphQL Query** (`common/modules/anilist.js` line 89-92):
  ```graphql
  trailer {
    id,        # YouTube video ID
    site       # Usually "youtube"
  }
  ```
- The trailer data is fetched directly from AniList API and contains a YouTube video ID

### UI Component
- **TrailerModal.svelte** (`common/modals/TrailerModal.svelte`):
  - Fetches trailer ID from `staticMedia.trailer?.id`
  - Falls back to `episodesList.getMedia(staticMedia.idMal)?.data?.trailer?.youtube_id`
  - Uses custom YouTube server wrapper via `ELECTRON.getYouTube()`
  - Embeds iframe with URL: `${youtubeServer}/embed/${trailerId}?autoplay=1&vq=medium&cc_lang_pref=ja`
  - Displays YouTube thumbnail preview while loading

### Current Flow
```
Anime Details Modal
  ├─ Loads staticMedia with trailer.id from AniList
  ├─ Button shows if trailer.id exists
  └─ Clicking opens TrailerModal
      └─ Fetches YouTube thumbnail
      └─ Embeds YouTube video via custom server
```

---

## TMDB Capabilities

### TMDB API Support for Videos
TMDB API provides video metadata including YouTube trailers via:

**TV Shows & Movies** - `/tv/{id}/videos` or `/movie/{id}/videos`

**Response Example:**
```json
{
  "results": [
    {
      "id": "5d8dd2f8c3a3680017f3c",
      "key": "YqbCCCu_YRQ",                    // YouTube video ID
      "name": "Official Trailer",
      "site": "YouTube",
      "size": 1080,
      "type": "Trailer",                       // Can be Trailer, Teaser, Clip, etc.
      "official": true,
      "published_at": "2020-02-10T18:32:37.000Z"
    },
    ...
  ]
}
```

### Key Differences from Anime
✅ **Supports Multiple Videos** - Can have official trailer, teasers, clips
✅ **Video Metadata** - Includes official flag, published date, video type
✅ **Same Provider** - YouTube videos, same embedding capability
❌ **Requires Additional API Call** - Not included in base media query

---

## Implementation Plan

### Phase 1: Fetch Videos from TMDB
**Location:** `common/modules/sections.js`

Create new function `fetchTMDBVideos()`:
```javascript
export async function fetchTMDBVideos(tmdbId, mediaFormat = 'TV') {
  // Endpoint: /tv/{id}/videos or /movie/{id}/videos
  // Find official trailer or teaser
  // Return first YouTube video with type='Trailer' or type='Teaser'
  // Return structure: { id: youtubeId, site: 'youtube' } // Match anime format
}
```

**What to do:**
- Call appropriate TMDB endpoint based on mediaFormat
- Filter for YouTube videos
- Prioritize: Official Trailer > Teaser > Other trailers
- Extract YouTube video ID from `key` field
- Cache result

### Phase 2: Store Video in Media Object
**Location:** `common/modules/sections.js` (line 130-160)

Update TMDB media mapping to include trailer:
```javascript
const media = (data.results || []).map(item => ({
  // ... existing fields ...
  trailer: {
    id: null,              // Will be populated later
    site: 'youtube'
  },
  // ... rest of fields ...
}))
```

### Phase 3: Fetch & Populate on Modal Open
**Location:** `common/modals/details/DetailsModal.svelte`

When DetailsModal opens for TMDB content:
```javascript
if (staticMedia?.source === 'TMDB' && !staticMedia?.trailer?.id) {
  const { fetchTMDBVideos } = await import('@/modules/sections.js')
  const videoData = await fetchTMDBVideos(staticMedia.id, staticMedia.format)
  if (videoData?.id) {
    staticMedia.trailer = videoData
  }
}
```

### Phase 4: Update UI Visibility
**Location:** `common/modals/details/DetailsModal.svelte` (line 228-230)

Current code already works:
```svelte
{#if staticMedia?.trailer?.id}
  <button ... use:click={() => modal.toggle(modal.TRAILER)}>
    <TvMinimalPlay size='1.7rem' />
  </button>
{/if}
```

**Existing TrailerModal Component** - Already compatible! No changes needed.

---

## Implementation Complexity

### Effort Level: **LOW** ⭐⭐
- ✅ TrailerModal already works for any source with `trailer.id`
- ✅ Same YouTube embedding mechanism
- ✅ Just need to fetch video ID from TMDB API
- ✅ Reuse existing cache patterns

### Files to Modify
1. `common/modules/sections.js` - Add `fetchTMDBVideos()` function
2. `common/modals/details/DetailsModal.svelte` - Add lazy-fetch on modal load
3. Optional: `common/modules/anime/anime.js` - Fetch in `getEpisodeMetadataForMedia()` 

### Testing Needed
- ✅ TV Show with trailer → Button shows, trailer plays
- ✅ Movie with trailer → Button shows, trailer plays
- ✅ Content without trailer → Button hidden
- ✅ Multiple videos available → Correct one selected

---

## Edge Cases to Handle

| Case | Solution |
|------|----------|
| No videos available | Skip, no button shown (already handled) |
| Non-YouTube videos | Filter to YouTube only |
| Multiple trailers | Prioritize official flag & type |
| API call fails | Graceful degradation, no button |
| Already cached | Return cached value |

---

## Code Examples

### fetchTMDBVideos() Implementation
```javascript
export async function fetchTMDBVideos(tmdbId, mediaFormat = 'TV') {
  const tmdbApiKey = window.__TMDB_API_KEY__
  if (!tmdbApiKey || !tmdbId) return null

  try {
    const endpoint = mediaFormat === 'TV' ? 'tv' : 'movie'
    const url = new URL(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}/videos`)
    url.searchParams.append('api_key', tmdbApiKey)
    
    const response = await fetch(url.toString())
    if (!response.ok) return null
    
    const data = await response.json()
    const videos = data.results || []
    
    // Find official trailer/teaser on YouTube
    const official = videos.find(v => 
      v.site === 'YouTube' && 
      v.official && 
      ['Trailer', 'Teaser'].includes(v.type)
    )
    
    // Fallback to any trailer
    const fallback = videos.find(v => 
      v.site === 'YouTube' && 
      v.type === 'Trailer'
    )
    
    const video = official || fallback
    if (video?.key) {
      return { id: video.key, site: 'youtube' }
    }
    
    return null
  } catch (error) {
    debug('Error fetching TMDB videos:', error)
    return null
  }
}
```

### DetailsModal Integration
```javascript
$: if (staticMedia?.source === 'TMDB' && 
      $modal[modal.TRAILER] && 
      !staticMedia?.trailer?.id) {
  (async () => {
    const { fetchTMDBVideos } = await import('@/modules/sections.js')
    const trailer = await fetchTMDBVideos(staticMedia.tmdbId, staticMedia.format)
    if (trailer?.id) {
      staticMedia = { ...staticMedia, trailer }
    }
  })()
}
```

---

## Recommendation

**✅ Proceed with implementation** - This is a quick win that significantly enhances TMDB TV/Movie viewing experience with minimal code changes. The existing TrailerModal component is already built to handle this.

**Timeline:** ~30 minutes to implement and test

**Priority:** Medium-High (improves content discovery and user engagement)
