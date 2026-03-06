import { app } from 'electron';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { Transcoder } from './src/main/transcoder.js';

app.whenReady().then(async () => {
    console.log('\n======================================================');
    console.log('🎬 FROYOFLIX TRANSCODER TEST SUITE');
    console.log('======================================================\n');

    // Parse arguments: node test-runner.js [--ffmpeg] [--hb-args "..."] [--ffmpeg-in "..."] [--ffmpeg-out "..."] <path>
    const args = process.argv.slice(2);
    const runFFmpeg = args.includes('--ffmpeg');

    // Support spaces within the quotes, e.g. --hb-args "--start-at seconds:252 --all-audio"
    const getFlagValue = (flag) => {
        const idx = args.indexOf(flag);
        if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
            return args[idx + 1].split(' ');
        }
        return null;
    };

    const testOptions = {};
    const hbOverride = getFlagValue('--hb-args');
    const ffmpegInOverride = getFlagValue('--ffmpeg-in');
    const ffmpegOutOverride = getFlagValue('--ffmpeg-out');

    if (hbOverride) testOptions.hbArgs = hbOverride;
    if (ffmpegInOverride) testOptions.ffmpegInputArgs = ffmpegInOverride;
    if (ffmpegOutOverride) testOptions.ffmpegOutputArgs = ffmpegOutOverride;

    const fileToTest = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--hb-args' && args[i - 1] !== '--ffmpeg-in' && args[i - 1] !== '--ffmpeg-out').pop();

    if (!fileToTest || !existsSync(fileToTest)) {
        console.error('❌ Usage: npx electron test-runner.js [--ffmpeg] <absolute-path-to-video-file>');
        console.error(`Received: ${fileToTest}`);
        app.quit();
        return;
    }

    let transcoder = null;
    let isExiting = false;

    const cleanupAndExit = () => {
        if (isExiting) return;
        isExiting = true;
        console.log('\nCleaning up and exiting...');
        if (transcoder) transcoder.stop();
        app.quit();
    };

    // Mock the mainWindow object to intercept IPC progress events
    const mockMainWindow = {
        webContents: {
            send: (channel, data) => {
                // Log progress events minimally to avoid terminal spam
                if (channel === 'repair-progress' && data.length > 0) {
                    const repair = data[0];
                    process.stdout.write(`\r[Repair Progress] Status: ${repair.status.padEnd(10)} | Progress: ${repair.progress?.toFixed(2).padStart(6, ' ')}% | ETA: ${(repair.eta || '').padEnd(20)}`);

                    if (repair.status === 'complete' || repair.status === 'error') {
                        console.log('\n'); // Add newline when finished
                        if (!runFFmpeg) cleanupAndExit();
                    }
                } else if (channel !== 'repair-progress') {
                    console.log(`\n[IPC Event] ${channel}:`, data);
                }
            }
        }
    };

    console.log('Initializing Transcoder with Test Options:', testOptions);
    transcoder = new Transcoder(mockMainWindow, testOptions);

    try {
        const hash = 'test-hash-' + Date.now();
        console.log(`\n🚀 Submitting file for testing...`);
        console.log(`Input: ${fileToTest}`);
        console.log(`Mock Hash: ${hash}\n`);

        if (runFFmpeg) {
            console.log('▶️ Mode: FFmpeg HLS Transcoding');
            await transcoder.startTranscoding(fileToTest, hash);
            console.log('\n✅ [Test] FFmpeg stream initialized!');
            console.log('Waiting for FFmpeg output or crash... (Press Ctrl+C to stop)\n');

            // Loop until the ffmpeg process finishes or is killed
            const checker = setInterval(() => {
                if (!transcoder.activeTranscodes.has(hash)) {
                    clearInterval(checker);
                    console.log('\nFFmpeg process has exited from active tracking.');
                    // If it crashed, it might have triggered repair fallback internally.
                    if (!transcoder.isRepairing) cleanupAndExit();
                }
            }, 2000);

        } else {
            console.log('▶️ Mode: HandBrake Repair');
            const outputPath = await transcoder.repairFile(fileToTest, hash);

            console.log('\n✅ [Test] Repair resolved successfully!');
            console.log(`Output Location: ${outputPath}`);
            setTimeout(cleanupAndExit, 1000); // give UI events a second to flush
        }
    } catch (e) {
        console.error('\n❌ [Test] Task failed:', e);
        cleanupAndExit();
    }
});
