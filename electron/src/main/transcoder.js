import http from 'http'
import { createHash } from 'crypto'
import { statSync, existsSync, createReadStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { join, basename } from 'path'
import { app } from 'electron'
import { spawn } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import getPort from 'get-port'

// Set FFmpeg binary path
const ffmpegBinaryPath = app.isPackaged
    ? join(process.resourcesPath, 'bin', 'ffmpeg')
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
        this.tempDir = join(app.getPath('temp'), 'froyo-transcode')
        this.repairDir = join(app.getPath('temp'), 'froyo-repair') // Persistent repair storage
        this.activeTranscodes = new Map() // hash -> ffmpeg command
        this.intentionalStops = new Set() // hash -> boolean (true if stopped explicitly)

        // Platform-specific encoder selection
        this.encoder = this.detectEncoder()

        // Ensure directories exist
        this.ensureTempDir()

        // Cleanup zombie processes from previous runs on startup
        this.safeCleanup()

        console.log('[Transcoder] Selected encoder:', this.encoder)
    }

    async safeCleanup() {
        console.log('[Transcoder] Running startup cleanup...')
        try {
            // Kill any ffmpeg processes that match our specific binary path pattern
            // This targets processes from this app (and legacy versions) without affecting system ffmpeg
            const { exec } = await import('child_process')
            const platform = process.platform

            if (platform === 'darwin' || platform === 'linux') {
                // pkill -f matches against the full command line
                // "node_modules/.pnpm/ffmpeg-static.*/ffmpeg" is specific enough to our dependency structure
                exec('pkill -f "node_modules/.pnpm/ffmpeg-static.*/ffmpeg"', (err) => {
                    if (!err) console.log('[Transcoder] Cleaned up zombie ffmpeg processes')
                })
            } else if (platform === 'win32') {
                // Windows equivalent (wmic or taskkill with filter)
                // Keeping it simple for now as pkill is unix-specific
                exec('taskkill /F /IM ffmpeg.exe /FI "COMMANDLINE LIKE \'%node_modules%\'"', (err) => {
                    if (!err) console.log('[Transcoder] Cleaned up zombie ffmpeg processes')
                })
            }
        } catch (e) {
            console.error('[Transcoder] Cleanup failed:', e)
        }
    }

    async ensureTempDir() {
        await mkdir(this.tempDir, { recursive: true })
        await mkdir(this.repairDir, { recursive: true })
    }

    /**
     * Detect best hardware encoder for platform
     */
    detectEncoder() {
        switch (process.platform) {
            case 'darwin':
                return 'h264_videotoolbox'
            // return 'libx264' // Force software encoding for debugging
            case 'win32':
                return 'h264_nvenc'
            // return 'libx264' // Force software encoding for debugging
            case 'linux':
                return 'h264_vaapi'
            // return 'libx264' // Force software encoding for debugging
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

            // Route: DELETE /stop?hash=<hash>
            // Explicitly stops transcoding for a specific file hash
            if (url.pathname === '/stop' && req.method === 'DELETE') {
                const hash = url.searchParams.get('hash')
                if (hash && this.activeTranscodes.has(hash)) {
                    console.log(`[Transcoder] Stopping transcoding for hash: ${hash}`)
                    const command = this.activeTranscodes.get(hash)
                    try {
                        this.intentionalStops.add(hash) // Mark as intentional stop
                        command.kill('SIGKILL') // Force kill for immediate stop
                    } catch (e) {
                        console.error(`[Transcoder] Failed to kill process ${hash}:`, e)
                    }
                    this.activeTranscodes.delete(hash)
                    res.writeHead(200)
                    res.end('Stopped')
                } else {
                    res.writeHead(404)
                    res.end('Not found or not running')
                }
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
                    } else if (existsSync(filePath) && !this.activeTranscodes.has(hash)) {
                        // Resumption Logic:
                        // Playlist exists, but no process is running.
                        // We need to check if the transcode was actually *completed* (has #EXT-X-ENDLIST)
                        // or if it was *interrupted* (killed by user/stop/crash).

                        const { readFileSync } = await import('fs')
                        try {
                            // Read the last few lines of the playlist to check for end tag
                            const content = readFileSync(filePath, 'utf8')
                            if (!content.includes('#EXT-X-ENDLIST')) {
                                console.log('[Transcoder] Found incomplete playlist with no active process. Restarting:', hash)
                                // Get original file from query param
                                const originalFile = url.searchParams.get('file')
                                if (originalFile) {
                                    await this.startTranscoding(originalFile, hash)
                                }
                            }
                        } catch (e) {
                            console.error('[Transcoder] Failed to check playlist status:', e)
                        }
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

                    const stats = statSync(filePath)
                    console.log(`[Transcoder] Serving: ${filename} (${stats.size} bytes)`)

                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'Content-Length': stats.size
                    })

                    const stream = createReadStream(filePath)
                    stream.pipe(res)

                    stream.on('error', (err) => {
                        console.error(`[Transcoder] Stream error serving ${filename}:`, err)
                        if (!res.headersSent) {
                            res.writeHead(500)
                            res.end('Stream error')
                        }
                    })

                    res.on('close', () => {
                        stream.destroy()
                    })
                } else {
                    console.log(`[Transcoder] 404 Not Found: ${filename}`)
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
     * Get path to bundled HandBrakeCLI binary
     */
    getHandBrakePath() {
        if (app.isPackaged) {
            return join(process.resourcesPath, 'bin', 'HandBrakeCLI')
        }

        // In development, app.getAppPath() might point to 'electron/build'
        const appPath = app.getAppPath()
        const possiblePaths = [
            join(appPath, 'resources', 'mac', 'HandBrakeCLI'),
            join(appPath, '..', 'resources', 'mac', 'HandBrakeCLI')
        ]

        for (const p of possiblePaths) {
            if (existsSync(p)) return p
        }

        console.error('[Transcoder] HandBrakeCLI binary not found in dev paths:', possiblePaths)
        return possiblePaths[0] // Return default to allow error to bubble up normally
    }

    /**
     * Repair file using HandBrakeCLI
     */
    async repairFile(filePath, hash) {
        const handbrakePath = this.getHandBrakePath()
        // Save to persistent repair directory, NOT the volatile cache dir
        const outputDir = join(this.repairDir, hash)
        const outputPath = join(outputDir, 'repaired.mp4')

        console.log(`[Transcoder] Attempting repair with HandBrake: ${filePath} -> ${outputPath}`)

        // Ensure directory exists
        await mkdir(outputDir, { recursive: true })

        return new Promise((resolve, reject) => {
            const hb = spawn(handbrakePath, [
                '-i', filePath,
                '-o', outputPath,
                '--preset', 'Fast 1080p30',
                '--format', 'av_mp4'
            ])

            hb.stdout.on('data', (data) => console.log(`[HandBrake] ${data}`))
            hb.stderr.on('data', (data) => console.log(`[HandBrake] ${data}`))

            hb.on('close', (code) => {
                if (code === 0) {
                    console.log('[Transcoder] Repair successful')
                    resolve(outputPath)
                } else {
                    reject(new Error(`HandBrake failed with code ${code}`))
                }
            })
        })
    }

    /**
     * Start FFmpeg transcoding process
     */
    async startTranscoding(filePath, hash, isRetry = false) {
        if (this.activeTranscodes.has(hash)) return // Already running

        const cacheDir = join(this.tempDir, hash)

        // Check for existing repaired file (persistent storage)
        const repairedPath = join(this.repairDir, hash, 'repaired.mp4')
        const useRepaired = existsSync(repairedPath)
        const inputPath = useRepaired ? repairedPath : filePath

        // Ensure clean slate for new transcode (only clears HLS cache, not repair)
        await rm(cacheDir, { recursive: true, force: true })
        await mkdir(cacheDir, { recursive: true })

        console.log(`[Transcoder] Starting HLS for ${inputPath} -> ${cacheDir} ${useRepaired ? '(Using Repaired Source)' : ''}`)

        return new Promise((resolve, reject) => {
            // Build FFmpeg command with platform-specific encoder
            const outputOptions = [
                `-c:v ${this.encoder}`,
                '-b:v 10M', // Target high bitrate
                '-maxrate 12M', // Cap max bitrate to prevent spikes
                '-bufsize 24M', // Buffer size for rate control
                '-c:a aac',
                '-b:a 128k',
                '-ac 2', // Keep forced stereo
                '-ar 48000', // Keep standard sample rate
                '-hls_time 6', // 6 second segments
                '-hls_list_size 0', // VOD mode (keep all segments)
                '-hls_segment_filename', join(cacheDir, 'segment_%03d.ts'),
                '-start_number 0',
                '-sn' // Disable subtitles
            ]

            if (useRepaired) {
                // INSTANT MODE: Stream copy if file is already repaired/standardized
                outputOptions.push(
                    '-c copy', // Copy video and audio streams
                    '-map 0', // Map all streams
                    '-f hls'
                )
            } else {
                // NORMAL MODE: Transcode with standard settings
                outputOptions.push(
                    `-c:v ${this.encoder}`,
                    '-b:v 10M', // Target high bitrate
                    '-maxrate 12M', // Cap max bitrate to prevent spikes
                    '-bufsize 24M', // Buffer size for rate control
                    '-c:a aac',
                    '-b:a 128k',
                    '-ac 2', // Keep forced stereo
                    '-ar 48000', // Keep standard sample rate
                    '-force_key_frames', 'expr:gte(t,n_forced*6)', // Force keyframe every 6 seconds
                    '-sc_threshold', '0', // Disable scene change detection for strict keyframes
                    '-fflags', '+genpts', // Generate presentation timestamps
                    '-vsync', '0' // Passthrough video sync (prevent dropping/duping)
                )

                // Optimize for software encoding if fallback is used
                if (this.encoder === 'libx264') {
                    outputOptions.splice(outputOptions.indexOf(`-c:v ${this.encoder}`), 0, '-preset ultrafast')
                }

                // Add software fallback for hardware encoders
                if (this.encoder !== 'libx264') {
                    outputOptions.push('-allow_sw 1')
                }
            }

            const command = ffmpeg(inputPath)
                .inputOptions(this.encoder !== 'libx264' && !useRepaired ? ['-hwaccel auto'] : [])
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

                    // Proactively catch fatal decoding errors that don't immediately crash FFmpeg
                    // This forces the 'error' handler to fire with SIGKILL, triggering the fallback logic
                    if (!isRetry && !useRepaired && stderrLine.includes('Error submitting packet to decoder')) {
                        console.error('[Transcoder] Detected fatal decoder error stream. Killing process to force fallback...')
                        command.kill('SIGKILL')
                    }
                })
                .on('error', async (err) => {
                    console.error(`[Transcoder] Error: ${err.message}`)
                    this.activeTranscodes.delete(hash)

                    // Smart Fallback Logic
                    // Trigger on critical decoder errors, unexpected crashes, or manual kill (SIGKILL)
                    // Do NOT trigger if we are already using a repaired file (to prevent infinite loops)
                    // Do NOT trigger if the stop was intentional (user request/app exit)
                    if (this.intentionalStops.has(hash)) {
                        console.log(`[Transcoder] Ignoring expected SIGKILL for ${hash}`)
                        this.intentionalStops.delete(hash)
                        return
                    }

                    if (!isRetry && !useRepaired && (
                        err.message.includes('decoder') ||
                        err.message.includes('Invalid data') ||
                        err.message.includes('sigkill') ||
                        err.message.includes('SIGKILL') // Check both cases
                    )) {
                        console.log('[Transcoder] Critical failure detected. Initiating Smart Fallback repair...')
                        try {
                            await this.repairFile(filePath, hash)
                            // Restart transcoding - will auto-detect the new repaired file
                            await this.startTranscoding(filePath, hash, true)
                        } catch (repairErr) {
                            console.error('[Transcoder] Repair failed:', repairErr)
                        }
                    }
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
                this.intentionalStops.add(hash) // Mark as intentional
                command.kill('SIGKILL') // Force kill on app exit
            } catch (e) {
                console.error(`[Transcoder] Failed to kill process ${hash}:`, e)
            }
        }
        this.activeTranscodes.clear()

        console.log('[Transcoder] Stopped')
    }
}
