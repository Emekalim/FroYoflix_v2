import http from 'http'
import { createHash } from 'crypto'
import { statSync, existsSync, createReadStream, writeFileSync, copyFileSync } from 'fs'
import { mkdir, rm, stat } from 'fs/promises'
import { join, basename, dirname, extname } from 'path'
import { app } from 'electron'
import { spawn } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'
import getPort from 'get-port'
import { buildHlsMasterPlaylist } from './hls-master-playlist.js'
import {
    captureRepairSignals,
    consumeIntentionalStop,
    createRepairState,
    describeRepairSignals,
    noteForcedCorruptionKill,
    shouldAttemptRepair
} from './transcode-repair-policy.js'
import {
    buildSubtitleExtractionPlan
} from './subtitle-extraction.js'

// Set FFmpeg binary path — only require ffmpeg-static in dev (it's not bundled in the packaged app)
const ffmpegBinaryPath = app.isPackaged
    ? join(process.resourcesPath, 'bin', 'ffmpeg')
    : require('ffmpeg-static')
const ffprobeBinaryPath = app.isPackaged
    ? join(process.resourcesPath, 'bin', 'ffprobe')
    : require('ffprobe-static').path

if (app.isPackaged && !existsSync(ffprobeBinaryPath)) {
    throw new Error(`[Transcoder] Missing bundled FFprobe binary at: ${ffprobeBinaryPath}`)
}

