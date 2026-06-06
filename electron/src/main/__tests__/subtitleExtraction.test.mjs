import assert from 'node:assert/strict'

import {
  buildSubtitleExtractionPlan,
  getTextSubtitleFormat,
  normalizeSubtitleLanguage
} from '../subtitle-extraction.js'

assert.equal(getTextSubtitleFormat('ass'), 'ass')
assert.equal(getTextSubtitleFormat('subrip'), 'srt')
assert.equal(getTextSubtitleFormat('hdmv_pgs_subtitle'), null)

assert.equal(normalizeSubtitleLanguage('en'), 'eng')
assert.equal(normalizeSubtitleLanguage('japanese'), 'jpn')
assert.equal(normalizeSubtitleLanguage(''), null)

const plan = buildSubtitleExtractionPlan({
  filePath: '/library/Movies/Dune (2021)/Dune (2021).mkv',
  streams: [
    {
      index: 2,
      codec_type: 'subtitle',
      codec_name: 'ass',
      tags: { language: 'eng', title: 'Signs & Songs' },
      disposition: { default: 1 }
    },
    {
      index: 3,
      codec_type: 'subtitle',
      codec_name: 'subrip',
      tags: { language: 'eng', title: 'Signs & Songs' },
      disposition: { forced: 1 }
    },
    {
      index: 4,
      codec_type: 'subtitle',
      codec_name: 'hdmv_pgs_subtitle',
      tags: { language: 'eng' },
      disposition: {}
    },
    {
      index: 5,
      codec_type: 'subtitle',
      codec_name: 'ass',
      tags: { language: 'eng', title: 'Signs & Songs' },
      disposition: { default: 1 }
    }
  ]
})

assert.equal(plan.length, 3)
assert.equal(plan[0].destinationPath, '/library/Movies/Dune (2021)/Subtitles/Dune (2021).eng.default.Signs.&.Songs.ass')
assert.equal(plan[1].destinationPath, '/library/Movies/Dune (2021)/Subtitles/Dune (2021).eng.forced.Signs.&.Songs.srt')
assert.equal(plan[2].destinationPath, '/library/Movies/Dune (2021)/Subtitles/Dune (2021).eng.default.Signs.&.Songs.2.ass')

console.log('subtitle extraction tests passed')
