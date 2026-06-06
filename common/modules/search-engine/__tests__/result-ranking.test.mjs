import assert from 'assert'
import { compareTorrentResults, diversifyTorrentResults, getResultRelevanceScore } from '../result-ranking.js'

export async function testMovieSourceConfidenceRanking() {
  const search = {
    media: {
      format: 'MOVIE',
      source: 'TMDB',
      title: { userPreferred: 'Dune', english: 'Dune' },
      synonyms: [],
      startDate: { year: 2021 }
    },
    movie: true,
    resolution: '1080'
  }

  const ytsResult = {
    title: 'Dune (2021) 1080p BluRay 5.1 x264 - YTS',
    seeders: 200,
    source: { id: 'yts', name: 'YTS' }
  }

  const tdResult = {
    title: 'Dune 2021 1080p WEBRip x264-RARBG',
    seeders: 900,
    source: { id: 'torrentdownloads', name: 'Torrent Downloads' }
  }

  assert(getResultRelevanceScore(ytsResult, search) > 0)
  assert(getResultRelevanceScore(tdResult, search) > 0)
  assert(compareTorrentResults(tdResult, ytsResult, 'seeders', search) < 0)
  return true
}

export async function testTvEpisodeMatchBeatsGenericSeederCount() {
  const search = {
    media: {
      format: 'TV',
      source: 'TMDB',
      title: { userPreferred: 'The Bear' },
      synonyms: [],
      startDate: { year: 2022 }
    },
    season: 2,
    episode: 5,
    resolution: '1080'
  }

  const exactEpisode = {
    title: 'The Bear S02E05 1080p WEB h264',
    seeders: 120,
    source: { id: 'showrss', name: 'showRSS' }
  }

  const genericSeries = {
    title: 'The Bear Complete Season 2 720p',
    seeders: 1500,
    source: { id: 'torrentdownloads', name: 'Torrent Downloads' }
  }

  assert(compareTorrentResults(genericSeries, exactEpisode, 'seeders', search) < 0)
  return true
}

export async function testDiversifiedMovieResults() {
  const search = {
    media: {
      format: 'MOVIE',
      source: 'TMDB',
      title: { userPreferred: 'Dune' },
      synonyms: [],
      startDate: { year: 2021 }
    },
    movie: true,
    resolution: '1080'
  }

  const sorted = [
    { title: 'Dune 2021 Remux', seeders: 1200, source: { id: 'torrentdownloads', name: 'Torrent Downloads' } },
    { title: 'Dune 2021 WEBRip', seeders: 1000, source: { id: 'torrentdownloads', name: 'Torrent Downloads' } },
    { title: 'Dune (2021) 1080p BluRay - YTS', seeders: 200, source: { id: 'yts', name: 'YTS' } },
    { title: 'Dune 2021 720p', seeders: 800, source: { id: 'torrentdownloads', name: 'Torrent Downloads' } }
  ].sort((a, b) => compareTorrentResults(a, b, 'seeders', search))

  const diversified = diversifyTorrentResults(sorted, search, 'seeders')
  assert(new Set(diversified.slice(0, 2).map(result => result.source.id)).size === 2)
  assert(diversified.slice(0, 3).some(result => result.source.id === 'yts'))
  assert(diversified.slice(0, 3).some(result => result.source.id === 'torrentdownloads'))
  return true
}

export async function testAnimeResultsPreferRelevanceOverFlatSeeders() {
  const search = {
    media: {
      format: 'TV',
      source: 'ANILIST',
      title: { userPreferred: 'Frieren' },
      synonyms: ['Sousou no Frieren'],
      startDate: { year: 2023 }
    },
    episode: 1,
    resolution: '1080'
  }

  const nyaaResult = {
    title: '[SubsPlease] Frieren - 01 (1080p)',
    seeders: 120,
    source: { id: 'nyaa', name: 'Nyaa' }
  }

  const genericResult = {
    title: 'Frieren S01 1080p Season Pack',
    seeders: 1500,
    source: { id: 'torrentdownloads', name: 'Torrent Downloads' }
  }

  assert(compareTorrentResults(genericResult, nyaaResult, 'seeders', search) > 0)
  return true
}

export async function testAnimeResultsDoNotDiversifyAcrossSources() {
  const search = {
    media: {
      format: 'TV',
      source: 'ANILIST',
      title: { userPreferred: 'Frieren' },
      synonyms: ['Sousou no Frieren'],
      startDate: { year: 2023 }
    },
    episode: 1,
    resolution: '1080'
  }

  const sorted = [
    { title: '[SubsPlease] Frieren - 01 (1080p)', seeders: 120, source: { id: 'nyaa', name: 'Nyaa' } },
    { title: '[Erai-raws] Frieren - 01 (1080p)', seeders: 110, source: { id: 'nyaa', name: 'Nyaa' } },
    { title: 'Frieren S01 1080p Season Pack', seeders: 1500, source: { id: 'torrentdownloads', name: 'Torrent Downloads' } }
  ]

  const diversified = diversifyTorrentResults(sorted, search, 'seeders')
  assert.deepStrictEqual(diversified, sorted)
  return true
}
