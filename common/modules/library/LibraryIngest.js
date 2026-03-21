import { IPC, ELECTRON } from '@/modules/bridge.js'
import MediaResolver from '@/modules/resolver/MediaResolver.js'
import { settings } from '@/modules/settings.js'
import { subRx, videoRx } from '@/modules/util.js'
import libraryRepository, { buildFileId, buildSubtitleId } from '@/modules/library/LibraryRepository.js'
import { buildCanonicalPaths, getCanonicalTitle } from '@/modules/library/pathSanitizer.js'
import MovieParser from '@/modules/resolver/parsers/MovieParser.js'

function getSeparator(...values) {
  return values.some(value => String(value || '').includes('\\')) ? '\\' : '/'
}

function joinPath(...segments) {
  const separator = getSeparator(...segments)
  const [first, ...rest] = segments
  const normalizedFirst = String(first || '').replace(/[\\/]+$/g, '')
  const normalizedRest = rest
    .map(value => String(value || '').replace(/^[\\/]+|[\\/]+$/g, ''))
    .filter(Boolean)
  return [normalizedFirst, ...normalizedRest].filter(Boolean).join(separator)
}

function basename(value) {
  return String(value || '').split(/[\\/]/).pop() || ''
}

function dirname(value) {
  const normalized = String(value || '').replace(/[\\/]+$/g, '')
  const parts = normalized.split(/[\\/]/)
  if (parts.length <= 1) return normalized
  parts.pop()
  if (/^[A-Za-z]:$/.test(parts[0])) return `${parts[0]}${getSeparator(value)}`
  return parts.join(getSeparator(value)) || getSeparator(value)
}

function extname(value) {
  const base = basename(value)
  const index = base.lastIndexOf('.')
  return index >= 0 ? base.slice(index) : ''
}

function containsSegment(value, segment) {
  const normalized = `/${String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/`
  return normalized.includes(`/${segment}/`)
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function getRootRelativePath(value, rootPath = getLibraryRoot()) {
  const normalizedValue = normalizePath(value)
  const normalizedRoot = normalizePath(rootPath)
  if (!normalizedValue || !normalizedRoot) return null
  if (normalizedValue === normalizedRoot) return ''
  if (!normalizedValue.startsWith(`${normalizedRoot}/`)) return null
  return normalizedValue.slice(normalizedRoot.length + 1)
}

function getManagedBucketName(value, rootPath = getLibraryRoot()) {
  const relative = getRootRelativePath(value, rootPath)
  const firstSegment = relative?.split('/').filter(Boolean)[0]
  return ['Movies', 'Shows', 'Anime'].includes(firstSegment) ? firstSegment : null
}

function isSubtitlePath(value) {
  return containsSegment(value, 'Subtitles')
}

function isManagedBucketPath(value, rootPath = getLibraryRoot()) {
  return !!getManagedBucketName(value, rootPath)
}

function isFroyoPath(value) {
  return containsSegment(value, '.froyo')
}

function getLibraryRoot() {
  return settings.value.torrentPathNew || ''
}

export function getIncomingRoot(rootPath = getLibraryRoot()) {
  return joinPath(rootPath, '.froyo', 'incoming')
}

export function getManagedIncomingPath(infoHash, rootPath = getLibraryRoot()) {
  return joinPath(getIncomingRoot(rootPath), infoHash || 'manual')
}

function stem(name) {
  const extension = extname(name)
  return basename(name || '').slice(0, extension ? -extension.length : undefined)
}

function makeStableKey(value) {
  const text = String(value || '')
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
  return `${partA}${partB}${partA}`
}

function normalizeStem(value) {
  return stem(value).toLowerCase().replace(/[\s._-]+/g, '')
}

function inferLanguage(name) {
  const lower = String(name || '').toLowerCase()
  for (const code of ['eng', 'en', 'jpn', 'jp', 'spa', 'es', 'ger', 'de', 'ita', 'fr', 'fre', 'pt', 'por']) {
    if (lower.includes(`.${code}.`) || lower.endsWith(`.${code}`) || lower.includes(`[${code}]`)) return code
  }
  return null
}

function inferResolution(name) {
  const match = String(name || '').match(/\b(\d{3,4})p\b/i)
  return match ? Number(match[1]) : null
}

function inferReleaseGroup(name) {
  const match = String(name || '').match(/^\[([^\]]+)\]/)
  return match?.[1] || null
}

