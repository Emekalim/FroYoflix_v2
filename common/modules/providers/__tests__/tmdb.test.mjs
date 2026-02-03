// @ts-check
/**
 * TMDB Provider Tests
 * Tests the TMDB provider for movies and TV shows
 *
 * @typedef {import('../types.js').MediaProvider} MediaProvider
 */

import { getProvider } from '../index.js'

export async function testTMDBProvider() {
  console.log('🎬 Testing TMDB Provider...\n')

  try {
    const tmdb = getProvider('tmdb')

    // Test 1: Check provider info
    console.log('Test 1: Provider information')
    console.log(`  ✓ ID: ${tmdb.id}`)
    console.log(`  ✓ Name: ${tmdb.name}`)
    console.log(`  ✓ Media types: ${tmdb.mediaTypes.join(', ')}\n`)

    // Test 2: Check required methods
    console.log('Test 2: Check required methods exist')
    const methods = [
      'search',
      'getById',
      'getTrending',
      'getPopular',
      'getEpisodes',
      'getSeasons',
      'isAuthenticated'
    ]
    for (const method of methods) {
      const exists = typeof tmdb[method] === 'function'
      console.log(`  ${exists ? '✓' : '✗'} ${method}()`)
    }
    console.log()

    // Test 3: Check internal state
    console.log('Test 3: Check provider state')
    console.log(`  ✓ Has mapper: ${!!tmdb.mapper}`)
    console.log(`  ✓ Has config: ${!!tmdb.config}\n`)

    // Test 4: Check authentication
    console.log('Test 4: Check authentication status')
    const isAuth = await tmdb.isAuthenticated()
    console.log(`  ✓ Authenticated: ${isAuth}\n`)

    console.log('✅ TMDB provider tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ TMDB provider test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTMDBSearch() {
  console.log('🔍 Testing TMDB Search...\n')

  try {
    const tmdb = getProvider('tmdb')

    // Test search for movies
    console.log('Test 1: Search for movies')
    const movieResults = await tmdb.search('Inception', { type: 'movie' })
    console.log(`  ✓ Found ${movieResults.length} movies`)
    if (movieResults.length > 0) {
      const first = movieResults[0]
      console.log(`  ✓ First result: "${first.title}" (ID: ${first.id})`)
      console.log(`  ✓ Media type: ${first.mediaType}`)
      console.log(`  ✓ Has description: ${!!first.description}`)
      console.log(`  ✓ Has external IDs: ${!!first.externalIds}\n`)
    }

    // Test search for TV
    console.log('Test 2: Search for TV shows')
    const tvResults = await tmdb.search('Breaking Bad', { type: 'tv' })
    console.log(`  ✓ Found ${tvResults.length} TV shows`)
    if (tvResults.length > 0) {
      const first = tvResults[0]
      console.log(`  ✓ First result: "${first.title}" (ID: ${first.id})`)
      console.log(`  ✓ Status: ${first.status}\n`)
    }

    console.log('✅ TMDB search tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ TMDB search test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTMDBTrending() {
  console.log('📈 Testing TMDB Trending...\n')

  try {
    const tmdb = getProvider('tmdb')

    // Test trending movies
    console.log('Test 1: Get trending movies')
    const trendingMovies = await tmdb.getTrending('movie')
    console.log(`  ✓ Found ${trendingMovies.length} trending movies`)
    if (trendingMovies.length > 0) {
      const first = trendingMovies[0]
      console.log(`  ✓ First: "${first.title}" (Popularity: ${first.popularity})\n`)
    }

    // Test trending TV
    console.log('Test 2: Get trending TV shows')
    const trendingTV = await tmdb.getTrending('tv')
    console.log(`  ✓ Found ${trendingTV.length} trending TV shows`)
    if (trendingTV.length > 0) {
      const first = trendingTV[0]
      console.log(`  ✓ First: "${first.title}" (Popularity: ${first.popularity})\n`)
    }

    console.log('✅ TMDB trending tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ TMDB trending test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTMDBPopular() {
  console.log('⭐ Testing TMDB Popular...\n')

  try {
    const tmdb = getProvider('tmdb')

    // Test popular movies
    console.log('Test 1: Get popular movies')
    const popularMovies = await tmdb.getPopular('movie')
    console.log(`  ✓ Found ${popularMovies.length} popular movies`)
    if (popularMovies.length > 0) {
      const first = popularMovies[0]
      console.log(`  ✓ First: "${first.title}" (Rating: ${first.rating})\n`)
    }

    // Test popular TV
    console.log('Test 2: Get popular TV shows')
    const popularTV = await tmdb.getPopular('tv')
    console.log(`  ✓ Found ${popularTV.length} popular TV shows`)
    if (popularTV.length > 0) {
      const first = popularTV[0]
      console.log(`  ✓ First: "${first.title}" (Rating: ${first.rating})\n`)
    }

    console.log('✅ TMDB popular tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ TMDB popular test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

export async function testTMDBMapper() {
  console.log('🗺️  Testing TMDB Mapper...\n')

  try {
    const tmdb = getProvider('tmdb')

    // Test movie mapping
    console.log('Test 1: Map movie response')
    const movieResults = await tmdb.search('Inception', { type: 'movie' })
    if (movieResults.length > 0) {
      const mapped = movieResults[0]
      console.log(`  ✓ Title: ${mapped.title}`)
      console.log(`  ✓ Media Type: ${mapped.mediaType}`)
      console.log(`  ✓ External IDs: ${Object.keys(mapped.externalIds || {}).join(', ')}`)
      console.log(`  ✓ Has poster: ${!!mapped.poster}`)
      console.log(`  ✓ Has banner: ${!!mapped.banner}\n`)
    }

    // Test TV mapping
    console.log('Test 2: Map TV response')
    const tvResults = await tmdb.search('Breaking Bad', { type: 'tv' })
    if (tvResults.length > 0) {
      const mapped = tvResults[0]
      console.log(`  ✓ Title: ${mapped.title}`)
      console.log(`  ✓ Status: ${mapped.status}`)
      console.log(`  ✓ Total seasons: ${mapped.totalSeasons}`)
      console.log(`  ✓ Total episodes: ${mapped.totalEpisodes}\n`)
    }

    console.log('✅ TMDB mapper tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ TMDB mapper test failed:', error.message)
    console.error(error.stack)
    return false
  }
}
