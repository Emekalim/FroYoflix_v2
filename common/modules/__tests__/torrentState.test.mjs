import assert from 'assert'
import { getTorrentState, getTorrentStateLabel } from '../torrentState.js'

console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║            TORRENT STATE UNIT TESTS                       ║')
console.log('╚════════════════════════════════════════════════════════════╝\n')

let passCount = 0
let failCount = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passCount++
  } catch (error) {
    console.error(`❌ ${name}`)
    console.error(`   ${error.message}`)
    failCount++
  }
}

test('current torrent reports playing', () => {
  assert.strictEqual(
    getTorrentState({ current: true, progress: 0.25 }, { current: true }),
    'playing'
  )
})

test('active staged torrent with transfer speed reports downloading', () => {
  assert.strictEqual(
    getTorrentState({ staging: true, progress: 0.4, downloadSpeed: 1024 }),
    'downloading'
  )
})

test('staged torrent without transfer speed reports queued', () => {
  assert.strictEqual(
    getTorrentState({ staging: true, progress: 0.4, downloadSpeed: 0, uploadSpeed: 0, eta: Infinity }),
    'queued'
  )
})

test('completed incomplete torrent reports paused', () => {
  assert.strictEqual(
    getTorrentState({ incomplete: true, missing_pieces: false }, { completed: true }),
    'paused'
  )
})

test('completed incomplete torrent with missing pieces reports missing_pieces', () => {
  assert.strictEqual(
    getTorrentState({ incomplete: true, missing_pieces: true }, { completed: true }),
    'missing_pieces'
  )
})

test('state labels use now playing override when requested', () => {
  assert.strictEqual(
    getTorrentStateLabel('playing', { currentLabel: 'Now Playing' }),
    'Now Playing'
  )
})

console.log(`\nPassed: ${passCount}`)
console.log(`Failed: ${failCount}`)

if (failCount > 0) process.exit(1)
