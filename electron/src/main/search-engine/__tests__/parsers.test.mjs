import assert from 'assert'
import { parseHumanSize, parseLooseDate, magnetHash, ensureTorrentIdentifier } from '../utils.js'
import { nyaaAdapter } from '../adapters/nyaa.js'
import { x1337Adapter } from '../adapters/1337x.js'
import { ytsAdapter } from '../adapters/yts.js'
import { eztvAdapter } from '../adapters/eztv.js'
import { torrentDownloadsAdapter } from '../adapters/torrentdownloads.js'
import { showRssAdapter } from '../adapters/showrss.js'

const originalFetch = global.fetch

function mockFetchOnce(htmlByUrl) {
  global.fetch = async (url) => {
    const key = String(url)
    if (!(key in htmlByUrl)) {
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' }
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => htmlByUrl[key]
    }
  }
}

export async function testUtilityParsing() {
  assert.strictEqual(parseHumanSize('1.4 GiB') > 1_000_000_000, true)
  assert.strictEqual(magnetHash('magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12'), 'abcdef1234567890abcdef1234567890abcdef12')
  assert.strictEqual(typeof parseLooseDate('2 days ago'), 'string')
  assert.strictEqual(ensureTorrentIdentifier('/download/1.torrent', 'abcdef1234567890', 'Test Release'), '')
  assert(ensureTorrentIdentifier('/download/1.torrent', 'abcdef1234567890abcdef1234567890abcdef12', 'Test Release').startsWith('magnet:?'))
  return true
}

