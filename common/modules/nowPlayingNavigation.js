import { modal, page, playPage } from '@/modules/navigation.js'

function getPlaybackSeason(nowPlaying) {
  const season = Number(nowPlaying?.season || nowPlaying?.parseObject?.anime_season || nowPlaying?.media?.season)
  return Number.isFinite(season) && season > 0 ? season : 1
}

export function openNowPlaying(nowPlaying) {
  if (!nowPlaying?.media) return

  if (nowPlaying.display) {
    openNowPlayingDetails(nowPlaying)
    return
  }

  const currentDetails = modal.value?.[modal.ANIME_DETAILS]?.data
  const detailsOpenForCurrent = currentDetails?.id === nowPlaying.media.id

  if (detailsOpenForCurrent) {
    modal.close(modal.ANIME_DETAILS)
    playPage.set(false)
    page.navigateTo(page.PLAYER)
    return
  }

  if (page.value !== page.PLAYER) {
    playPage.set(false)
    page.navigateTo(page.PLAYER)
    return
  }

  playPage.set(false)
  modal.open(modal.ANIME_DETAILS, {
    ...nowPlaying.media,
    __seasonFilter: getPlaybackSeason(nowPlaying)
  })
}

export function openNowPlayingDetails(nowPlaying) {
  if (!nowPlaying?.media) return
  modal.open(modal.ANIME_DETAILS, {
    ...nowPlaying.media,
    __seasonFilter: getPlaybackSeason(nowPlaying)
  })
}
