import { cache, caches } from '@/modules/cache.js'
import { mediaCache } from '@/modules/cache.js'
import { getFastHash } from '@/modules/library/fastHash.js'
import { writable } from 'simple-store-svelte'

const TYPE_PREFIX = {
  item: 'item:',
  file: 'file:',
  subtitle: 'subtitle:',
  watch: 'watch:',
  mediaIndex: 'index:media:',
  fileIndex: 'index:file:',
  scan: 'scan:'
}

function now() {
  return Date.now()
}

function unique(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)))
}

function uniqueByKey(arr, key) {
  return Array.from(new Map((arr || []).filter(Boolean).map(item => [item?.[key], item])).values())
}

function ensureArray(value) {
  return Array.isArray(value) ? value : value ? [value] : []
}

const LIBRARY_VERSION_DEBOUNCE_MS = 200
let libraryVersionBumpTimer = null
function bumpLibraryVersionSoon() {
  if (libraryVersionBumpTimer) return
  libraryVersionBumpTimer = setTimeout(() => {
    libraryVersionBumpTimer = null
    libraryVersion.set(Date.now())
  }, LIBRARY_VERSION_DEBOUNCE_MS)
  libraryVersionBumpTimer.unref?.()
}

export function normalizeLibraryMedia(media, item = null) {
  if (!media) return null

  const titleText = typeof media.title === 'string'
    ? media.title
    : media.title?.userPreferred || media.title?.english || media.title?.romaji || media.name || item?.canonicalTitle || ''

  const inferredType = item?.mediaType || media.mediaType
  const normalizedFormat = media.format || (inferredType === 'tv' ? 'TV' : inferredType === 'movie' ? 'MOVIE' : inferredType === 'anime' ? 'TV' : null)
  const normalizedSource = media.source || (item?.provider === 'tmdb' ? 'TMDB' : item?.provider === 'anilist' ? 'AniList' : null)
  const cover = media.coverImage
    ? (typeof media.coverImage === 'string'
        ? { extraLarge: media.coverImage, large: media.coverImage, medium: media.coverImage, color: null }
        : {
            extraLarge: media.coverImage.extraLarge || media.coverImage.large || media.coverImage.medium || media.posterImage || null,
            large: media.coverImage.large || media.coverImage.extraLarge || media.coverImage.medium || media.posterImage || null,
            medium: media.coverImage.medium || media.coverImage.large || media.coverImage.extraLarge || media.posterImage || null,
            color: media.coverImage.color || null
          })
    : {
        extraLarge: media.posterImage || media.poster || null,
        large: media.posterImage || media.poster || null,
        medium: media.posterImage || media.poster || null,
        color: null
      }

  const normalizedTmdbId = media.tmdbId || media.externalIds?.tmdb || null

  return {
    ...media,
    title: typeof media.title === 'object'
      ? {
          userPreferred: media.title.userPreferred || media.title.english || media.title.romaji || titleText,
          romaji: media.title.romaji || media.title.userPreferred || titleText,
          english: media.title.english || media.title.userPreferred || titleText,
          native: media.title.native || media.title.userPreferred || titleText
        }
      : {
          userPreferred: titleText,
          romaji: titleText,
          english: titleText,
          native: titleText
        },
    coverImage: cover,
    bannerImage: media.bannerImage || media.backdropImage || null,
    format: normalizedFormat,
    type: media.type || normalizedFormat,
    source: normalizedSource,
    tmdbId: normalizedTmdbId,
    genres: ensureArray(media.genres),
    tags: ensureArray(media.tags),
    mediaListEntry: media.mediaListEntry || null,
    relations: media.relations || { edges: [] },
    recommendations: media.recommendations || { edges: [] },
    stats: media.stats || { scoreDistribution: [] },
    airingSchedule: media.airingSchedule || { nodes: [] },
    nextAiringEpisode: media.nextAiringEpisode || null
  }
}

function makeHash(data) {
  const text = String(data || '')
  let hashA = 0x811c9dc5
  let hashB = 0x01000193
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    hashA ^= code
    hashA = Math.imul(hashA, 0x01000193)
    hashB ^= code
    hashB = Math.imul(hashB, 0x27d4eb2d)
  }
  const partA = (hashA >>> 0).toString(16).padStart(8, '0')
  const partB = (hashB >>> 0).toString(16).padStart(8, '0')
  return `${partA}${partB}${partA}${partB}${partA}`
}

