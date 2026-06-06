import { autoUpdater } from 'electron-updater'
import { app, ipcMain } from 'electron'
import path from 'node:path'
import { development, store } from '../util.js'
import {
  createUpdaterState,
  DEFAULT_UPDATE_CONFIG,
  getReleaseNotesUrl,
  normalizeError,
  UPDATE_PHASES
} from './state.js'
import { resolveAvailablePhase, resurfaceDismissedState } from './policy.js'

const SKIPPED_VERSION_KEY = 'updaterSkippedVersion'
const STATE_EVENT = 'updater:state-changed'
const DEV_ENABLE_ENV = 'FROYO_FORCE_DEV_UPDATES'
const DEV_SIMULATE_ENV = 'FROYO_SIMULATE_DEV_UPDATE'
const DEV_TARGET_VERSION_ENV = 'FROYO_DEV_UPDATE_VERSION'
const DEV_RELEASE_NOTES_ENV = 'FROYO_DEV_UPDATE_NOTES_URL'
const DEV_UPDATE_DEFAULT_DELAY_MS = 250

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function compareVersions(left = '', right = '') {
  const leftParts = String(left).split('.').map(part => Number(part) || 0)
  const rightParts = String(right).split('.').map(part => Number(part) || 0)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0
    const rightPart = rightParts[index] || 0
    if (leftPart > rightPart) return 1
    if (leftPart < rightPart) return -1
  }
  return 0
}