export async function testNyaaParsing() {
  mockFetchOnce({
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%2001': `
      <html><body><table><tbody></tbody></table></body></html>
    `,
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20-%2001': `
      <html><body><table><tbody></tbody></table></body></html>
    `,
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%2001%201080p': `
      <html><body><table><tbody>
        <tr>
          <td><a title="Anime">Anime</a></td>
          <td><a href="/view/1#comments">Comments</a><a href="/view/1">[SubsPlease] Frieren - 01 (1080p)</a></td>
          <td class="text-center"><a href="/download/1.torrent">Torrent</a><a href="magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12&dn=test">Magnet</a></td>
          <td>1.4 GiB</td>
          <td data-timestamp="1700000000">2023-11-14 10:00</td>
          <td>25</td>
          <td>3</td>
          <td>710</td>
        </tr>
      </tbody></table></body></html>
    `,
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20-%2001%201080p': `
      <html><body><table><tbody></tbody></table></body></html>
    `
  })

  const results = await nyaaAdapter.searchSingle({
    titles: ['Frieren'],
    episode: 1,
    resolution: '1080',
    variants: { single: ['Frieren 01 1080p'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].hash, 'abcdef1234567890abcdef1234567890abcdef12')
  assert.strictEqual(results[0].seeders, 25)
  return true
}

export async function testNyaaBatchDoesNotFallbackToSingles() {
  mockFetchOnce({
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20batch': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20complete': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20%E5%85%A8%E9%9B%86': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20%E5%90%88%E9%9B%86': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20batch%201080p': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20complete%201080p': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20%E5%85%A8%E9%9B%86%201080p': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20%E5%90%88%E9%9B%86%201080p': '<html><body><table><tbody></tbody></table></body></html>'
  })

  const results = await nyaaAdapter.searchBatch({
    titles: ['Frieren'],
    episode: 1,
    resolution: '1080',
    variants: {
      batch: ['Frieren batch 1080p'],
      single: ['Frieren 01 1080p']
    },
    variantPlan: {
      batch: [
        { stageMode: 'batch', terms: ['Frieren batch', 'Frieren complete', 'Frieren 全集', 'Frieren 合集'] },
        { stageMode: 'batch', terms: ['Frieren batch 1080p', 'Frieren complete 1080p', 'Frieren 全集 1080p', 'Frieren 合集 1080p'] }
      ]
    }
  })

  assert.strictEqual(results.length, 0)
  return true
}

export async function testNyaaBatchParsesBatchResults() {
  mockFetchOnce({
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20batch': `
      <html><body><table><tbody>
        <tr>
          <td><a title="Anime">Anime</a></td>
          <td><a href="/view/2#comments">Comments</a><a href="/view/2">[Group] Frieren Complete Batch (1080p)</a></td>
          <td class="text-center"><a href="/download/2.torrent">Torrent</a><a href="magnet:?xt=urn:btih:feedface12345678feedface12345678feedface&dn=test">Magnet</a></td>
          <td>12.2 GiB</td>
          <td data-timestamp="1700000200">2023-11-14 10:00</td>
          <td>19</td>
          <td>4</td>
          <td>700</td>
        </tr>
      </tbody></table></body></html>
    `
  })

  const results = await nyaaAdapter.searchBatch({
    titles: ['Frieren'],
    episode: 1,
    resolution: '1080',
    variants: {
      batch: ['Frieren batch 1080p'],
      single: ['Frieren 01 1080p']
    },
    variantPlan: {
      batch: [
        { stageMode: 'batch', terms: ['Frieren batch'] }
      ]
    }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].hash, 'feedface12345678feedface12345678feedface')
  assert.strictEqual(results[0].type, 'batch')
  return true
}

export async function testNyaaSingleSkipsBatchResults() {
  mockFetchOnce({
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%2001': '<html><body><table><tbody></tbody></table></body></html>',
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20-%2001': `
      <html><body><table><tbody></tbody></table></body></html>
    `,
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%2001%201080p': `
      <html><body><table><tbody>
        <tr>
          <td><a title="Anime">Anime</a></td>
          <td><a href="/view/3#comments">Comments</a><a href="/view/3">[Group] Frieren Complete Batch (1080p)</a></td>
          <td class="text-center"><a href="/download/3.torrent">Torrent</a><a href="magnet:?xt=urn:btih:deadbeef12345678deadbeef12345678deadbeef&dn=test">Magnet</a></td>
          <td>9.9 GiB</td>
          <td data-timestamp="1700000300">2023-11-14 10:00</td>
          <td>200</td>
          <td>10</td>
          <td>900</td>
        </tr>
        <tr>
          <td><a title="Anime">Anime</a></td>
          <td><a href="/view/4#comments">Comments</a><a href="/view/4">[SubsPlease] Frieren - 01 (1080p)</a></td>
          <td class="text-center"><a href="/download/4.torrent">Torrent</a><a href="magnet:?xt=urn:btih:facefeed12345678facefeed12345678facefeed&dn=test">Magnet</a></td>
          <td>1.3 GiB</td>
          <td data-timestamp="1700000400">2023-11-14 10:00</td>
          <td>80</td>
          <td>5</td>
          <td>800</td>
        </tr>
      </tbody></table></body></html>
    `,
    'https://nyaa.si/?f=0&c=1_0&q=Frieren%20-%2001%201080p': `
      <html><body><table><tbody>
        <tr>
          <td><a title="Anime">Anime</a></td>
          <td><a href="/view/3#comments">Comments</a><a href="/view/3">[Group] Frieren Complete Batch (1080p)</a></td>
          <td class="text-center"><a href="/download/3.torrent">Torrent</a><a href="magnet:?xt=urn:btih:deadbeef12345678deadbeef12345678deadbeef&dn=test">Magnet</a></td>
          <td>9.9 GiB</td>
          <td data-timestamp="1700000300">2023-11-14 10:00</td>
          <td>200</td>
          <td>10</td>
          <td>900</td>
        </tr>
        <tr>
          <td><a title="Anime">Anime</a></td>
          <td><a href="/view/4#comments">Comments</a><a href="/view/4">[SubsPlease] Frieren - 01 (1080p)</a></td>
          <td class="text-center"><a href="/download/4.torrent">Torrent</a><a href="magnet:?xt=urn:btih:facefeed12345678facefeed12345678facefeed&dn=test">Magnet</a></td>
          <td>1.3 GiB</td>
          <td data-timestamp="1700000400">2023-11-14 10:00</td>
          <td>80</td>
          <td>5</td>
          <td>800</td>
        </tr>
      </tbody></table></body></html>
    `
  })

  const results = await nyaaAdapter.searchSingle({
    titles: ['Frieren'],
    episode: 1,
    resolution: '1080',
    variants: { single: ['Frieren 01 1080p'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].hash, 'facefeed12345678facefeed12345678facefeed')
  return true
}

export async function test1337xParsing() {
  mockFetchOnce({
    'https://www.1337xx.to/category-search/Dune%202021%201080p/Movies/1/': `
      <html><body><table><tbody>
        <tr>
          <td class="name"><a href="/cat/movies">Movies</a><a href="/torrent/999/black-panther">Black Panther 2021 1080p BluRay</a></td>
          <td>1</td><td>2</td><td>3</td><td>4</td>
          <td>5000</td>
          <td>100</td>
        </tr>
        <tr>
          <td class="name"><a href="/cat/movies">Movies</a><a href="/torrent/123/dune">Dune 2021 1080p BluRay</a></td>
          <td>1</td><td>2</td><td>3</td><td>4</td>
          <td>50</td>
          <td>10</td>
        </tr>
      </tbody></table></body></html>
    `,
    'https://www.1337xx.to/torrent/123/dune': `
      <html><body>
        <div class="clearfix">
          <ul>
            <li><a href="magnet:?xt=urn:btih:1234abcd5678ef901234abcd5678ef901234abcd&dn=dune">Magnet</a></li>
            <li><span>Movies</span></li>
            <li><span>HD</span></li>
            <li><span>English</span></li>
            <li><span>2.0 GB</span></li>
            <li><span>Uploader</span></li>
            <li><span>500</span></li>
            <li><span>Yesterday</span></li>
            <li><span>2024-01-01</span></li>
            <li><span>90</span></li>
            <li><span>11</span></li>
          </ul>
        </div>
      </body></html>
    `
  })

  const results = await x1337Adapter.searchMovie({
    titles: ['Dune'],
    mediaType: 'movie',
    year: 2021,
    resolution: '1080',
    variants: { movie: ['Dune 2021 1080p'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].title, 'Dune 2021 1080p BluRay')
  assert.strictEqual(results[0].hash, '1234abcd5678ef901234abcd5678ef901234abcd')
  assert.strictEqual(results[0].seeders, 90)
  return true
}

export async function test1337xTvSingleRejectsWrongEpisodeRows() {
  mockFetchOnce({
    'https://www.1337xx.to/category-search/Rick%20and%20Morty%20S01E03/TV/1/': `
      <html><body><table><tbody>
        <tr>
          <td class="name"><a href="/cat/tv">TV</a><a href="/torrent/999/rick-s09e07">Rick.and.Morty.S09E07.1080p.WEBRip.x265</a></td>
          <td>1</td><td>2</td><td>3</td><td>4</td>
          <td>4256</td>
          <td>100</td>
        </tr>
        <tr>
          <td class="name"><a href="/cat/tv">TV</a><a href="/torrent/123/rick-s01e03">Rick.and.Morty.S01E03.Anatomy.Park.1080p.WEB-DL</a></td>
          <td>1</td><td>2</td><td>3</td><td>4</td>
          <td>25</td>
          <td>3</td>
        </tr>
      </tbody></table></body></html>
    `,
    'https://www.1337xx.to/torrent/123/rick-s01e03': `
      <html><body>
        <div class="clearfix">
          <ul>
            <li><a href="magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12&dn=rick">Magnet</a></li>
            <li><span>TV</span></li>
            <li><span>HD</span></li>
            <li><span>English</span></li>
            <li><span>1.0 GB</span></li>
            <li><span>Uploader</span></li>
            <li><span>10</span></li>
            <li><span>Yesterday</span></li>
            <li><span>2024-01-01</span></li>
            <li><span>25</span></li>
            <li><span>3</span></li>
          </ul>
        </div>
      </body></html>
    `
  })

  const results = await x1337Adapter.searchSingle({
    titles: ['Rick and Morty'],
    mediaType: 'tv',
    season: 1,
    episode: 3,
    resolution: '1080',
    variants: { single: ['Rick and Morty S01E03'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].title, 'Rick.and.Morty.S01E03.Anatomy.Park.1080p.WEB-DL')
  assert.strictEqual(results[0].hash, 'abcdef1234567890abcdef1234567890abcdef12')
  return true
}

export async function testYtsParsing() {
  mockFetchOnce({
    'https://movies-api.accel.li/api/v2/list_movies.json?limit=50&sort_by=date_added&order_by=desc&query_term=tt1160419': JSON.stringify({
      status: 'ok',
      data: {
        movies: [
          {
            imdb_code: 'tt0000001',
            title: 'Black Panther',
            title_english: 'Black Panther',
            title_long: 'Black Panther (2021)',
            year: 2021,
            torrents: [{ url: 'https://yts.invalid/bp', hash: 'bbbbccccbbbbccccbbbbccccbbbbccccbbbbcccc', quality: '1080p', type: 'web', video_codec: 'x264', audio_channels: '5.1', seeds: 999, peers: 2, size_bytes: 1_000, date_uploaded_unix: 1710000000 }]
          },
          {
            imdb_code: 'tt1160419',
            title: 'Dune',
            title_english: 'Dune',
            title_long: 'Dune (2021)',
            year: 2021,
            torrents: [{ url: 'https://yts.invalid/dune', hash: 'abcd1234abcd1234abcd1234abcd1234abcd1234', quality: '1080p', type: 'bluray', video_codec: 'x264', audio_channels: '5.1', seeds: 50, peers: 10, size_bytes: 2_000, date_uploaded_unix: 1710000001 }]
          }
        ]
      }
    })
  })

  const results = await ytsAdapter.searchMovie({
    mediaType: 'movie',
    ids: { imdb: 'tt1160419' },
    titles: ['Dune'],
    year: 2021,
    resolution: '1080',
    variants: { movie: ['Dune 2021 1080p'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].hash, 'abcd1234abcd1234abcd1234abcd1234abcd1234')
  assert.strictEqual(results[0].source.name, 'YTS')
  assert(results[0].link.startsWith('magnet:?'))
  return true
}

export async function testEztvParsing() {
  mockFetchOnce({
    'https://eztv.proxyninja.net/api/get-torrents?imdb_id=4574334&limit=100&page=1': JSON.stringify({
      torrents: [
        {
          title: 'Black.Panther.S01E01.1080p.WEB.h264',
          magnet_url: 'magnet:?xt=urn:btih:bbbbccccbbbbccccbbbbccccbbbbccccbbbbcccc&dn=bp',
          hash: 'bbbbccccbbbbccccbbbbccccbbbbccccbbbbcccc',
          seeds: 999,
          peers: 30,
          size_bytes: 1000,
          date_released_unix: 1710000000
        },
        {
          title: 'Stranger.Things.S01E01.1080p.WEB.h264',
          magnet_url: 'magnet:?xt=urn:btih:1234eeee1234eeee1234eeee1234eeee1234eeee&dn=st',
          hash: '1234eeee1234eeee1234eeee1234eeee1234eeee',
          seeds: 250,
          peers: 15,
          size_bytes: 2000,
          date_released_unix: 1710000001
        }
      ]
    })
  })

  const results = await eztvAdapter.searchSingle({
    mediaType: 'tv',
    ids: { imdb: 'tt4574334' },
    titles: ['Stranger Things'],
    season: 1,
    episode: 1,
    resolution: '1080',
    variants: { single: ['Stranger Things S01E01 1080p'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].hash, '1234eeee1234eeee1234eeee1234eeee1234eeee')
  assert.strictEqual(results[0].source.name, 'EZTV')
  return true
}

export async function testTorrentDownloadsParsing() {
  mockFetchOnce({
    'https://www.torrentdownloads.pro/rss.xml?type=search&search=Dune+2021+1080p': `
      <?xml version='1.0' encoding='iso-8859-1' ?>
      <rss version='2.0'><channel>
        <item>
          <title>Black Panther 2021 1080p WEBRip</title>
          <pubDate>Sun, 17 Oct 2021 17:30:14 +0200</pubDate>
          <size>1000</size>
          <seeders>999</seeders>
          <leechers>20</leechers>
          <info_hash>bbbbcccc1111</info_hash>
        </item>
        <item>
          <title>Dune (2021) [1080p] [WEBRip]</title>
          <pubDate>Sun, 17 Oct 2021 17:30:14 +0200</pubDate>
          <size>2947989023</size>
          <seeders>781</seeders>
          <leechers>57</leechers>
          <info_hash>ed0da850c273e3e15a819bdcbbf418bc85107ec8</info_hash>
        </item>
      </channel></rss>
    `
  })

  const results = await torrentDownloadsAdapter.searchMovie({
    mediaType: 'movie',
    titles: ['Dune'],
    year: 2021,
    resolution: '1080',
    variants: { movie: ['Dune 2021 1080p'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].hash, 'ed0da850c273e3e15a819bdcbbf418bc85107ec8')
  assert.strictEqual(results[0].source.name, 'Torrent Downloads')
  return true
}

export async function testShowRssParsing() {
  mockFetchOnce({
    'https://showrss.info/browse': `
      <html><body>
        <select>
          <option value="all">View all shows</option>
          <option value="1165">Loudermilk</option>
          <option value="55">Black Panther</option>
        </select>
      </body></html>
    `,
    'https://showrss.info/show/1165.rss': `
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel>
        <item>
          <title>Loudermilk 2x04 720p</title>
          <pubDate>Thu, 09 Apr 2026 22:31:20 +0000</pubDate>
          <tv:raw_title>Loudermilk S02E04 WEB x264 TORRENTGALAXY</tv:raw_title>
          <tv:info_hash>E854BFB57E46871C4F8A327272F85E6BB8FA6AF8</tv:info_hash>
          <enclosure url="magnet:?xt=urn:btih:E854BFB57E46871C4F8A327272F85E6BB8FA6AF8&amp;dn=loudermilk"/>
        </item>
        <item>
          <title>Loudermilk 2x05 720p</title>
          <pubDate>Thu, 09 Apr 2026 22:31:20 +0000</pubDate>
          <tv:raw_title>Loudermilk S02E05 WEB x264 TORRENTGALAXY</tv:raw_title>
          <tv:info_hash>5009D703BEE204074B1547E73045AE62747E0359</tv:info_hash>
          <enclosure url="magnet:?xt=urn:btih:5009D703BEE204074B1547E73045AE62747E0359&amp;dn=loudermilk"/>
        </item>
      </channel></rss>
    `
  })

  const results = await showRssAdapter.searchSingle({
    mediaType: 'tv',
    titles: ['Loudermilk'],
    season: 2,
    episode: 5,
    resolution: '720',
    variants: { single: ['Loudermilk S02E05 720p'] }
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].hash, '5009d703bee204074b1547e73045ae62747e0359')
  assert.strictEqual(results[0].source.name, 'showRSS')
  return true
}

process.on('exit', () => {
  global.fetch = originalFetch
})
