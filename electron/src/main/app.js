import { join } from 'node:path'
import process from 'node:process'

import { toXmlString } from 'powertoast'
import { youtubeServer } from './youtube.js'
import Jimp from 'jimp'
import fs, { readdirSync, statSync, rmSync } from 'fs'

import { BrowserWindow, MessageChannelMain, Notification, Tray, Menu, nativeImage, app, dialog, ipcMain, powerMonitor, shell, session } from 'electron'
import electronShutdownHandler from '@paymoapp/electron-shutdown-handler'

import { development, getWindowState, saveWindowState, getDefaultBounds } from './util.js'
import Discord from './discord.js'
import Protocol from './protocol.js'
import Updater from './updater.js'
import Dialog from './dialog.js'
import Debug from './debugger.js'
import { Transcoder } from './transcoder.js'

export default class App {
  icon = nativeImage.createFromPath(join(__dirname, process.platform === 'win32' ? '/icon_filled.ico' : '/icon_filled.png'))
  trayIcon = process.platform === 'darwin' ? nativeImage.createFromPath(join(__dirname, '/trayMacOSTemplate.png')) : this.icon
  trayNotifyIcon = nativeImage.createFromPath(join(__dirname, process.platform === 'darwin' ? '/trayNotifyMacOSTemplate.png' : process.platform === 'win32' ? '/icon_filled_notify.ico' : '/icon_filled_notify.png'))

  timeouts = new Set()
  stateTimeout = null

  torrentLoad = null
  webtorrentWindow = this.makeWebTorrentWindow()

