<script>
  import { settings } from "@/modules/settings.js";
  import { cache, caches } from "@/modules/cache.js";
  import { page, modal, playPage } from "@/modules/navigation.js";
  import {
    completePlayerStartup,
    failPlayerStartup,
    playerStartup,
    updatePlayerStartup,
  } from "@/modules/playerStartup.js";
  import {
    getAnimeProgress,
    setAnimeProgress,
  } from "@/modules/anime/animeprogress.js";
  import { openTorrentModal } from "@/modals/torrent/TorrentModal.svelte";
  import { anilistClient } from "@/modules/anilist.js";
  import { episodesList } from "@/modules/episodes.js";
  import MediaResolver from "@/modules/resolver/MediaResolver.js";
  import { getMediaMaxEp } from "@/modules/anime/anime.js";
  import { writable } from "simple-store-svelte";
  import { createEventDispatcher, tick } from "svelte";
  import Subtitles from "@/modules/subtitles.js";
  import {
    toTS,
    fastPrettyBytes,
    matchPhrase,
    videoRx,
    isValidNumber,
  } from "@/modules/util.js";
  import { toast } from "svelte-sonner";
  import { getChaptersAniSkip } from "@/modules/anime/anime.js";
  import { mediaCache } from "@/modules/cache.js";
  import Seekbar from "perfect-seekbar";
  import { click } from "@/modules/click.js";
  import VideoDeband from "video-deband";
  import Helper from "@/modules/helper.js";
  import Hls from "hls.js";
  import libraryRepository from "@/modules/library/LibraryRepository.js";

  import { w2gEmitter, state } from "@/routes/w2g/WatchTogetherPage.svelte";
  import ManagerModal from "@/modals/manager/ManagerModal.svelte";
  import Keybinds, { condition } from "svelte-keybinds";
  import { SUPPORTS } from "@/modules/support.js";
  import "rvfc-polyfill";
  import { IPC, ELECTRON } from "@/modules/bridge.js";
  import WPC from "@/modules/wpc.js";
  import {
    castMedia,
    pauseCast,
    playCast,
    castState,
    endCastSession,
    requestCastSession,
    seekCast,
    setCastMuted,
    setCastVolume,
  } from "@/modules/cast.js";
  import {
    failPlayback,
    markPlaybackEnded,
    markPlaybackPaused,
    markPlaybackPlaying,
    markPlaybackReady,
    playbackSession,
    PLAYBACK_TARGET,
  } from "@/modules/playback/session.js";
  import { getNowPlayingSnapshot } from "@/modules/playback/source.js";
  import {
    findChapter,
    isChapterSkippable,
    normaliseChapters,
    toSeekbarChapters,
  } from "@/modules/playback/chapters.js";
  import {
    buildBrowsingActivity,
    buildWatchingActivity,
  } from "@/modules/playback/discordActivity.js";
  import {
    buildMediaCacheKey,
    buildProgressQuery,
    clampTimeToDuration,
    shouldAutoComplete,
  } from "@/modules/playback/progress.js";
  import { createAudioGainManager } from "@/modules/playback/audioGain.js";
  import { createThumbnailer } from "@/routes/player/components/thumbnails.js";
  import {
    X,
    Minus,
    ArrowDown,
    ArrowUp,
    Captions,
    Cast,
    FastForward,
    Keyboard,
    EllipsisVertical,
    Eye,
    FilePlus2,
    ListMusic,
    ListVideo,
    Maximize,
    Minimize,
    Pause,
    PictureInPicture,
    PictureInPicture2,
    Play,
    Rewind,
    RotateCw,
    SkipBack,
    SkipForward,
    Users,
    Volume2,
    VolumeX,
    SlidersVertical,
    SquarePen,
    Milestone,
    Settings,
  } from "lucide-svelte";
  import { registerPlayerKeybinds } from "@/routes/player/components/keybinds.js";
  import Debug from "debug";
  const debug = Debug("ui:player");

  const emit = createEventDispatcher();

  w2gEmitter.on("playerupdate", (detail) => {
    currentTime = detail.time;
    paused = detail.paused;
  });
  w2gEmitter.on("setindex", (detail) => {
    playFile(detail);
  });

  export function playFile(file) {
    if (isValidNumber(file)) handleCurrent(videos?.[file]);
    else handleCurrent(file);
  }

  function updatew2g() {
    saveAnimeProgress();
    w2gEmitter.emit("player", { time: Math.floor(currentTime), paused });
  }

  export let miniplayer = false;
  $: viewAnime = $modal[modal.ANIME_DETAILS];
  $condition = () =>
    SUPPORTS.keybinds &&
    $page === page.PLAYER &&
    ((!miniplayer &&
      (!$modal || !modal.length) &&
      !document.querySelector(".modal.show")) ||
      viewAnime);

  export let files = [];
  export let playableFiles = [];
  export let updateCurrent;
  $: updateFiles(files);
  let src = null;
  let video = null;
  let container = null;
  let current = null;
  let subs = null;
  let duration = 0.1;
  let paused = true;
  let muted = false;
  let wasPaused = null;
  let videos = [];
  let immersed = false;
  let buffering = false;
  let immerseTimeout = null;
  let bufferTimeout = null;
  let subHeaders = null;
  let pip = false;
  let isFullscreen = false;
  let ended = false;
  const audio = createAudioGainManager({ cache, caches });
  const { gain, volume, volumeBoosted } = audio;
  let playbackRate = 1;
  let startupBufferRequest = 0;
  let startupBufferPending = false;
  let startupPlaybackPending = false;
  let initialStartPosition = 0;
  let initialStartPositionApplied = false;
  let handoffDurationFallback = null;
  $: builtinSource =
    $playbackSession?.target === PLAYBACK_TARGET.BUILTIN
      ? $playbackSession.source
      : null;
  $: castPlaybackActive =
    $castState?.sessionState === "SESSION_STARTED" ||
    $castState?.sessionState === "SESSION_RESUMED";
  $: castMediaState = $castState?.media || null;
  $: if (builtinSource?.file && current?.path !== builtinSource.file.path) {
    current = builtinSource.file;
  }
  $: if (builtinSource && builtinSource !== null) {
    media = getNowPlayingSnapshot(builtinSource);
  }
  $: localDurationReady =
    Number.isFinite(Number(duration)) &&
    Number(duration) > 0 &&
    Number(duration) !== 0.1;
  $: if (localDurationReady && handoffDurationFallback != null) {
    handoffDurationFallback = null;
  }
  $: safeduration = localDurationReady
    ? Number(duration)
    : handoffDurationFallback ?? currentTime;
  $: playbackDuration = castPlaybackActive
    ? Number(castMediaState?.duration) || safeduration
    : safeduration;
  $: playbackCurrentTime = castPlaybackActive
    ? Number(castMediaState?.currentTime) || 0
    : currentTime;
  $: playbackPaused = castPlaybackActive
    ? Boolean(castMediaState?.paused ?? true)
    : paused;
  $: playbackEnded = castPlaybackActive ? Boolean(castMediaState?.ended) : ended;
  $: playbackMuted = castPlaybackActive ? Boolean(castMediaState?.muted) : muted;
  $: playbackVolume = castPlaybackActive
    ? Math.max(0, Math.min(1, Number(castMediaState?.volume ?? 1)))
    : $volume;
  $: displayedTime = wasPaused == null ? playbackCurrentTime : targetTime;
  $: {
    if (hidden) setDiscordRPC(media, video?.currentTime);
    else setDiscordRPC(media, paused && $page !== page.PLAYER);
  }

  window.addEventListener("fileEdit", () => {
    if (current) {
      debug(
        "Detected a user update to the parsed file(s), now updating the media...",
      );
      const index = videos.indexOf(current);
      updateCurrent({ detail: current });
      current = videos[index];
    }
  });

  function checkAudio() {
    audio.restoreBoostForMedia(buildMediaCacheKey(media), video);
    if (!hls && "audioTracks" in HTMLVideoElement.prototype) {
      if (!video.audioTracks.length) {
        toast.error("Audio Codec Unsupported", {
          description:
            "This torrent's audio codec is not supported, try a different release by disabling Autoplay Torrents in RSS settings.",
        });
      } else if (video.audioTracks.length > 1) {
        const preferredTrack = [...video.audioTracks].find(
          ({ language }) => language === $settings.audioLanguage,
        );
        if (preferredTrack) return selectAudio(preferredTrack.id);

        const japaneseTrack = [...video.audioTracks].find(
          ({ language }) => language === "jpn",
        );
        if (japaneseTrack) return selectAudio(japaneseTrack.id);
      }
    }
  }

  function checkSubtitle() {
    const lastSubtitle = cache.getEntry(caches.HISTORY, "lastSubtitle")?.[
      buildMediaCacheKey(media)
    ];
    if (subHeaders?.length && lastSubtitle) {
      if (lastSubtitle === "OFF") {
        subs.selectCaptions(-1);
        setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix (resize) because video metadata doesn't update for multiple frames
      } else {
        for (const track of subHeaders) {
          const trackName =
            (track?.language ||
              (!Object.values(subs?.headers).some(
                (header) =>
                  header?.language === "eng" || header?.language === "en",
              )
                ? "eng"
                : track?.type)) + (track?.name ? " - " + track?.name : "");
          if (
            matchPhrase(
              lastSubtitle,
              trackName,
              trackName?.length > 10 ? 3 : 2,
              true,
            ) &&
            track?.number
          ) {
            subs.selectCaptions(track.number);
            setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix (resize) because video metadata doesn't update for multiple frames
            break;
          }
        }
      }
    }
  }

  // document.fullscreenElement isn't reactive
  let orientationLockable = true; // might as well stop trying to lock the orientation when the device doesn't support it.
  document.addEventListener("fullscreenchange", () => {
    isFullscreen = !!document.fullscreenElement;
    if (document.fullscreenElement && orientationLockable) {
      if (SUPPORTS.isAndroid) window.AndroidFullScreen?.immersiveMode();
      screen.orientation.lock("landscape").then(
        (success) => debug(success),
        (failure) => {
          if (!failure?.toString()?.includes("NotSupportedError")) {
            debug(failure);
          } else {
            orientationLockable = false;
          }
        },
      );
    } else if (orientationLockable) {
      if (SUPPORTS.isAndroid) {
        window.AndroidFullScreen?.showSystemUI();
        window.Capacitor.Plugins.StatusBar.setOverlaysWebView({
          overlay: true,
        });
        window.Capacitor.Plugins.StatusBar.hide();
      }
      screen.orientation.unlock();
    }
  });

  function handleHeaders() {
    subHeaders = subs?.headers;
  }

  function getStartupBufferTarget() {
    const configured = Number($settings.playerStartupBufferSeconds);
    if (!Number.isFinite(configured) || configured <= 0) return 0;
    if (!Number.isFinite(safeduration) || safeduration <= 0) {
      return Math.max(0, Math.floor(configured));
    }
    return Math.max(
      0,
      Math.min(Math.floor(configured), Math.floor(Math.max(safeduration - 1, 0))),
    );
  }

  function updateStartupStage(progress, label, detail) {
    const startupId = playerStartup.value?.id;
    if (!playerStartup.value?.active || startupId == null) return;
    updatePlayerStartup({
      id: startupId,
      progress,
      label,
      detail,
    });
  }

  function updateFiles(files) {
    if (files?.length) {
      videos = files.filter(
        (file) => videoRx.test(file.name) && !file.name.startsWith("._"),
      );
      if (videos?.length) {
        if (subs) {
          subs.syncFiles(files || []);
        }
      }
    } else {
      src = "";
      buffering = true;
      current = null;
      currentTime = 0;
      targetTime = 0;
      if (subs) {
        subs.destroy();
        subs = null;
      }
    }
  }

  let currentTranscodeHash = null;

  async function stopTranscode(hash) {
    if (!hash || !ELECTRON) return;
    try {
      const port = await window.electron.getTranscoderPort();
      if (port) {
        await fetch(`http://localhost:${port}/stop?hash=${hash}`, {
          method: "DELETE",
        });
        console.log("[Player] Stopped transcoding for hash:", hash);
      }
    } catch (e) {
      console.error("[Player] Failed to stop transcoding:", e);
    }
  }

  let loadInterval;

  function clearLoadInterval() {
    clearInterval(loadInterval);
  }
  /**
   * @type {VideoDeband}
   */
  let deband;

  function loadDeband(load, video) {
    if (!video) return;
    if (load && !deband) {
      deband = new VideoDeband(video);
      deband.canvas.classList.add("deband-canvas");
      video.before(deband.canvas);
    } else if (!load && deband) {
      deband.destroy();
      deband.canvas.remove();
      deband = null;
    }
  }
  $: loadDeband($settings.playerDeband, video);

  let hls;
  let hlsAudioTracks = [];
  let hlsAudioTrackIndex = -1;

  function updateHlsAudioTracks() {
    if (!hls) {
      hlsAudioTracks = [];
      hlsAudioTrackIndex = -1;
      return;
    }
    hlsAudioTracks = Array.isArray(hls.audioTracks) ? [...hls.audioTracks] : [];
    hlsAudioTrackIndex =
      typeof hls.audioTrack === "number" ? hls.audioTrack : hlsAudioTrackIndex;
  }

  function selectPreferredHlsAudioTrack() {
    if (!hls || !hlsAudioTracks?.length) return;
    const preferredLang = $settings.audioLanguage;
    const langOf = (track) => track?.lang || track?.language || "";

    let idx = hlsAudioTracks.findIndex((track) => langOf(track) === preferredLang);
    if (idx < 0) idx = hlsAudioTracks.findIndex((track) => langOf(track) === "jpn");
    if (idx < 0) idx = hlsAudioTracks.findIndex((track) => track?.default === true);
    if (idx < 0) idx = 0;

    if (Number.isFinite(idx) && idx !== hls.audioTrack) {
      hls.audioTrack = idx;
      hlsAudioTrackIndex = idx;
    }
  }
  let transcoderPort = null;
  async function handleCurrent(file) {
    // Skip hidden files
    if (file?.name?.startsWith("._")) {
      console.log("[PlayerPage] Skipping hidden file:", file.name);
      return;
    }
    paused = true;
    canPlay = false;
    startupBufferPending = false;
    startupBufferRequest += 1;
    initialStartPosition = 0;
    initialStartPositionApplied = false;
    video?.pause?.();
    showBuffering();
    updateStartupStage(24, "Loading video", file?.name || "Preparing stream");
    if (file) {
      thumbnailer.reset(video?.src);
      currentTime = 0;
      targetTime = 0;
      chapters = [];
      embeddedChapters = [];
      currentSkippable = null;
      completed = false;
      if (subs) {
        subs.destroy();
        subs = null;
      }
      current = file;
      setCurrent(file);
    }
  }

  async function setCurrent(file) {
    if (!video) await tick();
    if (!video) {
      debug("Video element not found in setCurrent");
      return;
    }
    handoffDurationFallback = null;
    initialStartPosition = await resolveInitialStartPosition();
    targetTime = initialStartPosition;
    currentTime = initialStartPosition;
    try {
      // CRITICAL CLEANUP: Destroy previous HLS and detach media
      if (hls) {
        hls.destroy();
        hls = null;
        hlsAudioTracks = [];
        hlsAudioTrackIndex = -1;
      }
      // Force clear video src to stop previous playback/loading
      src = "";
      if (video) {
        video.removeAttribute("src");
        video.load(); // triggers emptying of media element
      }

      // Check if file needs HLS transcoding (unsupported formats)
      const needsTranscoding =
        file.url?.startsWith("file://") &&
        ["mkv", "avi", "wmv", "flv", "ts", "m2ts"].some((ext) =>
          file.name?.toLowerCase().endsWith(`.${ext}`),
        );

      if (needsTranscoding && ELECTRON) {
        try {
          updateStartupStage(48, "Starting transcode", "Preparing HLS stream");
          // Get transcoder port
          const port = await window.electron.getTranscoderPort();
          if (!port) throw new Error("Transcoder not available");
          transcoderPort = port;

            // Request HLS URL from transcoder
            const filePath = decodeURIComponent(
              file.url.replace("file://", ""),
            );
            const response = await fetch(
              `http://localhost:${port}/init?file=${encodeURIComponent(filePath)}`,
            );
            const { url: hlsUrl, hash } = await response.json();

            // Stop previous transcode if exists (e.g. switching episodes)
            if (currentTranscodeHash && currentTranscodeHash !== hash) {
              stopTranscode(currentTranscodeHash);
            }
            currentTranscodeHash = hash;

            const startupBufferTarget = Math.max(
              30,
              Math.floor(Number($settings.playerStartupBufferSeconds) || 0),
            );
            if (startupBufferTarget > 0) {
              updateStartupStage(
                58,
                "Preparing stream",
                `Waiting for ${startupBufferTarget} seconds of startup media to be transcoded`,
              );
              await waitForTranscodeSegments(
                startupBufferTarget,
                startupBufferRequest,
              );
            }

            // Initialize hls.js with optimized buffer settings and resilience
            hls = new Hls({
              debug: false,
              maxBufferLength: startupBufferTarget,
              maxMaxBufferLength: Math.max(60, startupBufferTarget * 2),
              startFragPrefetch: true,
              startPosition: initialStartPosition,
              enableWorker: true,
              lowLatencyMode: false,
              maxBufferHole: 0.5, // Allow small unexpected gaps (0.5s)
              highBufferWatchdogPeriod: 3,
              nudgeOffset: 0.2, // Nudge amount when stalling
              nudgeMaxRetry: 10,
              fragLoadingMaxRetry: 10,
              manifestLoadingMaxRetry: 10,
              audioPreference: { lang: $settings.audioLanguage },
            });

            hlsAudioTracks = [];
            hlsAudioTrackIndex = -1;
            const syncAudioTracks = () => {
              updateHlsAudioTracks();
              selectPreferredHlsAudioTrack();
            };

            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            updateStartupStage(74, "Buffering stream", "Waiting for playable segments");

            // Error handling
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error(
                `[HLS] Error: ${data.formatted || data.type}`,
                data,
              );

              // Auto-recover from buffer stalls by nudging
              if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                console.warn("[HLS] Buffer stalled, attempting to nudge...");
                // Nudging is handled internally by hls.js with nudgeOffset, but we can force it if needed
                // video.currentTime += 0.1;
              }

              if (data.fatal) {
                console.error("[HLS] Fatal error type:", data.type);
                console.error("[HLS] Fatal error details:", data.details);
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  hls.startLoad();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                  hls.recoverMediaError();
                } else {
        toast.error("HLS playback failed");
                }
              }
            });

            hls.on(Hls.Events.MANIFEST_PARSED, syncAudioTracks);
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncAudioTracks);
            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
              const idx = Number(data?.id);
              hlsAudioTrackIndex = Number.isFinite(idx) ? idx : hls.audioTrack;
            });

            hls.on(Hls.Events.BUFFER_STALLED, (event, data) => {
              console.warn("[HLS] Buffer stalled", data);
            });

            hls.on(Hls.Events.FRAG_LOAD_ERROR, (event, data) => {
              console.error("[HLS] Fragment load error", data);
            });

          subs = new Subtitles(video, files, current, handleHeaders);
        } catch (e) {
          console.error("[HLS] Transcoding failed:", e);
          toast.error("Failed to transcode video");
          updateStartupStage(
            62,
            "Loading video",
            "Transcode startup failed, loading the file directly",
          );
          // Fallback to direct playback
          src = file.url;
          subs = new Subtitles(video, files, current, handleHeaders);
          video.load();
        }
      } else {
        // Direct playback for supported formats
        updateStartupStage(68, "Buffering stream", "Loading local file");
        src = file.url;
        subs = new Subtitles(video, files, current, handleHeaders);
        video.load();
      }
    } catch (e) {
      console.error("[Player] setCurrent failed:", e);
      toast.error("Failed to load video");
      startupBufferPending = false;
      failPlayerStartup({
        id: playerStartup.value?.id,
        detail: e?.message || "Failed to load video",
      });
      failPlayback(e?.message || "Failed to load video");

      // Reset state to prevent ghost events
      if (hls) {
        hls.destroy();
        hls = null;
        hlsAudioTracks = [];
        hlsAudioTrackIndex = -1;
      }
      src = "";
      video.removeAttribute("src");
      current = null;
    }
    emit("current", current); // #handleCurrent in MediaHandler
    WPC.send("current", {
      current: file,
      external: false,
    });
  }

  let currentQuality = "original";
  const qualityOptions = [
    { label: "Original", value: "original" },
    { label: "1080p", value: "1080p" },
    { label: "720p", value: "720p" },
    { label: "480p", value: "480p" },
  ];

  async function changeQuality(quality) {
    if (currentQuality === quality) return;
    currentQuality = quality;
    const time = video.currentTime;
    const wasPaused = paused; // Use local state

    // Destroy previous HLS
    if (hls) {
      hls.destroy();
      hls = null;
      hlsAudioTracks = [];
      hlsAudioTrackIndex = -1;
    }

    // Re-init with new quality
    if (ELECTRON && current?.url?.startsWith("file://")) {
      try {
        const port = await window.electron.getTranscoderPort();
        const filePath = decodeURIComponent(current.url.replace("file://", ""));
        const response = await fetch(
          `http://localhost:${port}/init?file=${encodeURIComponent(filePath)}&quality=${quality}`,
        );
        const { url: hlsUrl } = await response.json();

        // Clear src
        src = "";
        video.removeAttribute("src");

        hls = new Hls({
          debug: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
          lowLatencyMode: false,
          audioPreference: { lang: $settings.audioLanguage },
        });

        hlsAudioTracks = [];
        hlsAudioTrackIndex = -1;
        const syncAudioTracks = () => {
          updateHlsAudioTracks();
          selectPreferredHlsAudioTrack();
        };
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncAudioTracks);
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
          const idx = Number(data?.id);
          hlsAudioTrackIndex = Number.isFinite(idx) ? idx : hls.audioTrack;
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.currentTime = time;
          if (!wasPaused) requestVideoPlay("quality switch");
        });
      } catch (e) {
        console.error("Quality switch failed:", e);
        toast.error("Failed to switch quality");
      }
    }
  }

  export let media;

  $: checkAvail(media, current);
  let hasNext = false;
  let hasLast = false;
  function checkAvail(media, current) {
    if (
      (media?.media?.nextAiringEpisode?.episode - 1 ||
        getMediaMaxEp(media?.media)) -
        (media?.zeroEpisode ? 1 : 0) >
        media?.episode ||
      (media?.media &&
        !media.media.nextAiringEpisode?.episode &&
        !media.media.airingSchedule?.nodes?.[0]?.episode &&
        !media.media.episodes)
    )
      hasNext = true;
    else hasNext = videos.indexOf(current) !== videos.length - 1;
    if (
      media?.media &&
      (media?.episode > 1 || (media?.zeroEpisode && media?.episode === 1))
    )
      hasLast = true;
    else hasLast = videos.indexOf(current) > 0;
  }

  async function resolveInitialStartPosition() {
    if (current?.libraryItemId) {
      const watch = libraryRepository.getWatch(current.libraryItemId);
      if (
        watch &&
        !watch.completed &&
        Number.isFinite(Number(watch.positionSec)) &&
        Number(watch.positionSec) > 0
      ) {
        return Math.max(Number(watch.positionSec) - 5, 0);
      }
    }

    const animeProgress = await getAnimeProgress(
      buildProgressQuery(current, media),
    );
    if (!animeProgress) return 0;

    return Math.max(Number(animeProgress.currentTime || 0) - 5, 0);
  }

  function applyInitialStartPosition() {
    if (initialStartPositionApplied || !video) return;
    initialStartPositionApplied = true;
    if (!Number.isFinite(initialStartPosition) || initialStartPosition <= 0) return;
    targetTime = initialStartPosition;
    currentTime = initialStartPosition;
    try {
      video.currentTime = initialStartPosition;
    } catch (error) {
      debug("[Player] Failed to apply initial start position:", error);
    }
  }

  function getPlaybackCheckpointTime() {
    return castPlaybackActive
      ? playbackCurrentTime || 0
      : video?.currentTime || currentTime || 0;
  }

  function getPlaybackCheckpointDuration() {
    return castPlaybackActive ? playbackDuration || 0 : safeduration || 0;
  }

  function saveAnimeProgress(error = false) {
    if (!castPlaybackActive && !error && (buffering || video.readyState < 4)) return;
    const checkpointTime = error ? 0 : getPlaybackCheckpointTime();
    const checkpointDuration = getPlaybackCheckpointDuration();
    if (error) {
      currentTime = 0;
      targetTime = 0;
      video.currentTime = targetTime;
    }
    const progressQuery = buildProgressQuery(current, media);
    if (!progressQuery.mediaId)
      setAnimeProgress({
        name: progressQuery.name,
        currentTime: checkpointTime,
        safeduration: checkpointDuration,
      });
    else
      setAnimeProgress({
        mediaId: progressQuery.mediaId,
        episode: progressQuery.episode,
        currentTime: checkpointTime,
        safeduration: checkpointDuration,
      });
    if (current?.libraryItemId) {
      libraryRepository
        .updateWatch({
          itemId: current.libraryItemId,
          positionSec: checkpointTime || 0,
          durationSec: checkpointDuration || 0,
          completed,
        })
        .catch((libraryError) =>
          console.error("[Library] Failed to update watch progress:", libraryError),
        );
    }
  }
  setInterval(() => {
    if (!playbackPaused) {
      saveAnimeProgress();
      checkCompletionByTime(getPlaybackCheckpointTime(), getPlaybackCheckpointDuration());
    }
  }, 10_000);

  function cycleSubtitles() {
    if (current && subs?.headers) {
      const tracks = subs.headers.filter((header) => header);
      const index = tracks.indexOf(subs.headers[subs.current]) + 1;
      subs.selectCaptions(
        index >= tracks.length ? -1 : subs.headers.indexOf(tracks[index]),
      );
      setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix because video metadata doesn't update for multiple frames
    }
  }

  let subDelay = 0;
  $: updateDelay(subDelay);
  function updateDelay(delay) {
    if (subs?.renderer) subs.renderer.timeOffset = Number(delay);
  }

  let currentTime = 0;
  let targetTime = 0;
  $: progress = playbackDuration ? (displayedTime / playbackDuration) * 100 : 0;
  function clampPlaybackTime(time) {
    return clampTimeToDuration(time, playbackDuration);
  }
  $: {
    if (wasPaused == null) {
      if (castPlaybackActive) {
        targetTime = playbackCurrentTime || 0;
      } else if (!paused) {
        targetTime = currentTime || 0;
      }
    }
  }
  async function handleMouseDown({ detail }) {
    targetTime = clampPlaybackTime((detail / 100) * playbackDuration);
    if (wasPaused == null) {
      wasPaused = playbackPaused;
      if (castPlaybackActive) {
        pauseCast().catch((error) => {
          toast.error("Cast", {
            description: error?.message || "Failed to pause cast playback",
          });
        });
      } else requestVideoPause();
    }
  }
  async function handleMouseUp() {
    if (castPlaybackActive) {
      try {
        const seekTarget = clampPlaybackTime(targetTime);
        targetTime = seekTarget;
        await seekCast(seekTarget);
        if (!wasPaused) await playCast();
      } catch (error) {
        toast.error("Cast", { description: error?.message || "Failed to seek cast playback" });
      }
    } else {
      currentTime = targetTime;
      if (video) video.currentTime = targetTime;
      if (!wasPaused) requestVideoPlay("seek resume");
    }
    wasPaused = null;
  }
  $: pagePause($page, $playPage, $modal);
  let pagePaused = 0;
  function pagePause(_page, _playPage, _modal) {
    if (castPlaybackActive) {
      pagePaused = 1;
      return;
    }
    if (buffer === 0 && pagePaused) {
      pagePaused = 1;
      return;
    }
    const updateRequest = _modal[modal.UPDATE_PROMPT];
    const playerPage = _page === page.PLAYER || (!_playPage && updateRequest);
    const playPage = _playPage || updateRequest;
    const viewDetails =
      Object.keys(_modal).length === 1 && _modal[modal.ANIME_DETAILS];
    const overlayCount = Object.keys(_modal).length;
    if (!video?.ended) {
      if (
        (!playerPage || viewDetails || updateRequest) &&
        !paused &&
        playPage &&
        !pip
      ) {
        pagePaused = 2;
        playPause();
      } else if (
        playerPage &&
        paused &&
        pagePaused === 2 &&
        !overlayCount &&
        playPage &&
        !pip
      ) {
        pagePaused = 1;
        playPause();
      } else if (
        overlayCount &&
        ((!viewDetails && !updateRequest && !playerPage) || overlayCount > 1) &&
        !paused &&
        !playPage &&
        !pip
      ) {
        pagePaused = 2;
        playPause();
      } else if (
        (!overlayCount || viewDetails || updateRequest) &&
        paused &&
        pagePaused === 2 &&
        !playPage &&
        !pip
      ) {
        pagePaused = 1;
        playPause();
      } else if (
        (!playerPage || overlayCount) &&
        paused &&
        pagePaused &&
        pagePaused !== 2
      ) {
        pagePaused = 3;
      }
    }
    if (!pagePaused) pagePaused = 1;
  }
  async function promptFiller() {
    emit("duration", { current, duration });
    const fillerEpisode = await episodesList.getSingleEpisode(
      media?.media?.idMal,
      media?.episode,
    );
    filler = fillerEpisode?.filler && "Filler";
    recap = fillerEpisode?.recap && "Recap";
    resolvePrompt =
      current?.failed || current?.media?.failed || current?.parseObject?.failed;
    skipPrompt = filler || recap;
  }
  async function autoPlay() {
    const requestId = ++startupBufferRequest;
    const targetBuffer = getStartupBufferTarget();
    startupBufferPending = targetBuffer > 0;
    startupPlaybackPending = false;
    await promptFiller();
    if (
      (($page === page.PLAYER && modal.length === 0) || pip) &&
      !resolvePrompt &&
      !skipPrompt
    ) {
      if (!hidden) {
        if (targetBuffer > 0) {
          updateStartupStage(
            76,
            "Buffering stream",
            `Waiting for ${targetBuffer} seconds of playback buffer`,
          );
          try {
            await waitForStartupReadiness(targetBuffer, requestId);
          } catch (error) {
            startupBufferPending = false;
            failPlayerStartup({
              id: playerStartup.value?.id,
              detail: error?.message || "Timed out waiting for startup buffer",
            });
            toast.error("Failed to prepare playback", {
              description:
                error?.message || "Timed out waiting for startup buffer",
            });
            return;
          }
          if (requestId !== startupBufferRequest) return;
        }
        startupBufferPending = false;
        startupPlaybackPending = true;
        updateStartupStage(96, "Starting playback", "Launching video");
        const started = await requestVideoPlay("autoplay");
        startupPlaybackPending = false;
        if (!started) {
          failPlayerStartup({
            id: playerStartup.value?.id,
            detail: "Playback could not be started after startup completed",
          });
          return;
        }
        completePlayerStartup({
          id: playerStartup.value?.id,
          detail: "Playback ready",
        });
        resetImmerse();
        setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix because video metadata doesn't update for multiple frames
      }
    } else {
      startupBufferPending = false;
      startupPlaybackPending = false;
      requestVideoPause();
    }
  }

  let playAttemptToken = 0;
  async function requestVideoPlay(reason = "playback", allowRetry = true) {
    if (!video || hidden) return false;
    const token = ++playAttemptToken;
    try {
      await video.play();
      return true;
    } catch (error) {
      debug(`[Player] video.play() threw during ${reason}:`, error);
      if (!allowRetry || token !== playAttemptToken || hidden) return false;
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (token !== playAttemptToken || hidden || !video?.paused) return false;
      return requestVideoPlay(`${reason} retry`, false);
    }
    return false;
  }

  function requestVideoPause() {
    playAttemptToken += 1;
    startupPlaybackPending = false;
    video?.pause?.();
  }

  async function playPause() {
    if (hidden) return;
    if (castPlaybackActive) {
      try {
        if (playbackPaused) await playCast();
        else await pauseCast();
      } catch (error) {
        toast.error("Cast", { description: error?.message || "Failed to update cast playback" });
      }
    } else if (video?.paused) requestVideoPlay("manual toggle");
    else requestVideoPause();
    resetImmerse();
    setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix because video metadata doesn't update for multiple frames
  }
  let hidden = false;
  let visibilityPaused = true;
  const handleVisibility = (visible) => {
    if ($settings.playerPause && !pip) {
      hidden = !visible;
      if (castPlaybackActive) return;
      if (!video?.ended) {
        if (hidden) {
          visibilityPaused = paused;
          requestVideoPause();
        } else if (!visibilityPaused) requestVideoPlay("visibility restore");
      }
    }
  };
  ELECTRON.isMinimized().then((isMinimized) => {
    handleVisibility(!isMinimized);
    ELECTRON.onMinimize(handleVisibility);
  });
  function tryPlayNext() {
    currentSkippable = null;
    if ($settings.playerAutoplay && !state.value) playNext();
  }
  function playNext() {
    if (hasNext) {
      const index = videos.indexOf(current);
      if (index + 1 < videos.length) {
        const target = (index + 1) % videos.length;
        handleCurrent(videos[target]);
        w2gEmitter.emit("index", { index: target });
      } else if (
        media?.media?.nextAiringEpisode?.episode - 1 ||
        (media?.media?.episodes || getMediaMaxEp(media?.media)) > media?.episode
      ) {
        openTorrentModal(media.media, media.episode + 1);
      }
    }
  }
  function playLast() {
    if (hasLast) {
      const index = videos.indexOf(current);
      if (index > 0) {
        handleCurrent(videos[index - 1]);
        w2gEmitter.emit("index", { index: index - 1 });
      } else if (
        media?.episode > 1 ||
        (media?.zeroEpisode && media?.episode === 1)
      ) {
        openTorrentModal(media.media, media.episode - 1);
      }
    }
  }
  function setGain(event) {
    if (castPlaybackActive) return;
    audio.setGain(parseFloat(event.target.value), buildMediaCacheKey(media));
  }
  function toggleGain() {
    if (castPlaybackActive) return;
    audio.toggleGain(buildMediaCacheKey(media), video);
  }
  async function toggleMute() {
    if (castPlaybackActive) {
      try {
        await setCastMuted(!playbackMuted);
      } catch (error) {
        toast.error("Cast", { description: error?.message || "Failed to update cast mute state" });
      }
      return;
    }
    muted = !muted;
  }

  async function updatePlaybackVolume(value) {
    if (castPlaybackActive) {
      try {
        await setCastVolume(value);
      } catch (error) {
        toast.error("Cast", { description: error?.message || "Failed to update cast volume" });
      }
      return;
    }
    $volume = value;
  }

  function handleVolumeInput(event) {
    const value = parseFloat(event.target.value);
    if (!Number.isFinite(value)) return;
    updatePlaybackVolume(value);
  }

  function adjustPlaybackVolume(delta) {
    const nextValue = Math.max(0, Math.min(1, playbackVolume + delta));
    updatePlaybackVolume(nextValue);
  }
  function toggleFullscreen() {
    document.fullscreenElement
      ? document.exitFullscreen()
      : document.querySelector(".content-wrapper").requestFullscreen();
  }
  function skip() {
    const current = findChapter(chapters, playbackCurrentTime);
    if (current) {
      if (
        !isChapterSkippable(current) &&
        (current.end - current.start) / 1_000 > 100
      ) {
        currentTime = playbackCurrentTime + 85;
      } else {
        const endtime = current.end / 1_000;
        if (
          ((playbackDuration - endtime) | 0) === 0 &&
          hasNext &&
          settings.value.playerAutoplay
        )
          return playNext();
        currentTime = endtime;
        currentSkippable = null;
      }
    } else if (playbackCurrentTime < 10) {
      currentTime = 90;
    } else if (playbackDuration - playbackCurrentTime < 90) {
      currentTime = playbackDuration;
    } else {
      currentTime = playbackCurrentTime + 85;
    }
    targetTime = currentTime;
    if (castPlaybackActive) {
      seekCast(targetTime).catch((error) => {
        toast.error("Cast", { description: error?.message || "Failed to skip on cast playback" });
      });
    } else {
      video.currentTime = targetTime;
    }
  }
  function seek(time) {
    currentTime = playbackCurrentTime + time;
    targetTime = currentTime;
    if (castPlaybackActive) {
      seekCast(Math.max(0, Math.min(playbackDuration || targetTime, targetTime))).catch((error) => {
        toast.error("Cast", { description: error?.message || "Failed to seek cast playback" });
      });
    } else {
      video.currentTime = targetTime;
    }
  }
  function forward() {
    seek(settings.value.playerSeek);
  }
  function rewind() {
    seek(-settings.value.playerSeek);
  }
  function selectAudio(id) {
    if (hls && hlsAudioTracks?.length) {
      const idx = Number(id);
      if (Number.isFinite(idx) && idx >= 0 && idx < hlsAudioTracks.length) {
        hls.audioTrack = idx;
        hlsAudioTrackIndex = idx;
      }
      return;
    }
    if (id != null) {
      for (const track of video.audioTracks) {
        track.enabled = track.id === id;
      }
      seek(-0.2); // stupid fix because video freezes up when changing tracks
    }
  }
  function selectVideo(id) {
    if (id != null) {
      for (const track of video.videoTracks) {
        track.selected = track.id === id;
      }
      setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix because video metadata doesn't update for multiple frames
    }
  }
  let castBusy = false;
  let lastCastHandoffSnapshot = null;
  let castRestoreInFlight = false;
  let hadActiveCastSession = false;

  function getCastContentType(url, fallbackName = null) {
    const path = url?.split("?")[0]?.toLowerCase?.() || "";
    if (path.endsWith(".m3u8")) return "application/x-mpegurl";
    if (path.endsWith(".mpd")) return "application/dash+xml";

    const ext = fallbackName?.match(/\.([^.]+)$/i)?.[1]?.toLowerCase();
    return {
      webm: "video/webm",
      ogg: "video/ogg",
      ogv: "video/ogg",
      mkv: "video/x-matroska",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      mp4: "video/mp4",
    }[ext] || "video/mp4";
  }

  function getSelectedCastAudioTrack() {
    if (hls && Number.isFinite(hlsAudioTrackIndex) && hlsAudioTrackIndex >= 0) {
      return hlsAudioTrackIndex;
    }
    if ("audioTracks" in HTMLVideoElement.prototype && video?.audioTracks?.length) {
      const enabledIndex = [...video.audioTracks].findIndex((track) => track.enabled);
      if (enabledIndex >= 0) return enabledIndex;
      return 0;
    }
    return undefined;
  }

  function getSelectedCastSubtitle() {
    if (!subs || subs.current == null || subs.current < 0) return null;
    const header = subs.headers?.[subs.current];
    if (!header) return null;

    const subtitleFile =
      subs.subtitleFiles?.[header.number] ||
      (header.number >= 100 ? current?.subtitleFiles?.[header.number - 100] : null);

    return {
      number: header.number,
      language: header.language || null,
      name: header.name || null,
      type: header.type || null,
      sourcePath: subtitleFile?.sourcePath || subtitleFile?.path || null,
      sourceUrl: subtitleFile?.sourceUrl || subtitleFile?.url || null,
    };
  }

  async function startCast(receiverId = null) {
    const url = current?.url;
    if (!url) return;
    if (!receiverId && !($castState.receivers?.length ?? 0)) {
      toast("Cast", { description: "No devices found." });
      return;
    }
    castBusy = true;
    try {
      await requestCastSession(receiverId);
      const title = media?.title || media?.parseObject?.anime_title || media?.media?.title?.romaji || current?.name || null;
      const thumbnail = media?.thumbnail || media?.media?.coverImage?.extraLarge || null;
      const contentType = getCastContentType(url, current?.name);
      const startTime = (video?.currentTime > 0) ? video.currentTime : undefined;
      const selectedAudioTrack = getSelectedCastAudioTrack();
      const selectedSubtitle = getSelectedCastSubtitle();
      await castMedia(url, contentType, {
        title,
        thumbnail,
        startTime,
        selectedAudioTrack,
        selectedSubtitle,
      });
      requestVideoPause();
      toast.success("Casting", { description: `Streaming to ${$castState.session?.deviceName || "Cast device"}` });
    } catch (e) {
      toast.error("Cast", { description: e?.message || "Failed to cast" });
    } finally {
      castBusy = false;
    }
  }

  async function waitForLocalPlaybackReady() {
    if (!video) return false;
    if (video.readyState >= 2) return true;

    return new Promise((resolve) => {
      let settled = false;
      let timeout = null;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        video?.removeEventListener?.("loadeddata", onReady);
        video?.removeEventListener?.("canplay", onReady);
        video?.removeEventListener?.("error", onError);
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onReady = () => finish(true);
      const onError = () => finish(false);

      timeout = setTimeout(() => finish(video?.readyState >= 2), 4_000);
      video?.addEventListener?.("loadeddata", onReady, { once: true });
      video?.addEventListener?.("canplay", onReady, { once: true });
      video?.addEventListener?.("error", onError, { once: true });
    });
  }

  async function restoreLocalPlaybackAfterCast({
    resumeTime,
    resumeShouldPlay,
    resumeDurationFallback,
  }) {
    const safeResumeTime = clampPlaybackTime(resumeTime);
    const safeDurationFallback = Number(resumeDurationFallback);

    if (Number.isFinite(safeDurationFallback) && safeDurationFallback > 0) {
      handoffDurationFallback = safeDurationFallback;
    }

    targetTime = safeResumeTime;
    currentTime = safeResumeTime;

    const ready = await waitForLocalPlaybackReady();
    if (video && ready) {
      try {
        video.currentTime = safeResumeTime;
      } catch (error) {
        debug("[Player] Failed to restore cast handoff time:", error);
      }
    }

    if (resumeShouldPlay) {
      await requestVideoPlay("cast handoff");
    }
  }

  function snapshotCastHandoffState() {
    if (!castPlaybackActive) return;
    lastCastHandoffSnapshot = {
      resumeTime: playbackCurrentTime,
      resumeShouldPlay: !playbackPaused,
      resumeDurationFallback: playbackDuration,
    };
  }

  async function maybeRestoreLocalPlaybackAfterCastEnd() {
    if (
      castRestoreInFlight ||
      !lastCastHandoffSnapshot ||
      castPlaybackActive ||
      !current
    ) return;

    castRestoreInFlight = true;
    const handoffSnapshot = lastCastHandoffSnapshot;
    lastCastHandoffSnapshot = null;
    try {
      await restoreLocalPlaybackAfterCast(handoffSnapshot);
    } finally {
      castRestoreInFlight = false;
    }
  }

  $: if (castPlaybackActive) {
    hadActiveCastSession = true;
    snapshotCastHandoffState();
  } else if (hadActiveCastSession) {
    hadActiveCastSession = false;
    Promise.resolve().then(() => maybeRestoreLocalPlaybackAfterCastEnd());
  }

  async function toggleCast() {
    if (castBusy || !current) return;
    if (castPlaybackActive) {
      castBusy = true;
      try {
        snapshotCastHandoffState();
        await endCastSession();
      } catch (e) {
        toast.error("Cast", { description: e?.message || "Failed to end session" });
      } finally {
        castBusy = false;
      }
      return;
    }
    await startCast();
  }
  async function screenshot() {
    if ("clipboard" in navigator && video.readyState) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      if (subs?.renderer) {
        subs.renderer.resize(video.videoWidth, video.videoHeight);
        await new Promise((resolve) => setTimeout(resolve, 500)); // this is hacky, but TLDR wait for canvas to update and re-render, in practice this will take at MOST 100ms, but just to be safe
        context.drawImage(
          subs.renderer._canvas,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        subs.renderer.resize(0, 0, 0, 0); // undo resize
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve));
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      canvas.remove();
      toast.success("Screenshot", {
        description: "Saved screenshot to clipboard.",
      });
    }
  }
  function updatePiPState(paused) {
    const element = /** @type {HTMLVideoElement | undefined} */ (
      document.pictureInPictureElement
    );
    if (!element || element.id) return;
    if (paused) element.pause();
    else element.play();
  }
  $: updatePiPState(paused);
  function togglePopout() {
    if (video.readyState) {
      if (!subs?.renderer) {
        if (video !== document.pictureInPictureElement) {
          video.requestPictureInPicture();
          resetImmerse();
          pip = true;
        } else {
          document.exitPictureInPicture();
          pip = false;
        }
      } else {
        if (
          document.pictureInPictureElement &&
          !document.pictureInPictureElement.id
        ) {
          // only exit if pip is the custom one, else overwrite existing pip with custom
          document.exitPictureInPicture();
          pip = false;
        } else {
          const canvasVideo = document.createElement("video");
          const { stream, destroy } = getBurnIn();
          const cleanup = () => {
            pip = false;
            destroy();
            canvasVideo.remove();
          };
          pip = true;
          resetImmerse();
          canvasVideo.srcObject = stream;
          canvasVideo.onloadedmetadata = () => {
            canvasVideo.play();
            if (pip) {
              if (paused) canvasVideo.pause();
              canvasVideo
                .requestPictureInPicture()
                .then((pipwindow) => {
                  pipwindow.onresize = () => {
                    const { width, height } = pipwindow;
                    if (isNaN(width) || isNaN(height)) return;
                    if (!isFinite(width) || !isFinite(height)) return;
                    subs.renderer.resize(width, height);
                  };
                })
                .catch((e) => {
                  cleanup();
                  debug("Failed To Burn In Subtitles " + e);
                });
            } else {
              cleanup();
            }
          };
          canvasVideo.onleavepictureinpicture = cleanup;
        }
      }
    }
  }
  let fitWidth = false;
  let showKeybinds = false;
  registerPlayerKeybinds({
    isViewAnime: () => viewAnime,
    canCast: ELECTRON && !SUPPORTS.isAndroid,
    screenshot,
    toggleStats,
    toggleNowPlaying: () => {
      if (media?.media) modal.toggle(modal.ANIME_DETAILS, media.media);
    },
    toggleFileManager: () => {
      resolvePrompt = false;
      modal.toggle(modal.FILE_MANAGER);
    },
    toggleKeybindOverlay: () => (showKeybinds = !showKeybinds),
    playPause,
    playNext,
    playLast,
    toggleDeband: () => ($settings.playerDeband = !$settings.playerDeband),
    toggleMute,
    togglePopout,
    toggleFullscreen,
    skip,
    toggleFitWidth: () => (fitWidth = !fitWidth),
    toggleCast,
    cycleSubtitles,
    toggleGain,
    rewind,
    forward,
    volumeUp: () => {
      if (!castPlaybackActive && $volumeBoosted)
        setGain({ target: { value: Math.min(3, $gain + 0.05) } });
      else adjustPlaybackVolume(0.05);
    },
    volumeDown: () => {
      if (!castPlaybackActive && $volumeBoosted)
        setGain({ target: { value: Math.max(0, $gain - 0.05) } });
      else adjustPlaybackVolume(-0.05);
    },
    decreasePlaybackRate: () =>
      (playbackRate = video.defaultPlaybackRate -= 0.1),
    increasePlaybackRate: () =>
      (playbackRate = video.defaultPlaybackRate += 0.1),
    resetPlaybackRate: () => (playbackRate = video.defaultPlaybackRate = 1),
  });

  function getBurnIn() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let loop = null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    subs.renderer.resize(video.videoWidth, video.videoHeight);
    const renderFrame = () => {
      context.drawImage(deband ? deband.canvas : video, 0, 0);
      if (canvas.width && canvas.height)
        context.drawImage(
          subs.renderer?._canvas,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      loop = video.requestVideoFrameCallback(renderFrame);
    };
    renderFrame();
    const destroy = () => {
      subs.renderer.resize();
      video.cancelVideoFrameCallback(loop);
      canvas.remove();
    };
    container.append(canvas);
    return { stream: canvas.captureStream(), destroy };
  }

  function immersePlayer() {
    if (safeduration - currentTime !== 0) {
      immersed = true;
      immerseTimeout = undefined;
    }
  }

  let immerseToken = 0;
  function resetImmerse() {
    clearTimeout(immerseTimeout);
    const token = ++immerseToken;
    const wasImmersed = immersed;
    setTimeout(() => {
      if (token !== immerseToken || wasImmersed !== immersed) return;
      immersed = false;
      if (!paused || miniplayer) {
        immerseTimeout = setTimeout(
          () => {
            if (token === immerseToken) immersePlayer();
          },
          (paused ? 5 : 1.5) * 1_000,
        );
      }
    });
  }

  function toggleImmerse() {
    if (immersed) resetImmerse();
    else {
      clearTimeout(immerseTimeout);
      immersed = !immersed;
    }
  }

  let canPlay = !!src;
  function hideBuffering() {
    canPlay = !!src;
    if (bufferTimeout) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }
    buffering = false;
    if (
      playerStartup.value?.active &&
      !startupBufferPending &&
      !startupPlaybackPending &&
      !video?.paused
    ) {
      completePlayerStartup({
        id: playerStartup.value.id,
        detail: "Playback ready",
      });
    }
  }

  function syncBufferingWithPlayback() {
    if (!video?.paused && video?.readyState >= 2) {
      hideBuffering();
    }
  }

  function handleVideoSeeked() {
    updatew2g();
    syncBufferingWithPlayback();
  }

  function showBuffering() {
    if (!startupBufferPending) {
      updateStartupStage(84, "Buffering stream", "Waiting for playback to start");
    }
    if (bufferTimeout) clearTimeout(bufferTimeout);
    bufferTimeout = setTimeout(() => {
      bufferTimeout = null;
      buffering = true;
      resetImmerse();
    }, 150);
  }
  $: navigator.mediaSession?.setPositionState({
    duration: Math.max(0, safeduration || 0),
    playbackRate: 1,
    position: Math.max(0, Math.min(safeduration || 0, currentTime || 0)),
  });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", playPause);
    navigator.mediaSession.setActionHandler("pause", playPause);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("previoustrack", playLast);
    navigator.mediaSession.setActionHandler("seekforward", forward);
    navigator.mediaSession.setActionHandler("seekbackward", rewind);
  }
  let filler = null;
  let recap = null;
  let skipPrompt = false;
  function skipResponse(skip) {
    skipPrompt = false;
    if (skip) playNext();
    else {
      requestVideoPlay("skip prompt");
      setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix because video metadata doesn't update for multiple frames
    }
  }
  let resolvePrompt = false;
  function resolveResponse(resolve) {
    resolvePrompt = false;
    if (resolve) modal.open(modal.FILE_MANAGER);
    else {
      requestVideoPlay("resolve prompt");
      setTimeout(() => subs?.renderer?.resize(), 200); // stupid fix because video metadata doesn't update for multiple frames
    }
  }
  let stats = null;
  let requestCallback = null;
  function toggleStats() {
    if (requestCallback) {
      stats = null;
      video.cancelVideoFrameCallback(requestCallback);
      requestCallback = null;
    } else {
      requestCallback = video.requestVideoFrameCallback((a, b) => {
        stats = {};
        handleStats(a, b, b);
      });
      if (paused) seek(-0.001); // stupid hack because the initial request doesn't trigger canvas to re-render, stats won't appear unless the current time changes.
    }
  }
  async function handleStats(now, metadata, lastmeta) {
    if (stats) {
      const msbf =
        (metadata.mediaTime - lastmeta.mediaTime) /
        (metadata.presentedFrames - lastmeta.presentedFrames);
      const fps = (1 / msbf).toFixed(3);
      stats = {
        fps,
        presented: metadata.presentedFrames,
        dropped: video.getVideoPlaybackQuality()?.droppedVideoFrames,
        processing: metadata.processingDuration + " ms",
        viewport: video.clientWidth + "x" + video.clientHeight,
        resolution: videoWidth + "x" + videoHeight,
        buffer: getBufferHealth(metadata.mediaTime) + " s",
        speed: video.playbackRate || 1,
      };
      setTimeout(
        () =>
          video.requestVideoFrameCallback((n, m) =>
            handleStats(n, m, metadata),
          ),
        200,
      );
    }
  }
  function getBufferHealth(time) {
    for (let index = video.buffered.length; index--; ) {
      if (
        time < video.buffered.end(index) &&
        time >= video.buffered.start(index)
      ) {
        return (video.buffered.end(index) - time) | 0;
      }
    }
    return 0;
  }

  async function waitForStartupReadiness(targetSeconds, requestId) {
    if (hls && currentTranscodeHash && transcoderPort) {
      return waitForPlayableMedia(requestId);
    }
    return waitForStartupBuffer(targetSeconds, requestId);
  }

  async function waitForTranscodeSegments(targetSeconds, requestId) {
    const safeTarget = Math.max(0, Number(targetSeconds) || 0);
    if (!safeTarget || !currentTranscodeHash || !transcoderPort) return;

    const startedAt = Date.now();
    const timeoutMs = Math.max(30_000, safeTarget * 4_000);

    while (requestId === startupBufferRequest) {
      const response = await fetch(
        `http://localhost:${transcoderPort}/status?hash=${encodeURIComponent(currentTranscodeHash)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to read transcoder startup status");
      }
      const status = await response.json();
      const availableSeconds = Math.max(0, Number(status?.playlistDurationSec) || 0);
      const segmentCount = Math.max(0, Number(status?.segmentCount) || 0);
      const phase = status?.phase || "starting";
      const ratio = Math.max(0, Math.min(1, availableSeconds / safeTarget));
      const detail =
        phase === "starting"
          ? "Starting transcoder and generating the first startup segments"
          : `${Math.min(availableSeconds, safeTarget)} / ${safeTarget} seconds prepared (${segmentCount} segments)`;

      updateStartupStage(
        76 + Math.round(ratio * 18),
        "Buffering stream",
        detail,
      );

      if (availableSeconds >= safeTarget) return;
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(
          `Timed out before ${safeTarget} seconds of startup media were prepared`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  async function waitForStartupBuffer(targetSeconds, requestId) {
    const safeTarget = Math.max(0, Number(targetSeconds) || 0);
    if (!safeTarget || !video) return;

    const startedAt = Date.now();
    const timeoutMs = Math.max(30_000, safeTarget * 4_000);

    await new Promise((resolve, reject) => {
      let finished = false;
      let interval = null;

      const cleanup = () => {
        if (interval) clearInterval(interval);
        video?.removeEventListener?.("progress", checkBuffer);
        video?.removeEventListener?.("loadeddata", checkBuffer);
        video?.removeEventListener?.("canplay", checkBuffer);
        video?.removeEventListener?.("waiting", checkBuffer);
        video?.removeEventListener?.("error", checkError);
      };

      const finish = (callback) => {
        if (finished) return;
        finished = true;
        cleanup();
        callback();
      };

      const checkError = () => {
        const mediaError = video?.error;
        if (!mediaError) return;
        finish(() =>
          reject(
            new Error(
              mediaError?.message || "Video failed while buffering startup media",
            ),
          ),
        );
      };

      const checkBuffer = () => {
        if (requestId !== startupBufferRequest) {
          finish(resolve);
          return;
        }
        checkError();
        if (finished) return;
        const anchorTime = Number.isFinite(targetTime)
          ? targetTime
          : Number.isFinite(video?.currentTime)
            ? video.currentTime
            : 0;
        const bufferHealth = getPlaybackBufferHealth(anchorTime);
        const ratio = Math.max(0, Math.min(1, bufferHealth / safeTarget));
        updateStartupStage(
          76 + Math.round(ratio * 18),
          "Buffering stream",
          `${Math.min(bufferHealth, safeTarget)} / ${safeTarget} seconds ready`,
        );
        if (bufferHealth >= safeTarget) {
          finish(resolve);
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          finish(() =>
            reject(
              new Error(
                `Timed out before ${safeTarget} seconds of startup buffer became available`,
              ),
            ),
          );
        }
      };

      interval = setInterval(checkBuffer, 250);
      video?.addEventListener?.("progress", checkBuffer);
      video?.addEventListener?.("loadeddata", checkBuffer);
      video?.addEventListener?.("canplay", checkBuffer);
      video?.addEventListener?.("waiting", checkBuffer);
      video?.addEventListener?.("error", checkError);
      checkBuffer();
    });
  }

  async function waitForPlayableMedia(requestId) {
    if (!video) return;

    await new Promise((resolve, reject) => {
      let finished = false;
      let interval = null;
      const startedAt = Date.now();
      const timeoutMs = 30_000;

      const cleanup = () => {
        if (interval) clearInterval(interval);
        video?.removeEventListener?.("loadeddata", checkReady);
        video?.removeEventListener?.("canplay", checkReady);
        video?.removeEventListener?.("canplaythrough", checkReady);
        video?.removeEventListener?.("error", checkError);
      };

      const finish = (callback) => {
        if (finished) return;
        finished = true;
        cleanup();
        callback();
      };

      const checkError = () => {
        const mediaError = video?.error;
        if (!mediaError) return;
        finish(() =>
          reject(
            new Error(
              mediaError?.message || "Video failed while preparing playback",
            ),
          ),
        );
      };

      const checkReady = () => {
        if (requestId !== startupBufferRequest) {
          finish(resolve);
          return;
        }
        checkError();
        if (finished) return;

        const readyState = Number(video?.readyState) || 0;
        const forwardBuffer = getPlaybackBufferHealth(
          Number.isFinite(targetTime)
            ? targetTime
            : Number.isFinite(video?.currentTime)
              ? video.currentTime
              : 0,
        );

        updateStartupStage(
          88,
          "Starting playback",
          forwardBuffer > 0
            ? `Startup media prepared, ${forwardBuffer} seconds currently attached`
            : "Startup media prepared, attaching stream to the player",
        );

        if (readyState >= 3 || forwardBuffer > 0) {
          finish(resolve);
          return;
        }

        if (Date.now() - startedAt > timeoutMs) {
          finish(() =>
            reject(
              new Error("Timed out while waiting for the player to attach startup media"),
            ),
          );
        }
      };

      interval = setInterval(checkReady, 200);
      video?.addEventListener?.("loadeddata", checkReady);
      video?.addEventListener?.("canplay", checkReady);
      video?.addEventListener?.("canplaythrough", checkReady);
      video?.addEventListener?.("error", checkError);
      checkReady();
    });
  }

  function getPlaybackBufferHealth(time) {
    if (hls?.mainForwardBufferInfo) {
      const forwardLen = Number(hls.mainForwardBufferInfo.len);
      if (Number.isFinite(forwardLen)) {
        return Math.max(0, Math.floor(forwardLen));
      }
    }
    if (hls?.bufferInfo) {
      try {
        const bufferInfo = hls.bufferInfo(time, 0);
        if (Number.isFinite(bufferInfo?.len)) {
          return Math.max(0, Math.floor(bufferInfo.len));
        }
      } catch (error) {
        debug("[Player] Failed to read hls buffer info:", error);
      }
    }
    return getBufferHealth(time);
  }

  let buffer = 0;
  WPC.listen("progress", (detail) => {
    buffer = detail * 100;
  });

  let chapters = [];
  let embeddedChapters = [];
  WPC.listen("chapters", (detail) => {
    if (detail.length) {
      chapters = detail;
      embeddedChapters = detail;
    }
  });
  async function findChapters() {
    if (
      (!chapters.length ||
        settings.value.playerChapterSkip.match(/aniskip/i)) &&
      current?.media?.media
    ) {
      const _chapters = await getChaptersAniSkip(current, safeduration);
      if (_chapters?.length) chapters = _chapters;
    }
  }

  let currentSkippable = null;
  $: currentSkippable && $settings.playerAutoSkip && skip();
  function checkSkippableChapters() {
    const current = findChapter(chapters, currentTime);
    if (current) {
      currentSkippable = isChapterSkippable(current);
    }
  }

  // remaps chapters to what perfect-seekbar uses and adds potentially missing chapters
  function sanitiseChapters(_chapters, safeduration) {
    if (!_chapters?.length) return [];
    const normalised = normaliseChapters(_chapters, safeduration);
    if (JSON.stringify(chapters) !== JSON.stringify(normalised))
      chapters = normalised;
    return toSeekbarChapters(normalised, safeduration);
  }

  const thumbnailer = createThumbnailer({ getBuffer: () => buffer });

  function getThumbnail(percent) {
    return thumbnailer.getThumbnail(percent, safeduration);
  }
  function createThumbnail(vid = video) {
    thumbnailer.captureCurrentFrame(vid);
  }
  let videoWidth, videoHeight;
  function initThumbnails() {
    thumbnailer.init({
      videoWidth,
      videoHeight,
      duration: safeduration,
      url: current.url,
    });
  }

  const showOptions = writable(false);
  function toggleDropdown({ target }) {
    target.classList.toggle("active");
    target.closest(".dropdown").classList.toggle("show");
  }

  let completed = false;
  function checkCompletion() {
    if (!completed && $settings.playerAutocomplete) {
      checkCompletionByTime(currentTime, safeduration);
    }
  }

  function checkCompletionByTime(currentTime, safeduration) {
    if (
      shouldAutoComplete({
        currentTime,
        duration: safeduration,
        readyState: video?.readyState,
        thresholdPercent: $settings.playerAutocompleteThreshold,
        media,
      })
    ) {
      debug(
        `Marking current episode as completed as it has met the ${$settings.playerAutocompleteThreshold}% threshold.`,
      );
      completed = true;
      if (current?.libraryItemId) {
        libraryRepository
          .updateWatch({
            itemId: current.libraryItemId,
            positionSec: currentTime || safeduration || 0,
            durationSec: safeduration || 0,
            completed: true,
          })
          .catch((libraryError) =>
            console.error("[Library] Failed to finalize watch state:", libraryError),
          );
      }
      const _media = media.episodeRange ? structuredClone(media) : media;
      if (media.episodeRange) _media.episode = media.episodeRange.last;
      Helper.updateEntry(_media);
    }
  }
  const torrent = {};
  WPC.listen("stats", updateStats);
  function updateStats(detail) {
    torrent.peers = detail.numPeers || 0;
    torrent.up = detail.uploadSpeed || 0;
    torrent.down = detail.downloadSpeed || 0;
  }
  function checkError({ target }) {
    // video playback failed - show a message saying why
    if (target?.error) failPlayback(target.error.message || "Playback error");
    switch (target.error?.code) {
      case target.error.MEDIA_ERR_ABORTED:
        debug("You aborted the video playback.");
        break;
      case target.error.MEDIA_ERR_NETWORK:
        debug(
          "A network error caused the video download to fail part-way.",
          target.error,
        );
        saveAnimeProgress(true);
        toast.error("Video Network Error", {
          description:
            "A network error caused the video download to fail part-way. Dismiss this toast to reload the video.",
          duration: Infinity,
          onDismiss: () => target.load(),
        });
        break;
      case target.error.MEDIA_ERR_DECODE:
        debug(
          "The video playback was aborted due to a corruption problem or because the video used features your browser did not support.",
          target.error,
        );
        saveAnimeProgress(true);
        toast.error("Video Decode Error", {
          description:
            "The video playback was aborted due to a corruption problem. Dismiss this toast to reload the video.",
          duration: Infinity,
          onDismiss: () => target.load(),
        });
        break;
      case target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        if (
          target.error.message !== "MEDIA_ELEMENT_ERROR: Empty src attribute"
        ) {
          debug(
            "The video could not be loaded, either because the server or network failed or because the format is not supported.",
            target.error,
          );
          saveAnimeProgress(true);
          toast.error("Video Codec Unsupported", {
            description:
              "The video could not be loaded, either because the server or network failed or because the format is not supported. Try a different release by disabling Autoplay Torrents in RSS settings.",
            duration: 30_000,
          });
        }
        break;
      default:
        debug("An unknown video playback error occurred.");
        break;
    }
  }

  function handleSeekbarKey(e) {
    if (e.key === "ArrowLeft") {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      rewind();
    } else if (e.key === "ArrowRight") {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      forward();
    } else if (e.key === "ArrowDown") {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      document.querySelector("[data-name='toggleFullscreen']")?.focus();
    }
  }

  let fileInput;
  function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    window.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dataTransfer }),
    );
  }

  function setDiscordRPC(np = media, browsing) {
    if ((!np || Object.keys(np).length === 0) && !browsing) return;
    if (hidden) {
      IPC.emit("discord-clear");
      return;
    }
    const activity = browsing
      ? buildBrowsingActivity()
      : buildWatchingActivity({
          nowPlaying: np,
          paused,
          currentTime: targetTime,
          duration: safeduration,
          w2gCode: state.value?.code,
        });
    IPC.emit("discord", { activity });
  }
</script>

<div
  class="player w-full h-full d-flex flex-column overflow-hidden position-relative"
  class:ratio-16-9={!canPlay || !src}
  class:pointer={miniplayer}
  class:rounded-top-10={miniplayer}
  class:miniplayer
  class:pip
  class:immersed
  class:buffering={($page === page.PLAYER || miniplayer) && buffering}
  class:fitWidth
  bind:this={container}
  role="none"
  on:mousemove={resetImmerse}
  on:touchmove={resetImmerse}
  on:keypress={resetImmerse}
  on:keydown={resetImmerse}
  on:mouseleave={immersePlayer}
>
  {#if showKeybinds && !miniplayer}
    <div
      class="position-absolute bg-tp w-full h-full z-50 font-size-12 p-20 d-flex align-items-center justify-content-center pointer"
      on:pointerup|self={() => (showKeybinds = false)}
      tabindex="-1"
      role="button"
    >
      <Keybinds let:prop={item} autosave={true} clickable={true}>
        {#if item?.type}
          <div
            class="bind icon"
            title={item?.desc}
            style="pointer-events: all !important;"
          >
            {#if item?.icon}
              <svelte:component this={item.icon} size="2rem" />
            {/if}
          </div>
        {:else}
          <div
            class="bind font-weight-normal"
            title={item?.desc}
            style="pointer-events: all !important;"
          >
            {item?.id || ""}
          </div>
        {/if}
      </Keybinds>
    </div>
  {/if}
  <video
    crossorigin="anonymous"
    class="position-absolute h-full w-full"
    preload="auto"
    {src}
    bind:videoHeight
    bind:videoWidth
    bind:this={video}
    bind:volume={$volume}
    bind:duration
    bind:currentTime
    bind:paused
    bind:ended
    bind:muted
    bind:playbackRate
    on:error={checkError}
    on:pause={() => {
      updatew2g();
      markPlaybackPaused();
      immersed = false;
    }}
    on:play={() => {
      updatew2g();
      markPlaybackPlaying();
    }}
    on:seeked={handleVideoSeeked}
    on:timeupdate={() => createThumbnail()}
    on:timeupdate={checkCompletion}
    on:timeupdate={checkSkippableChapters}
    on:timeupdate={syncBufferingWithPlayback}
    on:waiting={showBuffering}
    on:loadeddata={hideBuffering}
    on:canplay={() => {
      hideBuffering();
      markPlaybackReady();
    }}
    on:playing={hideBuffering}
    on:ended={() => {
      markPlaybackEnded();
      tryPlayNext();
    }}
    on:loadedmetadata={initThumbnails}
    on:loadedmetadata={findChapters}
    on:loadedmetadata={applyInitialStartPosition}
    on:loadedmetadata={checkAudio}
    on:loadedmetadata={checkSubtitle}
    on:loadedmetadata={clearLoadInterval}
    on:loadedmetadata={autoPlay}
    on:leavepictureinpicture={() => {
      pip = false;
    }}><track kind="captions" src="" srclang="en" label="English" /></video
  >
  {#if $playerStartup.active && !miniplayer}
    <div class="position-absolute startupOverlay z-60 d-flex flex-column align-items-center justify-content-center text-center px-20">
      <div
        class="startupRing d-flex align-items-center justify-content-center"
        style={`--startup-progress: ${$playerStartup.progress || 0}%`}
      >
        <div class="startupRingInner">
          <div class="startupPercent">{$playerStartup.progress || 0}%</div>
        </div>
      </div>
      <div class="startupLabel mt-15">
        {$playerStartup.label || "Loading"}
      </div>
      {#if $playerStartup.detail}
        <div class="startupDetail mt-8">
          {$playerStartup.detail}
        </div>
      {/if}
    </div>
  {/if}
  {#if stats && !miniplayer}
    <div
      class="position-absolute top-0 bg-tp p-10 ml-20 mt-100 text-monospace rounded z-50"
    >
      <button
        class="close btn btn-square mt-5"
        type="button"
        use:click={toggleStats}
      >
        <X size="1.4rem" strokeWidth="3" />
      </button>
      <div>FPS: {stats.fps}</div>
      <div>Presented frames: {stats.presented}</div>
      <div>Dropped frames: {stats.dropped}</div>
      <div>Frame time: {stats.processing}</div>
      <div>Viewport: {stats.viewport}</div>
      <div>Resolution: {stats.resolution}</div>
      <div>Buffer health: {stats.buffer}</div>
      <div>Playback speed: x{stats.speed?.toFixed(1)}</div>
      <div>Name: {current.name || ""}</div>
      {#if playableFiles?.length > 1}
        <div class="mt-10">All files in this batch:</div>
        <div class="overflow-auto ml-10 mt-5" style="max-height: 200px;">
          {#each playableFiles as file}
            <div
              class="ctrl rounded-10 pl-5 pr-5 pbf"
              title={file.name}
              use:click={() => playFile(file)}
            >
              {file.name || "UNK"}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  <ManagerModal
    playing={current}
    files={playableFiles.filter((f) => !f.name.startsWith("._"))}
    {playFile}
  />
  <div class="top z-40 row d-title">
    <div class="stats pl-20 col-4 d-title">
      <div class="font-weight-bold overflow-hidden text-truncate font-scale-23">
        {#if media?.title}
          {media?.title}
        {:else if media?.media?.title}
          <!-- useful when a torrent is EXTREMELY slow at loading... -->
          {anilistClient.title(media?.media)}
        {:else if current}
          {MediaResolver.cleanFileName(current.name)}
        {/if}
      </div>
      <div
        class="font-weight-normal overflow-hidden text-truncate text-muted font-scale-16"
      >
        {#if (media?.episode === 0 || media?.episode) && media?.media?.format !== "MOVIE" && (!media?.episodeTitle || !new RegExp(`(?<![\\d.])${media.episode}(?![\\d.])`).test(media.episodeTitle))}
          {@const maxEpisodes =
            getMediaMaxEp(media.media) - (media.zeroEpisode ? 1 : 0)}
          Episode {media.episodeRange
            ? `${media.episodeRange.first} ~ ${media.episodeRange.last}`
            : media.episode}
          {#if maxEpisodes && Number(maxEpisodes) > 1}
            of {maxEpisodes}{:else if !maxEpisodes && videos && videos.length > 1}
            of {videos.length}{/if}
          <!-- for when the media fails to resolve, we can predict that the file length is likely the episode count. -->
        {:else if current && videos?.length > 1}
          Episode {videos.indexOf(current) + 1} of {videos.length}
          <!-- fallback for when the media fails to resolve and we also fail to resolve the episode numbers, best to indicate what file we are currently on. -->
        {/if}
        {#if (media?.episode === 0 || media?.episode) && media?.media?.format !== "MOVIE" && media?.episodeTitle && !new RegExp(`(?<![\\d.])${media.episode}(?![\\d.])`).test(media.episodeTitle)}{" - "}{/if}
        {#if media?.episodeTitle}{media.episodeTitle}{/if}
      </div>
    </div>
    <div class="d-flex justify-content-center bottom-0 col-4 d-title d-filler">
      <span class="icon"
        ><Users class="pt-5 block-scale-30" strokeWidth={3} />
      </span>
      <span class="stats font-scale-24">{torrent.peers || 0}</span>
      <span class="icon"><ArrowDown class="block-scale-30" /></span>
      <span class="stats font-scale-24">{fastPrettyBytes(torrent.down)}/s</span>
      <span class="icon"><ArrowUp class="block-scale-30" /></span>
      <span class="stats font-scale-24">{fastPrettyBytes(torrent.up)}/s</span>
      {#if resolvePrompt}
        <div
          class="position-absolute text-monospace rounded skipPrompt d-flex flex-column align-items-center text-center bg-dark-light p-20 z-50 mt-60"
          class:w-500={SUPPORTS.isAndroid}
        >
          <div class="skipFont">
            Failed to <b>identify</b> the media from the file name, would you like
            to fix it?
          </div>
          <div class="d-flex justify-content-center mt-20">
            <button
              class="btn btn-primary mx-2 mr-20 d-flex align-items-center justify-content-center"
              type="button"
              use:click={() => resolveResponse(true)}
            >
              <span>Yes</span>
            </button>
            <button
              class="btn btn-secondary mx-2 ml-20 d-flex align-items-center justify-content-center"
              type="button"
              use:click={() => resolveResponse(false)}
            >
              <span>No</span>
            </button>
          </div>
        </div>
      {:else if skipPrompt}
        <div
          class="position-absolute text-monospace rounded skipPrompt d-flex flex-column align-items-center text-center bg-dark-light p-20 z-50 mt-60"
          class:w-500={SUPPORTS.isAndroid}
        >
          <div class="skipFont">
            This episode has been marked as a <b>{filler || recap}</b>, do you
            want to skip?
          </div>
          <div class="d-flex justify-content-center mt-20">
            <button
              class="btn btn-primary mx-2 mr-20 d-flex align-items-center justify-content-center"
              type="button"
              use:click={() => skipResponse(true)}
            >
              <span>Yes</span>
            </button>
            <button
              class="btn btn-secondary mx-2 ml-20 d-flex align-items-center justify-content-center"
              type="button"
              use:click={() => skipResponse(false)}
            >
              <span>No</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
  <div
    class="middle d-flex align-items-center justify-content-center flex-grow-1 position-relative"
  >
    <div
      aria-hidden="true"
      class="w-full h-full position-absolute toggle-fullscreen"
      on:dblclick={toggleFullscreen}
      on:click|self={() => {
        if ($page === page.PLAYER && modal.length === 0) {
          playPause();
        } else {
          page.navigateTo(page.PLAYER);
        }
      }}
    />
    <div
      aria-hidden="true"
      class="w-full h-full position-absolute toggle-immerse d-none"
      on:dblclick={toggleFullscreen}
      on:click|self={toggleImmerse}
    />
    <div
      class="w-full h-full position-absolute mobile-focus-target d-none"
      use:click={() => {
        page.navigateTo(page.PLAYER);
      }}
    />
    <span
      aria-hidden="true"
      class="icon ctrl align-items-center justify-content-end w-150 mw-full mr-auto"
      class:mb-50={!miniplayer}
      on:click={rewind}><Rewind size="3rem" /></span
    >
    <!-- miniplayer buttons -->
    {#if miniplayer}
      <span
        class="position-absolute rounded-10 top-0 right-0 m-10 btn-shadow button miniplayer-action"
        class:mr-40={!SUPPORTS.isAndroid}
        class:mr-50={SUPPORTS.isAndroid}
        title="Minimize"
        data-name="playPause"
        use:click={() => playPage.set(!playPage.value)}
      >
        <Minus size="1.9rem" strokeWidth="3" />
      </span>
      <span
        class="position-absolute rounded-10 top-0 right-0 m-10 btn-shadow button miniplayer-action"
        title="Exit"
        data-name="playPause"
        use:click={() => {
          window.dispatchEvent(new CustomEvent("torrent-stop-playback"));
          if ($page === page.PLAYER) page.navigateTo(page.HOME);
        }}
      >
        <X size="1.9rem" strokeWidth="3" />
      </span>
    {/if}
    <div
      class="d-flex align-items-center position-relative"
      class:mb-50={!miniplayer}
      style="width: 100%;"
      title="Play/Pause"
    >
      {#if hasLast}
        <span
          class="icon ctrl position-absolute rounded-10 text-white"
          style="left: 15%"
          title="Last"
          data-name="playPause"
          use:click={playLast}
        >
          <SkipBack size="3rem" fill="currentColor" />
        </span>
      {/if}
      <span
        class="icon ctrl position-absolute rounded-10 text-white"
        data-name="playPause"
        style="left: 50%; margin-left: -3rem;"
        use:click={playPause}
      >
        {#if playbackEnded}
          <RotateCw size="3rem" />
        {:else if playbackPaused}
          <Play size="3rem" fill="currentColor" />
        {:else}
          <Pause size="3rem" fill="currentColor" />
        {/if}
      </span>
      {#if hasNext}
        <span
          class="icon ctrl position-absolute rounded-10 text-white"
          style="right: 15%"
          title="Next"
          data-name="playPause"
          use:click={playNext}
        >
          <SkipForward size="3rem" fill="currentColor" />
        </span>
      {/if}
    </div>
    <span
      aria-hidden="true"
      class="icon ctrl align-items-center w-150 mw-full ml-auto"
      class:mb-50={!miniplayer}
      on:click={forward}><FastForward size="3rem" /></span
    >
    <div
      class="position-absolute bufferingDisplay"
      class:bufferingPos={SUPPORTS.isAndroid && !miniplayer}
      class:startupHidden={$playerStartup.active && !miniplayer}
    />
    {#if currentSkippable}
      <button
        class="skip btn text-dark position-absolute bottom-0 right-0 mr-20 mb-5 font-weight-bold z-30 d-flex align-items-center justify-content-center"
        use:click={skip}
      >
        <FastForward size="1.8rem" fill="currentColor" /><span class="ml-5"
          >Skip {currentSkippable}</span
        >
      </button>
    {/if}
  </div>
  <div class="bottom d-flex z-40 flex-column px-20">
    <div
      class="w-full d-flex align-items-center h-20 mb-5 seekbar"
      tabindex="-1"
      role="button"
      on:keydown={handleSeekbarKey}
    >
      <Seekbar
        accentColor={completed ||
        (media?.media &&
          ($mediaCache[media.media.id] || media.media)?.mediaListEntry
            ?.progress ===
            (media.episodeRange ? media.episodeRange.last : media.episode))
          ? `var(--completed-color-dim)`
          : `var(--accent-color)`}
        class="font-size-20"
        length={playbackDuration}
        {buffer}
        bind:progress
        on:seeking={handleMouseDown}
        on:seeked={handleMouseUp}
        chapters={sanitiseChapters(chapters, playbackDuration)}
        {getThumbnail}
      />
    </div>
    <div class="d-flex">
      <span
        class="icon ctrl m-5 text-white"
        title="Play/Pause [Space]"
        data-name="playPause"
        use:click={playPause}
      >
        {#if playbackEnded}
          <RotateCw size="2rem" />
        {:else if playbackPaused}
          <Play size="2rem" fill="currentColor" />
        {:else}
          <Pause size="2rem" fill="currentColor" />
        {/if}
      </span>
      {#if hasLast}
        <span
          class="icon ctrl m-5 d-btn text-white"
          title="Last [B]"
          use:click={playLast}
        >
          <SkipBack size="2rem" fill="currentColor" />
        </span>
      {/if}
      {#if hasNext}
        <span
          class="icon ctrl m-5 d-btn text-white"
          title="Next [N]"
          use:click={playNext}
        >
          <SkipForward size="2rem" fill="currentColor" />
        </span>
      {/if}
      <div class="d-flex w-auto volume">
        <span
          class="icon ctrl m-5 text-white"
        title="Mute [M]"
        data-name="toggleMute"
        use:click={toggleMute}
      >
        {#if playbackMuted}
          <VolumeX size="2rem" fill="currentColor" />
        {:else}
          <Volume2 size="2rem" fill="currentColor" />
        {/if}
      </span>
        {#if castPlaybackActive || !$volumeBoosted}
          <input
            class="ctrl h-full custom-range"
            tabindex="-1"
            type="range"
            min="0"
            max="1"
            step="any"
            data-name="setVolume"
            value={playbackVolume}
            on:input={handleVolumeInput}
          />
        {:else}
          <input
            class="ctrl h-full custom-range"
            class:boost-color={$gain > 1}
            tabindex="-1"
            type="range"
            min="0"
            max="3"
            step="any"
            data-name="setVolume"
            bind:value={$gain}
            on:input={setGain}
          />
        {/if}
        {#if !castPlaybackActive && ($volume === 1 || $volumeBoosted)}
          <span
            class="icon ctrl boost p-0 mt-15 d-flex align-items-center justify-content-center text-white"
            class:boost-color={$volumeBoosted}
            title="Increase Volume Limit [V]"
            data-name="toggleGain"
            use:click={toggleGain}
          >
            <SlidersVertical size="1.4rem" fill="currentColor" />
          </span>
        {/if}
      </div>
      <div class="ts font-scale-20" class:mr-auto={playbackRate === 1}>
        {toTS(displayedTime, playbackDuration > 3600 ? 2 : 3)} / {toTS(
          playbackDuration - displayedTime,
          playbackDuration > 3600 ? 2 : 3,
        )}
      </div>
      {#if playbackRate !== 1}
        <div class="ts mr-auto font-scale-20">x{playbackRate.toFixed(1)}</div>
      {/if}
      <input
        type="file"
        class="d-none"
        id="search-subtitle"
        accept=".srt,.vtt,.ass,.ssa,.sub,.txt"
        on:input|preventDefault|stopPropagation={handleFile}
        bind:this={fileInput}
      />
      <div
        class="dropdown dropleft with-arrow"
        use:click={() => {
          showOptions.set(!$showOptions);
        }}
      >
        <span
          class="icon text-white ctrl d-flex align-items-center h-full"
          title="More"
          ><EllipsisVertical size="2.5rem" strokeWidth={2.5} /></span
        >
        <div
          class="position-absolute hm-40 text-capitalize text-nowrap bg-dark rounded dr-arrow"
          style="margin-top: -17.5rem !important; margin-left: -11.4rem !important; transition: opacity 0.1s ease-in;"
          class:hidden={!$showOptions}
        >
          <div
            role="button"
            aria-label="Add External Subtitles"
            class="pointer d-flex align-items-center justify-content-center font-size-16 bd-highlight py-5 px-10 rounded-top option"
            title="Add External Subtitles"
            use:click={() => {
              fileInput.click();
              showOptions.set(false);
            }}
          >
            <FilePlus2 size="2rem" strokeWidth={2.5} />
            <div class="ml-10">Add Subtitles</div>
          </div>
          <div class="dropdown dropleft with-arrow pointer bg-dark option font-size-16 bd-highlight">
            <div
              role="button"
              class="d-flex align-items-center justify-content-center py-5 px-10"
              aria-label="Quality"
              title="Quality"
              use:click={toggleDropdown}
            >
              <Settings size="2rem" strokeWidth={2.5} /><span class="ml-10"
                >Quality</span
              >
            </div>
            <div
              class="dropdown-menu dropdown-menu-right text-capitalize text-nowrap rounded"
            >
              <div class="custom-radio overflow-hidden pt-5 pl-5">
                {#each qualityOptions as option}
                  <input
                    name="quality-radio-set"
                    type="radio"
                    id="quality-{option.value}-radio"
                    tabindex="-1"
                    value={option.value}
                    checked={currentQuality === option.value}
                  />
                  <label
                    for="quality-{option.value}-radio"
                    use:click={(target) => {
                      changeQuality(option.value);
                      setTimeout(() => {
                        toggleDropdown(target);
                        showOptions.set(false);
                      });
                    }}
                    class="pb-5">{option.label}</label
                  >
                {/each}
              </div>
            </div>
          </div>
          <div class="dropdown dropleft with-arrow pointer bg-dark option font-size-16 bd-highlight">
            <div
              role="button"
              class="d-flex align-items-center justify-content-center py-5 px-10"
              aria-label="Change the Source of the Video Chapters"
              title="Change the Source of the Video Chapters"
              use:click={toggleDropdown}
            >
              <Milestone size="2rem" strokeWidth={2.5} /><span class="ml-10"
                >Chapter Source</span
              >
            </div>
            <div
              class="dropdown-menu dropdown-menu-right text-capitalize text-nowrap rounded"
            >
              <div class="custom-radio overflow-hidden pt-5 pl-5">
                <input
                  name="chapter-embed-set"
                  type="radio"
                  id="chapter-embed-radio"
                  tabindex="-1"
                  value="embedded"
                  checked={$settings.playerChapterSkip === "embedded"}
                />
                <label
                  for="chapter-embed-radio"
                  use:click={(target) => {
                    $settings.playerChapterSkip = "embedded";
                    chapters = embeddedChapters;
                    setTimeout(() => {
                      toggleDropdown(target);
                      showOptions.set(false);
                    });
                  }}
                  class="pb-5">Embedded</label
                >
                <input
                  name="chapter-aniskip-set"
                  type="radio"
                  id="chapter-aniskip-radio"
                  tabindex="-1"
                  value="aniskip"
                  checked={$settings.playerChapterSkip === "aniskip"}
                />
                <label
                  for="chapter-aniskip-radio"
                  use:click={(target) => {
                    $settings.playerChapterSkip = "aniskip";
                    findChapters();
                    setTimeout(() => {
                      toggleDropdown(target);
                      showOptions.set(false);
                    });
                  }}
                  class="pb-5">Aniskip</label
                >
              </div>
            </div>
          </div>
          <div
            role="button"
            aria-label="Modify Existing Files or Change to a New File"
            class="pointer d-flex align-items-center justify-content-center font-size-16 bd-highlight py-5 px-10 rounded-bottom option"
            title="Modify Existing Files or Change to a New File"
            use:click={() => {
              resolvePrompt = false;
              modal.toggle(modal.FILE_MANAGER);
              showOptions.set(false);
            }}
          >
            <SquarePen size="2rem" strokeWidth={2.5} />
            <div class="ml-10">File Manager</div>
          </div>
        </div>
      </div>
      <span
        class="icon text-white ctrl mr-5 d-flex align-items-center keybinds"
        title="Keybinds [`]"
        use:click={() => (showKeybinds = true)}
      >
        <Keyboard size="2.5rem" strokeWidth={2.5} />
      </span>
      {#if $playPage && media?.media}
        <span
          class="icon text-white ctrl mr-5 d-flex align-items-center"
          title="Now Playing [O]"
          use:click={() => modal.toggle(modal.ANIME_DETAILS, media.media)}
        >
          <Eye size="2.5rem" strokeWidth={2.5} />
        </span>
      {/if}
      {#if (hlsAudioTracks?.length || 0) > 1 ||
        ("audioTracks" in HTMLVideoElement.prototype && video?.audioTracks?.length > 1)}
        <div class="dropdown dropup with-arrow" use:click={toggleDropdown}>
          <span
            class="icon text-white ctrl mr-5 d-flex align-items-center h-full"
            title="Audio Tracks"
          >
            <ListMusic size="2.5rem" strokeWidth={2.5} />
          </span>
          <div
            class="dropdown-menu dropdown-menu-right ctrl p-10 pb-0 mr-15 text-capitalize text-nowrap"
          >
            <div class="custom-radio overflow-y-auto overflow-x-hidden hm-400">
              {#if (hlsAudioTracks?.length || 0) > 1}
                {#each hlsAudioTracks as track, i}
                  <input
                    name="audio-radio-set"
                    type="radio"
                    id="hls-audio-{i}-radio"
                    value={i}
                    checked={i === hlsAudioTrackIndex}
                  />
                  <label
                    for="hls-audio-{i}-radio"
                    use:click={() => selectAudio(i)}
                    class="pb-5"
                  >
                    {track?.name || track?.lang || track?.language || `Track ${i + 1}`}
                  </label>
                {/each}
              {:else}
                {#each video.audioTracks as track}
                  <input
                    name="audio-radio-set"
                    type="radio"
                    id="audio-{track.id}-radio"
                    value={track.id}
                    checked={track.enabled}
                  />
                  <label
                    for="audio-{track.id}-radio"
                    use:click={() => selectAudio(track.id)}
                    class="pb-5"
                  >
                    {(track.language ||
                      (!Object.values(video.audioTracks).some(
                        (track) =>
                          track.language === "eng" || track.language === "en",
                      )
                        ? "eng"
                        : track.label)) +
                      (track.label ? " - " + track.label : "")}
                  </label>
                {/each}
              {/if}
              <div class="mb-5 invisible"></div>
            </div>
          </div>
        </div>
      {/if}
      {#if "videoTracks" in HTMLVideoElement.prototype && video?.videoTracks?.length > 1}
        <div class="dropdown dropup with-arrow" use:click={toggleDropdown}>
          <span
            class="icon text-white ctrl mr-5 d-flex align-items-center h-full"
            title="Video Tracks"
          >
            <ListVideo size="2.5rem" strokeWidth={2.5} />
          </span>
          <div
            class="dropdown-menu dropdown-menu-right ctrl p-10 pb-0 mr-15 text-capitalize text-nowrap"
          >
            <div class="custom-radio overflow-y-auto overflow-x-hidden hm-400">
              {#each video.videoTracks as track}
                <input
                  name="video-radio-set"
                  type="radio"
                  id="video-{track.id}-radio"
                  value={track.id}
                  checked={track.selected}
                />
                <label
                  for="video-{track.id}-radio"
                  use:click={() => selectVideo(track.id)}
                  class="pb-5"
                >
                  {(track.language ||
                    (!Object.values(video.videoTracks).some(
                      (track) =>
                        track.language === "eng" || track.language === "en",
                    )
                      ? "eng"
                      : track.label)) +
                    (track.label ? " - " + track.label : "")}
                </label>
              {/each}
              <div class="mb-5 invisible"></div>
            </div>
          </div>
        </div>
      {/if}
      {#if subHeaders?.length}
        <div
          class="subtitles dropdown dropup with-arrow"
          use:click={toggleDropdown}
        >
          <span
            class="icon text-white ctrl mr-5 d-flex align-items-center h-full"
            title="Subtitles [C]"
          >
            <Captions size="2.5rem" strokeWidth={2.5} />
          </span>
          <div
            class="dropdown-menu dropdown-menu-right ctrl p-10 pb-5 mr-15 text-capitalize text-nowrap"
          >
            <div class="custom-radio overflow-y-auto overflow-x-hidden hm-400">
              <input
                name="subtitle-radio-set"
                type="radio"
                id="subtitle-off-radio"
                value="off"
                checked={subHeaders && subs?.current === -1}
              />
              <label
                for="subtitle-off-radio"
                use:click={() => {
                  subs.selectCaptions(-1);
                  setTimeout(() => subs?.renderer?.resize(), 200);
                  cache.setEntry(caches.HISTORY, "lastSubtitle", {
                    ...(cache.getEntry(caches.HISTORY, "lastSubtitle") || {}),
                    [buildMediaCacheKey(media)]: "OFF",
                  });
                }}
                class="pb-5"
              >
                OFF
              </label>
              <!-- stupid fix (resize) because video metadata doesn't update for multiple frames -->
              {#each subHeaders as track}
                {#if track}
                  {@const trackName =
                    (track.language ||
                      (!Object.values(subs.headers).some(
                        (header) =>
                          header.language === "eng" || header.language === "en",
                      )
                        ? "eng"
                        : track.type)) + (track.name ? " - " + track.name : "")}
                  <input
                    name="subtitle-radio-set"
                    type="radio"
                    id="subtitle-{track.number}-radio"
                    value={track.number}
                    checked={track.number === subs.current}
                  />
                  <label
                    for="subtitle-{track.number}-radio"
                    use:click={() => {
                      subs.selectCaptions(track.number);
                      setTimeout(() => subs?.renderer?.resize(), 200);
                      cache.setEntry(caches.HISTORY, "lastSubtitle", {
                        ...(cache.getEntry(caches.HISTORY, "lastSubtitle") ||
                          {}),
                        [buildMediaCacheKey(media)]: trackName,
                      });
                    }}
                    class="pb-5"
                  >
                    <!-- stupid fix (resize) because video metadata doesn't update for multiple frames -->
                    {trackName}
                  </label>
                {/if}
              {/each}
              <div class="mb-5 invisible"></div>
              <div class="subtitle-offset">
                <div
                  role="button"
                  aria-label="Add External Subtitles"
                  class="position-absolute not-reactive"
                  title="Add External Subtitles"
                  style="margin-left: 0.1rem !important; margin-top: 0.3rem !important"
                  use:click={(target) => {
                    fileInput.click();
                    toggleDropdown(target);
                  }}
                >
                  <FilePlus2 size="2rem" strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  inputmode="numeric"
                  pattern="-?[0-9]*.?[0-9]*"
                  step="0.1"
                  title="Subtitle Offset"
                  bind:value={subDelay}
                  on:click|stopPropagation
                  class="form-control text-right form-control-sm not-reactive"
                />
              </div>
            </div>
          </div>
        </div>
      {/if}
      {#if ELECTRON && !SUPPORTS.isAndroid && current}
        {#if $castState.sessionState === "SESSION_STARTED"}
          <span
            class="icon text-primary ctrl mr-5 d-flex align-items-center"
            title="Stop casting to {$castState.session?.deviceName || 'device'} [D]"
            data-name="toggleCast"
            use:click={toggleCast}
          >
            <Cast size="2.5rem" fill="currentColor" strokeWidth={0} />
          </span>
        {:else if ($castState.receivers?.length ?? 0) > 0}
          <div class="dropdown dropup with-arrow" use:click={toggleDropdown}>
            <span
              class="icon text-white ctrl mr-5 d-flex align-items-center h-full"
              title="Cast Video [D]"
            >
              <Cast size="2.5rem" strokeWidth={2.5} />
            </span>
            <div class="dropdown-menu dropdown-menu-right ctrl p-10 pb-0 mr-15 text-nowrap">
              <div class="overflow-y-auto overflow-x-hidden hm-400">
                {#each $castState.receivers as receiver}
                  <div
                    class="pb-5 pointer"
                    use:click={(e) => { e.target.closest(".dropdown").classList.remove("show"); startCast(receiver.id); }}
                  >
                    {receiver.friendlyName || receiver.name}
                  </div>
                {/each}
                <div class="mb-5 invisible"></div>
              </div>
            </div>
          </div>
        {:else}
          <div class="dropdown dropup with-arrow" use:click={toggleDropdown}>
            <span
              class="icon text-muted ctrl mr-5 d-flex align-items-center h-full"
              title="No cast devices found"
            >
              <Cast size="2.5rem" strokeWidth={2.5} />
            </span>
            <div class="dropdown-menu dropdown-menu-right ctrl p-10 mr-15 text-nowrap">
              <div class="text-muted">No devices found</div>
            </div>
          </div>
        {/if}
      {/if}
      {#if "pictureInPictureEnabled" in document}
        <span
          class="icon text-white ctrl mr-5 d-flex align-items-center"
          title="Popout Window [P]"
          data-name="togglePopout"
          use:click={togglePopout}
        >
          {#if pip}
            <PictureInPicture size="2.5rem" strokeWidth={2.5} />
          {:else}
            <PictureInPicture2 size="2.5rem" strokeWidth={2.5} />
          {/if}
        </span>
      {/if}
      <span
        class="icon text-white ctrl mr-5 d-flex align-items-center"
        title="Fullscreen [F]"
        data-name="toggleFullscreen"
        use:click={toggleFullscreen}
      >
        {#if isFullscreen}
          <Minimize size="2.5rem" strokeWidth={2.5} />
        {:else}
          <Maximize size="2.5rem" strokeWidth={2.5} />
        {/if}
      </span>
    </div>
  </div>
</div>

<style>
  :global(.deband-canvas) {
    max-width: 100%;
    max-height: 100%;
    width: 100% !important;
    height: 100% !important;
    top: 50%;
    left: 50%;
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: none;
    object-fit: contain;
  }
  :global(.deband-canvas) ~ video {
    opacity: 0;
  }
  .fitWidth video,
  .fitWidth :global(.deband-canvas) {
    object-fit: cover !important;
  }
  .custom-range {
    color: var(--accent-color);
    --thumb-height: 0px;
    --track-height: 3px;
    --track-color: hsla(var(--white-color-hsl), 0.2);
    --brightness-hover: 120%;
    --brightness-down: 80%;
    --clip-edges: 2px;
    --target-height: max(var(--track-height), var(--thumb-height));
    position: relative;
    background: hsla(var(--white-color-hsl), 0);
    overflow: hidden;
    transition: all ease 100ms;
    appearance: none;
  }
  .custom-range:hover {
    --thumb-height: 12px;
  }

  .custom-range:active {
    cursor: grabbing;
  }
  .custom-range::-webkit-slider-runnable-track {
    height: var(--target-height);
    position: relative;
    background: linear-gradient(var(--track-color) 0 0) scroll no-repeat center /
      100% calc(var(--track-height));
  }

  .custom-range::-webkit-slider-thumb {
    position: relative;
    height: var(--thumb-height);
    width: var(--thumb-width, var(--thumb-height));
    -webkit-appearance: none;
    --thumb-radius: calc((var(--target-height) * 0.5) - 1px);
    --clip-top: calc((var(--target-height) - var(--track-height)) * 0.5);
    --clip-bottom: calc(var(--target-height) - var(--clip-top));
    --clip-further: calc(100% + 1px);
    --box-fill: calc(-100vmax - var(--thumb-width, var(--thumb-height))) 0 0
      100vmax currentColor;

    background: linear-gradient(currentColor 0 0) scroll no-repeat left center /
      50% calc(var(--track-height) + 1px);
    background-color: currentColor;
    box-shadow: var(--box-fill);
    border-radius: var(--thumb-width, var(--thumb-height));

    filter: brightness(100%);
    clip-path: polygon(
      100% -1px,
      var(--clip-edges) -1px,
      0 var(--clip-top),
      -100vmax var(--clip-top),
      -100vmax var(--clip-bottom),
      0 var(--clip-bottom),
      var(--clip-edges) 100%,
      var(--clip-further) var(--clip-further)
    );
  }

  .custom-range:hover::-webkit-slider-thumb {
    filter: brightness(var(--brightness-hover));
    cursor: grab;
  }

  .custom-range:active::-webkit-slider-thumb {
    filter: brightness(var(--brightness-down));
    cursor: grabbing;
  }

  .custom-range:focus {
    outline: none;
  }

  .bind {
    font-size: 1.8rem;
    font-weight: bold;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
  .stats {
    font-size: 2.3rem;
    padding-top: 1.5rem;
    white-space: nowrap;
    font-weight: 600;
    font-family: Roboto, Arial, Helvetica, sans-serif;
  }
  .skipPrompt {
    margin-top: 10rem;
    font-family: Roboto, Arial, Helvetica, sans-serif;
  }
  .skipFont {
    font-size: 1.8rem !important;
  }
  .miniplayer {
    height: auto !important;
    cursor: pointer !important;
  }
  .miniplayer .top,
  .miniplayer .bottom,
  .miniplayer .skip {
    display: none !important;
  }
  .miniplayer video {
    position: relative !important;
  }
  .bg-tp {
    background: hsla(var(--black-color-hsl), 0.73);
    backdrop-filter: blur(10px);
  }
  .bg-tp .close {
    position: absolute;
    top: 0;
    right: 0;
    cursor: pointer;
    color: inherit;
    padding: var(--alert-close-padding);
    line-height: var(--alert-close-line-height);
    font-size: var(--alert-close-font-size);
    background-color: transparent;
    border-color: transparent;
  }

  video {
    transition: margin-top 0.2s ease;
  }
  .player {
    user-select: none;
    font-family: Roboto, Arial, Helvetica, sans-serif;
    background: var(--black-color);
  }

  .pip :global(canvas:not(.w-full)) {
    width: 1px !important;
    height: 1px !important;
  }

  .icon {
    font-size: 2.8rem;
    padding: 1.5rem;
    display: flex;
  }

  .immersed {
    cursor: none;
  }

  .immersed .middle .ctrl,
  .immersed .top,
  .immersed .bottom,
  .immersed .skip {
    pointer-events: none;
    opacity: 0;
  }
  /*:fullscreen .ctrl[data-name='toggleCast'] {*/
  /*  display: none !important;*/
  /*}*/

  .pip video {
    opacity: 0.1%;
  }

  .middle .bufferingDisplay {
    border: 4px solid hsla(var(--white-color-hsl), 0);
    border-top: 4px solid var(--white-color);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    will-change: transform;
    opacity: 0;
    visibility: hidden;
    transition: 0.2s opacity ease 0s;
    filter: drop-shadow(0 0 8px var(--black-color));
  }

  .middle .bufferingPos {
    margin-bottom: 5rem;
  }

  .buffering .middle .bufferingDisplay {
    opacity: 1 !important;
    visibility: visible !important;
  }
  .buffering .middle .bufferingDisplay.startupHidden {
    opacity: 0 !important;
    visibility: hidden !important;
  }
  .pip .bufferingDisplay {
    display: none;
  }

  .startupOverlay {
    inset: 0;
    background:
      radial-gradient(circle at center, rgba(0, 0, 0, 0.06) 0%, rgba(0, 0, 0, 0.44) 52%, rgba(0, 0, 0, 0.72) 100%);
    backdrop-filter: blur(6px);
    pointer-events: none;
  }

  .startupRing {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, rgba(10, 10, 10, 0.92) 63%, transparent 64%),
      conic-gradient(
        var(--accent-color) 0 var(--startup-progress),
        rgba(255, 255, 255, 0.1) var(--startup-progress) 100%
      );
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.28),
      0 0 18px color-mix(in srgb, var(--accent-color) 24%, transparent);
  }

  .startupRingInner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .startupPercent {
    font-size: 1.35rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: 0.01em;
    text-shadow: 0 0 12px rgba(0, 0, 0, 0.28);
  }

  .startupLabel {
    font-size: 1.65rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.98);
    letter-spacing: 0.012em;
  }

  .startupDetail {
    max-width: 28rem;
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.68);
    line-height: 1.4;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }

  .middle .ctrl {
    font-size: 4rem;
    z-index: 3;
    display: none;
  }
  :fullscreen {
    background: var(--black-color) !important;
  }

  @media (pointer: none), (pointer: coarse) {
    .middle .ctrl {
      display: flex;
    }
  }
  .miniplayer .middle {
    transition: background 0.2s ease;
    position: absolute !important;
    width: 100%;
    height: 100%;
  }
  .miniplayer .middle .ctrl[data-name="playPause"] {
    display: flex;
    font-size: 2.8rem;
  }
  .miniplayer .middle .ctrl[data-name="playPause"] {
    font-size: 5.625rem;
  }
  .miniplayer:hover .middle {
    background: hsla(var(--black-color-hsl), 0.4);
  }
  .middle .ctrl[data-name="playPause"] {
    font-size: 6.75rem;
  }

  .middle .ctrl,
  .bottom .ctrl:hover,
  .bottom .ts:hover,
  .bottom .hover .ts {
    filter: drop-shadow(0 0 8px var(--black-color));
  }
  .skip {
    transition: 0.2s opacity ease 0s;
    background: hsla(var(--white-color-hsl), 0.92);
  }
  .skip:hover {
    background-color: var(--lm-button-bg-color-hover);
  }

  .bottom {
    background: linear-gradient(
      to top,
      hsla(var(--black-color-hsl), 0.8),
      hsla(var(--black-color-hsl), 0.6) 25%,
      hsla(var(--black-color-hsl), 0.4) 50%,
      hsla(var(--black-color-hsl), 0.1) 75%,
      transparent
    );
    transition: 0.2s opacity ease 0s;
  }
  .top {
    background: linear-gradient(
      to bottom,
      hsla(var(--black-color-hsl), 0.8),
      hsla(var(--black-color-hsl), 0.4) 25%,
      hsla(var(--black-color-hsl), 0.2) 50%,
      hsla(var(--black-color-hsl), 0.1) 75%,
      transparent
    );
    transition: 0.2s opacity ease 0s;
  }
  .mr-50 {
    margin-right: 5rem !important;
  }
  .mb-50 {
    margin-bottom: 5rem !important;
  }
  .pbf:hover {
    background: var(--tertiary-color);
  }

  .ctrl {
    cursor: pointer;
  }

  .boost-color {
    color: var(--octonary-color) !important;
  }

  .bottom .volume:hover .boost,
  .bottom .volume:focus-within .boost {
    width: 3rem;
    height: 3rem;
  }

  .bottom .volume .boost {
    width: 0;
    height: 0;
    transition:
      width 0.1s ease,
      height 0.1s ease;
  }

  .bottom .volume:hover .custom-range,
  .bottom .volume:focus-within .custom-range {
    width: 5vw;
    display: inline-block;
    margin-right: 1.125rem;
  }

  .bottom .volume .custom-range {
    width: 0;
    transition: width 0.1s ease;
    height: 100%;
  }

  .mt-100 {
    margin-top: 10rem !important;
  }
  .h-20 {
    height: 2rem;
  }
  .rounded-10 {
    border-radius: 1rem;
  }

  .btn-shadow {
    filter: drop-shadow(0rem 0rem 0.5rem hsla(var(--black-color-hsl), 0.9));
  }

  .bottom .ts {
    color: hsla(var(--white-color-hsl), 0.92);
    white-space: nowrap;
    align-self: center;
    line-height: var(--base-line-height);
    padding: 0 1.56rem;
    font-weight: 600;
  }

  .seekbar {
    font-size: 2rem !important;
  }
  .miniplayer .mobile-focus-target {
    display: block !important;
  }
  .miniplayer-action {
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .miniplayer:hover .miniplayer-action {
    opacity: 1;
    pointer-events: auto;
  }
  .miniplayer .mobile-focus-target:focus-visible {
    background: hsla(209, 100%, 55%, 0.3);
  }

  @media (max-width: 30rem) {
    .d-btn {
      display: none !important;
    }
  }

  @media (max-width: 60rem) {
    .d-title {
      display: block !important;
      max-width: none !important;
      grid-row: unset !important;
      grid-column: unset !important;
    }
    .d-filler {
      display: flex !important;
    }
    .mt-60 {
      margin-top: 6rem !important;
    }
  }

  @media (pointer: none), (pointer: coarse) {
    .bottom .ctrl[data-name="playPause"],
    .bottom .volume,
    .bottom .keybinds {
      display: none !important;
    }
    @media (orientation: portrait) {
      .top {
        padding-top: max(
          var(--safe-area-top),
          env(safe-area-inset-top, 0)
        ) !important;
      }
    }
    .middle .ctrl {
      display: flex !important;
    }
    .miniplayer .middle .ctrl {
      display: none !important;
    }
    .toggle-immerse {
      display: block !important;
    }
    .toggle-fullscreen {
      display: none !important;
    }
  }
</style>
