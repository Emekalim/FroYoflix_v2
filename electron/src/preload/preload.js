import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('IPC', {
  emit: (event, data) => {
    ipcRenderer.send(event, data)
  },
  on: (event, callback) => {
    ipcRenderer.on(event, (event, ...args) => callback(...args))
  },
  once: (event, callback) => {
    ipcRenderer.once(event, (event, ...args) => callback(...args))
  },
  off: (event) => {
    ipcRenderer.removeAllListeners(event)
  },
  invoke: (event, data) => ipcRenderer.invoke(event, data)
})
contextBridge.exposeInMainWorld('version', {
  arch: process.arch,
  platform: process.platform,
  session: process.env.XDG_SESSION_TYPE || ''
})

// Expose environment variables needed for renderer process
contextBridge.exposeInMainWorld('env', {
  TMDB_API_KEY: process.env.TMDB_API_KEY || ''
})

contextBridge.exposeInMainWorld('electron', {
  isMinimized: () => ipcRenderer.invoke('electron:isMinimized'),
  isFullScreen: () => ipcRenderer.invoke('electron:isFullScreen'),
  onMinimize: (callback) => ipcRenderer.on('electron:onMinimize', (event, isMinimized) => callback(isMinimized)),
  onFullScreen: (callback) => ipcRenderer.on('electron:onFullScreen', (event, isFullScreen) => callback(isFullScreen)),
  getYouTube: () => ipcRenderer.invoke('electron:getYouTube'),
  getTranscoderPort: () => ipcRenderer.invoke('get-transcoder-port')
})

contextBridge.exposeInMainWorld('updater', {
  getState: () => ipcRenderer.invoke('updater:get-state'),
  checkForUpdates: (options) => ipcRenderer.invoke('updater:check-for-updates', options),
  downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
  installUpdate: () => ipcRenderer.invoke('updater:install-update'),
  dismiss: (options) => ipcRenderer.invoke('updater:dismiss', options)
})

let _ports
ipcRenderer.once('port', ({ ports }) => {
  _ports = ports
  contextBridge.exposeInMainWorld('port', {
    onmessage: (cb) => {
      _ports[0].onmessage = ({ type, data }) => cb({ type, data })
    },
    postMessage: (a, b) => {
      _ports[0].postMessage(a, b)
    }
  })
  ipcRenderer.on('port', ({ ports }) => _ports = ports)
})