async function scanPath(targetPath, recursive = true) {
  if (!ELECTRON) return []
  return IPC.invoke('library:scan', { path: targetPath, recursive })
}

async function movePath(src, dest) {
  if (!ELECTRON) throw new Error('Library moves are only implemented for Electron in v1')
  return IPC.invoke('library:move', { src, dest })
}

async function exists(targetPath) {
  if (!ELECTRON) return false
  return IPC.invoke('library:exists', { path: targetPath })
}

async function readText(targetPath) {
  if (!ELECTRON) return null
  return IPC.invoke('library:readText', { path: targetPath })
}

async function writeText(targetPath, content) {
  if (!ELECTRON) throw new Error('Library metadata writes are only implemented for Electron in v1')
  return IPC.invoke('library:writeText', { path: targetPath, content })
}

function buildMetadataRecordPath(absolutePath, rootPath) {
  return joinPath(rootPath, '.froyo', 'library-metadata', 'by-path', `${makeStableKey(absolutePath)}.json`)
}

function toStoredMetadata(identity) {
  return {
    provider: identity.provider,
    mediaId: identity.mediaId,
    mediaType: identity.mediaType,
    canonicalTitle: identity.canonicalTitle,
    season: identity.season ?? null,
    episode: identity.episode ?? null,
    episodeRange: identity.episodeRange || null,
    mediaSnapshot: identity.mediaSnapshot || null
  }
}

function fromStoredMetadata(stored) {
  if (!stored?.provider || stored?.provider === 'local' || !stored?.mediaId || !stored?.mediaType || !stored?.mediaSnapshot) return null
  return {
    media: stored.mediaSnapshot,
    episode: stored.mediaType === 'movie' ? null : (stored.episode ?? stored.episodeRange?.first ?? 1),
    season: stored.mediaType === 'movie' ? null : (stored.season ?? 1),
    parseObject: {
      media_title: stored.canonicalTitle || getCanonicalTitle(stored.mediaSnapshot),
      anime_title: stored.canonicalTitle || getCanonicalTitle(stored.mediaSnapshot),
      season_number: stored.season ?? null,
      anime_season: stored.season ?? null,
      episode_number: stored.episode ?? stored.episodeRange?.first ?? null,
      episodeRange: stored.episodeRange || null
    },
    mediaType: stored.mediaType,
    provider: stored.provider,
    failed: false
  }
}

