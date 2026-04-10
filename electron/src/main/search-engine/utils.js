import { parse } from 'node-html-parser'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

export async function fetchHtml(url, { timeout = 10_000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    if (!response.ok) throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchJson(url) {
  const body = await fetchHtml(url)
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Expected JSON response from ${url}.`)
  }
}

export function parseHtml(html) {
  return parse(html)
}

export function parseHumanSize(value) {
  if (typeof value === 'number') return value
  if (!value) return 0
  const match = String(value).trim().match(/([\d.,]+)\s*([A-Za-z]+)/)
  if (!match) return 0
  const amount = Number.parseFloat(match[1].replace(/,/g, ''))
  const unit = match[2].toLowerCase()
  if (!Number.isFinite(amount)) return 0

  const units = {
    b: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    tb: 1024 ** 4,
    tib: 1024 ** 4
  }

  return Math.round(amount * (units[unit] || units[unit.replace(/i?b$/, 'b')] || 1))
}

export function parseLooseDate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000).toISOString()
  }
  if (!value) return new Date(Date.now() - 1000).toISOString()
  const trimmed = String(value).trim()
  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) return direct.toISOString()

  const relative = trimmed.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i)
  if (relative) {
    const amount = Number(relative[1])
    const unit = relative[2].toLowerCase()
    const ms = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
      year: 31_536_000_000
    }
    return new Date(Date.now() - (amount * (ms[unit] || 0))).toISOString()
  }

  if (/^today$/i.test(trimmed)) return new Date().toISOString()
  if (/^(y-day|yesterday)$/i.test(trimmed)) return new Date(Date.now() - 86_400_000).toISOString()

  return new Date(Date.now() - 1000).toISOString()
}

export function parseInteger(value) {
  const sanitized = String(value ?? '').replace(/[^\d]/g, '')
  return sanitized ? Number.parseInt(sanitized, 10) : 0
}

export function magnetHash(magnet) {
  const match = String(magnet || '').match(/btih:([A-Fa-f0-9]+)/)
  return match?.[1]?.toLowerCase() || ''
}

export function isTorrentIdentifier(value) {
  const candidate = String(value || '').trim()
  if (!candidate) return false
  return /(^magnet:){1}|(^[A-F\d]{40}$){1}|(^https?:\/\/.+\.torrent(?:\?.*)?$){1}/i.test(candidate)
}

export function buildMagnetLink(hash, title, trackers = []) {
  const safeHash = String(hash || '').trim().toLowerCase()
  if (!/^[a-f\d]{40}$/i.test(safeHash)) return ''

  const defaultTrackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://tracker.coppersurfer.tk:6969/announce',
    'udp://explodie.org:6969'
  ]

  const allTrackers = [...new Set([...(trackers || []), ...defaultTrackers])]
  const dn = encodeURIComponent(String(title || safeHash))
  const tr = allTrackers.map(t => `tr=${encodeURIComponent(t)}`).join('&')
  // Avoid URLSearchParams — it encodes colons in xt=urn:btih: which parseTorrent can't parse
  return `magnet:?xt=urn:btih:${safeHash}&dn=${dn}${tr ? '&' + tr : ''}`
}

export function ensureTorrentIdentifier(link, hash, title, trackers = []) {
  const candidate = String(link || '').trim()
  if (isTorrentIdentifier(candidate)) return candidate
  return buildMagnetLink(hash, title, trackers)
}

export function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
}

export function trackerError(message) {
  return { message }
}
