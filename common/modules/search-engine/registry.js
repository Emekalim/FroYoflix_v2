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
  x1337: {
    id: '1337x',
    name: '1337x',
    mediaTypes: ['tv', 'movie']
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
  if (mediaType === 'animeMovie') return [TRACKERS.nyaa, TRACKERS.yts]
  if (mediaType === 'tv') return [TRACKERS.showrss, TRACKERS.x1337]
  if (mediaType === 'movie') return [TRACKERS.yts, TRACKERS.x1337]
  return []
}

export function supportsBuiltInMediaType(mediaType) {
  return getBuiltInTrackersForMediaType(mediaType).length > 0
}
