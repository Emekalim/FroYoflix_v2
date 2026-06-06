// @ts-check
/**
 * Download Folder Scanner
 * Scans the torrent download folder for video files and resolves them
 */

import { IPC } from '@/modules/bridge.js';
import { settings } from '@/modules/settings.js';
import MediaResolver from '@/modules/resolver/MediaResolver.js';
import { videoRx } from '@/modules/util.js';

/**
 * Scan the download folder for all video files
 * @returns {Promise<Array>} - Array of file objects with path and name
 */
export async function scanDownloadFolder() {
    return new Promise((resolve, reject) => {
        const downloadPath = settings.value.torrentPathNew;

        if (!downloadPath) {
            console.warn('[Folder Scanner] No download path configured');
            resolve([]);
            return;
        }

        console.log(`[Folder Scanner] Scanning: ${downloadPath}`);
        console.log(`[Folder Scanner] IPC object:`, IPC);
        console.log(`[Folder Scanner] Emitting scan-folder event...`);

        // Set up timeout (30 seconds for large folders)
        const timeout = setTimeout(() => {
            console.error('[Folder Scanner] Scan timeout after 30s');
            console.error('[Folder Scanner] IPC message never received response');
            reject(new Error('Scan timeout'));
        }, 30000);

        // Listen for scan result
        const handleResult = (files) => {
            console.log(`[Folder Scanner] Received result with ${files.length} files`);
            clearTimeout(timeout);
            IPC.off('folder-scan-result', handleResult);

            // Filter for video files only, excluding macOS hidden files
            const videoFiles = files.filter(file =>
                videoRx.test(file.name) && !file.name.startsWith("._")
            );
            console.log(`[Folder Scanner] Found ${videoFiles.length} video files out of ${files.length} total files`);

            resolve(videoFiles);
        };

        IPC.once('folder-scan-result', handleResult);

        // Request folder scan from main process
        console.log(`[Folder Scanner] Calling IPC.emit('scan-folder', '${downloadPath}')`);
        IPC.emit('scan-folder', downloadPath);
        console.log(`[Folder Scanner] IPC.emit called successfully`);
    });
}

/**
 * Search download folder for a specific media file
 * @param {Object} media - Media object to search for
 * @param {number} episode - Episode number
 * @param {number} [season] - Season number (for TMDB)
 * @returns {Promise<Object|null>} - Found file object or null
 */
export async function searchDownloadFolder(media, episode, season) {
    const mediaTitle = media.title?.userPreferred || media.title?.romaji || media.title?.english || media.title;
    const isMovie = media.format === 'MOVIE' || media.episodes === 1 || !media.episodes;

    console.log(`[Folder Scanner] Searching for: ${mediaTitle}${isMovie ? ' (Movie)' : ` - Episode ${episode}${season ? ` Season ${season}` : ''}`}`);
    console.log(`[Folder Scanner] Media ID: ${media.id}, TMDB ID: ${media.tmdbId}, Source: ${media.source}, Format: ${media.format}`);

    const files = await scanDownloadFolder();
    if (files.length === 0) {
        console.log('[Folder Scanner] No files found in download folder');
        return null;
    }

    console.log(`[Folder Scanner] Found ${files.length} total files, filtering for video files...`);

    // Resolve all files using MediaResolver module
    const filenames = files.map(f => f.name);

    console.log(`[Folder Scanner] Resolving ${filenames.length} files...`);
    const resolved = await MediaResolver.resolveFileMedia(filenames);
    console.log(`[Folder Scanner] Resolved ${resolved.length} files`);

    // Find matching file
    for (let i = 0; i < resolved.length; i++) {
        const result = resolved[i];

        // Skip failed resolutions
        if (result.failed || !result.media) {
            console.log(`[Folder Scanner] Skipping failed resolution: ${files[i].name}`);
            continue;
        }

        // Match by media ID (loose comparison for string/number diffs)
        const resultTmdbId = result.media.externalIds?.tmdb || result.media.tmdbId
        const mediaTmdbId = media.externalIds?.tmdb || media.tmdbId

        const mediaMatch =
            (String(result.media.id) === String(media.id)) ||
            (resultTmdbId && mediaTmdbId && String(resultTmdbId) === String(mediaTmdbId));

        // For movies, ignore episode matching (movies don't have episodes)
        const episodeMatch = isMovie ? true : (result.episode === episode);

        // For TMDB TV shows, also check season
        const seasonMatch = !season ||
            !result.season ||
            result.season === season ||
            isMovie; // Movies don't have seasons

        console.log(`[Folder Scanner] Checking ${files[i].name}:`, {
            mediaMatch,
            episodeMatch,
            seasonMatch,
            isMovie,
            'result.media.id': result.media?.id,
            'result.media.tmdbId': result.media?.tmdbId,
            'result.episode': result.episode,
            'result.season': result.season
        });

        if (mediaMatch && episodeMatch && seasonMatch) {
            console.log(`[Folder Scanner] ✓ Match found: ${files[i].name}`);
            console.log(`[Folder Scanner] Full path: ${files[i].path}`);
            return {
                ...files[i],
                media: result,
                resolved: true
            };
        }
    }

    console.log('[Folder Scanner] No match found after checking all files');
    return null;
}

export default {
    scanDownloadFolder,
    searchDownloadFolder
};
