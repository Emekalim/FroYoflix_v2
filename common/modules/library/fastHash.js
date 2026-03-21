import { IPC, ELECTRON } from '@/modules/bridge.js'

async function digestText(text) {
  const data = new TextEncoder().encode(String(text || ''))
  const hash = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function getFastHash(filePath) {
  if (!filePath) return null
  if (ELECTRON && IPC?.invoke) {
    try {
      return await IPC.invoke('library:hash', { path: filePath })
    } catch (error) {
      console.error('[Library] Failed to compute fast hash via IPC:', error)
    }
  }
  return digestText(filePath)
}
