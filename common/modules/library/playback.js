import libraryRepository from '@/modules/library/LibraryRepository.js'
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

function hydrateLibraryItem(item) {
  if (!item?.itemId) return item
  const storedItem = libraryRepository.getItem(item.itemId) || item
  return {
    ...storedItem,
    preferredFile: item?.preferredFile || libraryRepository.choosePreferredFile(storedItem.itemId),
    subtitles: item?.subtitles || libraryRepository.getSubtitlesForItem(storedItem.itemId),
    watch: item?.watch || libraryRepository.getWatch(storedItem.itemId),
    media: item?.media || libraryRepository.resolveMediaSnapshot(storedItem)
  }
}

function normalizeIdentityText(value) {
  return String(value || '').trim().toLowerCase()
}

function sameLibrarySeries(candidate, selectedItem) {
  if (!candidate || !selectedItem) return false
  if (candidate?.provider && candidate?.mediaId && selectedItem?.provider && selectedItem?.mediaId) {
    return candidate.provider === selectedItem.provider && String(candidate.mediaId) === String(selectedItem.mediaId)
  }
  return normalizeIdentityText(candidate?.canonicalTitle) === normalizeIdentityText(selectedItem?.canonicalTitle)
}

function buildAnimeLibraryShow(item) {
  if (!item?.itemId || item?.mediaType !== 'anime') return null

  const selectedItem = hydrateLibraryItem(item)
  const episodes = libraryRepository
    .listItems({ mediaType: 'anime' })
    .filter(candidate => !candidate?.libraryShow && sameLibrarySeries(candidate, selectedItem))
    .map(hydrateLibraryItem)
    .filter(candidate => getEpisodeNumbers(candidate).length > 0)
    .sort(compareEpisodes)

  if (!episodes.length) return null

  const seasons = {}
  for (const episodeItem of episodes) {
    const season = Number(episodeItem?.season || 1)
    seasons[season] ||= { availableEpisodes: [] }
    for (const episode of getEpisodeNumbers(episodeItem)) {
      if (!seasons[season].availableEpisodes.includes(episode)) {
        seasons[season].availableEpisodes.push(episode)
      }
    }
    seasons[season].availableEpisodes.sort((a, b) => a - b)
  }

  return {
    ...selectedItem,
    episodes,
    seasons,
    preferredEpisodeItem: selectPreferredShowEpisode({ episodes })
  }
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
    libraryFileId: file.fileId,
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

  const detailsData = {
    ...media,
    __libraryItemId: item?.itemId || null
  }
  const libraryShow = item?.libraryShow || buildAnimeLibraryShow(item)
  if (libraryShow) detailsData.__libraryShow = libraryShow

  modal.open(modal.ANIME_DETAILS, detailsData)
}
