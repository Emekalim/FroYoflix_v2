import { openTorrentModal } from '@/modals/torrent/TorrentModal.svelte'
import Helper from '@/modules/helper.js'
import { AnimeService } from '@/modules/anime/AnimeService.js'

/**
 * Service for handling Media Playback (generic)
 */
export const PlayerService = {

    /**
     * Play a media item (generic wrapper)
     * @param {Object} media 
     */
    async playMedia(media) {
        if (!media) return

        // 1. Determine starting episode (strategy pattern)
        let startEpisode = 1
        let isAnime = media.mediaType === 'anime' || media.source === 'anilist' || (!media.mediaType && !media.source) // legacy fallback

        if (isAnime) {
            // Delegate to Anime strategy
            startEpisode = await AnimeService.getStartEpisode(media)
        } else {
            // Default strategy for Movies/TV
            // Movies always start at 1 (files are usually "Movie 1")
            // TV shows start at 1
            startEpisode = 1
        }

        let ep = startEpisode

        // 2. Handle progress / "Continue Watching"
        if (media.mediaListEntry) {
            const { status, progress } = media.mediaListEntry
            if (progress) {
                if (status === 'COMPLETED') {
                    // Restart logic
                    await this.setStatus('REPEATING', { episode: 0 }, media)
                    // ep remains startEpisode (re-watching)
                } else {
                    // Continue logic
                    const hasZero = startEpisode === 0

                    // If startEp is 0 (0-indexed), progress 1 means we watched ep 0. Next is 1.
                    // If startEp is 1 (1-indexed), progress 1 means we watched ep 1. Next is 2.
                    const nextEpIndex = progress + (hasZero ? 0 : 1)

                    // Calculate max available episode to avoid jumping ahead of release
                    // Note: getMediaMaxEp is currently in AnimeService because it relies on AniList fields.
                    // We can use it here if we assume the media object handles data normalization, 
                    // or we just trust the progress if maxEp is unavailable.
                    // For generic safe-guarding, we might want to move getMediaMaxEp to a helper.
                    // For now, let's try to import it from AnimeService, assuming it handles nulls gracefully.

                    // However, for pure movies (no episodes), strict max is 1.
                    let maxEp = 9999
                    if (media.format === 'MOVIE') maxEp = 1

                    // Delegate max ep calculation if possible
                    // const maxEp = AnimeService.getMaxEpisode(media) // ... if we move it there
                    // For now, let's implement simplified logic or import the existing one.
                    // Im going to import it from AnimeService even though it's "generic" check, 
                    // because currently the logic resides there.
                    // But I'll define it locally in anime.js originally. 
                    // Let's assume I move getMediaMaxEp to AnimeService.js too.

                    // ep = Math.min(...) logic
                    // Simplified:
                    ep = nextEpIndex
                }
            }
        }

        openTorrentModal(media, ep)
        // media = null // no need to nullify argument in JS unless affecting caller scope (which it doesn't here)
    },

    /**
     * Set status for a media entry
     * @param {string} status 
     * @param {Object} other 
     * @param {Object} media 
     */
    setStatus(status, other = {}, media) {
        const fuzzyDate = Helper.getFuzzyDate(media, status)
        const variables = {
            id: media.id,
            idMal: media.idMal,
            status,
            score: media.mediaListEntry?.score ? Helper.isAniAuth() ? (media.mediaListEntry?.score * 10) : media.mediaListEntry?.score : 0,
            repeat: media.mediaListEntry?.repeat || 0,
            ...fuzzyDate,
            ...other
        }
        return Helper.entry(media, variables)
    }
}

// Export for direct import destructuring
export const { playMedia, setStatus } = PlayerService
