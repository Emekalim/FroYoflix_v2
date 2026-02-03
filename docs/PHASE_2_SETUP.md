# Phase 2: TMDB & Trakt Integration

**Status**: Starting  
**Date**: February 2, 2026  
**Goal**: Add movies and TV show support with TMDB and Trakt

---

## Setup Instructions

### 1. **Configure API Keys**

**For TMDB:**
1. Go to https://www.themoviedb.org/settings/api
2. Sign up for a free API key
3. Copy your API key

**For Trakt:**
1. Go to https://trakt.tv/settings/applications
2. Create a new OAuth application
3. Copy your Client ID

### 2. **Add Keys to .env**

Edit `.env` in the project root:
```env
TMDB_API_KEY=your_actual_key_here
TRAKT_CLIENT_ID=your_actual_id_here
```

---

## Implementation Plan

### Step 1: TMDB Provider (Movies & TV)

**File**: `common/modules/providers/tmdb/TMDBProvider.js`

**What it does:**
- Search for movies and TV shows
- Get metadata (poster, description, runtime, etc.)
- Get season/episode information
- Get trending and popular content

**Key Methods:**
```javascript
async search(query, filters)           // Search movies/TV
async getById(id)                      // Get by TMDB ID
async getTrending(type)                // Trending movies/TV
async getPopular(type)                 // Popular movies/TV
async getEpisodes(mediaId, season)     // Get episodes for series
async getSeasons(mediaId)              // Get all seasons
```

**API Base**: `https://api.themoviedb.org/3/`

### Step 2: Trakt Provider (User Tracking)

**File**: `common/modules/providers/trakt/TraktProvider.js`

**What it does:**
- Track user progress on shows/movies
- Get user lists and watchlist
- Get trending shows/movies
- Sync watch status

**Key Methods:**
```javascript
async search(query, filters)           // Search shows/movies
async getById(id)                      // Get by Trakt ID
async getTrending(type)                // Trending content
async getUserLists()                   // Get user's lists
async updateProgress(id, progress)     // Update watch status
```

**API Base**: `https://api.trakt.tv/`

---

## File Structure

```
common/modules/providers/
├── tmdb/
│   ├── TMDBProvider.js         (main provider)
│   ├── mapper.js               (API response → Media model)
│   ├── endpoints.js            (TMDB API endpoints)
│   └── utils.js                (TMDB-specific helpers)
│
├── trakt/
│   ├── TraktProvider.js        (main provider)
│   ├── mapper.js               (API response → Media model)
│   ├── endpoints.js            (Trakt API endpoints)
│   └── auth.js                 (OAuth handling)
│
└── config.js                   (load API keys from .env)
```

---

## API Basics

### TMDB Example

```javascript
// Search for a movie
const response = await fetch(
  'https://api.themoviedb.org/3/search/movie?' +
  'api_key=YOUR_KEY&query=Inception'
)
const data = await response.json()
// Returns: { results: [{id, title, poster_path, ...}] }

// Get movie details
const movie = await fetch(
  'https://api.themoviedb.org/3/movie/27205?' +
  'api_key=YOUR_KEY'
)
// Returns: {id, title, overview, poster_path, release_date, runtime, ...}
```

### Trakt Example

```javascript
// Search for a show
const response = await fetch(
  'https://api.trakt.tv/search?query=Breaking+Bad&type=show',
  {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  }
)
const data = await response.json()
// Returns: [{type: 'show', show: {ids, title, year, ...}}]
```

---

## Tasks

### Phase 2a: TMDB Provider (Higher Priority - Movies/TV Support)

- [ ] Create `TMDBProvider.js` class
- [ ] Implement `search()` method
- [ ] Implement `getById()` method
- [ ] Implement `getTrending()` and `getPopular()`
- [ ] Implement `getEpisodes()` and `getSeasons()` for TV
- [ ] Create `tmdb/mapper.js` for data normalization
- [ ] Create `tmdb/endpoints.js` with API URLs
- [ ] Add error handling and rate limiting
- [ ] Write tests for TMDB provider
- [ ] Update registry to include TMDB

### Phase 2b: Trakt Provider (Lower Priority - User Tracking)

- [ ] Create `TraktProvider.js` class
- [ ] Implement OAuth authentication flow
- [ ] Implement `search()` method
- [ ] Implement `getUserLists()` method
- [ ] Implement `updateProgress()` method
- [ ] Create `trakt/mapper.js` for data normalization
- [ ] Create `trakt/auth.js` for token management
- [ ] Write tests for Trakt provider
- [ ] Update registry to include Trakt

---

## Next Steps (When Ready)

1. **Start with TMDB** (simpler, more important for UI)
2. **Get first API response** and inspect the structure
3. **Build the mapper** to convert to Media model
4. **Write tests** to validate the mapping
5. **Move to Trakt** when TMDB is solid
6. **Update registry** to register both providers
7. **Update tests** to include new providers

---

## Learning Points for Phase 2

- **HTTP Requests**: Using `fetch()` API in Node.js
- **API Authentication**: API keys, headers, OAuth tokens
- **Data Normalization**: Mapping different API responses to unified model
- **Error Handling**: Managing API errors, rate limits, timeouts
- **Async Operations**: Chaining multiple API calls
- **Testing**: Mocking external API calls

---

## Resources

- **TMDB API Docs**: https://developer.themoviedb.org/docs
- **Trakt API Docs**: https://trakt.docs.apiary.io/
- **Fetch API**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- **HTTP Headers**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers

---

## Tips

1. **Start with TMDB** - It's simpler and more critical for media discovery
2. **Test API manually first** - Use Postman or curl to verify responses
3. **Inspect the structure** - Log the full API response to understand the shape
4. **Build mapper incrementally** - Map one field at a time
5. **Error messages** - Make them clear (which provider failed? why?)
6. **Rate limiting** - TMDB free tier has limits, handle gracefully

---

Ready to start? Let me know when you want to begin implementing TMDB! 🚀
