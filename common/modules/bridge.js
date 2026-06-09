const noop = () => {}
const noopAsyncVoid = async () => {}
const noopAsyncBool = async () => false
const androidDefaults = {
  requestFileAccess: noopAsyncBool,
  launchExternal: noopAsyncVoid
}
const electronDefaults = {
  isMinimized: noopAsyncBool,
  isFullScreen: noopAsyncBool,
  onMinimize: noop,
  onFullScreen: noop,
  getYouTube: async () => 'https://www.youtube-nocookie.com',
  cast: {
    isAvailable: noopAsyncBool,
    getState: async () => null,
    requestSession: noopAsyncBool,
    endSession: noopAsyncBool,
    openDiagnostics: noopAsyncBool,
    loadMedia: noopAsyncBool,
    control: noopAsyncBool
  }
}

export const IPC = window.IPC
export const VERSION = window.version
export const ANDROID = window.android || androidDefaults
export const ELECTRON = window.electron || electronDefaults
export const UPDATER = window.updater || {
  getState: async () => null,
  checkForUpdates: noopAsyncBool,
  downloadUpdate: noopAsyncBool,
  installUpdate: noopAsyncBool,
  dismiss: noopAsyncBool
}
