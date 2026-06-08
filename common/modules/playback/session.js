import { writable } from "simple-store-svelte";

export const PLAYBACK_TARGET = {
  BUILTIN: "builtin",
  CHROMECAST: "chromecast",
};

export const PLAYBACK_STATUS = {
  IDLE: "idle",
  PREPARING: "preparing",
  READY: "ready",
  PLAYING: "playing",
  PAUSED: "paused",
  ENDED: "ended",
  FAILED: "failed",
};

const initialState = {
  target: PLAYBACK_TARGET.BUILTIN,
  status: PLAYBACK_STATUS.IDLE,
  source: null,
  error: null,
};

export const playbackSession = writable({ ...initialState });

function patchSession(patch) {
  playbackSession.set({
    ...playbackSession.value,
    ...patch,
  });
}

export function beginBuiltinPlayback(source) {
  patchSession({
    target: PLAYBACK_TARGET.BUILTIN,
    status: PLAYBACK_STATUS.PREPARING,
    source,
    error: null,
  });
}

export function markPlaybackReady() {
  patchSession({ status: PLAYBACK_STATUS.READY, error: null });
}

export function markPlaybackPlaying() {
  patchSession({ status: PLAYBACK_STATUS.PLAYING, error: null });
}

export function markPlaybackPaused() {
  patchSession({ status: PLAYBACK_STATUS.PAUSED, error: null });
}

export function markPlaybackEnded() {
  patchSession({ status: PLAYBACK_STATUS.ENDED, error: null });
}

export function failPlayback(error) {
  patchSession({
    status: PLAYBACK_STATUS.FAILED,
    error: error || null,
  });
}

export function resetPlaybackSession() {
  playbackSession.set({ ...initialState });
}
