/**
 * All Provider Tests Runner
 * Runs all test suites
 */

import { testRegistry, testProviderInstantiation, testProviderInterface } from './registry.test.mjs'
import { testAniListProvider, testAniListSearch } from './anilist.test.mjs'
import { testMALProvider, testMALSearch } from './mal.test.mjs'
import { testAniListMapper, testMALMapper, testMapperConsistency } from './mappers.test.mjs'
import {
  testTMDBProvider,
  testTMDBSearch,
  testTMDBTrending,
  testTMDBPopular,
  testTMDBMapper
} from './tmdb.test.mjs'
import {
  testTraktProvider,
  testTraktSearch,
  testTraktTrending,
  testTraktAuthentication,
  testTraktMapper,
  testTraktGetById
} from './trakt.test.mjs'

async function runAllTests() {
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║                                                        ║')
  console.log('║        FroYo PROVIDER ABSTRACTION TEST SUITE           ║')
  console.log('║                                                        ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log('\n')

  const results = {}

  // Registry tests
  console.log('┌─ REGISTRY TESTS ─────────────────────────────────────┐')
  results.registry = await testRegistry()
  results.instantiation = await testProviderInstantiation()
  results.interface = await testProviderInterface()
  console.log('└──────────────────────────────────────────────────────┘\n')

  // AniList tests
  console.log('┌─ ANILIST PROVIDER TESTS ─────────────────────────────┐')
  results.anilistProvider = await testAniListProvider()
  results.anilistSearch = await testAniListSearch()
  console.log('└──────────────────────────────────────────────────────┘\n')

  // MAL tests
  console.log('┌─ MYANIMELIST PROVIDER TESTS ──────────────────────────┐')
  results.malProvider = await testMALProvider()
  results.malSearch = await testMALSearch()
  console.log('└──────────────────────────────────────────────────────┘\n')

  // Mapper tests
  console.log('┌─ MAPPER TESTS ───────────────────────────────────────┐')
  results.anilistMapper = await testAniListMapper()
  results.malMapper = await testMALMapper()
  results.mapperConsistency = await testMapperConsistency()
  console.log('└──────────────────────────────────────────────────────┘\n')

  // TMDB tests
  console.log('┌─ TMDB PROVIDER TESTS ────────────────────────────────┐')
  results.tmdbProvider = await testTMDBProvider()
  results.tmdbSearch = await testTMDBSearch()
  results.tmdbTrending = await testTMDBTrending()
  results.tmdbPopular = await testTMDBPopular()
  results.tmdbMapper = await testTMDBMapper()
  console.log('└──────────────────────────────────────────────────────┘\n')

  // Trakt tests
  console.log('┌─ TRAKT PROVIDER TESTS ───────────────────────────────┐')
  results.traktProvider = await testTraktProvider()
  results.traktSearch = await testTraktSearch()
  results.traktTrending = await testTraktTrending()
  results.traktAuth = await testTraktAuthentication()
  results.traktMapper = await testTraktMapper()
  results.traktGetById = await testTraktGetById()
  console.log('└──────────────────────────────────────────────────────┘\n')

  // Summary
  const passed = Object.values(results).filter(r => r).length
  const total = Object.values(results).length
  const percentage = Math.round((passed / total) * 100)

  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║                      TEST SUMMARY                      ║')
  console.log('╠════════════════════════════════════════════════════════╣')
  console.log(`║  Passed: ${passed}/${total} (${percentage}%)`)
  console.log('╠════════════════════════════════════════════════════════╣')

  // Detailed results
  for (const [name, passed] of Object.entries(results)) {
    const status = passed ? '✅' : '❌'
    const paddedName = name.padEnd(35)
    console.log(`║  ${status} ${paddedName}`)
  }

  console.log('╚════════════════════════════════════════════════════════╝\n')

  return passed === total
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const allPassed = await runAllTests()
  process.exit(allPassed ? 0 : 1)
}
