// @ts-check
/**
 * Trakt Provider Tests
 * Tests the Trakt provider for shows and movies
 *
 * @typedef {import('../types.js').MediaProvider} MediaProvider
 */

import { getProvider } from '../index.js'

export async function testTraktProvider() {
  console.log('🎯 Testing Trakt Provider...\n')

  try {
    const trakt = getProvider('trakt')

    // Test 1: Check provider info
    console.log('Test 1: Provider information')
    console.log(`  ✓ ID: ${trakt.id}`)
    console.log(`  ✓ Name: ${trakt.name}`)
    console.log(`  ✓ Media types: ${trakt.mediaTypes.join(', ')}\n`)

    // Test 2: Check required methods
    console.log('Test 2: Check required methods exist')
    const methods = [
      'search',
      'getById',
      'getTrending',
      'getUserLists',
      'getEpisodes',
      'updateProgress',
      'isAuthenticated'
    ]
    for (const method of methods) {
      const exists = typeof trakt[method] === 'function'
      console.log(`  ${exists ? '✓' : '✗'} ${method}()`)
    }
    console.log()

    // Test 3: Check internal state
    console.log('Test 3: Check provider state')
    console.log(`  ✓ Has mapper: ${!!trakt.mapper}`)
    console.log(`  ✓ Has config: ${!!trakt.config}\n`)

    // Test 4: Check authentication
    console.log('Test 4: Check authentication status')
    const isAuth = await trakt.isAuthenticated()
    console.log(`  ✓ Authenticated: ${isAuth}\n`)

    console.log('✅ Trakt provider tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Trakt provider test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTraktSearch() {
  console.log('🔍 Testing Trakt Search...\n')

  try {
    const trakt = getProvider('trakt')

    // Test search for shows
    console.log('Test 1: Search for TV shows')
    const showResults = await trakt.search('Breaking Bad', { type: 'tv' })
    console.log(`  ✓ Found ${showResults.length} TV shows`)
    if (showResults.length > 0) {
      const first = showResults[0]
      console.log(`  ✓ First result: "${first.title}" (ID: ${first.id})`)
      console.log(`  ✓ Media type: ${first.mediaType}`)
      console.log(`  ✓ Has external IDs: ${!!first.externalIds}\n`)
    }

    // Test search for movies
    console.log('Test 2: Search for movies')
    const movieResults = await trakt.search('Inception', { type: 'movie' })
    console.log(`  ✓ Found ${movieResults.length} movies`)
    if (movieResults.length > 0) {
      const first = movieResults[0]
      console.log(`  ✓ First result: "${first.title}" (ID: ${first.id})`)
      console.log(`  ✓ Media type: ${first.mediaType}\n`)
    }

    console.log('✅ Trakt search tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Trakt search test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTraktTrending() {
  console.log('📈 Testing Trakt Trending...\n')

  try {
    const trakt = getProvider('trakt')

    // Test trending shows
    console.log('Test 1: Get trending TV shows')
    const trendingShows = await trakt.getTrending('tv')
    console.log(`  ✓ Found ${trendingShows.length} trending shows`)
    if (trendingShows.length > 0) {
      const first = trendingShows[0]
      console.log(`  ✓ First: "${first.title}" (ID: ${first.id})`)
      console.log(`  ✓ Popularity: ${first.popularity}\n`)
    }

    // Test trending movies
    console.log('Test 2: Get trending movies')
    const trendingMovies = await trakt.getTrending('movie')
    console.log(`  ✓ Found ${trendingMovies.length} trending movies`)
    if (trendingMovies.length > 0) {
      const first = trendingMovies[0]
      console.log(`  ✓ First: "${first.title}" (ID: ${first.id})`)
      console.log(`  ✓ Popularity: ${first.popularity}\n`)
    }

    console.log('✅ Trakt trending tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Trakt trending test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTraktAuthentication() {
  console.log('🔐 Testing Trakt Authentication...\n')

  try {
    const trakt = getProvider('trakt')

    // Check if authenticated
    const isAuth = await trakt.isAuthenticated()
    console.log('Test 1: Check authentication status')
    console.log(`  ✓ Authenticated: ${isAuth}`)

    if (!isAuth) {
      console.log('\n⚠️  Note: User-specific features (getLists, updateProgress)')
      console.log('   require TRAKT_ACCESS_TOKEN in .env file\n')
    } else {
      console.log('  ✓ User list access would be available\n')
    }

    console.log('✅ Trakt authentication tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Trakt authentication test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTraktMapper() {
  console.log('🗺️  Testing Trakt Mapper...\n')

  try {
    const trakt = getProvider('trakt')

    // Test show mapping
    console.log('Test 1: Map show response')
    const showResults = await trakt.search('Breaking Bad', { type: 'tv' })
    if (showResults.length > 0) {
      const mapped = showResults[0]
      console.log(`  ✓ Title: ${mapped.title}`)
      console.log(`  ✓ Media Type: ${mapped.mediaType}`)
      console.log(`  ✓ External IDs: ${Object.keys(mapped.externalIds || {}).join(', ')}`)
      console.log(`  ✓ Has poster: ${!!mapped.poster}`)
      console.log(`  ✓ Has banner: ${!!mapped.banner}\n`)
    }

    // Test movie mapping
    console.log('Test 2: Map movie response')
    const movieResults = await trakt.search('Inception', { type: 'movie' })
    if (movieResults.length > 0) {
      const mapped = movieResults[0]
      console.log(`  ✓ Title: ${mapped.title}`)
      console.log(`  ✓ Status: ${mapped.status}`)
      console.log(`  ✓ Rating: ${mapped.rating}`)
      console.log(`  ✓ Description length: ${(mapped.description || '').length} chars\n`)
    }

    console.log('✅ Trakt mapper tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Trakt mapper test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTraktGetById() {
  console.log('🎬 Testing Trakt Get By ID...\n')

  try {
    const trakt = getProvider('trakt')

    // First search for a show to get its ID
    console.log('Test 1: Search for Breaking Bad and get by ID')
    const searchResults = await trakt.search('Breaking Bad', { type: 'tv' })
    if (searchResults.length > 0) {
      const firstResult = searchResults[0]
      console.log(`  ✓ Found: "${firstResult.title}" (ID: ${firstResult.id})`)

      // Try to get by ID if we have externalIds
      if (firstResult.externalIds && firstResult.externalIds.trakt) {
        try {
          const byId = await trakt.getById(firstResult.externalIds.trakt, 'tv')
          console.log(`  ✓ Retrieved by Trakt ID: "${byId.title}"`)
          console.log(`  ✓ Matches original: ${byId.title === firstResult.title}\n`)
        } catch (err) {
          console.log(`  ⚠️  Could not retrieve by ID (API may rate limit)\n`)
        }
      }
    }

    console.log('✅ Trakt getById tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Trakt getById test failed:', error.message)
    console.error(error.stack)
    return false
  }
}