function incrementPatchVersion(version = '0.0.0') {
  const parts = String(version).split('.').map(part => Number(part) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

export default class UpdaterService {
  /**
   * @param {import('electron').BrowserWindow} window
   * @param {{ onInstallRequested: () => void, config?: Partial<typeof DEFAULT_UPDATE_CONFIG> }} options
   */
  constructor(window, { onInstallRequested, config = {} }) {
    this.window = window
    this.onInstallRequested = onInstallRequested
    this.config = { ...DEFAULT_UPDATE_CONFIG, ...config }
    this.devUpdatesEnabled = development && isTruthyEnv(process.env[DEV_ENABLE_ENV])
    this.devSimulationEnabled = this.devUpdatesEnabled && isTruthyEnv(process.env[DEV_SIMULATE_ENV])
    this.state = createUpdaterState({
      currentVersion: app.getVersion(),
      channel: this.config.channel
    })

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowPrerelease = this.config.allowPrerelease
    autoUpdater.forceDevUpdateConfig = this.devUpdatesEnabled
    if (this.devUpdatesEnabled) {
      autoUpdater.updateConfigPath = path.join(process.cwd(), 'dev-app-update.yml')
    }

    this.registerAutoUpdaterEvents()
    this.registerIpc()
  }

  destroyed = false
  state
  currentUpdateInfo = null
  sessionDeferredVersion = ''
  checkInFlight = false
  installRequested = false
  pollInterval = null
  initialCheckTimeout = null
  simulatedDownloadTimeout = null
  simulatedInstallTimeout = null
  devUpdatesEnabled = false
  devSimulationEnabled = false
  onInstallRequested
  window
  config

  registerAutoUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
      this.setState({
        phase: UPDATE_PHASES.CHECKING,
        error: null
      })
    })

    autoUpdater.on('update-available', (info) => {
      this.currentUpdateInfo = info
      const nextState = this.buildAvailableState(info, this.lastCheckWasManual)
      this.setState(nextState)
    })

    autoUpdater.on('update-not-available', () => {
      this.currentUpdateInfo = null
      this.sessionDeferredVersion = ''
      this.setState({
        phase: UPDATE_PHASES.IDLE,
        targetVersion: '',
        downloadProgress: 0,
        releaseNotesUrl: '',
        releaseDate: '',
        dismissedVersion: '',
        error: null,
        canDownload: false,
        canInstall: false
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        phase: UPDATE_PHASES.DOWNLOADING,
        downloadProgress: progress?.percent ?? this.state.downloadProgress,
        error: null,
        canDownload: false,
        canInstall: false
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.currentUpdateInfo = info || this.currentUpdateInfo
      this.setState({
        phase: UPDATE_PHASES.DOWNLOADED,
        targetVersion: info?.version || this.state.targetVersion,
        downloadProgress: 100,
        releaseNotesUrl: getReleaseNotesUrl(info?.version || this.state.targetVersion, this.config.releasesBaseUrl),
        releaseDate: info?.releaseDate || this.state.releaseDate || '',
        dismissedVersion: '',
        error: null,
        canDownload: false,
        canInstall: true
      })
    })

    autoUpdater.on('error', (error) => {
      const stage = this.state.phase === UPDATE_PHASES.DOWNLOADING ? 'download' : 'check'
      this.setState({
        phase: UPDATE_PHASES.ERROR,
        error: normalizeError(error, stage, this.lastCheckWasManual),
        downloadProgress: stage === 'download' ? this.state.downloadProgress : 0,
        canDownload: stage === 'download' && Boolean(this.state.targetVersion),
        canInstall: false
      })
    })
  }

  registerIpc() {
    ipcMain.handle('updater:get-state', () => this.getState())
    ipcMain.handle('updater:check-for-updates', (event, options) => this.checkForUpdates(options))
    ipcMain.handle('updater:download-update', () => this.downloadUpdate())
    ipcMain.handle('updater:install-update', () => this.installUpdate())
    ipcMain.handle('updater:dismiss', (event, options) => this.dismiss(options))
  }

  start() {
    if (this.destroyed || (development && !this.devUpdatesEnabled)) return
    clearTimeout(this.initialCheckTimeout)
    clearInterval(this.pollInterval)
    this.initialCheckTimeout = setTimeout(() => {
      this.checkForUpdates({ manual: false }).catch(() => {})
    }, this.config.initialCheckDelayMs)
    this.initialCheckTimeout.unref?.()
    this.pollInterval = setInterval(() => {
      this.checkForUpdates({ manual: false }).catch(() => {})
    }, this.config.checkIntervalMs)
    this.pollInterval.unref?.()
  }

  destroy() {
    this.destroyed = true
    clearTimeout(this.initialCheckTimeout)
    clearInterval(this.pollInterval)
    clearTimeout(this.simulatedDownloadTimeout)
    clearTimeout(this.simulatedInstallTimeout)
  }

  getState() {
    return { ...this.state }
  }

  async checkForUpdates({ manual = false } = {}) {
    if ((development && !this.devUpdatesEnabled) || this.destroyed || this.checkInFlight || this.state.phase === UPDATE_PHASES.DOWNLOADING || this.state.phase === UPDATE_PHASES.INSTALLING) {
      return false
    }

    if (manual && [UPDATE_PHASES.SKIPPED, UPDATE_PHASES.DEFERRED].includes(this.state.phase) && this.state.targetVersion) {
      this.setState({
        phase: resurfaceDismissedState(this.state),
        dismissedVersion: '',
        error: null,
        canDownload: !this.state.canInstall,
        canInstall: this.state.canInstall
      })
      return true
    }

    if ([UPDATE_PHASES.AVAILABLE, UPDATE_PHASES.DOWNLOADED].includes(this.state.phase)) {
      return true
    }

    this.checkInFlight = true
    this.lastCheckWasManual = manual
    this.setState({
      manualCheckInFlight: manual,
      error: null
    })

    try {
      if (this.devSimulationEnabled) {
        await this.runSimulatedCheck(manual)
        return true
      }
      await autoUpdater.checkForUpdates()
      return true
    } catch (error) {
      this.setState({
        phase: UPDATE_PHASES.ERROR,
        error: normalizeError(error, 'check', manual),
        canDownload: false,
        canInstall: false
      })
      return false
    } finally {
      this.checkInFlight = false
      this.lastCheckWasManual = false
      this.setState({
        manualCheckInFlight: false
      })
    }
  }

  async downloadUpdate() {
    if (this.destroyed || this.state.phase !== UPDATE_PHASES.AVAILABLE || !this.state.canDownload) return false

    if (this.devSimulationEnabled) {
      return this.runSimulatedDownload()
    }

    this.setState({
      phase: UPDATE_PHASES.DOWNLOADING,
      downloadProgress: 0,
      error: null,
      canDownload: false,
      canInstall: false
    })

    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch (error) {
      this.setState({
        phase: UPDATE_PHASES.ERROR,
        error: normalizeError(error, 'download', false),
        canDownload: true,
        canInstall: false
      })
      return false
    }
  }

  installUpdate() {
    if (this.destroyed || this.state.phase !== UPDATE_PHASES.DOWNLOADED || !this.state.canInstall || this.installRequested) return false

    if (this.devSimulationEnabled) {
      return this.runSimulatedInstall()
    }

    this.installRequested = true
    this.setState({
      phase: UPDATE_PHASES.INSTALLING,
      error: null,
      canDownload: false,
      canInstall: false
    })
    this.onInstallRequested?.()
    return true
  }

  finalizeInstall(forceInstall = false) {
    if (forceInstall && this.installRequested) {
      autoUpdater.quitAndInstall(true, true)
      return true
    }
    return false
  }

  dismiss({ kind } = {}) {
    if (!this.state.targetVersion) return false

    if (kind === 'skip-version') {
      store.set(SKIPPED_VERSION_KEY, this.state.targetVersion)
      this.sessionDeferredVersion = ''
      this.setState({
        phase: UPDATE_PHASES.SKIPPED,
        dismissedVersion: this.state.targetVersion,
        error: null,
        canDownload: false,
        canInstall: false
      })
      return true
    }

    if (kind === 'remind-later') {
      this.sessionDeferredVersion = this.state.targetVersion
      this.setState({
        phase: UPDATE_PHASES.DEFERRED,
        dismissedVersion: this.state.targetVersion,
        error: null,
        canDownload: this.state.canDownload,
        canInstall: this.state.canInstall
      })
      return true
    }

    return false
  }

  buildAvailableState(info, manual) {
    const targetVersion = info?.version || ''
    const skippedVersion = store.get(SKIPPED_VERSION_KEY) || ''
    const deferredVersion = this.sessionDeferredVersion || ''
    const phase = resolveAvailablePhase({
      targetVersion,
      manual,
      skippedVersion,
      deferredVersion
    })

    return {
      phase,
      targetVersion,
      downloadProgress: 0,
      releaseNotesUrl: info?.releaseNotesUrl || getReleaseNotesUrl(targetVersion, this.config.releasesBaseUrl),
      releaseDate: info?.releaseDate || '',
      dismissedVersion: phase === UPDATE_PHASES.AVAILABLE ? '' : targetVersion,
      error: null,
      canDownload: phase === UPDATE_PHASES.AVAILABLE,
      canInstall: false
    }
  }

  async runSimulatedCheck(manual) {
    const info = this.getSimulatedUpdateInfo()
    await new Promise(resolve => {
      setTimeout(resolve, DEV_UPDATE_DEFAULT_DELAY_MS)
    })

    if (!info || compareVersions(info.version, this.state.currentVersion) <= 0) {
      this.currentUpdateInfo = null
      this.sessionDeferredVersion = ''
      this.setState({
        phase: UPDATE_PHASES.IDLE,
        targetVersion: '',
        downloadProgress: 0,
        releaseNotesUrl: '',
        releaseDate: '',
        dismissedVersion: '',
        error: null,
        canDownload: false,
        canInstall: false
      })
      return
    }

    this.currentUpdateInfo = info
    this.setState(this.buildAvailableState(info, manual))
  }

  runSimulatedDownload() {
    this.setState({
      phase: UPDATE_PHASES.DOWNLOADING,
      downloadProgress: 0,
      error: null,
      canDownload: false,
      canInstall: false
    })

    const progressSteps = [20, 55, 82, 100]
    let stepIndex = 0

    return new Promise(resolve => {
      const tick = () => {
        if (this.destroyed) {
          resolve(false)
          return
        }

        const percent = progressSteps[stepIndex]
        stepIndex += 1
        this.setState({
          phase: UPDATE_PHASES.DOWNLOADING,
          downloadProgress: percent,
          error: null,
          canDownload: false,
          canInstall: false
        })

        if (percent >= 100) {
          this.setState({
            phase: UPDATE_PHASES.DOWNLOADED,
            downloadProgress: 100,
            dismissedVersion: '',
            error: null,
            canDownload: false,
            canInstall: true
          })
          resolve(true)
          return
        }

        this.simulatedDownloadTimeout = setTimeout(tick, DEV_UPDATE_DEFAULT_DELAY_MS)
      }

      this.simulatedDownloadTimeout = setTimeout(tick, DEV_UPDATE_DEFAULT_DELAY_MS)
    })
  }

  runSimulatedInstall() {
    this.setState({
      phase: UPDATE_PHASES.INSTALLING,
      error: null,
      canDownload: false,
      canInstall: false
    })

    this.simulatedInstallTimeout = setTimeout(() => {
      if (this.destroyed) return
      const installedVersion = this.state.targetVersion || this.state.currentVersion
      this.currentUpdateInfo = null
      this.sessionDeferredVersion = ''
      store.delete?.(SKIPPED_VERSION_KEY)
      this.setState({
        phase: UPDATE_PHASES.IDLE,
        currentVersion: installedVersion,
        targetVersion: '',
        downloadProgress: 0,
        releaseNotesUrl: '',
        releaseDate: '',
        dismissedVersion: '',
        error: null,
        canDownload: false,
        canInstall: false
      })
    }, DEV_UPDATE_DEFAULT_DELAY_MS * 3)

    return true
  }

  getSimulatedUpdateInfo() {
    const simulatedVersion = process.env[DEV_TARGET_VERSION_ENV] || incrementPatchVersion(this.state.currentVersion)
    return {
      version: simulatedVersion,
      releaseDate: new Date().toISOString(),
      releaseNotesUrl: process.env[DEV_RELEASE_NOTES_ENV] || getReleaseNotesUrl(simulatedVersion, this.config.releasesBaseUrl)
    }
  }

  setState(patch) {
    this.state = {
      ...this.state,
      ...patch
    }
    this.emitState()
  }

  emitState() {
    if (this.destroyed || !this.window || this.window.isDestroyed()) return
    this.window.webContents.send(STATE_EVENT, this.getState())
  }
}
