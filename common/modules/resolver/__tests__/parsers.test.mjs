// @ts-check
/**
 * Parser Tests - Test all three parsers with real filenames
 */

import assert from 'assert'
import AnimeParser from '../parsers/AnimeParser.js'
import TVShowParser from '../parsers/TVShowParser.js'
import MovieParser from '../parsers/MovieParser.js'

console.log('='.repeat(60))
console.log('PARSER TESTS')
console.log('='.repeat(60))

// ============================================================================
// ANIME PARSER TESTS
// ============================================================================

console.log('\n--- AnimeParser Tests ---\n')

const animeTests = [
  {
    filename: '[HorribleSubs] Attack on Titan - 01 [1080p].mkv',
    expect: {
      mediaType: 'anime',
      title: 'Attack on Titan',
      episode: 1,
      subGroup: 'HorribleSubs',
      resolution: 'FullHD',
      minConfidence: 80,
    },
    description: 'Standard anime with subgroup and resolution',
  },
  {
    filename: 'Demon Slayer 05 [v2].mkv',
    expect: {
      mediaType: 'anime',
      title: 'Demon Slayer',
      episode: 5,
      version: 2,
      minConfidence: 70,
    },
    description: 'Anime with version marker',
  },
  {
    filename: '[SubGroup] My Hero Academia - 01.5 - Special.mkv',
    expect: {
      mediaType: 'anime',
      title: 'My Hero Academia',
      episode: 1,
      fractional: 5,
      subGroup: 'SubGroup',
      minConfidence: 75,
    },
    description: 'Anime with fractional episode (special)',
  },
  {
    filename: 'SteinsGate 12.mkv',
    expect: {
      mediaType: 'anime',
      title: 'SteinsGate',
      episode: 12,
      minConfidence: 50,
    },
    description: 'Anime without subgroup',
  },
  {
    filename: 'Show.S01E05.1080p.mkv',
    expect: {
      mediaType: null,
      description: 'Should NOT be detected as anime (has S01E05)',
    },
    description: 'TV format should NOT match anime',
  },
]

let animePass = 0
let animeTotal = animeTests.length

animeTests.forEach((test, i) => {
  try {
    const parser = new AnimeParser(test.filename)
    const result = parser.parse()

    if (test.expect.mediaType === null) {
      assert.strictEqual(result, null, `Expected null, got ${result?.mediaType}`)
    } else {
      assert.ok(result, `Should parse: ${test.filename}`)
      assert.strictEqual(result.mediaType, test.expect.mediaType)
      assert.strictEqual(result.title, test.expect.title)
      assert.strictEqual(result.episode, test.expect.episode)

      if (test.expect.subGroup) {
        assert.strictEqual(result.subGroup, test.expect.subGroup)
      }
      if (test.expect.version) {
        assert.strictEqual(result.version, test.expect.version)
      }
      if (test.expect.fractional !== undefined) {
        assert.strictEqual(result.fractional, test.expect.fractional)
      }
      if (test.expect.minConfidence) {
        assert.ok(
          result.confidence >= test.expect.minConfidence,
          `Expected confidence >= ${test.expect.minConfidence}, got ${result.confidence}`
        )
      }
    }

    console.log(`✓ Test ${i + 1}: ${test.description}`)
    animePass++
  } catch (err) {
    console.log(`✗ Test ${i + 1}: ${test.description}`)
    console.log(`  Error: ${err.message}`)
  }
})

console.log(`\nAnimeParser: ${animePass}/${animeTotal} passed\n`)

// ============================================================================
// TV SHOW PARSER TESTS
// ============================================================================

console.log('--- TVShowParser Tests ---\n')

const tvTests = [
  {
    filename: 'Breaking.Bad.S01E05.1080p.mkv',
    expect: {
      mediaType: 'tv',
      title: 'Breaking Bad',
      season: 1,
      episode: 5,
      resolution: 'FullHD',
      minConfidence: 75,
    },
    description: 'Standard TV format S01E05',
  },
  {
    filename: 'Game of Thrones - 3x10 - The Rains of Castamere.mkv',
    expect: {
      mediaType: 'tv',
      title: 'Game of Thrones',
      season: 3,
      episode: 10,
      minConfidence: 75,
    },
    description: 'Alternate TV format 3x10',
  },
  {
    filename: 'The Office.2024.S04E12.720p.mkv',
    expect: {
      mediaType: 'tv',
      title: 'The Office',
      season: 4,
      episode: 12,
      year: 2024,
      minConfidence: 80,
    },
    description: 'TV with year for disambiguation',
  },
  {
    filename: 'Stranger.Things.S02E08.mkv',
    expect: {
      mediaType: 'tv',
      title: 'Stranger Things',
      season: 2,
      episode: 8,
      minConfidence: 75,
    },
    description: 'Simple TV format',
  },
  {
    filename: '[HorribleSubs] Anime - 05.mkv',
    expect: {
      mediaType: null,
      description: 'Should NOT be detected as TV (no season marker)',
    },
    description: 'Anime format should NOT match TV',
  },
]

