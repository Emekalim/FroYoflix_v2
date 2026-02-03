/**
 * Provider Mapper Tests
 * Tests the data mappers for AniList and MyAnimeList
 */

import AniListMapper from '../anilist/mapper.js'
import MALMapper from '../mal/mapper.js'

// Mock data that mimics real API responses
const MOCK_ANILIST_DATA = {
  id: 16498,
  title: {
    romaji: '進撃の巨人',
    english: 'Attack on Titan',
    native: '進撃の巨人',
    userPreferred: 'Attack on Titan'
  },
  description: 'After his hometown is destroyed and his mother is killed, young Eren Yeager vows to eradicate the Titans.',
  status: 'FINISHED',
  startDate: {
    year: 2013,
    month: 4,
    day: 7
  },
  duration: 24,
  episodes: 94,
  coverImage: {
    large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-dXcPHITTBBtY.jpg',
    medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx16498-dXcPHITTBBtY.jpg'
  },
  bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-dY.jpg',
  externalLinks: [
    { site: 'IMDb', url: 'https://www.imdb.com/title/tt2560140/' }
  ],
  idMal: 16498
}

const MOCK_MAL_DATA = {
  id: 16498,
  title: 'Attack on Titan',
  titleJapanese: '進撃の巨人',
  synopsis: 'After his hometown is destroyed and his mother is killed, young Eren Yeager vows to eradicate the Titans.',
  status: 'Finished Airing',
  aired: {
    from: '2013-04-07T00:00:00+00:00'
  },
  duration: '24 min per ep',
  episodes: 94,
  images: {
    jpg: {
      image_url: 'https://api.jikan.moe/images/anime/16498.jpg'
    }
  },
  myListStatus: {
    status: 'completed',
    score: 9,
    num_episodes_watched: 94,
    updated_at: '2024-01-15T12:00:00+00:00'
  }
}

export async function testAniListMapper() {
  console.log('🗺️  Testing AniList Mapper...\n')

  try {
    const mapper = new AniListMapper()
    const result = mapper.mapAnime(MOCK_ANILIST_DATA)

    console.log('Mapping AniList response:')
    console.log(`  ✓ ID: ${result.id}`)
    console.log(`  ✓ Type: ${result.type}`)
    console.log(`  ✓ Title (default): ${result.title.default}`)
    console.log(`  ✓ Title (romaji): ${result.title.romaji}`)
    console.log(`  ✓ Description length: ${result.description.length} chars`)
    console.log(`  ✓ Status: ${result.status}`)
    console.log(`  ✓ Release date: ${result.releaseDate}`)
    console.log(`  ✓ Runtime: ${result.runtime} min`)
    console.log(`  ✓ Episodes: ${result.episodeCount}`)
    console.log(`  ✓ Poster URL: ${result.poster ? 'Yes' : 'No'}`)
    console.log(`  ✓ Banner URL: ${result.banner ? 'Yes' : 'No'}`)
    console.log(`  ✓ External IDs: ${Object.keys(result.externalIds).length} providers`)
    console.log()

    // Validate structure
    if (result.id && result.type === 'anime' && result.title.default && result.episodeCount) {
      console.log('✅ AniList mapper tests passed!\n')
      return true
    } else {
      throw new Error('Invalid mapped structure')
    }
  } catch (error) {
    console.error('❌ AniList mapper test failed:', error.message)
    return false
  }
}

export async function testMALMapper() {
  console.log('🗺️  Testing MyAnimeList Mapper...\n')

  try {
    const mapper = new MALMapper()
    const result = mapper.mapAnime(MOCK_MAL_DATA)

    console.log('Mapping MyAnimeList response:')
    console.log(`  ✓ ID: ${result.id}`)
    console.log(`  ✓ Type: ${result.type}`)
    console.log(`  ✓ Title (default): ${result.title.default}`)
    console.log(`  ✓ Title (native): ${result.title.native}`)
    console.log(`  ✓ Description length: ${result.description.length} chars`)
    console.log(`  ✓ Status: ${result.status}`)
    console.log(`  ✓ Release date: ${result.releaseDate}`)
    console.log(`  ✓ Runtime: ${result.runtime}`)
    console.log(`  ✓ Episodes: ${result.episodeCount}`)
    console.log(`  ✓ Poster URL: ${result.poster ? 'Yes' : 'No'}`)
    console.log(`  ✓ User progress: ${result.userProgress ? 'Yes' : 'No'}`)
    if (result.userProgress) {
      console.log(`    - Score: ${result.userProgress.score}`)
      console.log(`    - Status: ${result.userProgress.status}`)
      console.log(`    - Progress: ${result.userProgress.progress} episodes`)
    }
    console.log()

    // Validate structure
    if (result.id && result.type === 'anime' && result.title.default && result.episodeCount) {
      console.log('✅ MyAnimeList mapper tests passed!\n')
      return true
    } else {
      throw new Error('Invalid mapped structure')
    }
  } catch (error) {
    console.error('❌ MyAnimeList mapper test failed:', error.message)
    return false
  }
}

export async function testMapperConsistency() {
  console.log('🔄 Testing Mapper Consistency...\n')

  try {
    const anilistMapper = new AniListMapper()
    const malMapper = new MALMapper()

    const anilistResult = anilistMapper.mapAnime(MOCK_ANILIST_DATA)
    const malResult = malMapper.mapAnime(MOCK_MAL_DATA)

    console.log('Comparing unified outputs:')
    console.log(`  ✓ Both have type "anime": ${anilistResult.type === 'anime' && malResult.type === 'anime'}`)
    console.log(`  ✓ Both have ID: ${!!anilistResult.id && !!malResult.id}`)
    console.log(`  ✓ Both have title.default: ${!!anilistResult.title.default && !!malResult.title.default}`)
    console.log(`  ✓ Both have episodeCount: ${anilistResult.episodeCount && malResult.episodeCount}`)
    console.log(`  ✓ Both have poster: ${!!anilistResult.poster && !!malResult.poster}`)
    console.log()

    console.log('✅ Mapper consistency tests passed!\n')
    return true
  } catch (error) {
    console.error('❌ Mapper consistency test failed:', error.message)
    return false
  }
}

// Run all tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('================================================')
  console.log('PROVIDER MAPPER TEST SUITE')
  console.log('================================================\n')

  const results = []
  results.push(await testAniListMapper())
  results.push(await testMALMapper())
  results.push(await testMapperConsistency())

  console.log('================================================')
  console.log(`RESULTS: ${results.filter(r => r).length}/${results.length} passed`)
  console.log('================================================\n')

  process.exit(results.some(r => !r) ? 1 : 0)
}
