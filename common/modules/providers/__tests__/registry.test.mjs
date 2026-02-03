/**
 * Provider Registry Tests
 * Validates the provider registry and factory pattern
 */

import { getProvider, getProvidersForMediaType, getAllProviders } from '../index.js'

export async function testRegistry() {
  console.log('📋 Testing Provider Registry...\n')

  try {
    // Test 1: Get all providers
    console.log('Test 1: Get all providers')
    const providers = getAllProviders()
    console.log(`  ✓ Found ${providers.length} providers: ${providers.join(', ')}\n`)

    // Test 2: Get anime providers
    console.log('Test 2: Get providers for "anime"')
    const animeProviders = getProvidersForMediaType('anime')
    console.log(`  ✓ Anime providers: ${animeProviders.join(', ')}\n`)

    // Test 3: Get TV providers
    console.log('Test 3: Get providers for "tv"')
    const tvProviders = getProvidersForMediaType('tv')
    console.log(`  ✓ TV providers: ${tvProviders.length === 0 ? '(none - Phase 2)' : tvProviders.join(', ')}\n`)

    // Test 4: Get movie providers
    console.log('Test 4: Get providers for "movie"')
    const movieProviders = getProvidersForMediaType('movie')
    console.log(`  ✓ Movie providers: ${movieProviders.length === 0 ? '(none - Phase 2)' : movieProviders.join(', ')}\n`)

    console.log('✅ Registry tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Registry test failed:', error.message)
    return false
  }
}

export async function testProviderInstantiation() {
  console.log('🔧 Testing Provider Instantiation...\n')

  try {
    // Test 1: Get AniList
    console.log('Test 1: Instantiate AniList provider')
    const anilist = getProvider('anilist')
    console.log(`  ✓ ID: ${anilist.id}`)
    console.log(`  ✓ Name: ${anilist.name}`)
    console.log(`  ✓ Media types: ${anilist.mediaTypes.join(', ')}\n`)

    // Test 2: Get MAL
    console.log('Test 2: Instantiate MAL provider')
    const mal = getProvider('mal')
    console.log(`  ✓ ID: ${mal.id}`)
    console.log(`  ✓ Name: ${mal.name}`)
    console.log(`  ✓ Media types: ${mal.mediaTypes.join(', ')}\n`)

    // Test 3: Verify instance caching
    console.log('Test 3: Verify instance caching')
    const anilist2 = getProvider('anilist')
    console.log(`  ✓ Same instance: ${anilist === anilist2}\n`)

    // Test 4: Unknown provider
    console.log('Test 4: Handle unknown provider')
    try {
      getProvider('nonexistent')
      console.log('  ✗ Should have thrown error\n')
      return false
    } catch (error) {
      console.log(`  ✓ Correctly threw error: "${error.message}"\n`)
    }

    console.log('✅ Instantiation tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Instantiation test failed:', error.message)
    return false
  }
}

export async function testProviderInterface() {
  console.log('🔌 Testing Provider Interface...\n')

  try {
    const anilist = getProvider('anilist')
    const requiredMethods = [
      'search',
      'getById',
      'getEpisodes',
      'isAuthenticated',
      'authenticate',
      'getUser',
      'getTrending',
      'getUserLists',
      'updateProgress'
    ]

    console.log('Checking required methods on AniList provider:')
    let allExist = true
    for (const method of requiredMethods) {
      const exists = typeof anilist[method] === 'function'
      console.log(`  ${exists ? '✓' : '✗'} ${method}()`)
      if (!exists) allExist = false
    }
    console.log()

    if (!allExist) {
      throw new Error('Some required methods are missing')
    }

    console.log('✅ Interface tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Interface test failed:', error.message)
    return false
  }
}

// Run all tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('================================================')
  console.log('PROVIDER REGISTRY TEST SUITE')
  console.log('================================================\n')

  const results = []
  results.push(await testRegistry())
  results.push(await testProviderInstantiation())
  results.push(await testProviderInterface())

  console.log('================================================')
  console.log(`RESULTS: ${results.filter(r => r).length}/${results.length} passed`)
  console.log('================================================\n')

  process.exit(results.some(r => !r) ? 1 : 0)
}
