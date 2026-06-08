import { ipcMain } from 'electron'
import { development } from './util.js'
import http from 'http'

/**
 * YOUTUBE EMBED WORKAROUND SERVER (Temporary)
 *
 * This is a HORRIBLE HACKY FIX that should NOT be used as an example or best practice.
 *
 * THE PROBLEM:
 * - In production, Electron loads files via file:// protocol
 * - The file:// protocol does NOT send HTTP Referer headers (by design for security)
 * - YouTube recently changed their embed requirements to REQUIRE valid Referer headers
 * - Result: YouTube embeds show "Error 153" in production builds but work fine in dev
 *
 * WHY THIS "WORKS":
 * - Creates a local HTTP server that wraps YouTube embeds
 * - Serves content via http://localhost which CAN send Referer headers
 * - Keeps HTTP response open until YouTube's iframe actually loads (via fetch callback)
 * - This makes the outer iframe's onload event wait for YouTube to be ready
 *
 * WHY IT'S TERRIBLE:
 * - Running a full HTTP server just to embed YouTube videos is absurd
 * - Uses fetch() callback hack to signal when iframe loads
 * - Only needed because Electron production uses file:// protocol
 */

const YOUTUBE_DIRECT_ORIGIN = 'https://www.youtube-nocookie.com'
const pendingResponses = new Map()
let youtubeOrigin = YOUTUBE_DIRECT_ORIGIN

export const youtubeServer = !development
  ? http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname === '/loaded') {
      const responseId = url.searchParams.get('id')
      const pendingRes = pendingResponses.get(responseId)
      if (pendingRes) {
        pendingRes.end('</body></html>')
        pendingResponses.delete(responseId)
      }
      res.end('ok')
      return
    }
    const pathParts = url.pathname.split('/').filter(Boolean)
    const videoId = pathParts[pathParts.length - 1]
    const params = url.searchParams.toString()
    const responseId = String(Date.now() + Math.random())
    res.writeHead(200, { 'Content-Type': 'text/html', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
    res.write(`<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <meta name='referrer' content='strict-origin-when-cross-origin'>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
  </style>
</head>
<body>
  <iframe
    src='${YOUTUBE_DIRECT_ORIGIN}/embed/${videoId}?${params}'
    allow='autoplay'
    allowFullScreen
    referrerpolicy='strict-origin-when-cross-origin'
    onload="fetch('/loaded?id=${responseId}')"
  ></iframe>`)
    pendingResponses.set(responseId, res)
    req.on('close', () => pendingResponses.delete(responseId))
  })
  : null

youtubeServer?.on?.('error', (error) => {
  console.error('YouTube server failed to start, falling back to direct embeds.', error)
  youtubeOrigin = YOUTUBE_DIRECT_ORIGIN
})

youtubeServer?.listen?.(0, '127.0.0.1', () => {
  const address = youtubeServer.address()
  if (!address || typeof address === 'string') {
    console.warn('YouTube server started without a numeric port, falling back to direct embeds.')
    youtubeOrigin = YOUTUBE_DIRECT_ORIGIN
    return
  }

  youtubeOrigin = `http://127.0.0.1:${address.port}`
  console.log(`YouTube server running on ${youtubeOrigin}`)
})

ipcMain.handle('electron:getYouTube', () => youtubeOrigin)
