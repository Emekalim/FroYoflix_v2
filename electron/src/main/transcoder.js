import http from 'http'
import { createHash } from 'crypto'
import { statSync, existsSync, createReadStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { join, basename } from 'path'
import { app } from 'electron'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import getPort from 'get-port'

// Set FFmpeg binary path
const ffmpegBinaryPath = app.isPackaged
    ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
    : ffmpegStatic

console.log('[Transcoder] FFmpeg binary path:', ffmpegBinaryPath)
ffmpeg.setFfmpegPath(ffmpegBinaryPath)

/**
 * Transcoder Service
 * Manages HLS transcoding via local HTTP server
 */
export class Transcoder {
    constructor() {
        this.server = null
        this.port = null
        this.tempDir = join(app.getPath('temp'), 'shiru-transcode')
        this.activeTranscodes = new Map() // hash -> ffmpeg command

        // Platform-specific encoder selection
        this.encoder = this.detectEncoder()
        console.log('[Transcoder] Selected encoder:', this.encoder)
    }

    /**
     * Detect best hardware encoder for platform
     */
    detectEncoder() {
        switch (process.platform) {
            case 'darwin':
                return 'h264_videotoolbox'
            case 'win32':
                return 'h264_nvenc'
            case 'linux':
                return 'h264_vaapi'
            default:
                return 'libx264' // Fallback to software
        }
    }

    /**
     * Clear all cached segments
     */
    async clearCache() {
        try {
            if (existsSync(this.tempDir)) {
                await rm(this.tempDir, { recursive: true, force: true })
                console.log('[Transcoder] Cache cleared')
            }
        } catch (e) {
            console.error('[Transcoder] Failed to clear cache:', e)
        }
    }

    /**
     * Generate stable cache key from file metadata
     */
    getCacheKey(filePath) {
        try {
            const stats = statSync(filePath)
            const input = `${filePath}-${stats.mtimeMs}-${stats.size}`
            return createHash('sha256').update(input).digest('hex')
        } catch (e) {
            // Fallback if file not found
            return createHash('sha256').update(filePath).digest('hex')
        }
    }

    /**
     * Start HTTP server for HLS streaming
     */
    async start() {
        console.log('[Transcoder] Starting server...')

        // Clear previous session cache to avoid collisions
        await this.clearCache()

        this.port = await getPort()
        this.server = http.createServer(async (req, res) => {
            // Enable CORS
            res.setHeader('Access-Control-Allow-Origin', '*')

            const url = new URL(req.url, `http://localhost:${this.port}`)

            // Route: /init?file=<path>
            // Returns HLS playlist URL with file parameter embedded
            if (url.pathname === '/init') {
                const filePath = url.searchParams.get('file')

                // Reject invalid or hidden files
                if (!filePath || !existsSync(filePath) || basename(filePath).startsWith('._')) {
                    console.log('[Transcoder] Rejected invalid file:', filePath)
                    res.writeHead(400)
                    res.end('Invalid file')
                    return
                }

                const hash = this.getCacheKey(filePath)
                console.log('[Transcoder] Init for:', filePath, 'Hash:', hash)

                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                    // CRITICAL: Include file path in playlist URL for stateless design
                    url: `http://localhost:${this.port}/hls/${hash}/playlist.m3u8?file=${encodeURIComponent(filePath)}`,
                    hash
                }))
                return
            }

            // Route: /hls/<hash>/<filename>
            const match = url.pathname.match(/^\/hls\/([a-f0-9]+)\/(.+)$/)
            if (match) {
                const [, hash, filename] = match
                const cacheDir = join(this.tempDir, hash)
                const filePath = join(cacheDir, filename)

                // If playlist requested, ensure transcoding is started
                if (filename === 'playlist.m3u8') {
                    if (!existsSync(filePath)) {
                        // Get original file from query param (stateless design)
                        const originalFile = url.searchParams.get('file')
                        if (!originalFile) {
                            res.writeHead(400)
                            res.end('Missing file source')
                            return
                        }

                        // Start transcoding
                        await this.startTranscoding(originalFile, hash)
                    }

                    // Wait for playlist to be created (max 60s for 4K files)
                    let attempts = 0
                    while (!existsSync(filePath) && attempts < 120) {
                        await new Promise(r => setTimeout(r, 500))
                        attempts++
                    }

                    if (!existsSync(filePath)) {
                        res.writeHead(503)
                        res.end('Transcoding timeout')
                        return
                    }
                }

                // Serve the file
                if (existsSync(filePath)) {
                    let contentType = 'application/octet-stream'
                    if (filename.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl'
                    else if (filename.endsWith('.ts')) contentType = 'video/MP2T'
                    else if (filename.endsWith('.m4s')) contentType = 'video/iso.segment'
                    else if (filename.endsWith('.mp4')) contentType = 'video/mp4'

                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    })
                    createReadStream(filePath).pipe(res)
                } else {
                    res.writeHead(404)
                    res.end('Not found')
                }
                return
            }

            res.writeHead(404)
            res.end()
        })

        return new Promise((resolve) => {
            this.server.listen(this.port, 'localhost', () => {
                console.log(`[Transcoder] HLS Server listening on port ${this.port}`)
                resolve(this.port)
            })
        })
    }

    /**
     * Start FFmpeg transcoding process
     */
    async startTranscoding(filePath, hash) {
        if (this.activeTranscodes.has(hash)) return // Already running

        const cacheDir = join(this.tempDir, hash)

        // Ensure clean slate for new transcode
        await rm(cacheDir, { recursive: true, force: true })
        await mkdir(cacheDir, { recursive: true })

        console.log(`[Transcoder] Starting HLS for ${filePath} -> ${cacheDir}`)

        return new Promise((resolve, reject) => {
            // Build FFmpeg command with platform-specific encoder
            const outputOptions = [
                `-c:v ${this.encoder}`,
                '-b:v 10M', // Restore high bitrate
                '-c:a aac',
                '-b:a 128k',
                '-ac 2', // Keep forced stereo
                '-ar 48000', // Keep standard sample rate
                '-hls_time 6', // 6 second segments
                '-hls_list_size 0', // VOD mode (keep all segments)
                '-hls_segment_type', 'fmp4',
                '-hls_segment_filename', join(cacheDir, 'segment_%03d.m4s'),
                '-start_number 0'
            ]

            // Optimize for software encoding if fallback is used
            if (this.encoder === 'libx264') {
                outputOptions.splice(2, 0, '-preset ultrafast')
            }

            // Add software fallback for hardware encoders
            if (this.encoder !== 'libx264') {
                outputOptions.push('-allow_sw 1')
            }

            const command = ffmpeg(filePath)
                .outputOptions(outputOptions)
                .output(join(cacheDir, 'playlist.m3u8'))
                .on('start', (cmd) => {
                    console.log(`[Transcoder] Spawned: ${cmd}`)
                    this.activeTranscodes.set(hash, command)
                    resolve()
                })
                .on('stderr', (stderrLine) => {
                    // Only log errors or critical warnings
                    if (stderrLine.includes('Error') || stderrLine.includes('Opening')) {
                        console.log(`[FFmpeg] ${stderrLine}`)
                    }
                })
                .on('error', (err) => {
                    console.error(`[Transcoder] Error: ${err.message}`)
                    this.activeTranscodes.delete(hash)
                })
                .on('end', () => {
                    console.log(`[Transcoder] Finished: ${hash}`)
                    this.activeTranscodes.delete(hash)
                })

            command.run()
        })
    }

    /**
     * Stop server and cleanup
     */
    stop() {
        if (this.server) {
            this.server.close()
            this.server = null
        }

        // Kill all active ffmpeg processes
        for (const [hash, command] of this.activeTranscodes) {
            try {
                command.kill()
            } catch (e) {
                console.error(`[Transcoder] Failed to kill process ${hash}:`, e)
            }
        }
        this.activeTranscodes.clear()

        console.log('[Transcoder] Stopped')
    }
}
