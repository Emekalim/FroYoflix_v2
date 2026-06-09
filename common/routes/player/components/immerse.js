import { writable } from "simple-store-svelte";

// hides the player chrome after inactivity: 1.5s while playing, 5s while
// paused in the miniplayer; a token cancels stale timers when activity
// resumes. The deps are getters because they read reactive component state.
export function createImmerseController({ canImmerse, isPaused, isMiniplayer }) {
  const immersed = writable(false);
  let immerseTimeout = null;
  let immerseToken = 0;

  function immerse() {
    if (canImmerse()) {
      immersed.value = true;
      immerseTimeout = undefined;
    }
  }

  function reset() {
    clearTimeout(immerseTimeout);
    const token = ++immerseToken;
    const wasImmersed = immersed.value;
    setTimeout(() => {
      if (token !== immerseToken || wasImmersed !== immersed.value) return;
      immersed.value = false;
      if (!isPaused() || isMiniplayer()) {
        immerseTimeout = setTimeout(
          () => {
            if (token === immerseToken) immerse();
          },
          (isPaused() ? 5 : 1.5) * 1_000,
        );
      }
    });
  }

  function toggle() {
    if (immersed.value) reset();
    else {
      clearTimeout(immerseTimeout);
      immersed.value = !immersed.value;
    }
  }

  return { immersed, immerse, reset, toggle };
}
