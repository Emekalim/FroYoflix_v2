import { writable } from 'simple-store-svelte'
import { SUPPORTS } from '@/modules/support.js'
import { IPC, UPDATER } from '@/modules/bridge.js'
export {
  createDefaultUpdaterState,
  getUpdaterPrimaryAction,
  getUpdaterStatusMessage,
  shouldShowUpdateModal,
  UPDATE_PHASES
} from '@/modules/updater-helpers.js'
import {
  createDefaultUpdaterState,
  UPDATE_PHASES
} from '@/modules/updater-helpers.js'

function normalizeState(state) {
  return createDefaultUpdaterState(state || {})
}

export const updaterState = writable(createDefaultUpdaterState())

if (!SUPPORTS.isAndroid && typeof window !== 'undefined' && window.updater) {
  UPDATER.getState()
    .then(state => updaterState.set(normalizeState(state)))
    .catch(() => {})

  IPC.on('updater:state-changed', (state) => {
    updaterState.set(normalizeState(state))
  })
}

export async function checkForUpdates(manual = true) {
  if (SUPPORTS.isAndroid) return false
  return UPDATER.checkForUpdates({ manual })
}

export async function downloadUpdate() {
  if (SUPPORTS.isAndroid) return false
  return UPDATER.downloadUpdate()
}

export async function installUpdate() {
  if (SUPPORTS.isAndroid) return false
  return UPDATER.installUpdate()
}

export async function dismissUpdate(kind) {
  if (SUPPORTS.isAndroid) return false
  return UPDATER.dismiss({ kind })
}
