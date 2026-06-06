export const UPDATE_CHANNELS = Object.freeze({
  STABLE: 'stable',
  BETA: 'beta'
})

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

export const DEFAULT_UPDATE_CONFIG = Object.freeze({
  channel: UPDATE_CHANNELS.STABLE,
  allowPrerelease: false,
  initialCheckDelayMs: 2_500,
  checkIntervalMs: 300_000,
  releasesBaseUrl: 'https://github.com/Emekalim/FroYoflix_v2/releases'
})

export function createUpdaterState({
  currentVersion = '',
  channel = DEFAULT_UPDATE_CONFIG.channel
} = {}) {
  return {
    phase: UPDATE_PHASES.IDLE,
    currentVersion,
    targetVersion: '',
    downloadProgress: 0,
    releaseNotesUrl: '',
    releaseDate: '',
    channel,
    dismissedVersion: '',
    error: null,
    manualCheckInFlight: false,
    canDownload: false,
    canInstall: false
  }
}

export function getReleaseNotesUrl(version, releasesBaseUrl = DEFAULT_UPDATE_CONFIG.releasesBaseUrl) {
  if (!version) return `${releasesBaseUrl}/latest`
  const sanitized = version.startsWith('v') ? version : `v${version}`
  return `${releasesBaseUrl}/tag/${sanitized}`
}

export function normalizeError(error, stage, manual = false) {
  if (!error) return null
  return {
    message: error.message || String(error),
    stage,
    manual
  }
}
