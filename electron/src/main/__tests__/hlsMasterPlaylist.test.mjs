import assert from 'node:assert/strict'

import { buildHlsMasterPlaylist } from '../hls-master-playlist.js'

{
  const master = buildHlsMasterPlaylist({
    videoUri: 'video.m3u8?file=%2Ftmp%2Fmovie.mkv'
  })

  assert.ok(master.includes('#EXTM3U'))
  assert.ok(master.includes('video.m3u8?file=%2Ftmp%2Fmovie.mkv'))
  assert.ok(!master.includes('#EXT-X-MEDIA:TYPE=AUDIO'))
}

{
  const master = buildHlsMasterPlaylist({
    videoUri: 'video.m3u8?file=%2Ftmp%2Fmovie.mkv',
    audioRenditions: [
      { uri: 'audio_0.m3u8?file=%2Ftmp%2Fmovie.mkv', name: 'English - Stereo', language: 'eng' },
      { uri: 'audio_1.m3u8?file=%2Ftmp%2Fmovie.mkv', name: 'Japanese - Stereo', language: 'jpn', isDefault: true }
    ]
  })

  assert.ok(master.includes('#EXT-X-MEDIA:TYPE=AUDIO'))
  assert.ok(master.includes('LANGUAGE="eng"'))
  assert.ok(master.includes('LANGUAGE="jpn"'))
  assert.ok(master.includes('DEFAULT=YES'))
  // only one default
  assert.equal((master.match(/DEFAULT=YES/g) || []).length, 1)
  assert.ok(master.includes('AUDIO="audio"'))
  assert.ok(master.includes('video.m3u8?file=%2Ftmp%2Fmovie.mkv'))
}

console.log('hls master playlist tests passed')

