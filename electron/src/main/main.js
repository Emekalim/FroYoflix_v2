import { app } from 'electron'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import App from './app.js'

// Load environment variables from .env file manually
try {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const envPath = join(__dirname, '../../../common/.env')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const keyTrimmed = key.trim()
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
      if (keyTrimmed && value && !process.env[keyTrimmed]) {
        process.env[keyTrimmed] = value
      }
    }
  })
} catch (error) {
  // Silently fail if .env can't be loaded
}

let main // Keep a global reference of the window object, if you don't, the window will, be closed automatically when the JavaScript object is garbage collected.

function createWindow () {
  main = new App()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('ready', createWindow)

  app.on('activate', () => {
    if (main == null) createWindow()
    else main.showAndFocus()
  })
}
