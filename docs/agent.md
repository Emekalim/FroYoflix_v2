# FroYoflix Project Agent Guide

**Last Updated:** February 20, 2026  
**Project Status:** 🟢 Phase 1-5 Complete / Release Readiness  
**Current Focus:** Release v1.0.0 Readiness, Versioning Design, and Documentation Cleanup

---

## Quick Context

**What is FroYoflix?**
- Desktop media streaming aggregator (Electron app)
- Node.js backend with web-based UI
- Extensible plugin system for content sources
- Searches multiple providers (AniList, MAL, TMDB, Trakt) for media availability

**Current Architecture:**
- Phase 1: 4 Data providers (AniList, MAL, TMDB, Trakt) ✅
- Phase 2-3: Resolver system (parsers, matchers, orchestrator) ✅
- Phase 4: Media extension system (gh: protocol support) ✅
- Phase 5: UI/UX Improvements & Multi-media support ✅
- Extension system: Dynamic loading via Web Workers with Comlink RPC

**Tech Stack:**
- Frontend: Svelte + SvelteKit
- Backend: Node.js 22.21.1 (LTS), ES modules
- Desktop: Electron 39.x
- APIs: TMDB v3, Trakt v2, AniList GraphQL, MAL OAuth
- Testing: Node test runner with .test.mjs files

---

## Cache Storage & Persistency

**Storage Location**: `~/Library/Application Support/Electron/IndexedDB/`  
**Disk Size**: ~300MB (reasonable for full media metadata + search history)

### **Cache Types & Persistence**

| Cache Type | Storage | Persistence Duration | Purpose | Approx Size |
|-----------|---------|-------------------|---------|------------|
| **GENERAL** | IndexedDB | Indefinite | App settings, media type selection | ~1-5MB |
| **HISTORY** | IndexedDB | Indefinite | Search/view history | ~10-20MB |
| **MEDIA_CACHE** | IndexedDB | Indefinite | Media metadata (50,000+ items) | ~100-150MB |
| **QUERIES** | IndexedDB | Indefinite | Search queries & results | ~50-80MB |
| **MAPPINGS** | IndexedDB | Indefinite | Provider ID mappings (AniList↔TMDB↔MAL) | ~5-10MB |
| **USER_LISTS** | IndexedDB | Indefinite | User watchlists from providers | ~20-30MB |
| **NOTIFICATIONS** | IndexedDB | Indefinite | User notifications | ~1-2MB |
| **SEARCH** | IndexedDB | Custom TTL (e.g., 7 days) | Current search results + TV schedule | ~5-10MB |

---

## Project Structure

```
FroYoflix/
├── common/                    # Shared Svelte UI + all business logic
│   ├── components/            # Reusable UI components
│   ├── modals/                # Detail, Torrent, Manager, Trailer modals
│   ├── modules/               # Core logic modules
│   │   ├── anime/             # Anime filename resolver, hash, parser
│   │   ├── extensions/        # Extension manager (Web Worker + Comlink)
│   │   ├── providers/         # AniList, MAL, TMDB, Trakt adapters
│   │   ├── resolver/          # Title/episode resolver (TV, anime, movie)
│   │   ├── cache.js           # IndexedDB persistence layer
│   │   └── ...
│   └── routes/                # Page-level views (Home, Search, Player, etc.)
│
├── client/                    # WebTorrent client wrapper
├── electron/                  # Desktop app shell
├── capacitor/                 # Android app shell
├── extensions/                # Built-in extension source manifests
├── docs/                      # Project documentation
└── patches/                   # pnpm dependency patches
```

---

## Test Suite Status

### Provider Tests (21/21 ✅)
**Location:** `common/modules/providers/__tests__/`
Run all: `node common/modules/providers/__tests__/run-all.mjs`

### Resolver Tests (18/18 ✅)
**Location:** `common/modules/resolver/__tests__/`
Run all: `node common/modules/resolver/__tests__/run-all.mjs`

---

## API Credentials

**Required Keys in `.env`:**
```env
TMDB_API_KEY=<TMDB_API_KEY>
TRAKT_CLIENT_ID=<TRAKT_CLIENT_ID>
```

**How to obtain:**
- TMDB: https://www.themoviedb.org/settings/api
- Trakt: https://trakt.tv/oauth/applications

---

## Debugging Methodology: Incremental & Stepwise

**Golden Rule:** Isolate the problem domain first, then trace data flow step-by-step.

1. **Error Categorization**: Build vs Runtime vs UI vs Logic.
2. **Read the Full Stack Trace**: Identify WHERE it fails.
3. **Trace Data Flow**: Verify what data component receives, check required fields.
4. **Implement Minimal Fix**: Apply smallest change, verify, then proceed.
5. **Fix Upstream**: Prefer fixing data source (e.g., sections.js) over patching components.

---

**Last Known Status:** All systems operational, 100% tests passing, extension loading functional ✅
