export function isElectronRuntime(runtime = globalThis) {
  const scope = runtime?.window || runtime
  return typeof scope?.IPC?.invoke === 'function' && typeof scope?.electron?.getTranscoderPort === 'function'
}

export function shouldUseBuiltInSearchEngine(settingsValue, runtime = globalThis) {
  return Boolean(settingsValue?.useBuiltInSearchEngine && isElectronRuntime(runtime))
}
