import { createRequire } from 'node:module'
import os from 'node:os'

import electron from 'electron'

const require = createRequire(import.meta.url)
const { Bonjour } = require('bonjour-service')
const { Client, DefaultMediaReceiver } = require('castv2-client')
const { ipcMain } = electron

const RECEIVER_APP_ID = DefaultMediaReceiver.APP_ID

function createDefaultState() {
  return {
    bridgeStatus: 'idle',
    supported: true,
    secureOrigin: null,
    sdkAvailable: false,
    initialized: false,
    senderWindowReady: false,
    castState: 'UNKNOWN',
    sessionState: 'NO_SESSION',
    session: null,
    media: null,
    receivers: [],
    lastError: null
  }
}

function createDefaultMediaState(state = {}) {
  return {
    playerState: 'IDLE',
    idleReason: null,
    currentTime: 0,
    duration: 0,
    paused: true,
    ended: false,
    volume: 1,
    muted: false,
    ...state
  }
}

function firstIpv4(addresses = []) {
  return addresses.find(address => /^\d+\.\d+\.\d+\.\d+$/.test(address)) || null
}

function toReceiverRecord(service) {
  const ipAddress = firstIpv4(service.addresses)
  const txt = service.txt || {}
  return {
    id: txt.id || service.fqdn || `${service.name}:${service.port}`,
    name: service.name || txt.fn || 'Unknown Cast Device',
    friendlyName: txt.fn || service.name || 'Unknown Cast Device',
    modelName: txt.md || null,
    ipAddress,
    port: service.port || 8009,
    fqdn: service.fqdn || null,
    host: service.host || null
  }
}

function createSessionSnapshot(receiver, player) {
  const session = player?.session || null
  return {
    sessionId: session?.sessionId || null,
    appId: session?.appId || RECEIVER_APP_ID,
    deviceName: receiver?.friendlyName || receiver?.name || 'Unknown Cast Device',
    displayName: session?.displayName || receiver?.friendlyName || receiver?.name || 'Unknown Cast Device',
    statusText: session?.statusText || player?.session?.displayName || 'Connected',
    transportId: session?.transportId || null
  }
}

function castStateFor(receiverCount, hasSession) {
  if (hasSession) return 'CONNECTED'
  return receiverCount > 0 ? 'NOT_CONNECTED' : 'NO_DEVICES_AVAILABLE'
}

const TUNNEL_PREFIX = /^(utun|tun|tap|vpn|docker|vmnet|vboxnet|veth|wg|zt)/i
const PRIVATE_RFC1918 = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/
const CGNAT = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./

function getLanIp() {
  const ifaces = os.networkInterfaces()
  const candidates = []
  for (const [name, addresses] of Object.entries(ifaces)) {
    if (TUNNEL_PREFIX.test(name)) continue
    for (const iface of addresses) {
      if (iface.family !== 'IPv4' || iface.internal) continue
      if (CGNAT.test(iface.address)) continue
      candidates.push({ address: iface.address, isPrivate: PRIVATE_RFC1918.test(iface.address) })
    }
  }
  const privateAddr = candidates.find(c => c.isPrivate)
  return (privateAddr || candidates[0])?.address || null
}

function toReachableUrl(url) {
  if (!url) return url
  const lanIp = getLanIp()
  if (!lanIp) return url
  return url.replace(/^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)/, `$1${lanIp}$3`)
}

function contentTypeFromUrl(url) {
  if (!url) return 'video/mp4'
  const path = url.split('?')[0].toLowerCase()
  if (path.endsWith('.m3u8')) return 'application/x-mpegurl'
  if (path.endsWith('.mpd')) return 'application/dash+xml'
  if (path.endsWith('.mkv')) return 'video/x-matroska'
  if (path.endsWith('.webm')) return 'video/webm'
  if (path.endsWith('.ogg') || path.endsWith('.ogv')) return 'video/ogg'
  if (path.endsWith('.avi')) return 'video/x-msvideo'
  if (path.endsWith('.mov')) return 'video/quicktime'
  return 'video/mp4'
}

