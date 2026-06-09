import { loadWithDefaults } from "svelte-keybinds";
import {
  Captions,
  Cast,
  CircleHelp,
  Contrast,
  Eye,
  FastForward,
  List,
  Maximize,
  PictureInPicture2,
  Play,
  Proportions,
  RefreshCcw,
  Rewind,
  RotateCcw,
  RotateCw,
  ScreenShare,
  SkipBack,
  SkipForward,
  SlidersVertical,
  SquarePen,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-svelte";

// registers the player's default keybind table; actions is a flat object of
// component callbacks so all reactive state mutations happen inside the
// component. isViewAnime must be a getter — the anime-details overlay state
// is reactive and can't be captured at registration time.
export function registerPlayerKeybinds(actions) {
  const guarded = (fn) => () => !actions.isViewAnime() && fn();
  const guardedSeek = (fn) => (e) => {
    if (actions.isViewAnime()) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    fn();
  };
  loadWithDefaults({
    KeyX: {
      fn: guarded(actions.screenshot),
      id: "screenshot_monitor",
      icon: ScreenShare,
      type: "icon",
      desc: "Save Screenshot to Clipboard",
    },
    KeyI: {
      fn: guarded(actions.toggleStats),
      icon: List,
      id: "list",
      type: "icon",
      desc: "Toggle Stats",
    },
    KeyO: {
      fn: () => actions.toggleNowPlaying(),
      icon: Eye,
      id: "eye",
      type: "icon",
      desc: "Toggle Now Playing",
    },
    KeyH: {
      fn: guarded(actions.toggleFileManager),
      icon: SquarePen,
      id: "squarepen",
      type: "icon",
      desc: "Toggle File Manager",
    },
    Backquote: {
      fn: guarded(actions.toggleKeybindOverlay),
      id: "help_outline",
      icon: CircleHelp,
      type: "icon",
      desc: "Toggle Keybinds",
    },
    Space: {
      fn: guarded(actions.playPause),
      id: "play_arrow",
      play: Play,
      type: "icon",
      desc: "Play/Pause",
    },
    KeyN: {
      fn: guarded(actions.playNext),
      id: "skip_next",
      icon: SkipForward,
      type: "icon",
      desc: "Next Episode",
    },
    KeyB: {
      fn: guarded(actions.playLast),
      id: "skip_previous",
      icon: SkipBack,
      type: "icon",
      desc: "Previous Episode",
    },
    KeyA: {
      fn: guarded(actions.toggleDeband),
      id: "deblur",
      icon: Contrast,
      type: "icon",
      desc: "Toggle Video Debanding",
    },
    KeyM: {
      fn: guarded(actions.toggleMute),
      id: "volume_off",
      icon: VolumeX,
      type: "icon",
      desc: "Toggle Mute",
    },
    KeyP: {
      fn: guarded(actions.togglePopout),
      id: "picture_in_picture",
      icon: PictureInPicture2,
      type: "icon",
      desc: "Toggle Picture in Picture",
    },
    KeyF: {
      fn: guarded(actions.toggleFullscreen),
      id: "fullscreen",
      icon: Maximize,
      type: "icon",
      desc: "Toggle Fullscreen",
    },
    KeyS: {
      fn: guarded(actions.skip),
      id: "+90",
      desc: "Skip Intro/90s",
    },
    KeyW: {
      fn: guarded(actions.toggleFitWidth),
      id: "fit_width",
      icon: Proportions,
      type: "icon",
      desc: "Toggle Video Cover",
    },
    KeyD: actions.canCast
      ? {
          fn: guarded(actions.toggleCast),
          id: "cast",
          icon: Cast,
          type: "icon",
          desc: "Toggle Cast",
        }
      : undefined,
    KeyC: {
      fn: guarded(actions.cycleSubtitles),
      id: "subtitles",
      icon: Captions,
      type: "icon",
      desc: "Cycle Subtitles",
    },
    KeyV: {
      fn: guarded(actions.toggleGain),
      id: "toggle_gain",
      icon: SlidersVertical,
      type: "icon",
      desc: "Toggle Volume Limit Increase",
    },
    ArrowLeft: {
      fn: guardedSeek(actions.rewind),
      id: "fast_rewind",
      icon: Rewind,
      type: "icon",
      desc: "Rewind",
    },
    ArrowRight: {
      fn: guardedSeek(actions.forward),
      id: "fast_forward",
      icon: FastForward,
      type: "icon",
      desc: "Seek",
    },
    ArrowUp: {
      fn: guardedSeek(actions.volumeUp),
      id: "volume_up",
      icon: Volume2,
      type: "icon",
      desc: "Volume Up",
    },
    ArrowDown: {
      fn: guardedSeek(actions.volumeDown),
      id: "volume_down",
      icon: Volume1,
      type: "icon",
      desc: "Volume Down",
    },
    BracketLeft: {
      fn: guarded(actions.decreasePlaybackRate),
      id: "history",
      icon: RotateCcw,
      type: "icon",
      desc: "Decrease Playback Rate",
    },
    BracketRight: {
      fn: guarded(actions.increasePlaybackRate),
      id: "update",
      icon: RotateCw,
      type: "icon",
      desc: "Increase Playback Rate",
    },
    Backslash: {
      fn: guarded(actions.resetPlaybackRate),
      icon: RefreshCcw,
      id: "schedule",
      type: "icon",
      desc: "Reset Playback Rate",
    },
  });
}
