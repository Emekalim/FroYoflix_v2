<script context='module'>
    import { Download, CloudUpload, CloudDownload, FolderX, FolderCheck, TvMinimalPlay } from 'lucide-svelte'
    import { settings } from '@/modules/settings.js'
    import { stage, loadedTorrent, stagingTorrents, seedingTorrents, completedTorrents } from '@/modules/torrent.js'
    import { getHash } from '@/modules/anime/animehash.js'
    import { click } from '@/modules/click.js'
    import { getTorrentState, getTorrentStateLabel } from '@/modules/torrentState.js'

    export function playActive(hash, search, uri, prompt = true) {
        const autoFile = settings.value.rssAutofile
        const resolvedHash = getHash(search?.media?.id, { episode: search?.episode, client: true, batchGuess: true }, false, true)
        const activeHash = autoFile && getActiveHash([...(hash && hash !== resolvedHash ? [hash] : []), ...(resolvedHash ? [resolvedHash] : [])], false)
        if (activeHash && loadedTorrent.value?.infoHash !== activeHash && loadedTorrent.value?.fileHash !== activeHash) { // We have a cached and active hash with the requested media and episode, its predicted we should use this.
            window.dispatchEvent(new CustomEvent('add', { detail: { resolvedHash: activeHash, search } }))
        } else if ((autoFile || !prompt) && uri && (!hash || (hash !== loadedTorrent.value?.infoHash && hash !== loadedTorrent.value?.fileHash))) { // Nothing found, request download from torrent URI.
            window.dispatchEvent(new CustomEvent('play-torrent', { detail: { uri } }))
        } else if (prompt) { // Nothing found and no magnet, prompt user to locate torrent.
            window.dispatchEvent(new CustomEvent('play-anime', {
                detail: {
                    id: search?.media?.id,
                    episode: search?.episode,
                    torrentOnly: true
                }
            }))
        } else { // Nothing found, no magnet, and cannot prompt, show the anime details.
            window.dispatchEvent(new CustomEvent('open-anime', { detail: { id: search?.media?.id } }))
        }
    }

    function getActiveHash(hash, ignoreCached = true) {
        for (const _hash of hash) {
            if (loadedTorrent.value?.infoHash === _hash) return _hash
        }
        for (const _hash of hash) {
            if (seedingTorrents.value.some(torrent => torrent.infoHash === _hash)) return _hash
        }
        for (const _hash of hash) {
            if (completedTorrents.value.some(torrent => torrent.infoHash === _hash)) return _hash
        }
        for (const _hash of hash) {
            if (stagingTorrents.value.some(torrent => torrent.infoHash === _hash)) return _hash
        }
        return ignoreCached ? hash[0] : null
    }
</script>
<script>
    export let hash
    export let search
    export let torrentID = null
    export let size = '1.7rem'
    export let strokeWidth = '3'
    $: disabled = ($seedingTorrents?.length + $stagingTorrents?.length + 1) >= settings.value.seedingLimit && !settings.value.torrentPersist
    $: activeHash = $loadedTorrent && $stagingTorrents && $seedingTorrents && $completedTorrents && (Array.isArray(hash) ? getActiveHash(hash) : hash)
    $: currentTorrent = $loadedTorrent.infoHash === activeHash ? $loadedTorrent : null
    $: stagingTorrent = $stagingTorrents.find(torrent => torrent.infoHash === activeHash) || null
    $: seedingTorrent = $seedingTorrents.find(torrent => torrent.infoHash === activeHash) || null
    $: completedTorrent = $completedTorrents.find(torrent => torrent.infoHash === activeHash) || null
    $: activeTorrent = currentTorrent || seedingTorrent || stagingTorrent || completedTorrent || null
    $: torrentState = activeTorrent
        ? getTorrentState(activeTorrent, {
            current: !!currentTorrent,
            completed: !!completedTorrent,
            streamedDownload: settings.value.torrentStreamedDownload
        })
        : null
    $: canResume = !!(completedTorrent?.incomplete && !disabled && torrentID)
    $: canQueue = !!(!activeTorrent && !disabled && torrentID)
    $: buttonInteractive = canQueue || canResume
    $: buttonTitle = completedTorrent?.incomplete
        ? 'Resume Download'
        : activeTorrent
            ? getTorrentStateLabel(torrentState, { currentLabel: 'Now Playing' })
            : (!disabled ? 'Queue for Download' : 'Enable Persist Files or Increase Seeding Limit')
    $: buttonColor = completedTorrent?.incomplete
        ? 'var(--error-color)'
        : currentTorrent || completedTorrent
            ? 'var(--quaternary-color)'
            : seedingTorrent
                ? 'var(--tertiary-color)'
                : stagingTorrent
                    ? 'var(--warning-color)'
                    : ''
    $: buttonIcon = completedTorrent?.incomplete
        ? Download
        : completedTorrent
            ? FolderCheck
            : seedingTorrent
                ? CloudUpload
                : stagingTorrent
                    ? CloudDownload
                    : currentTorrent
                        ? TvMinimalPlay
                        : Download
</script>
<button type='button' class='torrent-button d-flex align-items-center justify-content-center {$$restProps.class}' class:not-allowed={!buttonInteractive && (activeTorrent || disabled)} class:not-reactive={!buttonInteractive && (activeTorrent || disabled)} disabled={disabled && !buttonInteractive} data-toggle='tooltip' data-placement='left' data-title={buttonTitle} use:click={() => { if (buttonInteractive) stage(torrentID, search, activeHash) }}>
    <svelte:component this={buttonIcon} {size} {strokeWidth} style={buttonColor ? `color: ${buttonColor}` : ''} />
</button>
