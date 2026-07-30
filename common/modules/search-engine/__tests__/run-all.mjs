import {
  testMediaTypeDetection,
  testTitleGeneration,
  testPreferredTitleOrdering,
  testAnimeSingleVariants,
  testTvSeasonFallbackVariants,
  testAnimeEpisodeVariantExpansion,
  testAnimeBatchVariants,
  testMovieVariants
} from './query-builder.test.mjs'
import {
  testMovieSourceConfidenceRanking,
  testTvEpisodeMatchBeatsGenericSeederCount,
  testDiversifiedMovieResults,
  testAnimeResultsPreferRelevanceOverFlatSeeders,
  testAnimeResultsDoNotDiversifyAcrossSources
} from './result-ranking.test.mjs'
import {
  testRuntimeDetection,
  testFlagGating
} from './runtime.test.mjs'
import {
  testTrackerSelection
} from './registry.test.mjs'

async function runTest(name, fn) {
  try {
    await fn()
    console.log(`✅ ${name}`)
    return true
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('\nBuilt-In Search Engine Test Suite\n')
  const tests = [
    ['Media type detection', testMediaTypeDetection],
    ['Title generation', testTitleGeneration],
    ['Preferred title ordering', testPreferredTitleOrdering],
    ['TV single variants', testAnimeSingleVariants],
    ['TV default season fallback', testTvSeasonFallbackVariants],
    ['Anime episode variant expansion', testAnimeEpisodeVariantExpansion],
    ['Anime batch variants', testAnimeBatchVariants],
    ['Movie variants', testMovieVariants],
    ['Movie source confidence ranking', testMovieSourceConfidenceRanking],
    ['TV episode relevance ranking', testTvEpisodeMatchBeatsGenericSeederCount],
    ['Diversified movie result list', testDiversifiedMovieResults],
    ['Anime relevance dominates flat seeders', testAnimeResultsPreferRelevanceOverFlatSeeders],
    ['Anime results do not diversify across sources', testAnimeResultsDoNotDiversifyAcrossSources],
    ['Tracker selection', testTrackerSelection],
    ['Runtime detection', testRuntimeDetection],
    ['Flag gating', testFlagGating]
  ]

  let passed = 0
  for (const [name, fn] of tests) {
    if (await runTest(name, fn)) passed++
  }

  console.log(`\nPassed ${passed}/${tests.length} tests\n`)
  process.exit(passed === tests.length ? 0 : 1)
}

main()
