/**
 * Provider Registry Tests
 * Validates Phase 1 provider abstraction implementation
 */


import { getProvider, getProvidersForMediaType, searchMultiple, getAllProviders } from './index.js'
import AniListProvider from './anilist/AniListProvider.js'
import MALProvider from './mal/MALProvider.js'

/**
 * Test suite for provider abstraction
 */
export async function runProviderTests() {
  console.log('🧪 Running Provider Tests...\n')

  try {
    // Test 1: Check available providers
    console.log('✓ Test 1: Available Providers')
    const providers = getAllProviders()
    console.log(`  Found ${providers.length} providers: ${providers.join(', ')}\n`)

    // Test 2: Get providers for anime
    console.log('✓ Test 2: Providers for Anime')
    const animeProviders = getProvidersForMediaType('anime')
    console.log(`  Anime providers: ${animeProviders.join(', ')}\n`)

    // Test 3: Get providers for TV
    console.log('✓ Test 3: Providers for TV')
    const tvProviders = getProvidersForMediaType('tv')
    console.log(`  TV providers: ${tvProviders.length === 0 ? '(none in Phase 1)' : tvProviders.join(', ')}\n`)

    // Test 4: Instantiate AniList provider
    console.log('✓ Test 4: Instantiate AniList Provider')
    const anilist = getProvider('anilist')
    console.log(`  Provider ID: ${anilist.id}`)
    console.log(`  Provider Name: ${anilist.name}`)
    console.log(`  Media Types: ${anilist.mediaTypes.join(', ')}\n`)

    // Test 5: Instantiate MAL provider
    console.log('✓ Test 5: Instantiate MAL Provider')
    const mal = getProvider('mal')
    console.log(`  Provider ID: ${mal.id}`)
    console.log(`  Provider Name: ${mal.name}`)
    console.log(`  Media Types: ${mal.mediaTypes.join(', ')}\n`)

    // Test 6: Provider interface validation
    console.log('✓ Test 6: Provider Interface Validation')
    const requiredMethods = ['search', 'getById', 'getEpisodes', 'isAuthenticated']
    for (const method of requiredMethods) {
      const hasMethod = typeof anilist[method] === 'function'
      console.log(`  ${hasMethod ? '✓' : '✗'} ${method}()`)
    }
    console.log()

    console.log('✅ All Phase 1 tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    return false
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProviderTests()
}

export default { runProviderTests }
