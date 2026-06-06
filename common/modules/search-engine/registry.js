const TRACKERS = {
  nyaa: {
    id: 'nyaa',
    name: 'Nyaa',
    mediaTypes: ['anime']
  },
  yts: {
    id: 'yts',
    name: 'YTS',
    mediaTypes: ['movie']
  },
  showrss: {
    id: 'showrss',
    name: 'showRSS',
    mediaTypes: ['tv']
  },
  torrentdownloads: {
    id: 'torrentdownloads',
    name: 'Torrent Downloads',
    mediaTypes: ['tv', 'movie']
  }
}

export function getBuiltInTrackersForMediaType(mediaType) {
  if (mediaType === 'anime') return [TRACKERS.nyaa]
  if (mediaType === 'animeMovie') return [TRACKERS.nyaa, TRACKERS.yts, TRACKERS.torrentdownloads]
  if (mediaType === 'tv') return [TRACKERS.showrss, TRACKERS.torrentdownloads]
  if (mediaType === 'movie') return [TRACKERS.yts, TRACKERS.torrentdownloads]
  return []
}

export function supportsBuiltInMediaType(mediaType) {
  return getBuiltInTrackersForMediaType(mediaType).length > 0
}