  isMinimized = false
  isFullScreen = false
  windowState = getWindowState()
  mainWindow = new BrowserWindow({
    ...this.windowState.bounds,
    minWidth: 320,
    minHeight: 390,
    frame: process.platform === 'darwin',
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? {
      titleBarOverlay: {
        color: 'rgba(47, 50, 65, 0)',
        symbolColor: '#eee',
        height: 28
      }
    } : {}),
    backgroundColor: '#17191c',
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false,
      allowRunningInsecureContent: false,
      enableBlinkFeatures: 'FontAccess, AudioVideoTracks',
      backgroundThrottling: false,
      preload: join(__dirname, '/preload.js')
    },
    icon: this.icon,
    show: false
  })

  discord = new Discord(this.mainWindow)
  protocol = new Protocol(this.mainWindow)
  updater = new Updater(this.mainWindow, () => this.webtorrentWindow)
  dialog = new Dialog()
  tray = new Tray(this.trayIcon)
  imageDir = join(app.getPath('userData'), 'Cache', 'Image_Data')
  debug = new Debug()
  close = false
  ready = false
  notifications = {}
  transcoder = null

  constructor() {
    // Initialize transcoder with main window reference
    this.transcoder = new Transcoder(this.mainWindow)

    this.mainWindow.setMenuBarVisibility(false)
    this.mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    if (development) this.mainWindow.once('ready-to-show', () => this.showAndFocus(true))
    else ipcMain.once('main-ready', () => this.showAndFocus(true)) // HACK: Prevents the window from being shown while it's still loading. This is nice for production as the window can't be moved without the elements being rendered.
    ipcMain.on('torrent-devtools', () => this.webtorrentWindow.webContents.openDevTools({ mode: 'detach' }))
    ipcMain.on('ui-devtools', ({ sender }) => sender.openDevTools({ mode: 'detach' }))
    ipcMain.on('window-hide', () => this.mainWindow.hide())
    ipcMain.on('window-show', () => this.showAndFocus())
    ipcMain.on('minimize', () => this.mainWindow?.minimize())
    ipcMain.on('maximize', () => this.mainWindow?.isMaximized() ? this.mainWindow.unmaximize() : this.mainWindow.maximize())
    ipcMain.on('webtorrent-restart', () => this.setWebTorrentWindow(true))
    this.mainWindow.on('maximize', () => this.mainWindow.webContents.send('isMaximized', true))
    this.mainWindow.on('unmaximize', () => {
      saveWindowState(this.mainWindow)
      this.mainWindow.webContents.send('isMaximized', false)
    })
    const minimize = (isMinimized) => {
      this.isMinimized = isMinimized
      this.mainWindow.webContents.send('electron:onMinimize', !isMinimized)
    }
    ipcMain.handle('electron:isMinimized', () => this.isMinimized)
    this.mainWindow.on('minimize', () => minimize(true))
    // Start transcoding server
    this.transcoder.start().then(port => {
      console.log('[Main] Transcoder started on port:', port)
    })
    ipcMain.handle('get-transcoder-port', () => this.transcoder.port)

    // Repair Management IPC endpoints
    ipcMain.handle('get-active-repairs', () => Array.from(this.transcoder.activeRepairs.values()))

    ipcMain.handle('get-repair-cache-size', async () => {
      try {
        // Use memoization to avoid expensive directory traversal every 5 seconds
        const now = Date.now()
        if (now - this.transcoder.lastCacheSizeUpdate < this.transcoder.repairCacheTTL) {
          return this.transcoder.cachedSize
        }

        let totalSize = 0
        const items = readdirSync(this.transcoder.repairDir, { withFileTypes: true })
        for (const item of items) {
          if (item.isDirectory()) {
            // Hash directory
            const hashDir = join(this.transcoder.repairDir, item.name)
            const files = readdirSync(hashDir, { withFileTypes: true })
            for (const file of files) {
              if (file.isFile()) {
                totalSize += statSync(join(hashDir, file.name)).size
              }
            }
          } else if (item.isFile()) {
            totalSize += statSync(join(this.transcoder.repairDir, item.name)).size
          }
        }

        // Update cache
        this.transcoder.cachedSize = totalSize
        this.transcoder.lastCacheSizeUpdate = now
        return totalSize
      } catch (e) {
        console.error('[RepairManager] Error calculating cache size:', e)
        return 0
      }
    })

    ipcMain.handle('clear-repair-cache', async () => {
      try {
        // Don't delete folders that have active repairs
        const activeHashes = new Set(this.transcoder.activeRepairs.keys())
        const folders = readdirSync(this.transcoder.repairDir, { withFileTypes: true })

        let clearedSpace = 0
        for (const folder of folders) {
          if (folder.isDirectory() && !activeHashes.has(folder.name)) {
            const folderPath = join(this.transcoder.repairDir, folder.name)
            rmSync(folderPath, { recursive: true, force: true })
            clearedSpace++
          }
        }

        // Clear cache TTL so next query recalculates
        this.transcoder.lastCacheSizeUpdate = 0
        return { success: true, clearedCount: clearedSpace }
      } catch (e) {
        console.error('[RepairManager] Error clearing repair cache:', e)
        return { success: false, error: e.message }
      }
    })

    // Cancel/stop repair handler
    ipcMain.handle('cancel-repair', async (event, hash) => {
      try {
        await this.transcoder.cancelRepair(hash)
        return { success: true }
      } catch (e) {
        console.error('[RepairManager] Error cancelling repair:', e)
        return { success: false, error: e.message }
      }
    })

    // Set up repair progress broadcast via IPC
    ipcMain.on('request-repair-progress', (event) => {
      const repairs = Array.from(this.transcoder.activeRepairs.values())
      console.log(`[Main] Sending repair-progress via reply: ${repairs.length} repairs`)
      event.reply('repair-progress', repairs)
    })

    // Auto-broadcast repairs every second
    setInterval(() => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const repairs = Array.from(this.transcoder.activeRepairs.values())
        if (repairs.length > 0) {
          console.log(`[Main] Broadcasting repair-progress: ${repairs.length} repairs`)
          this.mainWindow.webContents.send('repair-progress', repairs)
        }
      }
    }, 1000)

    this.mainWindow.on('hide', () => minimize(true))
    this.mainWindow.on('restore', () => minimize(false))
    this.mainWindow.on('show', () => minimize(false))
    const debounceState = () => {
      clearTimeout(this.stateTimeout)
      this.stateTimeout = setTimeout(() => saveWindowState(this.mainWindow), 150)
      this.stateTimeout.unref?.()
    }
    this.mainWindow.on('resize', debounceState)
    this.mainWindow.on('move', debounceState)
    const fullScreen = (isFullScreen) => {
      this.isFullScreen = isFullScreen
      this.mainWindow.webContents.send('electron:onFullScreen', isFullScreen)
    }
    ipcMain.handle('electron:isFullScreen', () => this.isFullScreen)
    this.mainWindow.on('enter-full-screen', () => fullScreen(true))
    this.mainWindow.on('leave-full-screen', () => fullScreen(false))

    this.setWebTorrentWindow()
    this.mainWindow.on('closed', () => this.destroy())
    ipcMain.on('close', () => { this.close = true; this.destroy() })

    ipcMain.on('close-prompt', () => {
      this.showAndFocus()
      this.mainWindow.webContents.send('window-close')
    })

    this.mainWindow.on('close', (event) => {
      if (!this.close) {
        event.preventDefault()
        this.showAndFocus()
        this.mainWindow.webContents.send('window-close')
      }
    })

    app.on('before-quit', e => {
      if (this.destroyed) return
      e.preventDefault()
      this.destroy()
    })

    powerMonitor.on('shutdown', e => {
      if (this.destroyed) return
      e.preventDefault()
      this.destroy()
    })

    this.createTray()

    fs.rmSync(this.imageDir, { recursive: true, force: true })
    ipcMain.on('notification-unread', async (e, notificationCount) => this.setTrayIcon(notificationCount))
    ipcMain.on('notification', async (e, opts) => {
      opts.icon = opts.icon ? ((await this.getImage(opts.id, opts.icon)) || this.icon) : this.icon
      let notification
      if (process.platform === 'win32') {
        opts.heroImg &&= await this.getImage(opts.id, opts.heroImg, true)
        opts.inlineImg &&= await this.getImage(opts.id, opts.inlineImg)
        notification = new Notification({ toastXml: toXmlString(opts) })
      } else {
        const simpleOpts = { title: opts.title, body: opts.message, icon: opts.icon }
        if (process.platform === 'darwin' && opts.button && opts.button.length) simpleOpts.actions = opts.button.map(button => ({ type: 'button', text: button.text }))
        notification = new Notification(simpleOpts)
        notification.on('click', () => {
          if (opts.activation?.launch) shell.openExternal(opts.activation.launch)
        })
        if (process.platform === 'darwin') {
          notification.on('action', (event, index) => {
            if (opts.button && opts.button[index]) shell.openExternal(opts.button[index].activation)
          })
        }
      }
      notification.show()
    })

    if (process.platform === 'win32') {
      app.setAppUserModelId('com.github.rockinchaos.froyo')
      // this message usually fires in dev-mode from the parent process
      process.on('message', data => {
        if (data === 'graceful-exit') this.destroy()
      })
      electronShutdownHandler.setWindowHandle(this.mainWindow.getNativeWindowHandle())
      electronShutdownHandler.blockShutdown('Saving torrent data...')
      electronShutdownHandler.on('shutdown', async () => {
        await this.destroy()
        electronShutdownHandler.releaseShutdown()
      })
    } else {
      process.on('SIGTERM', () => this.destroy())
    }

    // In development, delay loading to allow webpack dev-server to start
    if (development) {
      setTimeout(() => {
        this.mainWindow.loadURL('http://localhost:3000/app.html')
        // Open DevTools after page load to avoid disconnection issues
        this.mainWindow.webContents.once('did-finish-load', () => {
          this.mainWindow.webContents.openDevTools({ mode: 'detach' })
        })
      }, 3000)
    } else {
      this.mainWindow.loadURL(`file://${join(__dirname, '/app.html')}`)
    }

    let crashcount = 0
    this.mainWindow.webContents.on('render-process-gone', async (e, { reason }) => {
      if (reason === 'crashed') {
        if (++crashcount > 10) {
          await dialog.showMessageBox({ message: 'Crashed too many times.', title: 'FroYo', detail: 'App crashed too many times. For a fix visit https://github.com/Emekalim/FroYoflix_v2/wiki/faq/', icon: '/renderer/public/icon_filled.png' })
          shell.openExternal('https://github.com/Emekalim/FroYoflix_v2/wiki/faq/')
        } else {
          app.relaunch()
        }
        app.quit()
      }
    })

    ipcMain.on('portRequest', async (event, settings) => {
      const { port1, port2 } = new MessageChannelMain()
      await this.torrentLoad
      ipcMain.once('webtorrent-heartbeat', () => {
        this.webtorrentWindow.webContents.postMessage('main-heartbeat', settings)
        ipcMain.once('torrentRequest', () => {
          this.webtorrentWindow.webContents.postMessage('port', null, [port1])
          event.sender.postMessage('port', null, [port2])
        })
      })
    })

    ipcMain.on('webtorrent-reload', () => { if (!this.mainWindow?.isDestroyed() && !this.webtorrentWindow?.isDestroyed()) this.webtorrentWindow.webContents.postMessage('webtorrent-reload', null) })

    let authWindow
    ipcMain.on('open-auth', (event, url) => {
      if (authWindow && !authWindow.isDestroyed()) authWindow.loadURL(url)
      else {
        const partitionName = 'open-auth'
        authWindow = new BrowserWindow({
          width: 480,
          height: 720,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            backgroundThrottling: false,
            allowRunningInsecureContent: false,
            partition: partitionName
          },
          icon: this.icon,
          title: 'Login',
          backgroundColor: '#17191c',
          autoHideMenuBar: true
        })

        authWindow.webContents.setWindowOpenHandler(() => { return { action: 'deny' } })
        authWindow.webContents.on('did-finish-load', () => authWindow.show())
        authWindow.webContents.on('did-start-loading', () => authWindow.webContents.insertCSS
          (`
            ::-webkit-scrollbar {
              width: 6px;
              height: 6px;
              background-color: transparent;
            }
            ::-webkit-scrollbar-thumb {
              background-color: #2a2e32;
              border-radius: 3px;
            }
            ::-webkit-scrollbar-corner {
              background-color: transparent;
            }
          `))
        authWindow.on('close', () => {
          this.mainWindow.webContents.send('auth-canceled')
          session.fromPartition(partitionName).clearStorageData()
        })
        authWindow.webContents.on('will-redirect', (event, url) => {
          if (url.startsWith('froyo:')) {
            event.preventDefault()
            authWindow.destroy()
            ipcMain.emit('handle-protocol', {}, url)
            session.fromPartition(partitionName).clearStorageData()
          }
        })

        authWindow.loadURL(url)
      }
    })

    ipcMain.on('quit-and-install', () => {
      if (this.updater.hasUpdate) this.destroy(true)
    })

    // Folder scanner for local media search (recursive)
    ipcMain.on('scan-folder', async (event, folderPath) => {
      console.log(`[IPC] Received scan-folder request for: ${folderPath}`);

      try {
        const fs = await import('fs/promises')
        const path = await import('path')

        // Check if folder exists
        try {
          await fs.access(folderPath)
          console.log(`[IPC] Folder exists and is accessible: ${folderPath}`)
        } catch (err) {
          console.error(`[IPC] Folder not accessible: ${folderPath}`, err.message)
          event.sender.send('folder-scan-result', [])
          return
        }

        // Recursive function to scan all subdirectories
        async function scanDirectory(dirPath, maxDepth = 5, currentDepth = 0) {
          const files = []

          // Prevent infinite recursion
          if (currentDepth >= maxDepth) {
            console.log(`[Folder Scanner] Max depth reached at: ${dirPath}`)
            return files
          }

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true })
            console.log(`[Folder Scanner] Found ${entries.length} entries in ${dirPath} (depth ${currentDepth})`)

            for (const entry of entries) {
              const fullPath = path.join(dirPath, entry.name)

              if (entry.isFile()) {
                files.push({
                  path: fullPath,
                  name: entry.name
                })
              } else if (entry.isDirectory()) {
                // Recursively scan subdirectories
                try {
                  const subFiles = await scanDirectory(fullPath, maxDepth, currentDepth + 1)
                  files.push(...subFiles)
                } catch (err) {
                  // Skip directories we can't read (permissions, etc.)
                  console.log(`[Folder Scanner] Skipping directory: ${fullPath} - ${err.message}`)
                }
              }
            }
          } catch (err) {
            console.error(`[Folder Scanner] Error reading directory ${dirPath}:`, err.message)
          }

          return files
        }

        console.log(`[Folder Scanner] Starting scan of: ${folderPath}`)
        const startTime = Date.now()
        const files = await scanDirectory(folderPath)
        const duration = Date.now() - startTime
        console.log(`[Folder Scanner] Scan complete! Found ${files.length} files in ${duration}ms`)

        event.sender.send('folder-scan-result', files)
      } catch (error) {
        console.error('[Folder Scanner] Error:', error)
        event.sender.send('folder-scan-result', [])
      }
    })
  }

  makeWebTorrentWindow() {
    return new BrowserWindow({
      webPreferences: {
        webSecurity: false,
        allowRunningInsecureContent: false,
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false
      },
      show: false
    })
  }

  webTorrentCrashes = 0
  setWebTorrentWindow(crashed = false) {
    if (!crashed || ++this.webTorrentCrashes < 5) {
      if (crashed) {
        const timeout = setTimeout(() => {
          this.timeouts.delete(timeout)
          if (this.webTorrentCrashes < 5) this.webTorrentCrashes = 0
        }, 60_000)
        timeout.unref?.()
        this.timeouts.add(timeout)
        try {
          if (this.webtorrentWindow && !this.webtorrentWindow.isDestroyed()) {
            this.webtorrentWindow.removeAllListeners('closed')
            this.webtorrentWindow.destroy()
          }
        } catch { }
        this.webtorrentWindow = this.makeWebTorrentWindow()
      }
      this.torrentLoad = this.webtorrentWindow.loadURL(development ? 'http://localhost:3000/background.html' : `file://${join(__dirname, '/background.html')}`)
      if (development) this.webtorrentWindow.webContents.openDevTools({ mode: 'detach' })
      if (crashed) this.mainWindow.webContents.send('webtorrent-crashed')
      this.webtorrentWindow.on('closed', () => this.destroy())
      this.webtorrentWindow.webContents.on('render-process-gone', async (e, { reason }) => {
        if (reason === 'crashed') this.setWebTorrentWindow(true)
      })
    }
  }

  destroyed = false
  async destroy(forceRunAfter = false) {
    if (this.destroyed) return
    this.destroyed = true
    this.updater.destroyed = true
    this.close = true
    this.mainWindow.hide()
    this.mainWindow.webContents?.closeDevTools?.()
    this.tray?.destroy()
    for (const timeout of this.timeouts) clearTimeout(timeout)
    this.transcoder.stop()
    this.timeouts.clear()
    clearTimeout(this.stateTimeout)
    saveWindowState(this.mainWindow)
    youtubeServer?.close?.()
    try {
      if (this.webtorrentWindow && !this.webtorrentWindow.isDestroyed()) { // WebTorrent shouldn't ever be destroyed before main, but it's better to be safe.
        this.webtorrentWindow.webContents?.closeDevTools?.()
        this.webtorrentWindow.webContents?.postMessage('destroy', null)
        let resolveTimeout
        await new Promise(resolve => {
          ipcMain.once('destroyed', resolve)
          resolveTimeout = setTimeout(resolve, 5_000)
          resolveTimeout.unref?.()
        })
        clearTimeout(resolveTimeout)
      }
    } catch { } // WebTorrent crashed... prevents hanging infinitely.
    if (!this.updater.install(forceRunAfter)) app.quit()
  }

  imageCache = new Map()
  async getImage(id, url, wideScreen) {
    const cacheKey = `${id}_${url}_${wideScreen}`
    if (this.imageCache.has(cacheKey)) return this.imageCache.get(cacheKey)
    const res = await fetch(url)
    const arrayBuffer = await res.arrayBuffer()
    const urlParts = url.split('/')
    const baseName = urlParts[urlParts.length - 1].replace(/\.[^/.]+$/, '')
    const extension = urlParts[urlParts.length - 1].split('.').pop()
    const uniqueName = `${baseName}_${id}.${extension}`
    const imagePath = join(this.imageDir, uniqueName)
    const image = await Jimp.read(Buffer.from(arrayBuffer))
    const { width, height } = image.bitmap
    this.imageCache.set(cacheKey, imagePath)
    if (wideScreen) {
      let adjWidth, adjHeight
      if (width / height > (16 / 9)) {
        adjWidth = Math.floor(height * (16 / 9))
        image.crop((width - adjWidth) / 2, 0, adjWidth, height)
      } else {
        adjHeight = Math.floor(width / (16 / 9))
        image.crop(0, (height - adjHeight) / 2, width, adjHeight)
      }
      await image.resize(adjWidth || width, adjHeight || height, Jimp.RESIZE_BEZIER).writeAsync(imagePath)
    } else {
      const squareRatio = Math.min(width, height)
      await image.crop((width - squareRatio) / 2, (height - squareRatio) / 2, squareRatio, squareRatio).resize(128, 128, Jimp.RESIZE_BEZIER).writeAsync(imagePath)
    }
    const timeout = setTimeout(() => {
      this.timeouts.delete(timeout)
      fs.unlink(imagePath, (error) => {
        if (!error) this.imageCache.delete(cacheKey)
      })
    }, 90_000)
    timeout.unref?.()
    this.timeouts.add(timeout)
    return imagePath
  }

  notificationCount = 0
  setTrayIcon(notificationCount, verify) {
    if (this.destroyed) return
    if (!this.tray || this.tray.isDestroyed()) {
      this.tray = new Tray(this.trayIcon)
      this.createTray()
    }
    if (!verify) this.notificationCount = notificationCount
    if (this.notificationCount <= 0 || !this.notificationCount) {
      this.tray.setImage(this.trayIcon)
      this.mainWindow.setOverlayIcon(null, '')
    } else {
      this.mainWindow.setOverlayIcon(nativeImage.createFromPath(join(__dirname, `/icon_filled_notify_${this.notificationCount < 10 ? this.notificationCount : `filled`}.png`)), `${this.notificationCount} Unread Notifications`)
      this.tray.setImage(this.trayNotifyIcon)
    }
  }
  createTray() {
    if (this.destroyed) return
    this.tray.setToolTip('FroYo')
    this.setTrayMenu()
    this.tray.on('click', () => this.showAndFocus())
  }
  setTrayMenu() {
    if (this.destroyed || !this.tray || this.tray.isDestroyed()) return
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'FroYo', enabled: false },
      ...(this.ready ? [
        { type: 'separator' },
        { label: 'Show', click: () => this.showAndFocus() },
        { label: 'Restore', click: () => this.restoreWindow() }
      ]
        : []),
      { type: 'separator' },
      { label: 'Quit', click: () => this.destroy() }
    ]))
  }

  restoreWindow() {
    if (this.destroyed || this.mainWindow?.isDestroyed()) return
    const defaultBounds = getDefaultBounds()
    this.mainWindow.unmaximize()
    this.mainWindow.setFullScreen(false)
    this.mainWindow.setBounds(defaultBounds)
    /** HACK: Electron doesn't handle DPI scaling differences between monitors very well so we have to set the bounds twice... */
    setImmediate(() => {
      this.mainWindow.setBounds(defaultBounds)
      saveWindowState(this.mainWindow)
      this.showAndFocus()
    })
  }

  showAndFocus(ready = false) {
    if (!this.ready && !ready) return
    if (!this.ready) {
      this.ready = true
      this.setTrayMenu()
    }
    if (ready) {
      if (this.windowState.bounds.x && this.windowState.bounds.y) this.mainWindow.setBounds(this.windowState.bounds)
      if (this.windowState.isMaximized) this.mainWindow.maximize()
      if (this.windowState.isFullScreen) this.mainWindow.setFullScreen(true)
    }
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    } else if (!this.mainWindow.isVisible()) {
      this.mainWindow.show()
    } else {
      this.mainWindow.moveTop()
    }
    this.mainWindow.focus()
    this.setTrayIcon(0, true)
  }
}