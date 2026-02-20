import { anilistClient } from '@/modules/anilist.js'
import _anitomyscript from 'anitomyscript'
import { toast } from 'svelte-sonner'
import SectionsManager, { search, key } from '@/modules/sections.js'
import { page } from '@/modules/navigation.js'
import AnimeResolver from '@/modules/anime/animeresolver.js'
import { settings } from '@/modules/settings.js'
import { Activity, MountainSnow, Laugh, Drama, Droplets, WandSparkles, Adult, Skull, Sparkles, Bot, Guitar, Footprints, Brain, BookHeart, FlaskConical, Car, Volleyball, Ghost, HeartPulse } from 'lucide-svelte'
import Debug from 'debug'

const debug = Debug('ui:anime-service')
const imageRx = /\.(jpeg|jpg|gif|png|webp)/i

/**
 * Service for handling Anime-specific business logic
 */
export const AnimeService = {
    /**
     * Search for anime using Trace.moe (replaces traceAnime)
     * @param {string|Blob} image 
     */
    async trace(image) {
        let options
        let url = `https://api.trace.moe/search?cutBorders&url=${image}`
        if (image instanceof Blob) {
            options = {
                method: 'POST',
                body: image,
                headers: { 'Content-type': image.type }
            }
            url = 'https://api.trace.moe/search'
        }
        const res = await fetch(url, options)
        const { result } = await res.json()

        if (result?.length) {
            const ids = result.map(({ anilist }) => anilist).filter(Boolean)
            search.value = {
                clearNow: true,
                clearNext: true,
                load: (page = 1, perPage = 50, variables = {}) => {
                    // Lazy load legacy metadata if needed or implementation below
                    // For now assuming we use this logic
                    const res = anilistClient.searchIDS({ page, perPage, id: ids, ...SectionsManager.sanitiseObject(variables) }).then(async res => {
                        const { getEpisodeMetadataForMedia } = await import('@/modules/anime/anime.js')
                        for (const index in res.data?.Page?.media) {
                            const media = res.data.Page.media[index]
                            const counterpart = result.find(({ anilist }) => anilist === media.id)
                            const metadata = (await getEpisodeMetadataForMedia(media))?.[counterpart.episode] || {}
                            res.data.Page.media[index] = {
                                media,
                                episode: counterpart.episode,
                                similarity: counterpart.similarity,
                                episodeData: {
                                    ...metadata,
                                    ...(counterpart.image && { image: counterpart.image }),
                                    ...(counterpart.video && { video: counterpart.video })
                                }
                            }
                        }
                        res.data?.Page?.media?.sort((a, b) => b.similarity - a.similarity)
                        return res
                    })
                    return SectionsManager.wrapResponse(res, result.length, 'episode')
                }
            }
            key.value = {}
            page.navigateTo(page.SEARCH)
        } else {
            throw new Error('Search Failed \n Couldn\'t find anime for specified image! Try to remove black bars, or use a more detailed image.')
        }
    },

    /**
     * Determine the starting episode number (handling Episode 0 / Prologues)
     * @param {Object} media 
     * @param {Object} existingMappings 
     * @returns {Promise<number>} Returns 0 if it should start at 0, otherwise 1
     */
    async getStartEpisode(media, existingMappings) {
        if (!media) return 1
        try {
            const { hasZeroEpisode } = await import('@/modules/anime/anime.js')
            const zeroEp = await hasZeroEpisode(media, existingMappings)
            return zeroEp ? 0 : 1
        } catch (e) {
            console.error('Failed to check zero episode', e)
            return 1
        }
    },

    /**
     * Wrapper for anitomyscript
     */
    async parseFilename(filename) {
        // @ts-ignore
        const res = await _anitomyscript(filename)
        const parseObjs = Array.isArray(res) ? res : [res]
        debug('AnitoMyScript found titles:', JSON.stringify(parseObjs))

        for (const obj of parseObjs) {
            obj.anime_title ??= ''
            const seasonMatch = obj.anime_title.match(/S(\d{2})E(\d{2})|S(\d{2})|season-(\d+)/i)
            if (seasonMatch) {
                if (seasonMatch[1] && seasonMatch[2]) {
                    obj.anime_season = seasonMatch[1]
                    obj.episode_number = seasonMatch[2]
                    obj.anime_title = obj.anime_title.replace(/S(\d{2})E(\d{2})/, '')
                } else if (seasonMatch[3]) {
                    obj.anime_season = Number(seasonMatch[3])
                    obj.anime_title = obj.anime_title.replace(/S\d{2}/, '')
                } else if (seasonMatch[4]) {
                    obj.anime_season = seasonMatch[4]
                    obj.anime_title = obj.anime_title.replace(/season-\d+/i, '')
                }
            } else if (Array.isArray(obj.anime_season)) {
                obj.anime_season = obj.anime_season[0]
            }
            const yearMatch = obj.anime_title.match(/ (19[5-9]\d|20\d{2})/)
            if (yearMatch && Number(yearMatch[1]) <= (new Date().getUTCFullYear() + 1)) {
                obj.anime_year = yearMatch[1]
                obj.anime_title = obj.anime_title.replace(/ (19[5-9]\d|20\d{2})/, '')
            }
            obj.anime_title = obj.anime_title.replace(/(?<=\s)-\s*|\s*-(?=\s)/g, '')
            if (Number(obj.anime_season) > 1) obj.anime_title += ' S' + Number(obj.anime_season)
            if ((!obj.anime_type || ((Array.isArray(obj.anime_type) ? obj.anime_type[0] : obj.anime_type).toUpperCase()).includes('OAV')) && obj.anime_title.match(/\s*\(?oav\)?\s*$/i)) {
                obj.anime_title = obj.anime_title.replace(/\s*\(?oav\)?\s*$/i, '')
                this._addType(obj, 'OAV')
            }
            if (obj.file_name?.match(/(^|[\s()[\]\-_])NCED($|[\s()[\]\-_])/i)) this._addType(obj, 'NCED')
            if (obj.file_name?.match(/(^|[\s()[\]\-_])NCOP($|[\s()[\]\-_])/i)) this._addType(obj, 'NCOP')
            if (obj.file_name && /(^|\s|[[(-_])trailer(?=$|\s|[\]))-_])/i.test(obj.file_name)) this._addType(obj, 'Trailer')
        }
        debug('AnitoMyScript corrected titles:', JSON.stringify(parseObjs))
        return parseObjs
    },

    _addType(obj, newType) {
        if (!obj.anime_type) obj.anime_type = newType
        else if (Array.isArray(obj.anime_type) && !obj.anime_type.some(type => type.toUpperCase() === newType.toUpperCase())) obj.anime_type.push(newType)
        else if (typeof obj.anime_type === 'string' && obj.anime_type.toUpperCase() !== newType.toUpperCase()) obj.anime_type = [obj.anime_type, newType]
    },

    /**
     * Calculate max episode number
     */
    getMediaMaxEp(media, playable) {
        return getMediaMaxEp(media, playable)
    },

    genreIcons: {
        'Action': Activity,
        'Adventure': MountainSnow,
        'Comedy': Laugh,
        'Drama': Drama,
        'Ecchi': Droplets,
        'Fantasy': WandSparkles,
        'Hentai': Adult,
        'Horror': Skull,
        'Mahou Shoujo': Sparkles,
        'Mecha': Bot,
        'Music': Guitar,
        'Mystery': Footprints,
        'Psychological': Brain,
        'Romance': BookHeart,
        'Sci-Fi': FlaskConical,
        'Slice of Life': Car,
        'Sports': Volleyball,
        'Supernatural': Ghost,
        'Thriller': HeartPulse
    },

    getGenreList() {
        return [
            'Action',
            'Adventure',
            'Comedy',
            'Drama',
            'Ecchi',
            'Fantasy',
            ...(settings.value.adult === 'hentai' ? ['Hentai'] : []),
            'Horror',
            'Mahou Shoujo',
            'Mecha',
            'Music',
            'Mystery',
            'Psychological',
            'Romance',
            'Sci-Fi',
            'Slice of Life',
            'Sports',
            'Supernatural',
            'Thriller'
        ]
    }
}

