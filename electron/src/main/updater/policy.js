import { UPDATE_PHASES } from './state.js'

export function resolveAvailablePhase({ targetVersion, manual = false, skippedVersion = '', deferredVersion = '' }) {
  if (!manual && targetVersion && targetVersion === skippedVersion) return UPDATE_PHASES.SKIPPED
  if (!manual && targetVersion && targetVersion === deferredVersion) return UPDATE_PHASES.DEFERRED
  return UPDATE_PHASES.AVAILABLE
}

export function resurfaceDismissedState(state) {
  return state?.canInstall ? UPDATE_PHASES.DOWNLOADED : UPDATE_PHASES.AVAILABLE
}
