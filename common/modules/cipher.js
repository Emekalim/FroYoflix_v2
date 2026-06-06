const APP_SECRET = 'froyo-tmdb-cipher-v1'
const SALT = new TextEncoder().encode('froyo-static-salt')

async function deriveKey () {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt (plaintext) {
  if (!plaintext) return ''
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const combined = new Uint8Array(12 + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), 12)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt (base64) {
  if (!base64) return ''
  try {
    const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, await deriveKey(), combined.slice(12))
    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}
