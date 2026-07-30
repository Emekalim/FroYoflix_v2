import assert from 'assert'
import { getBuiltInTrackersForMediaType, supportsBuiltInMediaType } from '../registry.js'

export async function testTrackerSelection() {
  assert.deepStrictEqual(getBuiltInTrackersForMediaType('anime').map(tracker => tracker.id), ['nyaa'])
  assert.deepStrictEqual(getBuiltInTrackersForMediaType('animeMovie').map(tracker => tracker.id), ['nyaa', 'yts'])
  assert.deepStrictEqual(getBuiltInTrackersForMediaType('movie').map(tracker => tracker.id), ['yts', '1337x'])
  assert.deepStrictEqual(getBuiltInTrackersForMediaType('tv').map(tracker => tracker.id), ['showrss', '1337x'])
  assert.strictEqual(supportsBuiltInMediaType('movie'), true)
  assert.strictEqual(supportsBuiltInMediaType('unknown'), false)
  return true
}