async function readStoredMetadata(absolutePath, rootPath) {
  const recordPath = buildMetadataRecordPath(absolutePath, rootPath)
  const raw = await readText(recordPath)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeStoredMetadata(absolutePath, rootPath, identity) {
  const recordPath = buildMetadataRecordPath(absolutePath, rootPath)
  const payload = {
    version: 1,
    absolutePath,
    ...toStoredMetadata(identity),
    savedAt: Date.now()
  }
  await writeText(recordPath, JSON.stringify(payload, null, 2))
  return recordPath
}

async function snapshotIndexedMetadata(rootPath) {
  const items = libraryRepository.listItems({})
    .filter(item => item?.provider && item?.provider !== 'local' && item?.mediaId && item?.mediaType && (item?.media || item?.mediaSnapshot) && item?.preferredFile?.absolutePath)

  for (const item of items) {
    await writeStoredMetadata(item.preferredFile.absolutePath, rootPath, {
      provider: item.provider,
      mediaId: item.mediaId,
      mediaType: item.mediaType,
      canonicalTitle: item.canonicalTitle,
      season: item.season ?? null,
      episode: item.episode ?? null,
      episodeRange: item.episodeRange || null,
      mediaSnapshot: item.media || item.mediaSnapshot
    })
  }
}

function getManagedMediaType(filePath, rootPath = getLibraryRoot()) {
  const bucket = getManagedBucketName(filePath, rootPath)
  if (bucket === 'Movies') return 'movie'
  if (bucket === 'Shows') return 'tv'
  if (bucket === 'Anime') return 'anime'
  return null
}

function inferManagedMovieMedia(videoFile) {
  const folderName = basename(dirname(videoFile.path))
  const parsed = new MovieParser(folderName || videoFile.name).parse() || new MovieParser(videoFile.name).parse()
  const title = parsed?.title || stem(videoFile.name)
  const year = parsed?.year || null
  return {
    id: `local:${makeStableKey(videoFile.path)}`,
    title: {
      userPreferred: title,
      romaji: title,
      english: title,
      native: title
    },
    mediaType: 'movie',
    source: 'LOCAL',
    format: 'MOVIE',
    type: 'MOVIE',
    year,
    seasonYear: year,
    coverImage: null,
    bannerImage: null,
    genres: [],
    tags: [],
    mediaListEntry: null,
    relations: { edges: [] },
    recommendations: { edges: [] },
    stats: { scoreDistribution: [] },
    airingSchedule: { nodes: [] },
    nextAiringEpisode: null
  }
}

function inferManagedResolved(videoFile, rootPath) {
  const mediaType = getManagedMediaType(videoFile.path, rootPath)
  if (mediaType !== 'movie') return null

  return {
    media: inferManagedMovieMedia(videoFile),
    episode: null,
    season: null,
    parseObject: {
      file_name: basename(videoFile.path),
      media_title: stem(videoFile.name),
      anime_title: stem(videoFile.name)
    },
    mediaType,
    provider: 'local',
    failed: false
  }
}

function matchSubtitleFiles(videoFile, subtitleFiles) {
  const videoStem = normalizeStem(videoFile.name)
  return subtitleFiles.filter(subtitle => {
    const subtitleStem = normalizeStem(subtitle.name)
    return subtitleStem === videoStem || subtitleStem.startsWith(videoStem) || videoStem.startsWith(subtitleStem)
  })
}

async function buildImportedVideoRecord({ itemId, sourcePath, videoPath, infoHash, sourceKind, name, size, mtime, fastHash, status = 'imported' }) {
  const fileId = buildFileId({ absolutePath: videoPath, size, fastHash })
  return {
    fileId,
    itemId,
    absolutePath: videoPath,
    canonicalPath: videoPath,
    sourcePath,
    sourceKind,
    torrentInfoHash: infoHash || null,
    status,
    size,
    mtime,
    fastHash,
    resolution: inferResolution(name),
    releaseGroup: inferReleaseGroup(name),
    importedAt: Date.now(),
    lastSeenAt: Date.now()
  }
}

async function buildImportedSubtitleRecord({ itemId, fileId, absolutePath, size, mtime, language }) {
  const subtitleId = buildSubtitleId({ absolutePath, itemId })
  return {
    subtitleId,
    itemId,
    fileId,
    absolutePath,
    language,
    format: extname(absolutePath).replace(/^\./, ''),
    size,
    mtime
  }
}

async function indexResolvedVideo(videoFile, result, subtitleFiles, infoHash, rootPath, sourceKind = 'torrent', options = {}) {
  const { moveFiles = true, usedSubtitlePaths = new Set() } = options
  const canonical = buildCanonicalPaths({
    rootPath,
    media: result.media,
    mediaType: result.mediaType,
    season: result.season,
    episode: result.episode,
    episodeRange: result.parseObject?.episodeRange,
    extension: extname(videoFile.name).replace(/^\./, '')
  })

  const movedVideo = moveFiles
    ? await movePath(videoFile.path, canonical.videoPath)
    : {
        path: videoFile.path,
        size: videoFile.size || 0,
        mtime: videoFile.mtime || Date.now()
      }
  const fastHash = await libraryRepository.autoAttachFastHash(movedVideo.path)

  // Determine season: prefer resolver result, then try filename SxxExx pattern, then default to 1
  let resolvedSeason = result.season ?? null
  if (result.mediaType !== 'movie' && !resolvedSeason) {
    const seasonMatch = String(videoFile.name || '').match(/[Ss](\d{1,2})[Ee]\d{1,2}/)
    if (seasonMatch) resolvedSeason = parseInt(seasonMatch[1], 10)
  }

  const identity = {
    provider: result.provider,
    mediaId: result.media?.id || result.media?.tmdbId || result.media?.externalIds?.tmdb,
    mediaType: result.mediaType,
    canonicalTitle: getCanonicalTitle(result.media),
    season: resolvedSeason ?? (result.mediaType === 'movie' ? null : 1),
    episode: result.mediaType === 'movie' ? null : result.episode,
    episodeRange: result.parseObject?.episodeRange || null,
    mediaSnapshot: result.media
  }

  const candidateFile = await buildImportedVideoRecord({
    itemId: null,
    sourcePath: videoFile.path,
    videoPath: movedVideo.path,
    infoHash,
    sourceKind,
    name: videoFile.name,
    size: movedVideo.size || videoFile.size || 0,
    mtime: movedVideo.mtime || videoFile.mtime || Date.now(),
    fastHash
  })

  const existingMatches = fastHash ? libraryRepository.getFilesByFastHash(fastHash) : []
  const otherMatches = existingMatches.filter(file =>
    !['unmatched', 'missing'].includes(file?.status) &&
    file?.fileId !== candidateFile.fileId &&
    file?.absolutePath !== candidateFile.absolutePath &&
    file?.canonicalPath !== candidateFile.canonicalPath &&
    file?.sourcePath !== candidateFile.sourcePath
  )
  const existingIdentityItems = libraryRepository.getItemsByIdentity(identity)
  const samePhysicalFileAlreadyAttached = existingIdentityItems.some(item =>
    (item?.fileIds || []).includes(candidateFile.fileId)
  )

  if (otherMatches.some(file => Number(file.size || 0) === Number(candidateFile.size || 0))) {
    candidateFile.status = 'duplicate'
  } else if (existingIdentityItems.length > 0 && !samePhysicalFileAlreadyAttached) {
    candidateFile.status = 'alternate'
  }

  const matchedSubtitles = matchSubtitleFiles(videoFile, subtitleFiles)
    .filter(subtitle => !usedSubtitlePaths.has(subtitle.path))
  const subtitleRecords = []
  for (const subtitle of matchedSubtitles) {
    try {
      const subtitleTarget = buildCanonicalPaths({
        rootPath,
        media: result.media,
        mediaType: result.mediaType,
        season: result.season,
        episode: result.episode,
        episodeRange: result.parseObject?.episodeRange,
        subtitleExtension: extname(subtitle.name).replace(/^\./, ''),
        language: inferLanguage(subtitle.name)
      })
      const movedSubtitle = moveFiles
        ? await movePath(subtitle.path, subtitleTarget.subtitlePath)
        : {
            path: subtitle.path,
            size: subtitle.size || 0,
            mtime: subtitle.mtime || Date.now()
          }
      usedSubtitlePaths.add(subtitle.path)
      subtitleRecords.push(await buildImportedSubtitleRecord({
        itemId: null,
        fileId: candidateFile.fileId,
        absolutePath: movedSubtitle.path,
        size: movedSubtitle.size || subtitle.size || 0,
        mtime: movedSubtitle.mtime || subtitle.mtime || Date.now(),
        language: inferLanguage(subtitle.name)
      }))
    } catch (err) {
      console.warn('[Library] Subtitle move failed, skipping:', subtitle.path, err)
    }
  }

  const item = await libraryRepository.recordImportedMedia({
    identity,
    file: candidateFile,
    subtitles: subtitleRecords
  })

  if (identity.provider !== 'local') {
    await writeStoredMetadata(movedVideo.path, rootPath, identity)
  }

  for (const subtitle of subtitleRecords) {
    await libraryRepository.upsertSubtitle({ ...subtitle, itemId: item.itemId })
  }

  return item
}

async function importResolvedVideo(videoFile, result, subtitleFiles, infoHash, rootPath, sourceKind = 'torrent', usedSubtitlePaths = new Set()) {
  return indexResolvedVideo(videoFile, result, subtitleFiles, infoHash, rootPath, sourceKind, {
    moveFiles: true,
    usedSubtitlePaths
  })
}

function mapSelectedMedia(media) {
  const provider = media?.source === 'TMDB' ? 'tmdb' : 'anilist'
  const mediaType = media?.source === 'TMDB'
    ? (media?.format === 'MOVIE' ? 'movie' : 'tv')
    : 'anime'
  return { provider, mediaType }
}

async function recordUnmatchedVideo(videoFile, infoHash, sourceKind) {
  const fastHash = await libraryRepository.autoAttachFastHash(videoFile.path)
  const fileId = buildFileId({ absolutePath: videoFile.path, size: videoFile.size || 0, fastHash })
  return libraryRepository.recordUnmatchedFile({
    fileId,
    itemId: null,
    absolutePath: videoFile.path,
    canonicalPath: videoFile.path,
    sourcePath: videoFile.path,
    sourceKind,
    torrentInfoHash: infoHash || null,
    status: 'unmatched',
    size: videoFile.size || 0,
    mtime: videoFile.mtime || Date.now(),
    fastHash,
    resolution: inferResolution(videoFile.name),
    releaseGroup: inferReleaseGroup(videoFile.name),
    importedAt: Date.now(),
    lastSeenAt: Date.now()
  })
}

async function processScannedFiles(files, { rootPath, infoHash = null, sourceKind = 'manual', moveFiles = false } = {}) {
  const entries = Array.isArray(files) ? files : []
  const videos = entries.filter(file => file.type === 'file' && videoRx.test(file.name) && !file.name.startsWith('._') && !isSubtitlePath(file.path))
  const subtitles = entries.filter(file => file.type === 'file' && subRx.test(file.name) && !file.name.startsWith('._'))
  if (!videos.length) return []

  const results = new Array(videos.length)
  const unresolved = []

  for (let index = 0; index < videos.length; index++) {
    const videoFile = videos[index]
    if (isManagedBucketPath(videoFile.path, rootPath)) {
      const stored = await readStoredMetadata(videoFile.path, rootPath)
      let restored = fromStoredMetadata(stored)
      const expectedType = getManagedMediaType(videoFile.path, rootPath)
      if (restored && (!expectedType || restored.mediaType === expectedType)) {
        // If the current filename has an explicit SxxExx season pattern, use it to override
        // stale stored season (e.g. file was renamed after initial ingest with wrong season)
        if (restored.mediaType !== 'movie') {
          const fileName = basename(videoFile.path || videoFile.name)
          const seasonMatch = fileName.match(/[Ss](\d{1,2})[Ee]\d{1,2}/)
          if (seasonMatch) {
            const filenameSeason = parseInt(seasonMatch[1], 10)
            if (restored.season !== filenameSeason) {
              restored = { ...restored, season: filenameSeason }
            }
          }
        }
        results[index] = restored
        continue
      }
    }
    unresolved.push({ index, name: basename(videoFile.path || videoFile.name) })
  }

  if (unresolved.length) {
    const resolvedResults = await MediaResolver.resolveFileMedia(unresolved.map(entry => entry.name))
    unresolved.forEach((entry, index) => {
      results[entry.index] = resolvedResults[index]
    })
  }

  const imported = []
  const usedSubtitlePaths = new Set()

  for (let index = 0; index < videos.length; index++) {
    const videoFile = videos[index]
    const resolved = results[index]
    if (resolved?.failed || !resolved?.media || !resolved?.provider || !resolved?.mediaType) {
      if (isManagedBucketPath(videoFile.path, rootPath)) {
        const inferred = inferManagedResolved(videoFile, rootPath)
        if (inferred) {
          imported.push(await indexResolvedVideo(videoFile, inferred, subtitles, infoHash, rootPath, sourceKind, {
            moveFiles,
            usedSubtitlePaths
          }))
          continue
        }
      }
      imported.push(await recordUnmatchedVideo(videoFile, infoHash, sourceKind))
      continue
    }
    imported.push(await indexResolvedVideo(videoFile, resolved, subtitles, infoHash, rootPath, sourceKind, {
      moveFiles,
      usedSubtitlePaths
    }))
  }

  return imported
}

export async function ingestDirectory({ infoHash, incomingPath, sourceKind = 'torrent' }) {
  if (!ELECTRON) return []
  const rootPath = getLibraryRoot()
  if (!rootPath || !incomingPath || !(await exists(incomingPath))) return []
  try {
    const files = await scanPath(incomingPath, true)
    const videos = files.filter(file => videoRx.test(file.name) && !file.name.startsWith('._'))
    const subtitles = files.filter(file => subRx.test(file.name) && !file.name.startsWith('._'))
    if (!videos.length) return []
    const results = await MediaResolver.resolveFileMedia(videos.map(file => file.name))
    const imported = []
    const usedSubtitlePaths = new Set()
    for (let index = 0; index < videos.length; index++) {
      const videoFile = videos[index]
      const resolved = results[index]
      if (resolved?.failed || !resolved?.media || !resolved?.provider || !resolved?.mediaType) {
        imported.push(await recordUnmatchedVideo(videoFile, infoHash, sourceKind))
        continue
      }
      imported.push(await importResolvedVideo(videoFile, resolved, subtitles, infoHash, rootPath, sourceKind, usedSubtitlePaths))
    }
    await libraryRepository.setScanState(rootPath, {
      lastScanAt: Date.now(),
      lastFullScanAt: Date.now(),
      scannerVersion: 1,
      status: 'idle'
    })
    await libraryRepository.repairLibraryItems()
    return imported
  } catch (err) {
    console.error('[Library] ingestDirectory failed:', err)
    await libraryRepository.setScanState(rootPath, { status: 'error', error: err.message })
    return []
  }
}

export async function ingestTorrentCompletion(detail) {
  const incomingPath = detail?.incomingPath || getManagedIncomingPath(detail?.infoHash)
  return ingestDirectory({ infoHash: detail?.infoHash, incomingPath, sourceKind: 'torrent' })
}

export async function rebuildLibrary() {
  const rootPath = getLibraryRoot()
  if (!rootPath || !ELECTRON) return []
  try {
    const imported = []
    const managedRoots = ['Movies', 'Shows', 'Anime']
    await snapshotIndexedMetadata(rootPath)
    await libraryRepository.clearForRebuild()
    const rootEntries = await scanPath(rootPath, false)

    imported.push(...(await processScannedFiles(rootEntries, {
      rootPath,
      sourceKind: 'manual',
      moveFiles: true
    })))

    for (const entry of rootEntries.filter(file => file.type === 'directory' && managedRoots.includes(file.name))) {
      const files = await scanPath(entry.path, true)
      if (!files.length) continue
      imported.push(...(await processScannedFiles(files, {
        rootPath,
        sourceKind: 'manual',
        moveFiles: false
      })))
    }

    for (const entry of rootEntries.filter(file => file.type === 'directory' && file.name !== '.froyo' && !managedRoots.includes(file.name))) {
      const files = await scanPath(entry.path, true)
      if (!files.length || isFroyoPath(entry.path)) continue
      imported.push(...(await processScannedFiles(files, {
        rootPath,
        sourceKind: 'manual',
        moveFiles: !isManagedBucketPath(entry.path, rootPath)
      })))
    }

    const incomingRoot = getIncomingRoot(rootPath)
    if (await exists(incomingRoot)) {
      const folders = await scanPath(incomingRoot, false)
      for (const entry of folders.filter(file => file.type === 'directory')) {
        imported.push(...(await ingestDirectory({
          infoHash: basename(entry.path),
          incomingPath: entry.path,
          sourceKind: containsSegment(entry.path, 'manual') ? 'manual' : 'torrent'
        })))
      }
    }

    await libraryRepository.setScanState(rootPath, {
      lastScanAt: Date.now(),
      lastFullScanAt: Date.now(),
      scannerVersion: 1,
      status: 'idle'
    })
    await libraryRepository.repairLibraryItems()
    return imported
  } catch (err) {
    console.error('[Library] Rebuild failed:', err)
    await libraryRepository.setScanState(rootPath, { status: 'error', error: err.message })
    throw err
  }
}

export async function sweepOrphanedFiles() {
  if (!ELECTRON) return { checked: 0, missing: 0 }
  const rootPath = getLibraryRoot()
  if (!rootPath) return { checked: 0, missing: 0 }

  const files = libraryRepository.listPrefix('file:').filter(file => file.status === 'imported' && file.absolutePath)
  let missing = 0

  for (const file of files) {
    try {
      const found = await exists(file.absolutePath)
      if (!found) {
        await libraryRepository.upsertFile({ ...file, status: 'missing' })
        if (file.itemId) await libraryRepository.syncPreferredFile(file.itemId)
        missing++
      }
    } catch {
      // skip unreadable entries
    }
  }

  return { checked: files.length, missing }
}

export async function importManualIncoming() {
  return ingestDirectory({
    infoHash: 'manual',
    incomingPath: joinPath(getIncomingRoot(), 'manual'),
    sourceKind: 'manual'
  })
}

export async function applyManualMatch(fileOrItem, media) {
  if (!ELECTRON) throw new Error('Manual library matching is only implemented for Electron in v1')
  const candidate = fileOrItem?.preferredFile || fileOrItem
  const file = typeof candidate === 'string' ? libraryRepository.getFile(candidate) : candidate
  if (!file?.absolutePath) throw new Error('No unmatched file available to match')
  if (!media?.id) throw new Error('No media selection was provided')

  const resolved = (await MediaResolver.resolveFileMedia([basename(file.absolutePath)]))?.[0] || {}
  const { provider, mediaType } = mapSelectedMedia(media)
  const season = mediaType === 'movie' ? null : (resolved?.season || resolved?.parseObject?.season || 1)
  const episode = mediaType === 'movie' ? 1 : (resolved?.episode || resolved?.parseObject?.episode || resolved?.parseObject?.episode_number || 1)
  const subtitles = (await scanPath(dirname(file.absolutePath), false))
    .filter(entry => entry.type === 'file' && subRx.test(entry.name) && !entry.name.startsWith('._'))

  const result = {
    media,
    episode,
    season,
    parseObject: {
      ...(resolved?.parseObject || {}),
      file_name: basename(file.absolutePath),
      anime_title: resolved?.parseObject?.anime_title || resolved?.parseObject?.title || media?.title?.userPreferred || media?.title?.english || media?.name,
      media_title: resolved?.parseObject?.media_title || resolved?.parseObject?.title || media?.title?.userPreferred || media?.title?.english || media?.name,
      anime_season: season,
      episode_number: episode
    },
    mediaType,
    provider,
    failed: false
  }

  const item = await importResolvedVideo({
    ...file,
    name: basename(file.absolutePath),
    path: file.absolutePath
  }, result, subtitles, file.torrentInfoHash, getLibraryRoot(), file.sourceKind || 'manual')

  await libraryRepository.removeFileRecord(file.fileId)
  return libraryRepository.repairItem(item.itemId)
}