function mediaIdentityKey({ provider, mediaId, season, episode, episodeRange }) {
  const episodeToken = episodeRange?.first && episodeRange?.last
    ? `${episodeRange.first}-${episodeRange.last}`
    : (episode ?? 'none')
  return `${provider}:${mediaId}:${season ?? 'none'}:${episodeToken}`
}

function toLibraryItem(repository, item) {
  const preferred = repository.choosePreferredFile(item.itemId)
  const watch = repository.getWatch(item.itemId)
  const subtitles = repository.getSubtitlesForItem(item.itemId)
  const media = repository.resolveMediaSnapshot(item)
  return { ...item, preferredFile: preferred, watch, subtitles, media }
}

function toUnmatchedItem(file) {
  return {
    itemId: `unmatched:${file.fileId}`,
    fileId: file.fileId,
    canonicalTitle: file.absolutePath?.split(/[\\/]/).pop() || 'Unknown File',
    mediaType: 'unknown',
    statusSummary: 'unmatched',
    preferredFile: file,
    subtitles: [],
    watch: null,
    updatedAt: file.lastSeenAt || file.importedAt || 0
  }
}

export function buildItemId({ provider, mediaId, season, episode, episodeRange }) {
  return makeHash(mediaIdentityKey({ provider, mediaId, season, episode, episodeRange }))
}

export function buildFileId({ absolutePath, size, fastHash }) {
  return makeHash(`${absolutePath}:${size}:${fastHash || ''}`)
}

export function buildSubtitleId({ absolutePath, itemId }) {
  return makeHash(`${itemId}:${absolutePath}`)
}

function keyFor(prefix, id) {
  return `${prefix}${id}`
}

function comparePreferred(a, b) {
  const importedA = a.status === 'imported' ? 1 : 0
  const importedB = b.status === 'imported' ? 1 : 0
  if (importedA !== importedB) return importedB - importedA

  const completeA = a.status !== 'incoming' ? 1 : 0
  const completeB = b.status !== 'incoming' ? 1 : 0
  if (completeA !== completeB) return completeB - completeA

  const resolutionA = Number(a.resolution || 0)
  const resolutionB = Number(b.resolution || 0)
  if (resolutionA !== resolutionB) return resolutionB - resolutionA

  const sizeA = Number(a.size || 0)
  const sizeB = Number(b.size || 0)
  if (sizeA !== sizeB) return sizeB - sizeA

  return Number(b.importedAt || 0) - Number(a.importedAt || 0)
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

function getEpisodeNumbers(item) {
  const first = Number(item?.episodeRange?.first || 0)
  const last = Number(item?.episodeRange?.last || 0)
  if (first > 0 && last >= first) {
    return Array.from({ length: last - first + 1 }, (_, index) => first + index)
  }
  const episode = Number(item?.episode || 0)
  return episode > 0 ? [episode] : []
}

function hasPoster(media) {
  return !!(media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium)
}

function isPlayableEpisodeItem(item) {
  return !!item?.preferredFile?.absolutePath && item?.statusSummary !== 'missing'
}

function buildShowGroupKey(item) {
  if (item?.provider && item?.mediaId) return `${item.provider}:${item.mediaId}`
  return `title:${String(item?.canonicalTitle || item?.preferredFile?.absolutePath || item?.itemId || '').toLowerCase()}`
}

function chooseShowLeadItem(items) {
  return [...items].sort((a, b) => {
    const posterA = hasPoster(a?.media || a?.mediaSnapshot) ? 1 : 0
    const posterB = hasPoster(b?.media || b?.mediaSnapshot) ? 1 : 0
    if (posterA !== posterB) return posterB - posterA

    const watchA = a?.watch && !a.watch.completed && (a.watch.percent || 0) > 0 ? 1 : 0
    const watchB = b?.watch && !b.watch.completed && (b.watch.percent || 0) > 0 ? 1 : 0
    if (watchA !== watchB) return watchB - watchA

    const fileOrder = comparePreferred(a?.preferredFile || {}, b?.preferredFile || {})
    if (fileOrder !== 0) return fileOrder

    return Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0)
  })[0] || null
}

