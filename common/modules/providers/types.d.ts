/**
 * Shiru Provider Abstraction Types
 * Unified type definitions for all media providers
 */

// ============================================================================
// CORE MEDIA MODEL
// ============================================================================

export interface Media {
  id: string
  externalIds: {
    imdb?: string
    tmdb?: number
    tvdb?: number
    anilist?: number
    mal?: number
    anidb?: number
  }

  type: 'movie' | 'tv' | 'anime'

  title: {
    romaji?: string
    english?: string
    native?: string
    userPreferred?: string
    default: string
  }

  description?: string
  status?: 'RELEASING' | 'FINISHED' | 'UPCOMING' | 'CANCELLED'
  releaseDate?: string
  runtime?: number

  episodeCount?: number
  seasonCount?: number

  poster?: string
  banner?: string

  userProgress?: {
    score?: number
    status?: 'WATCHING' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING'
    progress?: number
    updatedAt?: string
  }
}

export interface Episode {
  number: number
  season?: number
  title?: string
  aired?: string
  runtime?: number
  description?: string
}

export interface Season {
  number: number
  title?: string
  episodeCount: number
  aired?: string
  poster?: string
}

export interface UserList {
  id: string
  name: string
  description?: string
  isPrivate: boolean
  media: Media[]
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface SearchFilters {
  type?: 'anime' | 'tv' | 'movie'
  year?: number
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
  status?: 'RELEASING' | 'FINISHED' | 'UPCOMING'
  limit?: number
  offset?: number
}

export interface ProgressUpdate {
  score?: number
  status?: 'WATCHING' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING'
  progress?: number
}

export interface MediaProvider {
  id: string
  name: string
  mediaTypes: ('anime' | 'tv' | 'movie')[]
  mapper?: any                                        // Data mapper (optional)
  config?: Record<string, any>                        // Provider config (optional)

  isAuthenticated(): Promise<boolean>
  authenticate?(): Promise<void>
  getUser?(): Promise<any>

  search(query: string, filters?: SearchFilters): Promise<Media[]>
  getById(id: string | number): Promise<Media>
  getTrending?(type: 'anime' | 'tv' | 'movie'): Promise<Media[]>
  getPopular?(type: 'anime' | 'tv' | 'movie'): Promise<Media[]>

  getEpisodes(mediaId: string | number, season?: number): Promise<Episode[]>
  getSeasons?(mediaId: string | number): Promise<Season[]>

  getUserLists?(): Promise<UserList[]>
  updateProgress?(mediaId: string | number, progress: ProgressUpdate): Promise<void>
}
