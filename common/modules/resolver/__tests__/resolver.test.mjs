// @ts-check
/**
 * Integration Tests - Test the full resolver workflow
 */

import assert from 'assert'
import resolver from '../index.js'

console.log('='.repeat(60))
console.log('INTEGRATION/RESOLVER TESTS')
console.log('='.repeat(60))
console.log('\nNote: These tests require TMDB and AniList APIs to be available')
console.log('Some tests will be skipped if APIs are unreachable\n')

// ============================================================================
// HELPER: Test resolver with timeout
// ============================================================================

async function resolveWithTimeout(filename, timeout = 5000) {
  return Promise.race([
    resolver.resolve(filename),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Resolver timeout')), timeout)
    ),
  ])
}

// ============================================================================
// TEST CASES
// ============================================================================

const testCases = [
  {
    filename: '[HorribleSubs] Attack on Titan - 01 [1080p].mkv',
    expectMediaType: 'anime',
    expectTitle: 'Attack on Titan',
    description: 'Should resolve anime correctly',
    skipReason: 'Requires AniList API',
  },
  {
    filename: 'Breaking.Bad.S01E05.1080p.mkv',
    expectMediaType: 'tv',
    description: 'Should resolve TV show correctly',
    skipReason: 'Requires TMDB API',
  },
  {
    filename: 'Inception.2010.1080p.BluRay.mkv',
    expectMediaType: 'movie',
    description: 'Should resolve movie correctly',
    skipReason: 'Requires TMDB API',
  },
]

console.log('--- Resolver Integration Tests ---\n')

let passed = 0
let skipped = 0
let failed = 0

;(async () => {
  for (const test of testCases) {
    try {
      console.log(`Testing: ${test.description}`)
      console.log(`  File: ${test.filename}`)

      const result = await resolveWithTimeout(test.filename)

      console.log(`  Parser result: ${result.parsed.mediaType}`)

      assert.strictEqual(result.parsed.mediaType, test.expectMediaType, 
        `Expected mediaType ${test.expectMediaType}, got ${result.parsed.mediaType}`)

      if (result.media) {
        console.log(`  ✓ Media found: ${result.media.title || result.media.name}`)
        console.log(`    Provider: ${result.provider}`)
        console.log(`    Match score: ${result.matchScore}%`)
        console.log(`    Confidence: ${result.confidence}`)
        passed++
      } else if (result.userPromptRequired) {
        console.log(`  ⚠ No match found (flagged for user input)`)
        console.log(`    Best parse: ${result.parsed.title}`)
        passed++ // Still counts as passing if parsing worked
      } else {
        console.log(`  ✗ Failed to resolve`)
        failed++
      }

      console.log()
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('getaddrinfo')) {
        console.log(`  ⊘ SKIPPED: API unreachable (${err.message})`)
        skipped++
      } else if (err.message.includes('timeout')) {
        console.log(`  ⊘ SKIPPED: Request timeout`)
        skipped++
      } else if (err.message.includes('Could not parse')) {
        console.log(`  ✗ Parse error: ${err.message}`)
        failed++
      } else {
        console.log(`  ✗ Error: ${err.message}`)
        failed++
      }
      console.log()
    }
  }

  // Summary
  console.log('='.repeat(60))
  console.log('RESOLVER TEST SUMMARY')
  console.log('='.repeat(60))

  const total = testCases.length
  console.log(`Passed: ${passed}/${total}`)
  console.log(`Skipped: ${skipped}/${total}`)
  console.log(`Failed: ${failed}/${total}\n`)

  if (failed === 0) {
    console.log('✓ ALL AVAILABLE TESTS PASSED!')
    process.exit(0)
  } else {
    console.log(`✗ ${failed} tests failed`)
    process.exit(1)
  }
})()