console.log('[Transcoder] FFmpeg binary path:', ffmpegBinaryPath)
ffmpeg.setFfmpegPath(ffmpegBinaryPath)
console.log('[Transcoder] FFprobe binary path:', ffprobeBinaryPath)
ffmpeg.setFfprobePath(ffprobeBinaryPath)

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
        this.activeTranscodes = new Map() // hash -> Set<ffmpeg command>
        this.intentionalStops = new Set() // hash (true if stopped explicitly)

        // Platform-specific encoder selection — verified async after init
        this.encoder = this.detectEncoder()
        this.encoderReady = this.detectWorkingEncoder().then(enc => { this.encoder = enc })

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
                // Match ffmpeg-static binary in either hoisted (node_modules/ffmpeg-static)
                // or pnpm store (.pnpm/ffmpeg-static) locations
                exec('pkill -f "node_modules.*ffmpeg-static.*/ffmpeg"', (err) => {
                    if (!err) console.log('[Transcoder] Cleaned up zombie ffmpeg processes')
                })
            } else if (platform === 'win32') {
                exec('taskkill /F /IM ffmpeg.exe /FI "COMMANDLINE LIKE \'%ffmpeg-static%\'"', (err) => {
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

    addActiveTranscode(hash, command) {
        if (!hash || !command) return
        let commands = this.activeTranscodes.get(hash)
        if (!commands) {
            commands = new Set()
            this.activeTranscodes.set(hash, commands)
        }
        commands.add(command)
    }

    removeActiveTranscode(hash, command) {
        const commands = this.activeTranscodes.get(hash)
        if (!commands) return false
        commands.delete(command)
        if (commands.size === 0) {
            this.activeTranscodes.delete(hash)
            return true
        }
        return false
    }

    async probe(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (error, metadata) => {
                if (error) reject(error)
                else resolve(metadata)
            })
        })
    }

    async runFFmpeg(args) {
        return new Promise((resolve, reject) => {
            const proc = spawn(ffmpegBinaryPath, args)
            let stderr = ''

            proc.stderr.on('data', (chunk) => {
                stderr += chunk.toString()
            })

            proc.on('error', reject)
            proc.on('close', (code) => {
                if (code === 0) resolve()
                else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`))
            })
        })
    }

    async extractTextSubtitles(filePath) {
        if (!filePath || !existsSync(filePath)) {
            throw new Error('Subtitle extraction requires an existing file path')
        }

        const [metadata, sourceStats] = await Promise.all([
            this.probe(filePath),
            stat(filePath)
        ])
        const plan = buildSubtitleExtractionPlan({
            filePath,
            streams: metadata?.streams || []
        })

        if (!plan.length) return { subtitles: [], errors: [] }

        const subtitles = []
        const errors = []

        for (const entry of plan) {
            try {
                let destinationStats = null
                try {
                    destinationStats = await stat(entry.destinationPath)
                } catch {}

                if (!destinationStats || destinationStats.mtimeMs < sourceStats.mtimeMs) {
                    await mkdir(dirname(entry.destinationPath), { recursive: true })
                    await this.runFFmpeg([
                        '-y',
                        '-i', filePath,
                        '-map', `0:${entry.index}`,
                        '-vn',
                        '-an',
                        '-dn',
                        '-c:s', entry.encoder,
                        entry.destinationPath
                    ])
                    destinationStats = await stat(entry.destinationPath)
                }

                subtitles.push({
                    absolutePath: entry.destinationPath,
                    language: entry.language,
                    format: entry.format,
                    size: destinationStats.size,
                    mtime: destinationStats.mtimeMs
                })
            } catch (error) {
                errors.push({
                    streamIndex: entry.index,
                    message: error.message
                })
            }
        }

        return { subtitles, errors }
    }

    /**
     * Detect best hardware encoder for platform
     */
    detectEncoder() {
        switch (process.platform) {
            case 'darwin':
                return 'h264_videotoolbox'
            case 'win32':
                // Prefer NVIDIA, but many Windows machines use AMD/Intel — test at transcode time
                return 'h264_nvenc'
            case 'linux':
                return 'h264_vaapi'
            default:
                return 'libx264'
        }
    }

    async detectWorkingEncoder() {
        if (this.encoder === 'libx264') return 'libx264'
        return new Promise(resolve => {
            const { execFile } = require('child_process')
            // Probe encoder availability with a null input test
            execFile(ffmpegBinaryPath, [
                '-f', 'lavfi', '-i', 'nullsrc=s=64x64:d=1',
                '-c:v', this.encoder, '-f', 'null', '-'
            ], { timeout: 5000 }, (err) => {
                if (err) {
                    console.warn(`[Transcoder] ${this.encoder} unavailable, falling back to libx264`)
                    resolve('libx264')
                } else {
                    resolve(this.encoder)
                }
            })
        })
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
    getCacheKey(filePath, options = {}) {
        try {
            const stats = statSync(filePath)
            const selectedAudioTrack = Number.isFinite(options?.selectedAudioTrack)
                ? `-audio:${options.selectedAudioTrack}`
                : ''
            const input = `${filePath}-${stats.mtimeMs}-${stats.size}${selectedAudioTrack}`
            return createHash('sha256').update(input).digest('hex')
        } catch (e) {
            // Fallback if file not found
            const selectedAudioTrack = Number.isFinite(options?.selectedAudioTrack)
                ? `-audio:${options.selectedAudioTrack}`
                : ''
            return createHash('sha256').update(`${filePath}${selectedAudioTrack}`).digest('hex')
        }
    }

    getPlaylistStatus(hash) {
        const playlistPath = join(this.tempDir, hash, 'playlist.m3u8')
        if (!existsSync(playlistPath)) {
            return {
                exists: false,
                hash,
                segmentCount: 0,
                playlistDurationSec: 0,
                completed: false
            }
        }

        const { readFileSync } = require('fs')
        const content = readFileSync(playlistPath, 'utf8')
        const lines = content.split(/\r?\n/)
        let playlistDurationSec = 0
        let segmentCount = 0

        for (const line of lines) {
            if (line.startsWith('#EXTINF:')) {
                const duration = Number(line.replace('#EXTINF:', '').split(',')[0])
                if (Number.isFinite(duration)) {
                    playlistDurationSec += duration
                    segmentCount += 1
                }
            }
        }

        return {
            exists: true,
            hash,
            segmentCount,
            playlistDurationSec: Math.max(0, Math.floor(playlistDurationSec)),
            completed: content.includes('#EXT-X-ENDLIST')
        }
    }

    getCastSubtitleCacheKey(filePath) {
        return this.getCacheKey(filePath)
    }

    async ensureCastSubtitleVtt(sourcePath) {
        if (!sourcePath || !existsSync(sourcePath)) {
            throw new Error('Cast subtitle source is missing')
        }

        const sourceStats = await stat(sourcePath)
        const ext = extname(sourcePath).toLowerCase()
        if (ext === '.vtt') return sourcePath

        const hash = this.getCastSubtitleCacheKey(sourcePath)
        const cacheDir = join(this.tempDir, hash, 'cast-subtitles')
        const outputPath = join(cacheDir, `${basename(sourcePath, extname(sourcePath))}.vtt`)

        let outputStats = null
        try {
            outputStats = await stat(outputPath)
        } catch {}

        if (!outputStats || outputStats.mtimeMs < sourceStats.mtimeMs) {
            await mkdir(cacheDir, { recursive: true })
            if (ext === '.webvtt') {
                copyFileSync(sourcePath, outputPath)
            } else {
                await this.runFFmpeg([
                    '-y',
                    '-i', sourcePath,
                    '-map', '0:0',
                    '-vn',
                    '-an',
                    '-dn',
                    '-c:s', 'webvtt',
                    outputPath
                ])
            }
        }

        return outputPath
    }

    getTranscodeStatus(hash) {
        const playlistStatus = this.getPlaylistStatus(hash)
        const active = this.activeTranscodes.has(hash)
        const firstSegmentExists = playlistStatus.segmentCount > 0

        let phase = 'idle'
        if (playlistStatus.completed) phase = 'completed'
        else if (active && !playlistStatus.exists) phase = 'starting'
        else if (active && !firstSegmentExists) phase = 'starting'
        else if (active && firstSegmentExists) phase = 'preparing'
        else if (playlistStatus.exists && firstSegmentExists) phase = 'prepared'
        else if (playlistStatus.exists) phase = 'stalled'

        return {
            ...playlistStatus,
            active,
            firstSegmentExists,
            phase
        }
    }

    async ensureTranscoding(filePath, hash, options = {}) {
        const status = this.getTranscodeStatus(hash)
        if (status.completed || status.active) return this.getTranscodeStatus(hash)

        if (!status.exists || status.phase === 'stalled') {
            await this.startTranscoding(filePath, hash, false, options)
        }

        return this.getTranscodeStatus(hash)
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
                const audioTrackParam = url.searchParams.get('audioTrack')
                const selectedAudioTrack = Number.isFinite(Number(audioTrackParam))
                    ? Number(audioTrackParam)
                    : null

                // Reject invalid or hidden files
                if (!filePath || !existsSync(filePath) || basename(filePath).startsWith('._')) {
                    console.log('[Transcoder] Rejected invalid file:', filePath)
                    res.writeHead(400)
                    res.end('Invalid file')
                    return
                }

                const hash = this.getCacheKey(filePath, { selectedAudioTrack })
                console.log('[Transcoder] Init for:', filePath, 'Hash:', hash)
                const status = await this.ensureTranscoding(filePath, hash, { selectedAudioTrack })
                const audioTrackQuery = selectedAudioTrack != null ? `&audioTrack=${selectedAudioTrack}` : ''

                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                    // CRITICAL: Include file path in playlist URL for stateless design
                    url: `http://localhost:${this.port}/hls/${hash}/master.m3u8?file=${encodeURIComponent(filePath)}${audioTrackQuery}`,
                    hash,
                    status
                }))
                return
            }

            // Route: DELETE /stop?hash=<hash>
            // Explicitly stops transcoding for a specific file hash
            if (url.pathname === '/stop' && req.method === 'DELETE') {
                const hash = url.searchParams.get('hash')
                if (hash && this.activeTranscodes.has(hash)) {
                    console.log(`[Transcoder] Stopping transcoding for hash: ${hash}`)
                    const commands = this.activeTranscodes.get(hash)
                    try {
                        this.intentionalStops.add(hash) // Mark as intentional stop
                        for (const command of commands) {
                            command.kill('SIGKILL') // Force kill for immediate stop
                        }
                    } catch (e) {
                        console.error(`[Transcoder] Failed to kill process ${hash}:`, e)
                    }
                    res.writeHead(200)
                    res.end('Stopped')
                } else {
                    res.writeHead(404)
                    res.end('Not found or not running')
                }
                return
            }

            // Route: /status?hash=<hash>
            if (url.pathname === '/status') {
                const hash = url.searchParams.get('hash')
                if (!hash) {
                    res.writeHead(400)
                    res.end('Missing hash')
                    return
                }

                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(this.getTranscodeStatus(hash)))
                return
            }

            // Route: /hls/<hash>/<filename>
            const match = url.pathname.match(/^\/hls\/([a-f0-9]+)\/(.+)$/)
            if (match) {
                const [, hash, filename] = match
                const cacheDir = join(this.tempDir, hash)
                const filePath = join(cacheDir, filename)

                const isPlaylistRequest = filename.endsWith('.m3u8')
                if (isPlaylistRequest) {
                    const audioTrackParam = url.searchParams.get('audioTrack')
                    const selectedAudioTrack = Number.isFinite(Number(audioTrackParam))
                        ? Number(audioTrackParam)
                        : null
                    if (!existsSync(filePath)) {
                        const originalFile = url.searchParams.get('file')
                        if (!originalFile) {
                            res.writeHead(400)
                            res.end('Missing file source')
                            return
                        }
                        await this.startTranscoding(originalFile, hash, false, { selectedAudioTrack })
                    } else if (existsSync(filePath) && !this.activeTranscodes.has(hash)) {
                        const statusPlaylistPath = join(cacheDir, 'playlist.m3u8')
                        const { readFileSync } = await import('fs')
                        try {
                            const probePath = existsSync(statusPlaylistPath) ? statusPlaylistPath : filePath
                            const content = readFileSync(probePath, 'utf8')
                            if (!content.includes('#EXT-X-ENDLIST')) {
                                console.log('[Transcoder] Found incomplete playlist with no active process. Restarting:', hash)
                                const originalFile = url.searchParams.get('file')
                                if (originalFile) {
                                    await this.startTranscoding(originalFile, hash, false, { selectedAudioTrack })
                                }
                            }
                        } catch (e) {
                            console.error('[Transcoder] Failed to check playlist status:', e)
                        }
                    }

                    // Wait for playlist/master to be created (max 60s for 4K files)
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

            // Route: /file?path=<encoded absolute path>
            // Serves a local file with range request support for Cast device streaming
            if (url.pathname === '/file') {
                const filePath = url.searchParams.get('path')
                if (!filePath || !existsSync(filePath) || basename(filePath).startsWith('._')) {
                    res.writeHead(400)
                    res.end('Invalid file')
                    return
                }

                let fileStats
                try { fileStats = statSync(filePath) } catch {
                    res.writeHead(404)
                    res.end('Not found')
                    return
                }

                const ext = filePath.split('.').pop()?.toLowerCase() || ''
                const mimeMap = {
                    mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm',
                    avi: 'video/x-msvideo', mov: 'video/quicktime', ogg: 'video/ogg',
                    ogv: 'video/ogg', m4v: 'video/mp4', ts: 'video/mp2t', vtt: 'text/vtt'
                }
                const contentType = mimeMap[ext] || 'video/mp4'
                const totalSize = fileStats.size

                const rangeHeader = req.headers['range']
                if (rangeHeader) {
                    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
                    const start = parseInt(startStr, 10)
                    const end = endStr ? parseInt(endStr, 10) : totalSize - 1
                    const chunkSize = end - start + 1
                    res.writeHead(206, {
                        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunkSize,
                        'Content-Type': contentType,
                        'Access-Control-Allow-Origin': '*'
                    })
                    createReadStream(filePath, { start, end }).pipe(res)
                } else {
                    res.writeHead(200, {
                        'Content-Length': totalSize,
                        'Content-Type': contentType,
                        'Accept-Ranges': 'bytes',
                        'Access-Control-Allow-Origin': '*'
                    })
                    createReadStream(filePath).pipe(res)
                }
                return
            }

            res.writeHead(404)
            res.end()
        })

        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`[Transcoder] HLS Server listening on port ${this.port}`)
                resolve(this.port)
            })
        })
    }

    /**
     * Returns the HTTP URL that the Cast device can use to stream a local file.
     * Replaces localhost with the machine's first non-loopback IPv4 address.
     */
    getFileUrl(filePath, lanIp) {
        const host = lanIp || 'localhost'
        return `http://${host}:${this.port}/file?path=${encodeURIComponent(filePath)}`
    }

    /**
     * Get path to bundled HandBrakeCLI binary
     */
    getHandBrakePath() {
        const isWin = process.platform === 'win32'
        const binaryName = isWin ? 'HandBrakeCLI.exe' : 'HandBrakeCLI'
        const osFolderName = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux'

        if (app.isPackaged) {
            return join(process.resourcesPath, 'bin', binaryName)
        }

        // In development, app.getAppPath() might point to 'electron/build'
        const appPath = app.getAppPath()
        const possiblePaths = [
            join(appPath, 'resources', osFolderName, binaryName),
            join(appPath, '..', 'resources', osFolderName, binaryName)
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
    async startTranscoding(filePath, hash, isRetry = false, options = {}) {
        if (this.activeTranscodes.has(hash)) return // Already running
        await this.encoderReady // Ensure encoder detection has completed

        const cacheDir = join(this.tempDir, hash)

        // Check for existing repaired file (persistent storage)
        const repairedPath = join(this.repairDir, hash, 'repaired.mp4')
        const useRepaired = existsSync(repairedPath)
        const inputPath = useRepaired ? repairedPath : filePath

        // Ensure clean slate for new transcode (only clears HLS cache, not repair)
        await rm(cacheDir, { recursive: true, force: true })
        await mkdir(cacheDir, { recursive: true })

        console.log(`[Transcoder] Starting HLS for ${inputPath} -> ${cacheDir} ${useRepaired ? '(Using Repaired Source)' : ''}`)

        let metadata = null
        try {
            metadata = await this.probe(inputPath)
        } catch (e) {
            console.error('[Transcoder] ffprobe failed:', e)
        }

        const audioStreams = (metadata?.streams || []).filter((s) => s?.codec_type === 'audio')
        const hasMultiAudio = audioStreams.length > 1
        const selectedAudioTrack = Number.isFinite(options?.selectedAudioTrack)
            ? Math.max(0, Math.min(options.selectedAudioTrack, Math.max(audioStreams.length - 1, 0)))
            : null

        const encodedSource = encodeURIComponent(filePath)
        const audioTrackQuery = selectedAudioTrack != null ? `&audioTrack=${selectedAudioTrack}` : ''
        const videoUri = `playlist.m3u8?file=${encodedSource}${audioTrackQuery}`
        const audioRenditions = hasMultiAudio
            ? audioStreams.map((stream, idx) => {
                const language = stream?.tags?.language || null
                const nameParts = []
                if (language) nameParts.push(language)
                const title = stream?.tags?.title || stream?.tags?.handler_name
                if (title) nameParts.push(title)
                const name = nameParts.join(' - ') || `Track ${idx + 1}`
                return {
                    uri: `audio_${idx}.m3u8?file=${encodedSource}${audioTrackQuery}`,
                    name,
                    language,
                    isDefault: selectedAudioTrack != null
                        ? idx === selectedAudioTrack
                        : Boolean(stream?.disposition?.default)
                }
            })
            : []

        try {
            writeFileSync(
                join(cacheDir, 'master.m3u8'),
                buildHlsMasterPlaylist({ videoUri, audioRenditions }),
                'utf8'
            )
        } catch (e) {
            console.error('[Transcoder] Failed to write master.m3u8:', e)
        }

        if (hasMultiAudio) {
            return this.startMultiAudioTranscoding({
                filePath,
                hash,
                cacheDir,
                inputPath,
                audioStreams,
                selectedAudioTrack,
                isRetry,
                useRepaired
            })
        }

        return new Promise((resolve, reject) => {
            const repairState = createRepairState()
            // Explicit stream mapping excludes subtitle/attachment streams entirely —
            // relying on -sn is not sufficient for MKVs with bitmap subs (PGS/VOBSUB)
            // or embedded font attachments, which can cause FFmpeg to error before
            // writing any segments even though they wouldn't appear in the output.
            const audioMap = audioStreams.length > 0 ? ['-map', '0:a:0'] : []
            const outputOptions = ['-map', '0:v:0', ...audioMap]

            if (useRepaired) {
                // Repaired file (HandBrake MP4): stream-copy since codecs are already
                // Chromecast-compatible. Explicit maps above exclude any stray streams.
                outputOptions.push('-c', 'copy')
            } else {
                outputOptions.push(
                    `-c:v`, this.encoder,
                )
                if (this.encoder === 'libx264') outputOptions.push('-preset', 'ultrafast')
                else outputOptions.push('-allow_sw', '1')
                outputOptions.push(
                    // Chromecast rejects 10-bit H.264 output from 10-bit sources.
                    '-pix_fmt', 'yuv420p',
                    '-b:v', '10M',
                    '-maxrate', '12M',
                    '-bufsize', '24M',
                    '-force_key_frames', 'expr:gte(t,n_forced*6)',
                    '-sc_threshold', '0',
                    '-fflags', '+genpts',
                    '-vsync', '0',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-ac', '2',
                    '-ar', '48000'
                )
            }

            outputOptions.push(
                '-hls_time', '6',
                '-hls_list_size', '0',
                '-hls_segment_filename', join(cacheDir, 'segment_%03d.ts'),
                '-start_number', '0'
            )

            const command = ffmpeg(inputPath)
                .inputOptions(this.encoder !== 'libx264' && !useRepaired ? ['-hwaccel auto'] : [])
                .outputOptions(outputOptions)
                .output(join(cacheDir, 'playlist.m3u8'))
                .on('start', (cmd) => {
                    console.log(`[Transcoder] Spawned: ${cmd}`)
                    this.addActiveTranscode(hash, command)
                    resolve()
                })
                .on('stderr', (stderrLine) => {
                    captureRepairSignals(repairState, stderrLine)

                    // Only log errors or critical warnings
                    if (stderrLine.includes('Error') || stderrLine.includes('Opening')) {
                        console.log(`[FFmpeg] ${stderrLine}`)
                    }

                    // Proactively catch fatal decoding errors that don't immediately crash FFmpeg
                    // This forces the 'error' handler to fire with SIGKILL, triggering the fallback logic
                    if (!isRetry && !useRepaired && repairState.sawDecoderFailure && !repairState.forcedDecoderKillForCorruption) {
                        noteForcedCorruptionKill(repairState)
                        console.error('[Transcoder] Detected fatal decoder error stream. Killing process to force fallback...')
                        command.kill('SIGKILL')
                    }
                })
                .on('error', async (err) => {
                    console.error(`[Transcoder] Error: ${err.message}`)
                    captureRepairSignals(repairState, err.message)
                    const becameIdle = this.removeActiveTranscode(hash, command)
                    const intentionalStop = consumeIntentionalStop(this.intentionalStops, hash)

                    if (intentionalStop) {
                        console.log(`[Transcoder] Ignoring expected SIGKILL for ${hash}`)
                        return
                    }

                    if (shouldAttemptRepair({ intentionalStop, isRetry, useRepaired, repairState })) {
                        console.log(`[Transcoder] Critical failure detected (${describeRepairSignals(repairState)}). Initiating Smart Fallback repair...`)
                        try {
                            await this.repairFile(filePath, hash)
                            // Restart transcoding - will auto-detect the new repaired file
                            await this.startTranscoding(filePath, hash, true, options)
                        } catch (repairErr) {
                            console.error('[Transcoder] Repair failed:', repairErr)
                        }
                        return
                    }

                    console.warn(`[Transcoder] Transcode failed without repair for ${hash}: ${err.message}`)
                    if (becameIdle) this.intentionalStops.delete(hash)
                })
                .on('end', () => {
                    console.log(`[Transcoder] Finished: ${hash}`)
                    const becameIdle = this.removeActiveTranscode(hash, command)
                    if (becameIdle) this.intentionalStops.delete(hash)
                })

            command.run()
        })
    }

    startMultiAudioTranscoding({ filePath, hash, cacheDir, inputPath, audioStreams, selectedAudioTrack = null, isRetry, useRepaired }) {
        // Single FFmpeg process with multiple HLS outputs.
        //
        // The video playlist muxes video + the default audio track together.
        // This is essential for Chromecast compatibility: some firmware versions
        // silently ignore EXT-X-MEDIA audio renditions when the video variant
        // segments contain no audio at all. By embedding the default audio in the
        // video segments, Chromecast always has audio to play regardless of whether
        // it loads the EXT-X-MEDIA renditions.
        //
        // All audio tracks are also produced as separate EXT-X-MEDIA playlists so
        // that hls.js in the native player can still offer full track switching.

        // Find which audio stream is flagged as default; fall back to the first one.
        const defaultAudioIdx = audioStreams.findIndex(s => s.disposition?.default === 1)
        const defaultIdx = Number.isFinite(selectedAudioTrack) && selectedAudioTrack >= 0 && selectedAudioTrack < audioStreams.length
            ? selectedAudioTrack
            : (defaultAudioIdx >= 0 ? defaultAudioIdx : 0)
        const defaultStream = audioStreams[defaultIdx]

        const args = []

        if (this.encoder !== 'libx264' && !useRepaired) {
            args.push('-hwaccel', 'auto')
        }
        args.push('-i', inputPath)

        // Video output — mux video + default audio into the same segments so
        // Chromecast always has an audio source even if EXT-X-MEDIA is ignored.
        args.push('-map', '0:v:0', '-map', `0:${defaultStream.index}`, '-c:v', this.encoder)
        if (this.encoder === 'libx264') args.push('-preset', 'ultrafast')
        if (this.encoder !== 'libx264') args.push('-allow_sw', '1')
        args.push(
            '-b:v', '10M', '-maxrate', '12M', '-bufsize', '24M',
            // Force 8-bit 4:2:0 output for Cast-compatible HLS variants.
            '-pix_fmt', 'yuv420p',
            '-force_key_frames', 'expr:gte(t,n_forced*6)',
            '-sc_threshold', '0', '-fflags', '+genpts', '-vsync', '0',
            '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '48000',
            '-hls_time', '6', '-hls_list_size', '0',
            '-hls_flags', 'independent_segments+split_by_time',
            '-hls_segment_filename', join(cacheDir, 'segment_%03d.ts'),
            '-start_number', '0', '-f', 'hls',
            join(cacheDir, 'playlist.m3u8')
        )

        // One audio-only output per track (all tracks, including default) so that
        // hls.js can offer full track switching in the native player.
        for (let idx = 0; idx < audioStreams.length; idx++) {
            args.push(
                '-map', `0:${audioStreams[idx].index}`,
                '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '48000',
                '-hls_time', '6', '-hls_list_size', '0',
                '-hls_flags', 'independent_segments+split_by_time',
                '-hls_segment_filename', join(cacheDir, `audio_${idx}_%03d.ts`),
                '-start_number', '0', '-f', 'hls',
                join(cacheDir, `audio_${idx}.m3u8`)
            )
        }

        return new Promise((resolve) => {
            let started = false
            const repairState = createRepairState()
            const proc = spawn(ffmpegBinaryPath, args)
            const handle = { kill: (signal) => proc.kill(signal) }

            proc.stderr.on('data', (chunk) => {
                const line = chunk.toString()
                captureRepairSignals(repairState, line)
                if (!started) {
                    started = true
                    this.addActiveTranscode(hash, handle)
                    console.log(`[Transcoder] Spawned multi-audio: ${hash}`)
                    resolve()
                }
                if (line.includes('Error') || line.includes('Opening')) {
                    console.log(`[FFmpeg:multi] ${line.trim()}`)
                }
                if (!isRetry && !useRepaired && repairState.sawDecoderFailure && !repairState.forcedDecoderKillForCorruption) {
                    noteForcedCorruptionKill(repairState)
                    console.error('[Transcoder] Fatal decoder error (multi). Killing...')
                    proc.kill('SIGKILL')
                }
            })

            proc.on('error', (err) => {
                if (!started) { started = true; resolve() }
                captureRepairSignals(repairState, err.message)
                console.error(`[Transcoder] Multi-audio spawn error: ${err.message}`)
                const becameIdle = this.removeActiveTranscode(hash, handle)
                if (becameIdle) this.intentionalStops.delete(hash)
            })

            proc.on('close', async (code) => {
                if (!started) { started = true; resolve() }
                const becameIdle = this.removeActiveTranscode(hash, handle)
                const intentionalStop = consumeIntentionalStop(this.intentionalStops, hash)

                if (intentionalStop) {
                    console.log(`[Transcoder] Ignoring expected stop for multi-audio transcode ${hash}`)
                    return
                }

                if (code === 0) {
                    console.log(`[Transcoder] Multi-audio finished: ${hash}`)
                    if (becameIdle) this.intentionalStops.delete(hash)
                    return
                }

                if (shouldAttemptRepair({ intentionalStop, isRetry, useRepaired, repairState })) {
                    console.log(`[Transcoder] Multi-audio failed (${describeRepairSignals(repairState)}), attempting repair...`)
                    try {
                        await this.repairFile(filePath, hash)
                        await this.startTranscoding(filePath, hash, true, { selectedAudioTrack })
                    } catch (repairErr) {
                        console.error('[Transcoder] Repair failed:', repairErr)
                    }
                    return
                }

                console.warn(`[Transcoder] Multi-audio exited without repair for ${hash} (code ${code})`)
                if (becameIdle) this.intentionalStops.delete(hash)
            })
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
        for (const [hash, commands] of this.activeTranscodes) {
            try {
                this.intentionalStops.add(hash) // Mark as intentional
                for (const command of commands) {
                    command.kill('SIGKILL') // Force kill on app exit
                }
            } catch (e) {
                console.error(`[Transcoder] Failed to kill process ${hash}:`, e)
            }
        }
        this.activeTranscodes.clear()

        console.log('[Transcoder] Stopped')
    }
}
