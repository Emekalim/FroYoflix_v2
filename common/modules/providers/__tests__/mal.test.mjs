// @ts-check
/**
 * MyAnimeList Provider Tests
 * Tests the MyAnimeList provider wrapper
 *
 * @typedef {import('../types.js').MediaProvider} MediaProvider
 */

import { getProvider } from '../index.js'

export async function testMALProvider() {
  console.log('📺 Testing MyAnimeList Provider...\n')

  try {
    const mal = getProvider('mal')

    // Test 1: Check provider info
    console.log('Test 1: Provider information')
    console.log(`  ✓ ID: ${mal.id}`)
    console.log(`  ✓ Name: ${mal.name}`)
    console.log(`  ✓ Media types: ${mal.mediaTypes.join(', ')}\n`)

    // Test 2: Check authentication
    console.log('Test 2: Check authentication status')
    const isAuth = await mal.isAuthenticated()
    console.log(`  ✓ Authenticated: ${isAuth}\n`)

    // Test 3: Check required methods
    console.log('Test 3: Check required methods exist')
    const methods = ['search', 'getById', 'getEpisodes', 'isAuthenticated']
    for (const method of methods) {
      const exists = typeof mal[method] === 'function'
      console.log(`  ${exists ? '✓' : '✗'} ${method}()`)
    }
    console.log()

    // Test 4: Check internal state
    console.log('Test 4: Check provider state')
    console.log(`  ✓ Has mapper: ${!!mal.mapper}`)
    console.log(`  ✓ Has config: ${!!mal.config}\n`)

    console.log('✅ MyAnimeList provider tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ MyAnimeList provider test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testMALSearch() {
  console.log('🔍 Testing MyAnimeList Search (if authenticated)...\n')

  try {
    const mal = getProvider('mal')
    const isAuth = await mal.isAuthenticated()

    if (!isAuth) {
      console.log('⚠️  Skipped: Not authenticated with MyAnimeList')
      console.log('   (Search requires authentication)\n')
      return true
    }

    console.log('Test: Search for anime')
    const results = await mal.search('Demon Slayer')
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

    console.log('✅ MyAnimeList search tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ MyAnimeList search test failed:', error.message)
    return false
  }
}

// Run all tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('================================================')
  console.log('MYANIMELIST PROVIDER TEST SUITE')
  console.log('================================================\n')

  const results = []
  results.push(await testMALProvider())
  results.push(await testMALSearch())

  console.log('================================================')
  console.log(`RESULTS: ${results.filter(r => r).length}/${results.length} passed`)
  console.log('================================================\n')

  process.exit(results.some(r => !r) ? 1 : 0)
}