function normalizeCastContentType(url, requestedType = null) {
  const inferredType = contentTypeFromUrl(url)
  if (inferredType === 'application/x-mpegurl' || inferredType === 'application/dash+xml') {
    return inferredType
  }

  const supportedTypes = new Set([
    'video/mp4',
    'video/webm',
    'video/ogg',
    'application/x-mpegurl',
    'application/dash+xml'
  ])
  return supportedTypes.has(requestedType) ? requestedType : inferredType
}

function preferReceiverSafeHlsVariant(url) {
  if (!url) return url
  return url.replace(/(\/hls\/[a-f0-9]+)\/master\.m3u8(\?.*)?$/i, (_, basePath, query = '') => {
    return `${basePath}/playlist.m3u8${query}`
  })
}

function getSelectedAudioTrack(payload) {
  const value = Number(payload?.selectedAudioTrack)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function appendAudioTrack(url, selectedAudioTrack) {
  if (!url || selectedAudioTrack == null) return url
  const parsed = new URL(url)
  parsed.searchParams.set('audioTrack', String(selectedAudioTrack))
  return parsed.toString()
}

function getFileBackedHlsSource(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const filePath = parsed.searchParams.get('file')
    if (!filePath || !/\/hls\/[a-f0-9]+\//i.test(parsed.pathname)) return null
    return decodeURIComponent(filePath)
  } catch {
    return null
  }
}

function normalizeCastTrackLanguage(language) {
  const key = String(language || '').trim().toLowerCase()
  if (!key) return 'en'
  return {
    eng: 'en',
    en: 'en',
    jpn: 'ja',
    ja: 'ja',
    jp: 'ja',
    spa: 'es',
    es: 'es',
    ger: 'de',
    deu: 'de',
    de: 'de',
    fre: 'fr',
    fra: 'fr',
    fr: 'fr',
    ita: 'it',
    it: 'it',
    por: 'pt',
    pt: 'pt'
  }[key] || key
}

function getSubtitleSourcePath(selectedSubtitle) {
  if (selectedSubtitle?.sourcePath) return selectedSubtitle.sourcePath
  if (selectedSubtitle?.sourceUrl?.startsWith?.('file://')) {
    return decodeURIComponent(selectedSubtitle.sourceUrl.replace('file://', ''))
  }
  return null
}

function updateLastErrorFromError(error) {
  return error?.message || String(error)
}

function isStaleDisconnectError(error) {
  const message = String(error?.message || error || '')
  return /reading 'disconnect'/.test(message) || /reading "disconnect"/.test(message)
}

export class CastSenderService {
  constructor(mainWindow, transcoder = null) {
    this.mainWindow = mainWindow
    this.transcoder = transcoder
    this.ready = null
    this.bonjour = null
    this.browser = null
    this.receivers = new Map()
    this.currentReceiverId = null
    this.client = null
    this.player = null
    this.mediaPollInterval = null
    this.state = createDefaultState()
    this.closeReason = null

    this.registerIpc()
  }

  registerIpc() {
    ipcMain.handle('cast:isAvailable', async () => {
      await this.ensureReady()
      return this.state.supported
    })
    ipcMain.handle('cast:getState', async () => {
      await this.ensureReady()
      return this.getState()
    })
    ipcMain.handle('cast:requestSession', async (event, receiverId) => {
      await this.ensureReady()
      return this.requestSession(receiverId)
    })
    ipcMain.handle('cast:endSession', async () => {
      await this.ensureReady()
      return this.endSession()
    })
    ipcMain.handle('cast:openDiagnostics', async () => {
      await this.ensureReady()
      return this.getState()
    })
    ipcMain.handle('cast:loadMedia', async (event, payload) => {
      await this.ensureReady()
      return this.loadMedia(payload)
    })
    ipcMain.handle('cast:control', async (event, payload) => {
      await this.ensureReady()
      return this.control(payload)
    })
  }

  getState() {
    return {
      ...this.state,
      receivers: [...this.receivers.values()]
    }
  }

  updateState(patch = {}) {
    const nextPatch = { ...patch }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'media')) {
      nextPatch.media = nextPatch.media
        ? createDefaultMediaState(nextPatch.media)
        : null
    }
    this.state = {
      ...this.state,
      ...nextPatch
    }
    this.mainWindow?.webContents?.send?.('cast:state-changed', this.getState())
  }

  getCurrentVolumeState() {
    return this.state.media || createDefaultMediaState()
  }

  hasActiveSession() {
    return Boolean(
      this.client &&
      this.player &&
      this.player.connection &&
      this.player.session &&
      this.player.client
    )
  }

  clearActiveSession({
    bridgeStatus = 'ready',
    sessionState = 'NO_SESSION',
    lastError = null
  } = {}) {
    this.stopMediaPolling()
    this.closeReason = null
    this.client = null
    this.player = null
    this.currentReceiverId = null
    this.updateState({
      bridgeStatus,
      castState: castStateFor(this.receivers.size, false),
      sessionState,
      session: null,
      media: null,
      lastError
    })
    return this.getState()
  }

  buildMediaState(playerStatus = null, volumeStatus = null) {
    const previous = this.getCurrentVolumeState()
    const media = playerStatus?.media || this.player?.media?.currentSession?.media || null
    const volume = volumeStatus || null
    const playerState = playerStatus?.playerState || previous.playerState || 'IDLE'
    const idleReason = playerStatus?.idleReason || null
    const currentTime = Number.isFinite(playerStatus?.currentTime) ? playerStatus.currentTime : previous.currentTime || 0
    const duration = Number.isFinite(media?.duration) ? media.duration : previous.duration || 0
    const muted = typeof volume?.muted === 'boolean' ? volume.muted : previous.muted
    const level = Number.isFinite(volume?.level) ? volume.level : previous.volume

    return createDefaultMediaState({
      playerState,
      idleReason,
      currentTime,
      duration,
      paused: playerState !== 'PLAYING' && playerState !== 'BUFFERING',
      ended: playerState === 'IDLE' && idleReason === 'FINISHED',
      volume: Math.max(0, Math.min(1, level ?? 1)),
      muted
    })
  }

  async refreshMediaState(playerStatus = null, volumeStatus = null) {
    if (!this.hasActiveSession()) return this.getState()

    const nextPlayerStatus = playerStatus || await new Promise((resolve, reject) => {
      this.player.getStatus((error, status) => {
        if (error) {
          reject(error)
          return
        }
        resolve(status)
      })
    })

    const nextVolumeStatus = volumeStatus || await new Promise((resolve, reject) => {
      this.client.getVolume((error, volume) => {
        if (error) {
          reject(error)
          return
        }
        resolve(volume)
      })
    })

    this.updateState({
      media: this.buildMediaState(nextPlayerStatus, nextVolumeStatus)
    })
    return this.getState()
  }

  startMediaPolling() {
    this.stopMediaPolling()
    this.mediaPollInterval = setInterval(() => {
      this.refreshMediaState().catch((error) => {
        console.warn('[Cast] Failed to refresh media state:', error)
      })
    }, 1000)
    this.mediaPollInterval.unref?.()
  }

  stopMediaPolling() {
    if (this.mediaPollInterval) {
      clearInterval(this.mediaPollInterval)
      this.mediaPollInterval = null
    }
  }

  async ensureReady() {
    this.ready ||= this.start().catch((error) => {
      this.ready = null
      this.updateState({
        bridgeStatus: 'error',
        sdkAvailable: false,
        initialized: false,
        lastError: updateLastErrorFromError(error)
      })
      throw error
    })
    return this.ready
  }

  async start() {
    if (this.browser) return this.getState()

    this.bonjour = new Bonjour({}, (error) => {
      this.updateState({
        bridgeStatus: 'error',
        lastError: updateLastErrorFromError(error)
      })
    })
    this.browser = this.bonjour.find({ type: 'googlecast' }, (service) => {
      this.handleReceiverUp(service)
    })
    this.browser.on('down', (service) => {
      this.handleReceiverDown(service)
    })
    this.browser.start()

    this.updateState({
      bridgeStatus: 'ready',
      sdkAvailable: true,
      initialized: true,
      senderWindowReady: true,
      castState: castStateFor(this.receivers.size, false),
      sessionState: 'NO_SESSION',
      secureOrigin: 'native://cast-bridge',
      lastError: null
    })
    return this.getState()
  }

  handleReceiverUp(service) {
    const receiver = toReceiverRecord(service)
    if (!receiver.ipAddress) return
    this.receivers.set(receiver.id, receiver)
    this.updateState({
      bridgeStatus: 'ready',
      castState: castStateFor(this.receivers.size, this.hasActiveSession()),
      lastError: null
    })
  }

  handleReceiverDown(service) {
    const receiver = toReceiverRecord(service)
    if (receiver.id) this.receivers.delete(receiver.id)
    else if (receiver.ipAddress) {
      for (const [id, existing] of this.receivers) {
        if (existing.ipAddress === receiver.ipAddress) this.receivers.delete(id)
      }
    }
    this.updateState({
      castState: castStateFor(this.receivers.size, this.hasActiveSession())
    })
  }

  getPreferredReceiver() {
    if (this.currentReceiverId && this.receivers.has(this.currentReceiverId)) {
      return this.receivers.get(this.currentReceiverId)
    }
    return [...this.receivers.values()].sort((left, right) => left.friendlyName.localeCompare(right.friendlyName))[0] || null
  }

  attachClientLifecycle(client, receiver) {
    client.on('error', (error) => {
      this.stopMediaPolling()
      this.closeReason = 'error'
      this.updateState({
        bridgeStatus: 'error',
        castState: castStateFor(this.receivers.size, false),
        sessionState: 'SESSION_ERROR',
        media: null,
        lastError: updateLastErrorFromError(error)
      })
    })
    client.on('status', (status) => {
      const volume = status?.volume
      this.updateState({
        media: this.buildMediaState(null, volume ? {
          level: volume.level,
          muted: volume.muted
        } : null)
      })
    })
    client.on('close', () => {
      this.stopMediaPolling()
      this.client = null
      this.player = null
      this.currentReceiverId = null
      const closeReason = this.closeReason
      this.closeReason = null
      this.updateState({
        bridgeStatus: closeReason === 'error' ? 'error' : 'ready',
        castState: castStateFor(this.receivers.size, false),
        sessionState: closeReason === 'error' ? 'SESSION_ERROR' : 'SESSION_ENDED',
        session: null,
        media: null,
        lastError: closeReason === 'error' ? this.state.lastError : null
      })
    })
    if (receiver?.id) this.currentReceiverId = receiver.id
  }

  async requestSession(receiverId = null) {
    if (receiverId) this.currentReceiverId = receiverId
    if (this.hasActiveSession()) {
      this.updateState({
        castState: 'CONNECTED',
        sessionState: 'SESSION_RESUMED',
        session: createSessionSnapshot(this.getPreferredReceiver(), this.player),
        lastError: null
      })
      return this.getState()
    }

    if (this.player || this.client) {
      try {
        this.client?.close?.()
      } catch {}
      this.clearActiveSession()
    }

    const receiver = this.getPreferredReceiver()
    if (!receiver) {
      this.updateState({
        bridgeStatus: 'ready',
        castState: 'NO_DEVICES_AVAILABLE',
        sessionState: 'NO_SESSION',
        session: null,
        lastError: 'No Google Cast receivers found on the local network'
      })
      throw new Error('No Google Cast receivers found on the local network')
    }

    this.updateState({
      bridgeStatus: 'connecting',
      castState: 'CONNECTING',
      sessionState: 'SESSION_STARTING',
      session: {
        deviceName: receiver.friendlyName,
        displayName: receiver.friendlyName
      },
      lastError: null
    })

    const client = new Client()
    this.attachClientLifecycle(client, receiver)

    const player = await new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('Timed out while connecting to the selected Cast receiver'))
      }, 15000)
      timeout.unref?.()

      const onError = (error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        client.off('error', onError)
        reject(error)
      }

      client.on('error', onError)
      client.connect({ host: receiver.ipAddress, port: receiver.port }, () => {
        client.launch(DefaultMediaReceiver, (error, launchedPlayer) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          client.off('error', onError)
          if (error) {
            reject(error)
            return
          }
          resolve(launchedPlayer)
        })
      })
    }).catch((error) => {
      this.closeReason = 'error'
      client.close()
      throw error
    })

    this.client = client
    this.player = player

    player.on('close', () => {
      if (this.player !== player) return
      this.stopMediaPolling()
      this.closeReason ||= 'ended'
      if (this.client === client) client.close()
    })

    player.on('status', () => {
      this.updateState({
        bridgeStatus: 'ready',
        castState: 'CONNECTED',
        sessionState: 'SESSION_STARTED',
        session: createSessionSnapshot(receiver, player),
        lastError: null
      })
      this.refreshMediaState().catch((error) => {
        console.warn('[Cast] Failed to refresh media state from status broadcast:', error)
      })
    })

    await this.refreshMediaState().catch(() => {})
    this.startMediaPolling()
    this.updateState({
      bridgeStatus: 'ready',
      castState: 'CONNECTED',
      sessionState: 'SESSION_STARTED',
      session: createSessionSnapshot(receiver, player),
      lastError: null
    })
    return this.getState()
  }

  async loadMedia(payload = {}) {
    if (!this.hasActiveSession()) {
      throw new Error('No active Cast session. Connect to a device first.')
    }

    const rawUrl = payload.url
    if (!rawUrl) throw new Error('loadMedia: url is required')

    const TRANSCODE_EXTS = /\.(mkv|avi|wmv|flv|ts|m2ts)$/i

    let url
    let contentType
    const lanIp = getLanIp()
    const selectedAudioTrack = getSelectedAudioTrack(payload)
    let tracks = []
    let activeTrackIds = []

    const prepareTranscodedHls = async (filePath) => {
      const audioTrackQuery = selectedAudioTrack != null
        ? `&audioTrack=${selectedAudioTrack}`
        : ''
      const initRes = await fetch(`http://localhost:${this.transcoder.port}/init?file=${encodeURIComponent(filePath)}${audioTrackQuery}`)
      if (!initRes.ok) throw new Error(`Transcoder init failed: ${initRes.status}`)
      const { url: hlsUrl, hash } = await initRes.json()

      let waited = 0
      while (waited < 30000) {
        const statusRes = await fetch(`http://localhost:${this.transcoder.port}/status?hash=${hash}`)
        const status = await statusRes.json()
        if (status.firstSegmentExists) break
        await new Promise(r => setTimeout(r, 500))
        waited += 500
      }

      return preferReceiverSafeHlsVariant(
        hlsUrl.replace(/localhost|127\.0\.0\.1/, lanIp || 'localhost')
      )
    }

    const prepareSelectedSubtitleTrack = async () => {
      if (!this.transcoder?.port) return
      const selectedSubtitle = payload?.selectedSubtitle
      const sourcePath = getSubtitleSourcePath(selectedSubtitle)
      if (!selectedSubtitle || !sourcePath) return

      const vttPath = await this.transcoder.ensureCastSubtitleVtt(sourcePath)
      const subtitleUrl = this.transcoder.getFileUrl(vttPath, lanIp)
      tracks = [{
        trackId: 1,
        type: 'TEXT',
        trackContentId: subtitleUrl,
        trackContentType: 'text/vtt',
        name: selectedSubtitle.name || selectedSubtitle.language || 'Subtitles',
        language: normalizeCastTrackLanguage(selectedSubtitle.language),
        subtype: 'SUBTITLES'
      }]
      activeTrackIds = [1]
    }

    if (rawUrl.startsWith('file://')) {
      if (!this.transcoder?.port) throw new Error('File server not ready — transcoder has not started yet.')
      const filePath = decodeURIComponent(rawUrl.replace('file://', ''))

      if (TRANSCODE_EXTS.test(filePath)) {
        url = await prepareTranscodedHls(filePath)
        contentType = 'application/x-mpegurl'
      } else {
        url = this.transcoder.getFileUrl(filePath, lanIp)
        contentType = normalizeCastContentType(url, payload.contentType)
      }
    } else {
      const originalFile = this.transcoder?.port ? getFileBackedHlsSource(rawUrl) : null
      if (originalFile && TRANSCODE_EXTS.test(originalFile)) {
        url = await prepareTranscodedHls(originalFile)
        contentType = 'application/x-mpegurl'
      } else {
        url = preferReceiverSafeHlsVariant(appendAudioTrack(toReachableUrl(rawUrl), selectedAudioTrack))
        contentType = normalizeCastContentType(url, payload.contentType)
      }
    }

    try {
      await prepareSelectedSubtitleTrack()
    } catch (error) {
      console.warn('[Cast] Failed to prepare subtitle track:', error)
      tracks = []
      activeTrackIds = []
    }

    const streamType = 'BUFFERED'

    const title = payload.title || null
    const thumbnail = payload.thumbnail || null
    const startTime = Number.isFinite(payload.startTime) && payload.startTime > 0
      ? payload.startTime
      : undefined

    const media = {
      contentId: url,
      contentType,
      streamType,
      metadata: {
        metadataType: 0,
        title: title || '',
        images: thumbnail ? [{ url: thumbnail }] : []
      },
      tracks
    }

    const loadOptions = { autoplay: true }
    if (startTime !== undefined) loadOptions.currentTime = startTime
    if (activeTrackIds.length) loadOptions.activeTrackIds = activeTrackIds

    await new Promise((resolve, reject) => {
      this.player.load(media, loadOptions, (error, status) => {
        if (error) { reject(error); return }
        resolve(status)
      })
    })

    this.updateState({
      bridgeStatus: 'ready',
      castState: 'CONNECTED',
      sessionState: 'SESSION_STARTED',
      session: {
        ...this.state.session,
        statusText: title ? `Playing: ${title}` : 'Playing'
      },
      lastError: null
    })
    await this.refreshMediaState().catch(() => {})
    return this.getState()
  }

  async control(payload = {}) {
    if (!this.hasActiveSession()) {
      throw new Error('No active Cast session. Connect to a device first.')
    }

    const action = payload?.action
    if (!action) throw new Error('cast:control requires an action')

    if (action === 'play') {
      await new Promise((resolve, reject) => {
        this.player.play((error) => error ? reject(error) : resolve())
      })
    } else if (action === 'pause') {
      await new Promise((resolve, reject) => {
        this.player.pause((error) => error ? reject(error) : resolve())
      })
    } else if (action === 'seek') {
      const currentTime = Number(payload?.currentTime)
      if (!Number.isFinite(currentTime) || currentTime < 0) {
        throw new Error('cast:control seek requires a non-negative currentTime')
      }
      await new Promise((resolve, reject) => {
        this.player.seek(currentTime, (error) => error ? reject(error) : resolve())
      })
    } else if (action === 'setVolume') {
      const level = Number(payload?.level)
      if (!Number.isFinite(level)) {
        throw new Error('cast:control setVolume requires a numeric level')
      }
      await new Promise((resolve, reject) => {
        this.client.setVolume({ level: Math.max(0, Math.min(1, level)) }, (error) => error ? reject(error) : resolve())
      })
    } else if (action === 'setMuted') {
      const muted = Boolean(payload?.muted)
      await new Promise((resolve, reject) => {
        this.client.setVolume({ muted }, (error) => error ? reject(error) : resolve())
      })
    } else {
      throw new Error(`Unsupported cast control action: ${action}`)
    }

    await this.refreshMediaState().catch(() => {})
    return this.getState()
  }

  async endSession() {
    if (!this.client || !this.player) {
      return this.clearActiveSession()
    }

    if (!this.hasActiveSession()) {
      try {
        this.client?.close?.()
      } catch {}
      return this.clearActiveSession({ sessionState: 'SESSION_ENDED' })
    }

    const client = this.client
    const player = this.player
    this.stopMediaPolling()
    this.closeReason = 'ended'

    await new Promise((resolve, reject) => {
      client.stop(player, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    }).catch((error) => {
      if (isStaleDisconnectError(error)) {
        try {
          client.close()
        } catch {}
        return null
      }
      this.closeReason = 'error'
      client.close()
      this.clearActiveSession({
        bridgeStatus: 'error',
        sessionState: 'SESSION_ERROR',
        lastError: updateLastErrorFromError(error)
      })
      throw error
    })

    try {
      client.close()
    } catch {}
    return this.clearActiveSession({ sessionState: 'SESSION_ENDED' })
  }

  async destroy() {
    this.stopMediaPolling()
    if (this.browser) {
      this.browser.stop()
      this.browser = null
    }
    if (this.bonjour) {
      this.bonjour.destroy()
      this.bonjour = null
    }
    if (this.client) {
      this.client.close()
      this.client = null
    }
    this.player = null
    this.currentReceiverId = null
  }
}
