import { modal } from '@/modules/navigation.js'

function getEpisodeNumbers(item) {
  const first = Number(item?.episodeRange?.first || 0)
  const last = Number(item?.episodeRange?.last || 0)
  if (first > 0 && last >= first) {
    return Array.from({ length: last - first + 1 }, (_, index) => first + index)
  }
  const episode = Number(item?.episode || 0)
  return episode > 0 ? [episode] : []
}

function compareEpisodes(a, b) {
  const seasonA = Number(a?.season || 1)
  const seasonB = Number(b?.season || 1)
  if (seasonA !== seasonB) return seasonA - seasonB

  const episodeA = Number(a?.episodeRange?.first || a?.episode || 0)
  const episodeB = Number(b?.episodeRange?.first || b?.episode || 0)
  if (episodeA !== episodeB) return episodeA - episodeB

  return Number(a?.updatedAt || 0) - Number(b?.updatedAt || 0)
}

function isPlayableEpisodeItem(item) {
  return !!item?.preferredFile?.absolutePath && item?.statusSummary !== 'missing'
}

function matchShowEpisode(item, season, episode) {
  if (!item) return false
  if (Number(item.season || 1) !== Number(season || 1)) return false
  return getEpisodeNumbers(item).includes(Number(episode))
}

function findShowEpisode(show, season, episode) {
  return (show?.episodes || []).find(item => matchShowEpisode(item, season, episode)) || null
}

function selectPreferredShowEpisode(show, season = null) {
  const episodes = (show?.episodes || [])
    .filter(isPlayableEpisodeItem)
    .filter(item => season == null || Number(item.season || 1) === Number(season))
    .sort((a, b) => {
      const inProgressA = a?.watch && !a.watch.completed && (a.watch.percent || 0) > 0 ? 1 : 0
      const inProgressB = b?.watch && !b.watch.completed && (b.watch.percent || 0) > 0 ? 1 : 0
      if (inProgressA !== inProgressB) return inProgressB - inProgressA

      const progressA = Number(a?.watch?.percent || 0)
      const progressB = Number(b?.watch?.percent || 0)
      if (progressA !== progressB) return progressB - progressA

      return compareEpisodes(a, b)
    })

  return episodes[0] || null
}

export function playLibraryItem(item) {
  const media = item?.media || item?.mediaSnapshot
  const file = item?.preferredFile
  if ((!file?.absolutePath && !item?.infoHash) || item?.statusSummary === 'missing') return

  if (!file?.absolutePath || !media) {
    if (item?.infoHash) {
      window.dispatchEvent(
        new CustomEvent('add', {
          detail: {
            resolvedHash: item.infoHash
          }
        })
      )
    }
    return
  }

  const subtitleFiles = (item.subtitles || []).map((subtitle) => ({
    name: subtitle.absolutePath.split(/[\\/]/).pop(),
    path: subtitle.absolutePath,
    url: `file://${subtitle.absolutePath}`,
    subtitle: true
  }))

  const fileObject = {
    name: file.absolutePath.split(/[\\/]/).pop(),
    path: file.absolutePath,
    url: `file://${file.absolutePath}`,
    libraryItemId: item.itemId,
    subtitlePaths: (item.subtitles || []).map((subtitle) => subtitle.absolutePath),
    subtitleFiles,
    media: {
      media,
      episode: item.episode,
      season: item.season,
      parseObject: {
        anime_title: item.canonicalTitle,
        media_title: item.canonicalTitle,
        episode_number: item.episode,
        anime_season: item.season,
        file_name: file.absolutePath.split(/[\\/]/).pop()
      }
    }
  }

  window.dispatchEvent(
    new CustomEvent('play-library-file', {
      detail: {
        fileObject,
        nowPlaying: {
          media,
          episode: item.episode,
          season: item.season,
          parseObject: fileObject.media.parseObject
        }
      }
    })
  )
}

export function playLibraryShowEpisode(show, season, episode) {
  const item = findShowEpisode(show, season, episode)
  if (!item || !isPlayableEpisodeItem(item)) return null
  playLibraryItem(item)
  return item
}

export function playLibraryShowItem(item, season = null) {
  const show = item?.libraryShow || item
  const preferredItem = item?.preferredEpisodeItem || selectPreferredShowEpisode(show, season)
  if (!preferredItem) return null
  playLibraryItem(preferredItem)
  return preferredItem
}

export function openLibraryItemDetails(item) {
  const media = item?.media || item?.mediaSnapshot
  if (!media) return

  if (item?.libraryShow) {
    modal.open(modal.ANIME_DETAILS, {
      ...media,
      __libraryShow: item.libraryShow,
      __libraryItemId: item.itemId
    })
    return
  }

  modal.open(modal.ANIME_DETAILS, media)
}
