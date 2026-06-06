import assert from 'node:assert'
import {
  sanitizeSegment,
  zeroPad,
  getMovieFolderName,
  getEpisodeToken,
  getSeasonFolder,
  buildCanonicalPaths
} from '../pathSanitizer.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passed++
  } catch (error) {
    console.error(`❌ ${name}`)
    console.error(`   ${error.message}`)
    failed++
  }
}

console.log('Library path sanitizer tests\n')

test('sanitizeSegment removes illegal path characters', () => {
  assert.strictEqual(sanitizeSegment('Movie: Name?/<>*'), 'Movie Name')
})

test('zeroPad pads season and episode numbers', () => {
  assert.strictEqual(zeroPad(1), '01')
  assert.strictEqual(zeroPad(12), '12')
})

test('getMovieFolderName includes year when available', () => {
  assert.strictEqual(
    getMovieFolderName({ title: { userPreferred: 'Arrival' }, releaseYear: 2016 }),
    'Arrival (2016)'
  )
})

test('getEpisodeToken supports single episodes', () => {
  assert.strictEqual(getEpisodeToken(3), 'E03')
})

test('getEpisodeToken supports episode ranges', () => {
  assert.strictEqual(getEpisodeToken(null, { first: 1, last: 2 }), 'E01-E02')
})

test('getSeasonFolder zero-pads seasons', () => {
  assert.strictEqual(getSeasonFolder(1), 'Season 01')
})

test('buildCanonicalPaths creates movie subtitle folders', () => {
  const result = buildCanonicalPaths({
    rootPath: '/library',
    media: { title: { userPreferred: 'Dune' }, releaseYear: 2021 },
    mediaType: 'movie',
    extension: 'mkv',
    subtitleExtension: 'srt',
    language: 'eng'
  })

  assert.strictEqual(result.videoPath, '/library/Movies/Dune (2021)/Dune (2021).mkv')
  assert.strictEqual(result.subtitlePath, '/library/Movies/Dune (2021)/Subtitles/Dune (2021).eng.srt')
})

test('buildCanonicalPaths creates show season subtitle folders', () => {
  const result = buildCanonicalPaths({
    rootPath: '/library',
    media: { title: { userPreferred: 'Severance' } },
    mediaType: 'tv',
    season: 1,
    episode: 4,
    extension: 'mp4',
    subtitleExtension: 'ass',
    language: 'en'
  })

  assert.strictEqual(result.videoPath, '/library/Shows/Severance/Season 01/Severance - S01E04.mp4')
  assert.strictEqual(result.subtitlePath, '/library/Shows/Severance/Season 01/Subtitles/Severance - S01E04.en.ass')
})

console.log(`\nPassed: ${passed}`)
console.log(`Failed: ${failed}`)

if (failed > 0) process.exit(1)
