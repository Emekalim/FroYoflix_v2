import { writable } from 'simple-store-svelte'
import { SUPPORTS } from '@/modules/support.js'
import { ELECTRON, IPC } from '@/modules/bridge.js'

export function createDefaultCastState(state = {}) {
  return {
    bridgeStatus: 'idle',
    supported: !SUPPORTS.isAndroid,
    secureOrigin: null,
    sdkAvailable: false,
    initialized: false,
    senderWindowReady: false,
    castState: 'UNKNOWN',
    sessionState: 'NO_SESSION',
    session: null,
    media: null,
    receivers: [],
    lastError: null,
    ...state
  }
}

export const castState = writable(createDefaultCastState())

function normalizeState(state) {
  return createDefaultCastState(state || {})
}

if (!SUPPORTS.isAndroid && typeof window !== 'undefined' && window.electron?.cast) {
  ELECTRON.cast.getState()
    .then(state => castState.set(normalizeState(state)))
    .catch(() => {})

  IPC.on('cast:state-changed', (state) => {
    castState.set(normalizeState(state))
  })
}

export async function openCastDiagnostics() {
  if (SUPPORTS.isAndroid) return false
  const state = await ELECTRON.cast.openDiagnostics()
  castState.set(normalizeState(state))
  return state
}

export async function requestCastSession(receiverId = null) {
  if (SUPPORTS.isAndroid) return false
  const state = await ELECTRON.cast.requestSession(receiverId)
  castState.set(normalizeState(state))
  return state
}

export async function endCastSession() {
  if (SUPPORTS.isAndroid) return false
  const state = await ELECTRON.cast.endSession()
  castState.set(normalizeState(state))
  return state
}

export async function refreshCastState() {
  if (SUPPORTS.isAndroid) return false
  const state = await ELECTRON.cast.getState()
  castState.set(normalizeState(state))
  return state
}

export async function castMedia(url, contentType, metadata = {}) {
  if (SUPPORTS.isAndroid) return false
  const state = await ELECTRON.cast.loadMedia({ url, contentType, ...metadata })
  castState.set(normalizeState(state))
  return state
}

export async function controlCast(action, payload = {}) {
  if (SUPPORTS.isAndroid) return false
  const state = await ELECTRON.cast.control({ action, ...payload })
  castState.set(normalizeState(state))
  return state
}

export async function playCast() {
  return controlCast('play')
}

export async function pauseCast() {
  return controlCast('pause')
}

export async function seekCast(currentTime) {
  return controlCast('seek', { currentTime })
}

export async function setCastVolume(level) {
  return controlCast('setVolume', { level })
}

export async function setCastMuted(muted) {
  return controlCast('setMuted', { muted })
}