// Standalone exports
export function lastAired(nodes, variables) {
    const currentTime = new Date()
    return nodes?.filter(node => new Date(variables?.hideSubs ? node.airingAt : (node.airingAt * 1000)) < currentTime)?.sort((a, b) => {
        const timeDiff = b.airingAt - a.airingAt
        if (timeDiff !== 0) return timeDiff
        return (b.episode || 0) - (a.episode || 0)
    })?.shift()
}

export function getMediaMaxEp(media, playable) {
    if (!media) return 0
    else if (playable) return media.nextAiringEpisode?.episode - 1 || lastAired(media.airingSchedule?.nodes)?.episode || (media.status === 'NOT_YET_RELEASED' ? 0 : media.episodes) || (media.status === 'RELEASING' ? (media.mediaListEntry?.progress ?? 1) : 0)
    else return Math.max(media.airingSchedule?.nodes?.[media.airingSchedule?.nodes?.length - 1]?.episode || 0, media.airingSchedule?.nodes?.length || 0, (!media.streamingEpisodes || (media.status === 'FINISHED' && media.episodes) ? 0 : media.streamingEpisodes?.filter((ep) => { const match = (/Episode (\d+(\.\d+)?) - /).exec(ep.title); return match ? Number.isInteger(parseFloat(match[1])) : false }).length), media.episodes || 0, media.nextAiringEpisode?.episode || 0) || (media.status === 'RELEASING' ? (media.mediaListEntry?.progress ?? 1) : 0)
}
