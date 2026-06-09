import { writable } from "simple-store-svelte";

// owns the Web Audio gain pipeline used for volume boosting and the
// persisted per-media boost state; the AudioContext is created lazily so
// audio is only routed through the gain node once boost is actually used
export function createAudioGainManager({ cache, caches, createContext }) {
  let audioCtx = null;
  let gainNode = null;

  const gain = writable(0);
  const volume = writable(
    Number(cache.getEntry(caches.GENERAL, "volume")) || 1,
  );
  const volumeBoosted = writable(false);

  volume.subscribe((value) =>
    cache.setEntry(caches.GENERAL, "volume", String(value || 0)),
  );

  function readBoost(mediaKey) {
    return cache.getEntry(caches.HISTORY, "lastBoosted")?.[mediaKey];
  }

  function persistBoost(mediaKey) {
    cache.setEntry(caches.HISTORY, "lastBoosted", {
      ...(cache.getEntry(caches.HISTORY, "lastBoosted") || {}),
      [mediaKey]: { boosted: volumeBoosted.value, gain: gain.value },
    });
  }

  function attach(videoElement) {
    if (!audioCtx) {
      if (createContext) {
        ({ audioCtx, gainNode } = createContext(videoElement));
      } else {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(videoElement);
        gainNode = audioCtx.createGain();
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
      }
    }
  }

  // restores the persisted boost for a media entry on load, or resets the
  // gain node back to plain volume when the entry wasn't boosted
  function restoreBoostForMedia(mediaKey, videoElement) {
    volumeBoosted.value = readBoost(mediaKey)?.boosted || false;
    if (volumeBoosted.value) {
      attach(videoElement);
      gain.value = readBoost(mediaKey)?.gain || 0;
      gainNode.gain.value = gain.value;
    } else {
      if (gainNode?.gain) gainNode.gain.value = volume.value;
      gain.value = 0;
    }
  }

  // values <= 1 act as plain volume; above 1 the surplus goes to the gain node
  function setGain(value, mediaKey) {
    if (value <= 1) {
      gainNode.gain.value = 1;
      volume.value = value;
    } else {
      volume.value = 1;
      gainNode.gain.value = value;
    }
    gain.value = value;
    persistBoost(mediaKey);
  }

  function toggleGain(mediaKey, videoElement) {
    attach(videoElement);
    if (volumeBoosted.value) {
      volume.value = gain.value <= 1 ? gain.value : 1;
      gain.value = 1;
      if (audioCtx) gainNode.gain.value = 1;
    } else {
      setGain(volume.value, mediaKey);
    }
    volumeBoosted.value = !volumeBoosted.value;
    persistBoost(mediaKey);
  }

  return {
    gain,
    volume,
    volumeBoosted,
    attach,
    restoreBoostForMedia,
    setGain,
    toggleGain,
  };
}
