import { nyaaAdapter } from './adapters/nyaa.js'
import { x1337Adapter } from './adapters/1337x.js'
import { ytsAdapter } from './adapters/yts.js'
import { eztvAdapter } from './adapters/eztv.js'
import { showRssAdapter } from './adapters/showrss.js'
import { torrentDownloadsAdapter } from './adapters/torrentdownloads.js'

const registry = {
  nyaa: nyaaAdapter,
  yts: ytsAdapter,
  eztv: eztvAdapter,
  showrss: showRssAdapter,
  torrentdownloads: torrentDownloadsAdapter,
  '1337x': x1337Adapter
}

export function getTrackerAdapter(id) {
  return registry[id] || null
}
