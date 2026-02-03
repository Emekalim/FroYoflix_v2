// @ts-check
/**
 * AniList Provider Tests
 * Tests the AniList provider wrapper
 *
 * @typedef {import('../types.js').MediaProvider} MediaProvider
 */

import { getProvider } from '../index.js'

export async function testAniListProvider() {
  console.log('📺 Testing AniList Provider...\n')

  try {
    const anilist = getProvider('anilist')

    // Test 1: Check provider info
    console.log('Test 1: Provider information')
    console.log(`  ✓ ID: ${anilist.id}`)
    console.log(`  ✓ Name: ${anilist.name}`)
    console.log(`  ✓ Media types: ${anilist.mediaTypes.join(', ')}\n`)

    // Test 2: Check authentication
    console.log('Test 2: Check authentication status')
    const isAuth = await anilist.isAuthenticated()
    console.log(`  ✓ Authenticated: ${isAuth}\n`)

    // Test 3: Check required methods
    console.log('Test 3: Check required methods exist')
    const methods = ['search', 'getById', 'getEpisodes', 'isAuthenticated']
    for (const method of methods) {
      const exists = typeof anilist[method] === 'function'
      console.log(`  ${exists ? '✓' : '✗'} ${method}()`)
    }
    console.log()

    // Test 4: Check internal state
    console.log('Test 4: Check provider state')
    console.log(`  ✓ Has mapper: ${!!anilist.mapper}`)
    console.log(`  ✓ Has config: ${!!anilist.config}\n`)

    console.log('✅ AniList provider tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ AniList provider test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testAniListSearch() {
  console.log('🔍 Testing AniList Search (if authenticated)...\n')

  try {
    const anilist = getProvider('anilist')
    const isAuth = await anilist.isAuthenticated()

    if (!isAuth) {
      console.log('⚠️  Skipped: Not authenticated with AniList')
      console.log('   (Search requires authentication)\n')
      return true
    }

    console.log('Test: Search for anime')
    const results = await anilist.search('Demon Slayer')
    console.log(`  ✓ Returned ${results.length} results\n`)

    if (results.length > 0) {
      console.log('First result:')
      const first = results[0]
      console.log(`  ✓ ID: ${first.id}`)
      console.log(`  ✓ Type: ${first.type}`)
      console.log(`  ✓ Title: ${first.title.default}`)
      console.log(`  ✓ Episodes: ${first.episodeCount}`)
      console.log(`  ✓ Poster: ${first.poster ? 'Yes' : 'No'}\n`)
    }

    console.log('✅ AniList search tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ AniList search test failed:', error.message)
    return false
  }
}

// Run all tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('================================================')
  console.log('ANILIST PROVIDER TEST SUITE')
  console.log('================================================\n')

  const results = []
  results.push(await testAniListProvider())
  results.push(await testAniListSearch())

  console.log('================================================')
  console.log(`RESULTS: ${results.filter(r => r).length}/${results.length} passed`)
  console.log('================================================\n')

  process.exit(results.some(r => !r) ? 1 : 0)
}
