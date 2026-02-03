/**
 * TMDB Provider Test Runner
 * Run only TMDB tests
 */

import {
  testTMDBProvider,
  testTMDBSearch,
  testTMDBTrending,
  testTMDBPopular,
  testTMDBMapper
} from './tmdb.test.mjs'

async function runTMDBTests() {
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║                                                        ║')
  console.log('║           TMDB PROVIDER TEST SUITE                     ║')
  console.log('║                                                        ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log('\n')

  const results = {}

  results.provider = await testTMDBProvider()
  results.search = await testTMDBSearch()
  results.trending = await testTMDBTrending()
  results.popular = await testTMDBPopular()
  results.mapper = await testTMDBMapper()

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
  const allPassed = await runTMDBTests()
  process.exit(allPassed ? 0 : 1)
}
