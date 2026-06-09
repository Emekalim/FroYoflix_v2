export function getTorrentState(torrent, {
  current = false,
  completed = false,
  streamedDownload = false
} = {}) {
  if (!torrent) return 'idle'

  const progress = torrent.progress || 0
  const hasTransferSpeed = !!(torrent.downloadSpeed || torrent.uploadSpeed)
  const isScanning = !hasTransferSpeed &&
    torrent.eta > 1000 &&
    torrent.eta < Infinity &&
    progress < 1 &&
    !streamedDownload

  if (completed) {
    if (torrent.incomplete) return torrent.missing_pieces ? 'missing_pieces' : 'paused'
    return 'completed'
  }
  if (current || torrent.current) return 'playing'
  if (torrent.seeding || progress === 1) return 'seeding'
  if (hasTransferSpeed) return 'downloading'
  if (isScanning) return 'scanning'
  if (torrent.staging) return 'queued'
  return torrent.name ? 'stalled' : 'idle'
}

export function getTorrentStateLabel(state, { currentLabel = 'Playing' } = {}) {
  switch (state) {
    case 'playing':
      return currentLabel
    case 'seeding':
      return 'Seeding'
    case 'downloading':
      return 'Downloading'
    case 'queued':
      return 'Queued'
    case 'scanning':
      return 'Scanning'
    case 'paused':
      return 'Paused'
    case 'missing_pieces':
      return 'Missing Pieces'
    case 'completed':
      return 'Completed'
    case 'stalled':
      return 'Stalled'
    default:
      return '—'
  }
}
