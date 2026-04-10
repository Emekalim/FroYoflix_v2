import {
  testUtilityParsing,
  testNyaaParsing,
  testNyaaBatchDoesNotFallbackToSingles,
  testNyaaBatchParsesBatchResults,
  testNyaaSingleSkipsBatchResults,
  test1337xParsing,
  testYtsParsing,
  testEztvParsing,
  testTorrentDownloadsParsing,
  testShowRssParsing
} from './parsers.test.mjs'

async function runTest(name, fn) {
  try {
    await fn()
    console.log(`✅ ${name}`)
    return true
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('\nElectron Search Engine Parser Tests\n')
  const tests = [
    ['Utility parsing', testUtilityParsing],
    ['Nyaa parser', testNyaaParsing],
    ['Nyaa batch does not fallback to singles', testNyaaBatchDoesNotFallbackToSingles],
    ['Nyaa batch parser', testNyaaBatchParsesBatchResults],
    ['Nyaa single skips batch results', testNyaaSingleSkipsBatchResults],
    ['1337x parser', test1337xParsing],
    ['YTS parser', testYtsParsing],
    ['EZTV parser', testEztvParsing],
    ['Torrent Downloads parser', testTorrentDownloadsParsing],
    ['showRSS parser', testShowRssParsing]
  ]

  let passed = 0
  for (const [name, fn] of tests) {
    if (await runTest(name, fn)) passed++
  }

  console.log(`\nPassed ${passed}/${tests.length} tests\n`)
  process.exit(passed === tests.length ? 0 : 1)
}

main()