let tvPass = 0
let tvTotal = tvTests.length

tvTests.forEach((test, i) => {
  try {
    const parser = new TVShowParser(test.filename)
    const result = parser.parse()

    if (test.expect.mediaType === null) {
      assert.strictEqual(result, null, `Expected null, got ${result?.mediaType}`)
    } else {
      assert.ok(result, `Should parse: ${test.filename}`)
      assert.strictEqual(result.mediaType, test.expect.mediaType)
      assert.strictEqual(result.title, test.expect.title)
      assert.strictEqual(result.season, test.expect.season)
      assert.strictEqual(result.episode, test.expect.episode)

      if (test.expect.year) {
        assert.strictEqual(result.year, test.expect.year)
      }
      if (test.expect.resolution) {
        assert.strictEqual(result.resolution, test.expect.resolution)
      }
      if (test.expect.minConfidence) {
        assert.ok(
          result.confidence >= test.expect.minConfidence,
          `Expected confidence >= ${test.expect.minConfidence}, got ${result.confidence}`
        )
      }
    }

    console.log(`✓ Test ${i + 1}: ${test.description}`)
    tvPass++
  } catch (err) {
    console.log(`✗ Test ${i + 1}: ${test.description}`)
    console.log(`  Error: ${err.message}`)
  }
})

console.log(`\nTVShowParser: ${tvPass}/${tvTotal} passed\n`)

// ============================================================================
// MOVIE PARSER TESTS
// ============================================================================

console.log('--- MovieParser Tests ---\n')

const movieTests = [
  {
    filename: 'Inception.2010.1080p.BluRay.mkv',
    expect: {
      mediaType: 'movie',
      title: 'Inception',
      year: 2010,
      resolution: 'FullHD',
      quality: 'BluRay',
      minConfidence: 90,
    },
    description: 'Movie with year and quality marker',
  },
  {
    filename: 'The Matrix (1999) 720p.mkv',
    expect: {
      mediaType: 'movie',
      title: 'The Matrix',
      year: 1999,
      resolution: 'HD',
      minConfidence: 85,
    },
    description: 'Movie with year in parentheses',
  },
  {
    filename: 'Pulp.Fiction.1994.WEB-DL.mkv',
    expect: {
      mediaType: 'movie',
      title: 'Pulp Fiction',
      year: 1994,
      quality: 'WEB-DL',
      minConfidence: 85,
    },
    description: 'Movie with year and streaming quality',
  },
  {
    filename: 'Interstellar.2014.1080p.mkv',
    expect: {
      mediaType: 'movie',
      title: 'Interstellar',
      year: 2014,
      minConfidence: 80,
    },
    description: 'Simple movie with year',
  },
  {
    filename: 'Breaking.Bad.S01E05.mkv',
    expect: {
      mediaType: null,
      description: 'Should NOT be detected as movie (has S01E05)',
    },
    description: 'TV format should NOT match movie',
  },
]

let moviePass = 0
let movieTotal = movieTests.length

movieTests.forEach((test, i) => {
  try {
    const parser = new MovieParser(test.filename)
    const result = parser.parse()

    if (test.expect.mediaType === null) {
      assert.strictEqual(result, null, `Expected null, got ${result?.mediaType}`)
    } else {
      assert.ok(result, `Should parse: ${test.filename}`)
      assert.strictEqual(result.mediaType, test.expect.mediaType)
      assert.strictEqual(result.title, test.expect.title)
      assert.strictEqual(result.year, test.expect.year)

      if (test.expect.resolution) {
        assert.strictEqual(result.resolution, test.expect.resolution)
      }
      if (test.expect.quality) {
        assert.strictEqual(result.quality, test.expect.quality)
      }
      if (test.expect.minConfidence) {
        assert.ok(
          result.confidence >= test.expect.minConfidence,
          `Expected confidence >= ${test.expect.minConfidence}, got ${result.confidence}`
        )
      }
    }

    console.log(`✓ Test ${i + 1}: ${test.description}`)
    moviePass++
  } catch (err) {
    console.log(`✗ Test ${i + 1}: ${test.description}`)
    console.log(`  Error: ${err.message}`)
  }
})

console.log(`\nMovieParser: ${moviePass}/${movieTotal} passed\n`)

// ============================================================================
// SUMMARY
// ============================================================================

console.log('='.repeat(60))
console.log('PARSER TEST SUMMARY')
console.log('='.repeat(60))

const totalPass = animePass + tvPass + moviePass
const totalTests = animeTotal + tvTotal + movieTotal

console.log(`Total: ${totalPass}/${totalTests} tests passed`)
console.log(`Success rate: ${((totalPass / totalTests) * 100).toFixed(1)}%\n`)

if (totalPass === totalTests) {
  console.log('✓ ALL PARSER TESTS PASSED!')
  process.exit(0)
} else {
  console.log(`✗ ${totalTests - totalPass} tests failed`)
  process.exit(1)
}
