import assert from 'assert'
import { buildBuiltInSearchQuery, createSearchTitles, determineBuiltInMediaType } from '../query-builder.js'

export async function testMediaTypeDetection() {
  assert.strictEqual(determineBuiltInMediaType({ format: 'TV', source: 'TMDB' }), 'tv')
  assert.strictEqual(determineBuiltInMediaType({ format: 'MOVIE', source: 'TMDB' }), 'movie')
  assert.strictEqual(determineBuiltInMediaType({ format: 'TV', source: 'ANILIST' }), 'anime')
  assert.strictEqual(determineBuiltInMediaType({ mediaType: 'tv', format: 'ONA' }), 'tv')
  assert.strictEqual(determineBuiltInMediaType({ format: 'ONA' }), 'anime')
  return true
}

export async function testTitleGeneration() {
  const titles = createSearchTitles({
    title: { userPreferred: "My Hero Academia Season 2", romaji: 'Boku no Hero Academia 2nd Season' },
    synonyms: ['My-Hero-Academia']
  })

  assert(titles.includes('My Hero Academia Season 2'))
  assert(titles.includes('My Hero Academia S2'))
  assert(titles.includes('Boku no Hero Academia S2'))
  return true
}

export async function testPreferredTitleOrdering() {
  const titles = createSearchTitles({
    title: {
      native: '進撃の巨人',
      romaji: 'Shingeki no Kyojin',
      userPreferred: 'Attack on Titan',
      english: 'Attack on Titan'
    },
    synonyms: ['AoT']
  })

  assert.strictEqual(titles[0], 'Attack on Titan')
  assert(titles.indexOf('AoT') > titles.indexOf('Shingeki no Kyojin'))
  return true
}

export async function testAnimeSingleVariants() {
  const query = buildBuiltInSearchQuery({
    media: {
      format: 'TV',
      source: 'TMDB',
      title: { userPreferred: 'Attack on Titan' },
      synonyms: [],
      startDate: { year: 2013 },
      episodes: 25
    },
    season: 1,
    episode: 3,
    resolution: '1080'
  })

  assert.strictEqual(query.mediaType, 'tv')
  assert(query.variants.single.some(value => value.includes('1080p')))
  assert(query.variants.single.some(value => value.includes('Episode 3') || value.includes('S')))
  assert(query.variants.single.some(value => value.includes('1x03') || value.includes('S01E03')))
  return true
}

export async function testTvSeasonFallbackVariants() {
  const query = buildBuiltInSearchQuery({
    media: {
      source: 'TMDB',
      format: 'TV',
      title: { userPreferred: 'The Bear' },
      synonyms: [],
      startDate: { year: 2022 }
    },
    episode: 5,
    resolution: '1080'
  })

  assert.strictEqual(query.mediaType, 'tv')
  assert(query.variants.single.some(value => value.includes('S01E05')))
  return true
}

export async function testAnimeEpisodeVariantExpansion() {
  const query = buildBuiltInSearchQuery({
    media: {
      format: 'ONA',
      title: { userPreferred: 'Frieren' },
      synonyms: [],
      startDate: { year: 2023 },
      episodes: 28
    },
    episode: 1,
    resolution: '1080'
  })

  assert.strictEqual(query.mediaType, 'anime')
  assert.strictEqual(query.variantPlan.single[0].stageMode, 'single')
  assert.strictEqual(query.variantPlan.single[0].terms[0], 'Frieren 01')
  assert(query.variants.single.some(value => value.includes('Frieren 01')))
  assert(query.variants.single.some(value => value.includes('Frieren 1')))
  return true
}

export async function testAnimeBatchVariants() {
  const query = buildBuiltInSearchQuery({
    media: {
      format: 'ONA',
      title: { userPreferred: 'Frieren' },
      synonyms: [],
      startDate: { year: 2023 },
      episodes: 28
    },
    episode: 10,
    batch: true,
    resolution: '720'
  })

  assert.strictEqual(query.mediaType, 'anime')
  assert(query.variantPlan.batch.some(stage => stage.stageMode === 'batch'))
  assert(!query.variantPlan.batch.some(stage => stage.stageMode === 'single'))
  assert(query.variants.batch.some(value => value.toLowerCase().includes('batch')))
  assert(query.variants.batch.some(value => value.includes('720p')))
  return true
}

export async function testMovieVariants() {
  const query = buildBuiltInSearchQuery({
    media: {
      format: 'MOVIE',
      title: { userPreferred: 'Dune' },
      synonyms: [],
      startDate: { year: 2021 },
      externalIds: { imdb: 'tt1160419', tmdb: 438631 }
    },
    movie: true,
    resolution: '1080'
  })

  assert.strictEqual(query.mediaType, 'movie')
  assert.strictEqual(query.ids.imdb, 'tt1160419')
  assert.strictEqual(query.ids.tmdb, 438631)
  assert.strictEqual(query.variants.movie[0], 'Dune 2021')
  assert(query.variants.movie.some(value => value.includes('2021')))
  assert(query.variants.movie.some(value => value.includes('1080p')))
  return true
}
