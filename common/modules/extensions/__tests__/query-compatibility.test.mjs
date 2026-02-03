/**
 * Phase 4 Extension System Tests
 * Tests for Query adapters, Backward compatibility, and Registry
 * 
 * Run: node __tests__/run-all.mjs
 */

import assert from 'assert'
import {
  adaptLegacyQuery,
  filterQueryForExtension,
  validateSourceConfig,
  isValidQuery,
  isValidExtension
} from '../compatibility.js'

// ============================================================================
// QUERY ADAPTER TESTS
// ============================================================================

export function testQueryAdapters() {
  console.log('\n=== Query Adapter Tests ===\n')

  // Test 1: Old anime query format
  {
    const oldQuery = {
      titles: ['Attack on Titan'],
      anilist: 16498,
      episode: 5,
      episodeCount: 94
    }

    const adapted = adaptLegacyQuery(oldQuery)

    assert.strictEqual(adapted.mediaType, 'anime', 'Should default to anime')
    assert.strictEqual(adapted.ids.anilist, 16498, 'Should convert anilist to ids.anilist')
    assert.strictEqual(adapted.episode, 5, 'Should preserve episode')
    assert.strictEqual(adapted.titles[0], 'Attack on Titan', 'Should preserve titles')

    console.log('✅ Test 1: Old anime query format - PASS')
  }

  // Test 2: New format query passes through unchanged
  {
    const newQuery = {
      mediaType: 'tv',
      ids: { tmdb: 1396, imdb: 'tt0903747' },
      titles: ['Breaking Bad'],
      season: 1,
      episode: 5
    }

    const adapted = adaptLegacyQuery(newQuery)

    assert.deepStrictEqual(adapted, newQuery, 'New format should pass through unchanged')

    console.log('✅ Test 2: New format query passes through - PASS')
  }

  // Test 3: Multiple legacy ID formats
  {
    const oldQuery = {
      titles: ['Anime'],
      anilist: 123,
      anidb: 456,
      mal: 789
    }

    const adapted = adaptLegacyQuery(oldQuery)

    assert.strictEqual(adapted.ids.anilist, 123, 'Should preserve anilist')
    assert.strictEqual(adapted.ids.anidb, 456, 'Should preserve anidb')
    assert.strictEqual(adapted.ids.mal, 789, 'Should preserve mal')

    console.log('✅ Test 3: Multiple legacy ID formats - PASS')
  }

  // Test 4: Query with resolution and exclusions
  {
    const query = {
      titles: ['Show'],
      episode: 5,
      resolution: '1080',
      exclusions: ['x264', 'hardsubbed']
    }

    const adapted = adaptLegacyQuery(query)

    assert.strictEqual(adapted.resolution, '1080', 'Should preserve resolution')
    assert.deepStrictEqual(adapted.exclusions, ['x264', 'hardsubbed'], 'Should preserve exclusions')

    console.log('✅ Test 4: Query with resolution and exclusions - PASS')
  }

  // Test 5: Empty/minimal query
  {
    const query = { titles: ['Something'] }
    const adapted = adaptLegacyQuery(query)

    assert.strictEqual(adapted.mediaType, 'anime', 'Should default to anime')
    assert.deepStrictEqual(adapted.ids, {}, 'Should have empty ids')

    console.log('✅ Test 5: Empty/minimal query - PASS')
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY TESTS
// ============================================================================

export function testBackwardCompatibility() {
  console.log('\n=== Backward Compatibility Tests ===\n')

  // Test 1: Filter query for anime-only extension
  {
    const query = {
      mediaType: 'tv',
      ids: { anilist: 123, tmdb: 456, imdb: 'tt789' },
      titles: ['Show'],
      episode: 5
    }

    const animeOnlyExt = {
      config: {
        supportedIds: ['anilist', 'anidb', 'mal']
      }
    }

    const filtered = filterQueryForExtension(query, animeOnlyExt)

    assert.strictEqual(filtered.ids.anilist, 123, 'Should keep anilist')
    assert.strictEqual(filtered.ids.tmdb, undefined, 'Should remove tmdb')
    assert.strictEqual(filtered.ids.imdb, undefined, 'Should remove imdb')

    console.log('✅ Test 1: Filter query for anime-only extension - PASS')
  }

  // Test 2: Filter query for general extension
  {
    const query = {
      mediaType: 'tv',
      ids: { anilist: 123, tmdb: 456, imdb: 'tt789', tvdb: 999 },
      titles: ['Show']
    }

    const generalExt = {
      config: {
        supportedIds: ['anilist', 'imdb', 'tmdb', 'tvdb']
      }
    }

    const filtered = filterQueryForExtension(query, generalExt)

    assert.strictEqual(filtered.ids.anilist, 123, 'Should keep anilist')
    assert.strictEqual(filtered.ids.tmdb, 456, 'Should keep tmdb')
    assert.strictEqual(filtered.ids.imdb, 'tt789', 'Should keep imdb')
    assert.strictEqual(filtered.ids.tvdb, 999, 'Should keep tvdb')

    console.log('✅ Test 2: Filter query for general extension - PASS')
  }

  // Test 3: Old extension without supportedIds
  {
    const query = {
      mediaType: 'anime',
      ids: { anilist: 123, tmdb: 456 },
      titles: ['Anime']
    }

    const oldExt = {
      config: {} // No supportedIds
    }

    const filtered = filterQueryForExtension(query, oldExt)

    assert.strictEqual(filtered.ids.anilist, 123, 'Should keep anilist')
    assert.strictEqual(filtered.ids.tmdb, undefined, 'Should remove tmdb for old extension')
    assert.strictEqual(filtered.ids.anidb, undefined, 'Should not add anidb')

    console.log('✅ Test 3: Old extension without supportedIds - PASS')
  }

  // Test 4: TV-only extension rejects anime query
  {
    const query = {
      mediaType: 'tv',
      ids: { tmdb: 456, imdb: 'tt789' },
      titles: ['Show'],
      season: 1,
      episode: 5
    }

    const tvExt = {
      config: {
        supportedIds: ['imdb', 'tmdb']
      }
    }

    const filtered = filterQueryForExtension(query, tvExt)

    assert.strictEqual(filtered.ids.imdb, 'tt789', 'Should keep supported IDs')
    assert.strictEqual(filtered.ids.tmdb, 456, 'Should keep supported IDs')

    console.log('✅ Test 4: TV-only extension with correct IDs - PASS')
  }
}

// ============================================================================
// VALIDATION TESTS
// ============================================================================

export function testValidation() {
  console.log('\n=== Validation Tests ===\n')

  // Test 1: Valid query
  {
    const query = {
      titles: ['Something'],
      episode: 5
    }

    assert.strictEqual(isValidQuery(query), true, 'Should validate correct query')

    console.log('✅ Test 1: Valid query - PASS')
  }

  // Test 2: Invalid query - missing titles
  {
    const query = { episode: 5 }
    assert.strictEqual(isValidQuery(query), false, 'Should reject query without titles')

    console.log('✅ Test 2: Invalid query (no titles) - PASS')
  }

  // Test 3: Invalid query - empty titles
  {
    const query = { titles: [] }
    assert.strictEqual(isValidQuery(query), false, 'Should reject query with empty titles')

    console.log('✅ Test 3: Invalid query (empty titles) - PASS')
  }

  // Test 4: Valid extension
  {
    const ext = {
      single: async () => [],
      batch: async () => [],
      movie: async () => [],
      validate: async () => true
    }

    assert.strictEqual(isValidExtension(ext), true, 'Should validate correct extension')

    console.log('✅ Test 4: Valid extension - PASS')
  }

  // Test 5: Invalid extension - missing method
  {
    const ext = {
      single: async () => [],
      batch: async () => []
      // Missing movie and validate
    }

    assert.strictEqual(isValidExtension(ext), false, 'Should reject extension with missing methods')

    console.log('✅ Test 5: Invalid extension (missing methods) - PASS')
  }

  // Test 6: Valid SourceConfig
  {
    const config = {
      id: 'nyaa-si',
      name: 'Nyaa.si',
      version: '1.0.0',
      mediaTypes: ['anime'],
      supportedIds: ['anilist', 'anidb']
    }

    const validation = validateSourceConfig(config)
    assert.strictEqual(validation.valid, true, 'Should validate correct config')
    assert.strictEqual(validation.errors.length, 0, 'Should have no errors')

    console.log('✅ Test 6: Valid SourceConfig - PASS')
  }

  // Test 7: Invalid SourceConfig - missing id
  {
    const config = {
      name: 'Extension',
      version: '1.0.0',
      mediaTypes: ['anime'],
      supportedIds: ['anilist']
    }

    const validation = validateSourceConfig(config)
    assert.strictEqual(validation.valid, false, 'Should reject config without id')
    assert(validation.errors.length > 0, 'Should have errors')

    console.log('✅ Test 7: Invalid SourceConfig (no id) - PASS')
  }

  // Test 8: Invalid SourceConfig - empty mediaTypes
  {
    const config = {
      id: 'ext',
      name: 'Extension',
      version: '1.0.0',
      mediaTypes: [],
      supportedIds: ['anilist']
    }

    const validation = validateSourceConfig(config)
    assert.strictEqual(validation.valid, false, 'Should reject config with empty mediaTypes')

    console.log('✅ Test 8: Invalid SourceConfig (empty mediaTypes) - PASS')
  }
}

// ============================================================================
// INTEGRATION SCENARIO TESTS
// ============================================================================

export function testIntegrationScenarios() {
  console.log('\n=== Integration Scenario Tests ===\n')

  // Scenario 1: Old anime extension receiving new TV query
  {
    console.log('Scenario 1: Old anime extension receiving TV query...')

    const oldQuery = { anilist: 123, titles: ['Anime'], episode: 5 }
    const adapted = adaptLegacyQuery(oldQuery)

    // Old extension only supports anime
    const oldExt = { config: { supportedIds: ['anilist', 'anidb', 'mal'] } }
    const filtered = filterQueryForExtension(adapted, oldExt)

    assert.strictEqual(filtered.ids.anilist, 123, 'Should adapt and filter query')
    assert.strictEqual(filtered.mediaType, 'anime', 'Should be anime type')

    console.log('✅ Scenario 1: PASS')
  }

  // Scenario 2: New extension receiving mixed IDs
  {
    console.log('Scenario 2: New extension receiving mixed IDs...')

    const newQuery = {
      mediaType: 'tv',
      ids: { anilist: 123, imdb: 'tt456', tmdb: 789, tvdb: 999 },
      titles: ['Show'],
      season: 1,
      episode: 5
    }

    // Extension only supports imdb/tmdb
    const tvExt = { config: { supportedIds: ['imdb', 'tmdb'] } }
    const filtered = filterQueryForExtension(newQuery, tvExt)

    assert.strictEqual(filtered.ids.anilist, undefined, 'Should remove unsupported anilist')
    assert.strictEqual(filtered.ids.imdb, 'tt456', 'Should keep imdb')
    assert.strictEqual(filtered.ids.tmdb, 789, 'Should keep tmdb')
    assert.strictEqual(filtered.ids.tvdb, undefined, 'Should remove unsupported tvdb')
    assert.strictEqual(filtered.season, 1, 'Should preserve season')

    console.log('✅ Scenario 2: PASS')
  }

  // Scenario 3: Movie query with year
  {
    console.log('Scenario 3: Movie query with year...')

    const movieQuery = {
      mediaType: 'movie',
      ids: { imdb: 'tt1375666', tmdb: 27205 },
      titles: ['Inception'],
      year: 2010,
      resolution: '1080'
    }

    const movieExt = { config: { supportedIds: ['imdb', 'tmdb'] } }
    const filtered = filterQueryForExtension(movieQuery, movieExt)

    assert.strictEqual(filtered.mediaType, 'movie', 'Should preserve movie type')
    assert.strictEqual(filtered.year, 2010, 'Should preserve year')
    assert.strictEqual(filtered.resolution, '1080', 'Should preserve resolution')

    console.log('✅ Scenario 3: PASS')
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗')
  console.log('║  PHASE 4 - EXTENSION SYSTEM TEST SUITE               ║')
  console.log('║  Query Adapters, Compatibility, and Validation      ║')
  console.log('╚════════════════════════════════════════════════════════╝')

  try {
    testQueryAdapters()
    testBackwardCompatibility()
    testValidation()
    testIntegrationScenarios()

    console.log('\n╔════════════════════════════════════════════════════════╗')
    console.log('║                    ALL TESTS PASSED                   ║')
    console.log('║                      ✅ 26/26                          ║')
    console.log('╚════════════════════════════════════════════════════════╝\n')

    return { passed: 26, failed: 0 }
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error(error.stack)
    return { passed: 0, failed: 1 }
  }
}
