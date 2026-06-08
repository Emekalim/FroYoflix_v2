export const UPDATE_PHASES = Object.freeze({
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  DOWNLOADING: 'downloading',
  DOWNLOADED: 'downloaded',
  INSTALLING: 'installing',
  ERROR: 'error',
  SKIPPED: 'skipped',
  DEFERRED: 'deferred'
})

export function createDefaultUpdaterState(overrides = {}) {
  return {
    phase: UPDATE_PHASES.IDLE,
    currentVersion: '',
    targetVersion: '',
    downloadProgress: 0,
    releaseNotesUrl: '',
    releaseDate: '',
    channel: 'stable',
    dismissedVersion: '',
    downloadUrl: '',
    manualDownloadOnly: false,
    error: null,
    manualCheckInFlight: false,
    canDownload: false,
    canInstall: false,
    ...overrides
  }
}

export function shouldShowUpdateModal(state) {
  return state.phase === UPDATE_PHASES.AVAILABLE ||
    state.phase === UPDATE_PHASES.DOWNLOADED ||
    (state.phase === UPDATE_PHASES.ERROR && (state.error?.stage === 'download' || state.error?.manual))
}

export function getUpdaterPrimaryAction(state) {
  switch (state.phase) {
    case UPDATE_PHASES.CHECKING:
      return { label: 'Checking for Updates...', action: null, disabled: true }
    case UPDATE_PHASES.AVAILABLE:
      return { label: state.manualDownloadOnly ? 'Download ZIP' : 'Download Update', action: 'download', disabled: !state.canDownload }
    case UPDATE_PHASES.DOWNLOADING:
      return { label: 'Downloading Update...', action: null, disabled: true }
    case UPDATE_PHASES.DOWNLOADED:
      return { label: 'Install Update', action: 'install', disabled: !state.canInstall }
    case UPDATE_PHASES.INSTALLING:
      return { label: 'Installing Update...', action: null, disabled: true }
    case UPDATE_PHASES.ERROR:
      return { label: state.error?.stage === 'download' ? 'Retry Download' : 'Check for Updates', action: state.error?.stage === 'download' ? 'download' : 'check', disabled: false }
    case UPDATE_PHASES.SKIPPED:
      return { label: 'Check for Updates', action: 'check', disabled: false }
    case UPDATE_PHASES.DEFERRED:
      if (state.canInstall) return { label: 'Install Update', action: 'install', disabled: false }
      if (state.canDownload) return { label: state.manualDownloadOnly ? 'Download ZIP' : 'Download Update', action: 'download', disabled: false }
      return { label: 'Check for Updates', action: 'check', disabled: false }
    default:
      return { label: 'Check for Updates', action: 'check', disabled: false }
  }
}

export function getUpdaterStatusMessage(state) {
  switch (state.phase) {
    case UPDATE_PHASES.CHECKING:
      return 'Looking for a newer release.'
    case UPDATE_PHASES.AVAILABLE:
      return state.targetVersion
        ? (state.manualDownloadOnly
            ? `v${state.targetVersion} is available. Download the ZIP and replace the app manually.`
            : `v${state.targetVersion} is available to download.`)
        : 'A new update is available.'
    case UPDATE_PHASES.DOWNLOADING:
      return `Downloading v${state.targetVersion || ''} ${state.downloadProgress ? `(${Math.round(state.downloadProgress)}%)` : ''}`.trim()
    case UPDATE_PHASES.DOWNLOADED:
      return state.targetVersion ? `v${state.targetVersion} has been downloaded and is ready to install.` : 'An update is ready to install.'
    case UPDATE_PHASES.INSTALLING:
      return 'Closing the app and preparing the update.'
    case UPDATE_PHASES.ERROR:
      return state.error?.message || 'Update check failed.'
    case UPDATE_PHASES.SKIPPED:
      return state.targetVersion ? `v${state.targetVersion} is currently skipped.` : 'This version is skipped.'
    case UPDATE_PHASES.DEFERRED:
      return state.targetVersion
        ? (state.manualDownloadOnly
            ? `v${state.targetVersion} download was opened. Replace the app manually after the ZIP finishes downloading.`
            : `v${state.targetVersion} has been deferred for this session.`)
        : 'Update reminder deferred for this session.'
    default:
      return 'You are on the current release unless a new update is found.'
  }
}