function chooseShowPlayableItem(items) {
  return [...items]
    .filter(isPlayableEpisodeItem)
    .sort((a, b) => {
      const inProgressA = a?.watch && !a.watch.completed && (a.watch.percent || 0) > 0 ? 1 : 0
      const inProgressB = b?.watch && !b.watch.completed && (b.watch.percent || 0) > 0 ? 1 : 0
      if (inProgressA !== inProgressB) return inProgressB - inProgressA

      const progressA = Number(a?.watch?.percent || 0)
      const progressB = Number(b?.watch?.percent || 0)
      if (progressA !== progressB) return progressB - progressA

      return compareEpisodes(a, b)
    })[0] || null
}

function chooseShowWatch(items) {
  return [...items]
    .filter(item => item?.watch)
    .sort((a, b) => {
      const activeA = !a.watch.completed && (a.watch.percent || 0) > 0 ? 1 : 0
      const activeB = !b.watch.completed && (b.watch.percent || 0) > 0 ? 1 : 0
      if (activeA !== activeB) return activeB - activeA
      return Number(b.watch?.lastPlayedAt || 0) - Number(a.watch?.lastPlayedAt || 0)
    })[0]?.watch || null
}

function toShowItem(repository, items) {
  const episodes = [...items].sort(compareEpisodes)
  const leadItem = chooseShowLeadItem(episodes) || episodes[0]
  if (!leadItem) return null

  const playableItem = chooseShowPlayableItem(episodes)
  const watch = chooseShowWatch(episodes)
  const subtitles = uniqueByKey(episodes.flatMap(item => ensureArray(item?.subtitles)), 'subtitleId')
  const media = leadItem?.media || leadItem?.mediaSnapshot || repository.resolveMediaSnapshot(leadItem)
  const seasons = {}
  let updatedAt = Number(leadItem?.updatedAt || 0)
  let hasAvailableEpisodes = false
  let hasMissingEpisodes = false

  for (const episodeItem of episodes) {
    updatedAt = Math.max(updatedAt, Number(episodeItem?.preferredFile?.importedAt || episodeItem?.updatedAt || 0))
    const season = Number(episodeItem?.season || 1)
    const entry = seasons[season] || {
      availableEpisodes: [],
      missingEpisodes: [],
      episodeItemIds: {}
    }

    const episodeNumbers = getEpisodeNumbers(episodeItem)
    const available = isPlayableEpisodeItem(episodeItem)
    for (const episode of episodeNumbers) {
      entry.episodeItemIds[episode] ||= episodeItem.itemId
      if (available) entry.availableEpisodes.push(episode)
      else entry.missingEpisodes.push(episode)
    }

    if (episodeNumbers.length > 0) {
      hasAvailableEpisodes ||= available
      hasMissingEpisodes ||= !available
    }

    seasons[season] = entry
  }

  for (const entry of Object.values(seasons)) {
    entry.availableEpisodes = unique(entry.availableEpisodes).sort((a, b) => a - b)
    entry.missingEpisodes = unique(entry.missingEpisodes).sort((a, b) => a - b)
  }

  return {
    itemId: `show:${buildShowGroupKey(leadItem)}`,
    provider: leadItem.provider,
    mediaId: leadItem.mediaId,
    mediaType: 'tv',
    canonicalTitle: leadItem.canonicalTitle,
    statusSummary: hasAvailableEpisodes ? 'imported' : 'missing',
    preferredFile: playableItem?.preferredFile || null,
    preferredEpisodeItem: playableItem || null,
    subtitles,
    watch,
    updatedAt,
    mediaSnapshot: media || null,
    media,
    libraryShow: {
      showKey: buildShowGroupKey(leadItem),
      canonicalTitle: leadItem.canonicalTitle,
      provider: leadItem.provider,
      mediaId: leadItem.mediaId,
      mediaType: 'tv',
      seasons,
      episodes,
      preferredEpisodeItemId: playableItem?.itemId || null,
      hasMissingEpisodes
    }
  }
}

class LibraryRepository {
  _sectionCache = { version: null, data: null }

  store() {
    return cache.getStore(caches.LIBRARY)
  }

  getRaw(key) {
    return cache.getEntry(caches.LIBRARY, key) || null
  }

  setRaw(key, value) {
    this._sectionCache = { version: null, data: null }
    const result = cache.write(caches.LIBRARY, key, value)
    bumpLibraryVersionSoon()
    return result
  }

