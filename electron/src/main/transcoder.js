import http from 'http'
import { createHash } from 'crypto'
import { statSync, existsSync, createReadStream, rmSync } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { join, basename } from 'path'
import { app } from 'electron'
import { spawn } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import getPort from 'get-port'

// Resolve FFmpeg binary path
const getFFmpegPath = () => {
    if (app.isPackaged) {
        return join(process.resourcesPath, 'bin', 'ffmpeg')
    }

    // In development, resolve relative to appPath
    const appPath = app.getAppPath()
    const possiblePaths = [
        join(appPath, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        join(appPath, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg')
    ]

    for (const p of possiblePaths) {
        if (existsSync(p)) return p
    }

    // Fallback if not found natively (unlikely)
    return ffmpegStatic || 'ffmpeg'
}

const ffmpegBinaryPath = getFFmpegPath()
console.log('[Transcoder] FFmpeg binary path:', ffmpegBinaryPath)
ffmpeg.setFfmpegPath(ffmpegBinaryPath)

/**
 * Transcoder Service
 * Manages HLS transcoding via local HTTP server
 */
export class Transcoder {
    constructor(mainWindow = null, testOptions = {}) {
        this.mainWindow = mainWindow
        this.testOptions = testOptions
        this.server = null
        this.port = null
        this.tempDir = join(app.getPath('temp'), 'froyo-transcode')
        this.repairDir = join(app.getPath('temp'), 'froyo-repair') // Persistent repair storage
        this.activeTranscodes = new Map() // hash -> ffmpeg command
        this.intentionalStops = new Set() // hash -> boolean (true if stopped explicitly)
        this.activeRepairs = new Map() // hash -> repair job state (progress, etc.)
        this.repairQueue = [] // { filePath, hash, resolve, reject }
        this.isRepairing = false
        this.repairCacheTTL = 5000 // Cache size TTL in ms
        this.lastCacheSizeUpdate = 0
        this.cachedSize = 0



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
                        // If repairing, return 404 so player halts (don't return 503 as some players spam retry)
                        if (this.activeRepairs.has(hash)) {
                            res.writeHead(404, { 'Retry-After': '5' })
                            res.end('Repairing')
                            return
                        }
                        await this.startTranscoding(originalFile, hash)
                    } else if (existsSync(filePath) && !this.activeTranscodes.has(hash)) {
                        // Resumption Logic:
                        // Playlist exists, but no process is running.
                        if (this.activeRepairs.has(hash)) {
                            res.writeHead(404, { 'Retry-After': '5' })
                            res.end('Repairing')
                            return
                        }
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
                                if (originalFile && !this.activeRepairs.has(hash)) {
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
                        res.writeHead(404)
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

    // Add these properties to the Transcoder class
    repairQueue = []
    isRepairing = false

    /**
     * Repair file using HandBrakeCLI
     */
    async repairFile(filePath, hash) {
        return new Promise((resolve, reject) => {
            this.repairQueue.push({ filePath, hash, resolve, reject })

            // Initialize basic state immediately so UI shows "Queued"
            const fileName = basename(filePath)
            this.activeRepairs.set(hash, {
                id: hash,
                name: fileName,
                progress: 0,
                eta: 'Pending...',
                speed: '0 fps',
                status: 'queued'
            })

            this.emitRepairProgress()
            this.processRepairQueue()
        })
    }

    emitRepairProgress() {
        if (this.mainWindow?.webContents) {
            const repairs = Array.from(this.activeRepairs.values())
            console.log(`[Transcoder] Emitting repair-progress: ${repairs.length} repairs`, repairs)
            this.mainWindow.webContents.send('repair-progress', repairs)
        } else {
            console.warn('[Transcoder] Cannot emit repair-progress: mainWindow or webContents not available')
        }
    }

    async processRepairQueue() {
        if (this.isRepairing || this.repairQueue.length === 0) return
        this.isRepairing = true

        const job = this.repairQueue.shift()
        const { filePath, hash, resolve, reject } = job

        const handbrakePath = this.getHandBrakePath()
        // Save to persistent repair directory, NOT the volatile cache dir
        const outputDir = join(this.repairDir, hash)
        const outputPath = join(outputDir, 'repaired.mp4')
        const logPath = join(outputDir, 'handbrake-debug.log')
        const fileName = basename(filePath)

        console.log(`[Transcoder] Attempting repair with HandBrake: ${filePath} -> ${outputPath}`)

        // Ensure directory exists
        try {
            await mkdir(outputDir, { recursive: true })
        } catch (e) {
            console.error('[Transcoder] Failed to create repair directory', e)
            this.activeRepairs.delete(hash)
            this.isRepairing = false
            this.emitRepairProgress()
            reject(e)
            this.processRepairQueue()
            return
        }

        // Update state from queued to starting
        const repairState = this.activeRepairs.get(hash) || { id: hash, name: fileName }
        repairState.status = 'starting'
        repairState.eta = 'Calculating...'
        this.activeRepairs.set(hash, repairState)

        this.emitRepairProgress()

        let hbArgs = [
            '-i', filePath,
            '-o', outputPath,
            '--preset', 'Fast 1080p30',
            '--format', 'av_mp4'
        ]
        if (this.testOptions.hbArgs && Array.isArray(this.testOptions.hbArgs)) {
            hbArgs = hbArgs.concat(this.testOptions.hbArgs)
            console.log('[Transcoder] Injected custom HB args:', this.testOptions.hbArgs.join(' '))
        }

        const hb = spawn(handbrakePath, hbArgs)

        const progressRegex = /Encoding: task \d+ of \d+, (\d+(?:\.\d+)?) % \(([\d\.]+ fps).*?(?:ETA (.+?)\))?/

        let lastEmit = Date.now()
        let hasError = false
        let outputBuffer = ''

        const { createWriteStream } = await import('fs')
        const logStream = createWriteStream(logPath, { flags: 'a' })
        logStream.write(`\n--- Started HandBrake Repair at ${new Date().toISOString()} ---\n`)
        logStream.write(`Command: ${hbArgs.join(' ')}\n\n`)

        const processOutput = (data) => {
            const strData = data.toString()
            logStream.write(strData)

            outputBuffer += strData
            // Split by carriage return or newline, as HB uses \r for progress
            const lines = outputBuffer.split(/[\r\n]+/)
            // Keep the last partial line in the buffer
            outputBuffer = lines.pop()

            for (const line of lines) {
                const match = line.match(progressRegex)
                if (match) {
                    repairState.progress = parseFloat(match[1])
                    repairState.speed = match[2]
                    repairState.eta = match[3]?.trim() || 'Calculating...'
                    repairState.status = 'repairing'

                    if (Date.now() - lastEmit > 1000) {
                        this.emitRepairProgress()
                        lastEmit = Date.now()
                    }
                } else if (line.includes('Error') || line.includes('FAILED')) {
                    console.error(`[Transcoder] HandBrake error: ${line}`)
                    hasError = true
                } else if (line.trim().length > 0) {
                    console.log(`[HB Debug] ${line}`)
                }
            }
        }

        hb.stdout.on('data', processOutput)
        hb.stderr.on('data', processOutput)

        hb.on('close', (code) => {
            this.isRepairing = false
            logStream.write(`\n--- HandBrake Finished with exit code ${code} at ${new Date().toISOString()} ---\n`)
            logStream.end()

            if (code === 0 && !hasError) {
                console.log('[Transcoder] Repair successful')
                repairState.status = 'complete'
                repairState.progress = 100 // Force completion percentage in case it stuck
                repairState.eta = 'Done'
                this.emitRepairProgress()
                // Don't delete from activeRepairs immediately; let UI show completion
                // Clean up after a delay to allow UI to display
                setTimeout(() => {
                    this.activeRepairs.delete(hash)
                    this.emitRepairProgress()
                }, 2000)
                resolve(outputPath)
            } else {
                console.error(`[Transcoder] HandBrake failed with exit code ${code}`)
                repairState.status = 'error'
                repairState.error = hasError ? 'HandBrake encountered an error' : `Process exited with code ${code}`
                this.emitRepairProgress()
                reject(new Error(repairState.error))
            }

            this.processRepairQueue() // Start next job if any
        })
    }

    /**
     * Cancel a queued or in-progress repair
     */
    async cancelRepair(hash) {
        // Remove from queue if pending
        const queueIndex = this.repairQueue.findIndex(job => job.hash === hash)
        if (queueIndex > -1) {
            const job = this.repairQueue.splice(queueIndex, 1)[0]
            job.reject(new Error('Repair cancelled by user'))
        }

        // Clean up from active repairs
        this.activeRepairs.delete(hash)

        // Clean up partial repair file
        const repairPath = join(this.repairDir, hash)
        try {
            if (existsSync(repairPath)) {
                rmSync(repairPath, { recursive: true, force: true })
                console.log(`[Transcoder] Cleaned up partial repair for ${hash}`)
            }
        } catch (e) {
            console.warn(`[Transcoder] Could not clean up partial repair for ${hash}:`, e)
        }

        this.emitRepairProgress()
    }

    /**
     * Start FFmpeg transcoding process
     */
    async startTranscoding(filePath, hash, isRetry = false) {
        if (this.activeTranscodes.has(hash) || this.activeRepairs.has(hash)) return // Already running or repairing

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

            let inputArgs = this.encoder !== 'libx264' && !useRepaired ? ['-hwaccel auto'] : []
            if (this.testOptions.ffmpegInputArgs && Array.isArray(this.testOptions.ffmpegInputArgs)) {
                inputArgs = inputArgs.concat(this.testOptions.ffmpegInputArgs)
                console.log('[Transcoder] Injected custom FFmpeg input args:', this.testOptions.ffmpegInputArgs.join(' '))
            }
            if (this.testOptions.ffmpegOutputArgs && Array.isArray(this.testOptions.ffmpegOutputArgs)) {
                outputOptions.push(...this.testOptions.ffmpegOutputArgs)
                console.log('[Transcoder] Injected custom FFmpeg output args:', this.testOptions.ffmpegOutputArgs.join(' '))
            }

            const command = ffmpeg(inputPath)
                .inputOptions(inputArgs)
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
