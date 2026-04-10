import { writable } from "simple-store-svelte";

const initialState = {
  active: false,
  id: null,
  progress: 0,
  label: "",
  detail: "",
  error: "",
};

let nextStartupId = 1;

function clampProgress(progress) {
  const numeric = Number(progress);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function sanitizeState(overrides = {}) {
  return {
    ...initialState,
    ...overrides,
    progress: clampProgress(overrides.progress ?? initialState.progress),
  };
}

export const playerStartup = writable({ ...initialState });

function isCurrentStartup(id) {
  return playerStartup.value?.active && playerStartup.value?.id === id;
}

export function beginPlayerStartup({
  label = "Opening player",
  detail = "",
  progress = 0,
} = {}) {
  const id = nextStartupId++;
  playerStartup.set(
    sanitizeState({
      active: true,
      id,
      label,
      detail,
      progress,
    }),
  );
  return id;
}

export function updatePlayerStartup({
  id,
  label,
  detail,
  progress,
  error,
} = {}) {
  if (!isCurrentStartup(id)) return false;
  playerStartup.set(
    sanitizeState({
      ...playerStartup.value,
      label: label ?? playerStartup.value.label,
      detail: detail ?? playerStartup.value.detail,
      progress:
        progress == null ? playerStartup.value.progress : clampProgress(progress),
      error: error ?? playerStartup.value.error,
    }),
  );
  return true;
}

export function completePlayerStartup({ id, detail = "Ready" } = {}) {
  if (!isCurrentStartup(id)) return false;
  playerStartup.set(
    sanitizeState({
      active: false,
      id,
      progress: 100,
      label: "Ready",
      detail,
    }),
  );
  return true;
}

export function failPlayerStartup({
  id,
  label = "Playback failed",
  detail = "Unable to prepare playback.",
} = {}) {
  if (!isCurrentStartup(id)) return false;
  playerStartup.set(
    sanitizeState({
      active: false,
      id,
      progress: playerStartup.value.progress || 0,
      label,
      detail,
      error: detail,
    }),
  );
  return true;
}

export function clearPlayerStartup(id = playerStartup.value?.id) {
  if (id != null && playerStartup.value?.id !== id) return false;
  playerStartup.set({ ...initialState });
  return true;
}

export function createStartupSnapshot(overrides = {}) {
  return sanitizeState(overrides);
}