  deleteRaw(key) {
    this._sectionCache = { version: null, data: null }
    bumpLibraryVersionSoon()
    return cache.deleteEntry(caches.LIBRARY, key)
  }

  listPrefix(prefix) {
    return Object.entries(this.store())
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value)
  }

  async upsertItem(item) {
    const key = keyFor(TYPE_PREFIX.item, item.itemId)
    const existing = this.getRaw(key) || {}
    const merged = {
      fileIds: unique([...(existing.fileIds || []), ...(item.fileIds || [])]),
      subtitleIds: unique([...(existing.subtitleIds || []), ...(item.subtitleIds || [])]),
      createdAt: existing.createdAt || item.createdAt || now(),
      updatedAt: now(),
      statusSummary: item.statusSummary || existing.statusSummary || 'imported',
      ...existing,
      ...item
    }
    await this.setRaw(key, merged)
    return merged
  }

  async saveMediaSnapshot(itemId, media) {
    const item = this.getItem(itemId)
    if (!item || !media) return null
    const normalized = normalizeLibraryMedia(media, item)
    if (!normalized) return item
    await cache.updateMedia([normalized])
    await this.upsertItem({
      ...item,
      mediaSnapshot: normalized
    })
    return this.getItem(itemId)
  }

  async resolveImportedItemMetadata(itemId, identity = {}) {
    const item = this.getItem(itemId)
    if (!item) return null

    const normalized = normalizeLibraryMedia(identity.mediaSnapshot || item.mediaSnapshot || null, {
      ...item,
      ...identity
    })

    const previousIdentity = {
      provider: item.provider,
      mediaId: item.mediaId,
      season: item.season,
      episode: item.episode,
      episodeRange: item.episodeRange
    }

    await this.removeMediaIndex(previousIdentity, itemId)
    if (normalized) await cache.updateMedia([normalized])

    const updated = await this.upsertItem({
      ...item,
      provider: identity.provider || item.provider,
      mediaId: identity.mediaId || item.mediaId,
      mediaType: identity.mediaType || item.mediaType,
      canonicalTitle: identity.canonicalTitle || item.canonicalTitle,
      season: identity.season ?? item.season ?? null,
      episode: identity.episode ?? item.episode ?? null,
      episodeRange: identity.episodeRange ?? item.episodeRange ?? null,
      mediaSnapshot: normalized || item.mediaSnapshot || null
    })

    if (updated?.provider && updated?.mediaId) {
      await this.upsertMediaIndex(updated, itemId)
    }
    return this.getItem(itemId)
  }

  async upsertFile(file) {
    const key = keyFor(TYPE_PREFIX.file, file.fileId)
    const existing = this.getRaw(key) || {}
    const merged = {
      importedAt: existing.importedAt || file.importedAt || now(),
      lastSeenAt: now(),
      ...existing,
      ...file
    }
    await this.setRaw(key, merged)
    return merged
  }

  async upsertSubtitle(subtitle) {
    const key = keyFor(TYPE_PREFIX.subtitle, subtitle.subtitleId)
    const existing = this.getRaw(key) || {}
    const merged = {
      ...existing,
      ...subtitle
    }
    await this.setRaw(key, merged)
    return merged
  }

  async upsertWatch(itemId, watch) {
    return this.setRaw(keyFor(TYPE_PREFIX.watch, itemId), {
      itemId,
      playCount: 0,
      lastPlayedAt: now(),
      ...this.getWatch(itemId),
      ...watch
    })
  }

  getWatch(itemId) {
    return this.getRaw(keyFor(TYPE_PREFIX.watch, itemId)) || null
  }

  async upsertMediaIndex(identity, itemId) {
    const key = keyFor(TYPE_PREFIX.mediaIndex, mediaIdentityKey(identity))
    const existing = this.getRaw(key) || { itemIds: [] }
    return this.setRaw(key, { ...existing, itemIds: unique([...(existing.itemIds || []), itemId]) })
  }

  async removeMediaIndex(identity, itemId) {
    if (!identity?.provider || !identity?.mediaId) return null
    const key = keyFor(TYPE_PREFIX.mediaIndex, mediaIdentityKey(identity))
    const existing = this.getRaw(key)
    if (!existing) return null
    const itemIds = ensureArray(existing.itemIds).filter(id => id !== itemId)
    if (itemIds.length === 0) return this.deleteRaw(key)
    return this.setRaw(key, { ...existing, itemIds })
  }

  async upsertFileIndex(fastHash, fileId) {
    const key = keyFor(TYPE_PREFIX.fileIndex, fastHash)
    const existing = this.getRaw(key) || { fileIds: [] }
    return this.setRaw(key, { ...existing, fileIds: unique([...(existing.fileIds || []), fileId]) })
  }

  async removeFileIndex(fastHash, fileId) {
    if (!fastHash) return null
    const key = keyFor(TYPE_PREFIX.fileIndex, fastHash)
    const existing = this.getRaw(key)
    if (!existing) return null
    const fileIds = ensureArray(existing.fileIds).filter(id => id !== fileId)
    if (fileIds.length === 0) return this.deleteRaw(key)
    return this.setRaw(key, { ...existing, fileIds })
  }

  async setScanState(rootId, state) {
    return this.setRaw(keyFor(TYPE_PREFIX.scan, rootId), { ...this.getScanState(rootId), ...state })
  }

  getScanState(rootId) {
    return this.getRaw(keyFor(TYPE_PREFIX.scan, rootId)) || null
  }

  getItem(itemId) {
    return this.getRaw(keyFor(TYPE_PREFIX.item, itemId)) || null
  }

  getFile(fileId) {
    return this.getRaw(keyFor(TYPE_PREFIX.file, fileId)) || null
  }

  getSubtitle(subtitleId) {
    return this.getRaw(keyFor(TYPE_PREFIX.subtitle, subtitleId)) || null
  }

  getFilesForItem(itemId) {
    return this.listPrefix(TYPE_PREFIX.file).filter(file => file.itemId === itemId)
  }

  getSubtitlesForItem(itemId) {
    return this.listPrefix(TYPE_PREFIX.subtitle).filter(subtitle => subtitle.itemId === itemId)
  }

  getItemsByIdentity(identity) {
    const index = this.getRaw(keyFor(TYPE_PREFIX.mediaIndex, mediaIdentityKey(identity)))
    return ensureArray(index?.itemIds).map(itemId => this.getItem(itemId)).filter(Boolean)
  }

  getFilesByFastHash(fastHash) {
    const index = this.getRaw(keyFor(TYPE_PREFIX.fileIndex, fastHash))
    return ensureArray(index?.fileIds).map(fileId => this.getFile(fileId)).filter(Boolean)
  }

  choosePreferredFile(itemId) {
    const files = this.getFilesForItem(itemId)
      .filter(file => !['missing', 'duplicate'].includes(file.status))
      .sort(comparePreferred)
    return files[0] || null
  }

  async syncPreferredFile(itemId) {
    const item = this.getItem(itemId)
    if (!item) return null
    const preferred = this.choosePreferredFile(itemId)
    const statusSummary = preferred?.status || (item.fileIds?.length ? 'missing' : item.statusSummary)
    return this.upsertItem({
      ...item,
      preferredFileId: preferred?.fileId || null,
      statusSummary
    })
  }

  async repairItem(itemId) {
    const item = this.getItem(itemId)
    if (!item) return null

    let preferred = this.choosePreferredFile(itemId)
    if (!preferred) {
      const files = this.getFilesForItem(itemId).sort(comparePreferred)
      const duplicateOnly = files.length > 0 && files.every(file => file.status === 'duplicate')
      if (duplicateOnly) {
        const recovered = { ...files[0], status: 'imported' }
        await this.upsertFile(recovered)
        preferred = recovered
      }
    }

    await this.syncPreferredFile(itemId)
    return this.getItem(itemId)
  }

  async repairLibraryItems() {
    const items = this.listPrefix(TYPE_PREFIX.item)
    for (const item of items) {
      try {
        await this.repairItem(item.itemId)
      } catch (err) {
        console.warn('[Library] repairItem failed for', item.itemId, err)
      }
    }
    return items.length
  }

  async clearForRebuild() {
    const prefixes = [
      TYPE_PREFIX.item,
      TYPE_PREFIX.file,
      TYPE_PREFIX.subtitle,
      TYPE_PREFIX.mediaIndex,
      TYPE_PREFIX.fileIndex,
      TYPE_PREFIX.scan
    ]
    const keys = Object.keys(this.store()).filter(key => prefixes.some(prefix => key.startsWith(prefix)))
    for (const key of keys) {
      await this.deleteRaw(key)
    }
    return keys.length
  }

  async attachFileToItem(item, file) {
    await this.upsertFile(file)
    await this.upsertItem({
      ...item,
      fileIds: unique([...(item.fileIds || []), file.fileId])
    })
    await this.upsertMediaIndex(item, item.itemId)
    await this.syncPreferredFile(item.itemId)
  }

  async attachSubtitleToItem(itemId, subtitle) {
    await this.upsertSubtitle(subtitle)
    const item = this.getItem(itemId)
    if (item) {
      await this.upsertItem({
        ...item,
        subtitleIds: unique([...(item.subtitleIds || []), subtitle.subtitleId])
      })
    }
  }

  async createOrMergeItem(identity, extra = {}) {
    const existing = this.getItemsByIdentity(identity)[0]
    const itemId = existing?.itemId || buildItemId(identity)
    const item = {
      itemId,
      provider: identity.provider,
      mediaId: identity.mediaId,
      mediaType: identity.mediaType,
      canonicalTitle: identity.canonicalTitle,
      season: identity.season ?? null,
      episode: identity.episode ?? null,
      episodeRange: identity.episodeRange || null,
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
      fileIds: existing?.fileIds || [],
      subtitleIds: existing?.subtitleIds || [],
      statusSummary: existing?.statusSummary || extra.statusSummary || 'imported',
      mediaSnapshot: extra.mediaSnapshot || existing?.mediaSnapshot || null
    }
    return this.upsertItem({ ...existing, ...item, ...extra })
  }

  async recordImportedMedia({ identity, file, subtitles = [] }) {
    const item = await this.createOrMergeItem(identity, { statusSummary: file.status, mediaSnapshot: identity.mediaSnapshot })
    await this.attachFileToItem(item, { ...file, itemId: item.itemId })
    if (file.fastHash) await this.upsertFileIndex(file.fastHash, file.fileId)
    for (const subtitle of subtitles) {
      await this.attachSubtitleToItem(item.itemId, { ...subtitle, itemId: item.itemId })
    }
    return this.getItem(item.itemId)
  }

  async recordUnmatchedFile(file) {
    await this.upsertFile({ ...file, itemId: null, status: file.status || 'unmatched' })
    if (file.fastHash) await this.upsertFileIndex(file.fastHash, file.fileId)
    return this.getFile(file.fileId)
  }

  async removeFileRecord(fileId) {
    const file = this.getFile(fileId)
    if (!file) return null
    if (file.fastHash) await this.removeFileIndex(file.fastHash, file.fileId)
    if (file.itemId) {
      const item = this.getItem(file.itemId)
      if (item) {
        await this.upsertItem({
          ...item,
          fileIds: ensureArray(item.fileIds).filter(id => id !== file.fileId)
        })
        await this.syncPreferredFile(file.itemId)
      }
    }
    await this.deleteRaw(keyFor(TYPE_PREFIX.file, file.fileId))
    return file
  }

  listShows({ query = '', status, subtitles, watchState, season, sort = 'recent' } = {}) {
    const queryText = query.trim().toLowerCase()
    const groups = new Map()
    const episodeItems = this.listPrefix(TYPE_PREFIX.item)
      .filter(item => item.mediaType === 'tv')
      .map(item => toLibraryItem(this, item))
      .filter(item => item.preferredFile || item.statusSummary === 'missing')

    for (const item of episodeItems) {
      const key = buildShowGroupKey(item)
      const existing = groups.get(key) || []
      existing.push(item)
      groups.set(key, existing)
    }

    let shows = Array.from(groups.values())
      .map(items => toShowItem(this, items))
      .filter(Boolean)

    if (status === 'missing') shows = shows.filter(show => show.statusSummary === 'missing' || show.libraryShow?.hasMissingEpisodes)
    else if (status) shows = shows.filter(show => show.statusSummary === status)
    if (subtitles) shows = shows.filter(show => show.subtitles.length > 0)
    if (watchState === 'continue') shows = shows.filter(show => show.watch && !show.watch.completed && (show.watch.percent || 0) > 0)
    if (watchState === 'completed') shows = shows.filter(show => show.watch?.completed)
    if (season != null && season !== '') shows = shows.filter(show => !!show.libraryShow?.seasons?.[Number(season)])
    if (queryText) {
      shows = shows.filter(show =>
        show.canonicalTitle?.toLowerCase().includes(queryText) ||
        show.preferredFile?.canonicalPath?.toLowerCase().includes(queryText) ||
        show.preferredFile?.absolutePath?.toLowerCase().includes(queryText))
    }

    shows.sort((a, b) => {
      if (sort === 'title') return String(a.canonicalTitle || '').localeCompare(String(b.canonicalTitle || ''))
      if (sort === 'watch') return Number(b.watch?.lastPlayedAt || 0) - Number(a.watch?.lastPlayedAt || 0)
      return Number(b.preferredFile?.importedAt || b.updatedAt || 0) - Number(a.preferredFile?.importedAt || a.updatedAt || 0)
    })

    return shows
  }

  listItems({ section, query = '', mediaType, status, subtitles, watchState, season, sort = 'recent' } = {}) {
    if (section === 'shows' || mediaType === 'tv') {
      return this.listShows({ query, status, subtitles, watchState, season, sort })
    }

    const queryText = query.trim().toLowerCase()
    const unmatched = this.listPrefix(TYPE_PREFIX.file)
      .filter(file => file.status === 'unmatched')
      .map(toUnmatchedItem)
    let items = [
      ...this.listPrefix(TYPE_PREFIX.item).map(item => toLibraryItem(this, item)),
      ...unmatched
    ].filter(item => item.preferredFile || item.statusSummary === 'unmatched')

    if (section === 'continue') items = items.filter(item => item.watch && !item.watch.completed && (item.watch.percent || 0) > 0)
    if (section === 'recent') items = items.filter(item => item.statusSummary === 'imported')
    if (section === 'incoming') items = items.filter(item => item.statusSummary === 'incoming')
    if (section === 'unmatched') items = items.filter(item => item.statusSummary === 'unmatched')
    if (section === 'movies') items = items.filter(item => item.mediaType === 'movie')
    if (section === 'shows') items = items.filter(item => item.mediaType === 'tv')
    if (section === 'anime') items = items.filter(item => item.mediaType === 'anime')

    if (mediaType) items = items.filter(item => item.mediaType === mediaType)
    if (status) items = items.filter(item => item.statusSummary === status || item.preferredFile?.status === status)
    if (watchState === 'continue') items = items.filter(item => item.watch && !item.watch.completed && (item.watch.percent || 0) > 0)
    if (watchState === 'completed') items = items.filter(item => item.watch?.completed)
    if (season != null) items = items.filter(item => Number(item.season || 1) === Number(season))

    const tvEpisodes = items.filter(item => item.mediaType === 'tv')
    if (tvEpisodes.length > 0) {
      const nonTvItems = items.filter(item => item.mediaType !== 'tv')
      const groups = new Map()
      for (const item of tvEpisodes) {
        const key = buildShowGroupKey(item)
        const group = groups.get(key) || []
        group.push(item)
        groups.set(key, group)
      }
      const showItems = Array.from(groups.values())
        .map(groupItems => toShowItem(this, groupItems))
        .filter(Boolean)
      items = [...showItems, ...nonTvItems]
    }

    if (subtitles) items = items.filter(item => (item.subtitles?.length || 0) > 0)
    if (queryText) items = items.filter(item =>
      item.canonicalTitle?.toLowerCase().includes(queryText) ||
      item.preferredFile?.canonicalPath?.toLowerCase().includes(queryText) ||
      item.preferredFile?.absolutePath?.toLowerCase().includes(queryText))

    items.sort((a, b) => {
      if (sort === 'title') return String(a.canonicalTitle || '').localeCompare(String(b.canonicalTitle || ''))
      if (sort === 'watch') return Number(b.watch?.lastPlayedAt || 0) - Number(a.watch?.lastPlayedAt || 0)
      return Number(b.preferredFile?.importedAt || b.updatedAt || 0) - Number(a.preferredFile?.importedAt || a.updatedAt || 0)
    })

    return items
  }

  listSection(section, limit = 20) {
    return this.listItems({ section }).slice(0, limit)
  }

  computeAllSections(limit = 20) {
    const currentVersion = libraryVersion.value
    if (this._sectionCache.version === currentVersion && this._sectionCache.data) {
      return this._sectionCache.data
    }

    const baseItems = this.listPrefix(TYPE_PREFIX.item)
      .map(item => toLibraryItem(this, item))
      .filter(Boolean)

    const unmatched = this.listPrefix(TYPE_PREFIX.file)
      .filter(file => file.status === 'unmatched')
      .map(toUnmatchedItem)

    const sectionItems = [...baseItems, ...unmatched]
      .filter(item => item.preferredFile || item.statusSummary === 'unmatched' || item.statusSummary === 'missing')

    const tvEpisodes = baseItems.filter(item => item.mediaType === 'tv')
    let showItems = []
    if (tvEpisodes.length > 0) {
      const groups = new Map()
      for (const item of tvEpisodes) {
        const key = buildShowGroupKey(item)
        const group = groups.get(key) || []
        group.push(item)
        groups.set(key, group)
      }
      showItems = Array.from(groups.values()).map(g => toShowItem(this, g)).filter(Boolean)
    }

    const processed = [...showItems, ...sectionItems.filter(item => item.mediaType !== 'tv')]
    processed.sort((a, b) =>
      Number(b.preferredFile?.importedAt || b.updatedAt || 0) -
      Number(a.preferredFile?.importedAt || a.updatedAt || 0)
    )

    const data = [
      { title: 'Continue Watching', section: 'continue', items: processed.filter(i => i.watch && !i.watch.completed && (i.watch.percent || 0) > 0).slice(0, limit) },
      { title: 'Recently Added',    section: 'recent',   items: processed.filter(i => i.statusSummary === 'imported').slice(0, limit) },
      { title: 'Movies',            section: 'movies',   items: processed.filter(i => i.mediaType === 'movie').slice(0, limit) },
      { title: 'Shows',             section: 'shows',    items: showItems.slice(0, limit) },
      { title: 'Anime',             section: 'anime',    items: processed.filter(i => i.mediaType === 'anime').slice(0, limit) },
      { title: 'Unmatched Files',   section: 'unmatched',items: unmatched.slice(0, limit) },
    ].filter(s => s.items.length > 0)

    this._sectionCache = { version: currentVersion, data }
    return data
  }

  async findPreferredFile({ provider, mediaId, season, episode }) {
    const lookups = [
      { provider, mediaId, season, episode }
    ]
    if (season == null && episode != null) lookups.push({ provider, mediaId, season: null, episode: null })
    const items = uniqueByKey(lookups.flatMap(identity => this.getItemsByIdentity(identity).filter(Boolean)), 'itemId')
    const item = items[0]
    if (!item) return null
    const preferred = this.choosePreferredFile(item.itemId)
    if (!preferred) return null
    return {
      item,
      file: preferred,
      subtitles: this.getSubtitlesForItem(item.itemId),
      watch: this.getWatch(item.itemId)
    }
  }

  async updateWatch({ itemId, positionSec, durationSec, completed = false }) {
    if (!itemId) return null
    const percent = durationSec > 0 ? Math.max(0, Math.min(100, Math.round((positionSec / durationSec) * 100))) : 0
    const existing = this.getWatch(itemId) || {}
    return this.upsertWatch(itemId, {
      itemId,
      lastPlayedAt: now(),
      positionSec,
      durationSec,
      percent,
      completed,
      playCount: Number(existing.playCount || 0) + (completed ? 1 : 0)
    })
  }

  async markMissing(absolutePath) {
    const file = this.listPrefix(TYPE_PREFIX.file).find(entry => entry.absolutePath === absolutePath || entry.canonicalPath === absolutePath)
    if (!file) return null
    await this.upsertFile({ ...file, status: 'missing' })
    if (file.itemId) await this.syncPreferredFile(file.itemId)
    return this.getFile(file.fileId)
  }

  async autoAttachFastHash(filePath) {
    return getFastHash(filePath)
  }

  resolveMediaSnapshot(item) {
    const cached = mediaCache.value[item?.mediaId]
    return normalizeLibraryMedia(cached || item?.mediaSnapshot || null, item)
  }
}

export const libraryVersion = writable(Date.now())
export const libraryRepository = new LibraryRepository()
export default libraryRepository
