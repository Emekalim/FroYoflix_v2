# Production Known Issues & Roadmap

> **Scope:** Issues that only manifest in production builds (after `pnpm build` or in the packaged Electron app).
> For general development bugs, use `Known_Issues.md`.
>
> **Status tags:** `RESOLVED` · `IN PROGRESS` · `OPEN` · `INTENTIONAL BEHAVIOR`
>
> **Adding an entry:** Include error messages verbatim, root cause, and resolution plan or steps.

This document specifically tracks technical issues that only manifest in the **Production Build** (e.g., after `npm run build` or in the packaged application), along with their root causes and resolution roadmaps.

## 🔴 Critical Blockers (Prevent App Launch)

### 1. `Cannot find module 'fluent-ffmpeg'`
> **Status**: **RESOLVED**
> **Resolution**: Removed from `externals` in Webpack config.
> **Impact**: App crashes immediately on launch.

**Issue Description:**
The packed application failed to start with `Error: Cannot find module 'fluent-ffmpeg'`.

**Technical Root Cause:**
`fluent-ffmpeg` was incorrectly listed in the `externals` section of `electron/webpack.config.cjs`.
- **In Development**: Dependencies in `node_modules` are available at runtime via the file system.
- **In Production**: `electron-builder` packs sources into an `app.asar`. If a module is marked as `external`, Webpack generates a `require('fluent-ffmpeg')` call but does *not* bundle the module's code. Since `node_modules` are not deployed as-is inside the ASAR (unless specified), the require fails.

**Resolution:**
Removed `fluent-ffmpeg` from the `externals` object. This forces Webpack to bundle the library code directly into the main process bundle.

---

### 2. `Cannot find module 'ffmpeg-static'`
> **Status**: **IN PROGRESS**
> **Resolution**: Remove from `externals` in Webpack config.
> **Impact**: App launches but crashes shortly after with `UnhandledPromiseRejection`.

**Issue Description:**
After fixing `fluent-ffmpeg`, the app failed with `Error: Cannot find module 'ffmpeg-static'`.

**Technical Root Cause:**
Similar to the previous issue, `ffmpeg-static` was also listed in `externals`.
- `ffmpeg-static` provides the path to the ffmpeg binary.
- It *must* be available at runtime. While the binary itself needs to be unpacked (via `electron-builder`'s `extraResources` or similar), the *node module* that locates it must be reachable by the bundled code.
- By externalizing it without ensuring `node_modules` availability, the runtime `require` failed.

**Resolution Plan:**
1.  Remove `ffmpeg-static` from `externals` in `electron/webpack.config.cjs`.
2.  Verify that `ffmpeg-static` is correctly identifying the binary path in the packed environment (it usually handles `app.asar.unpacked` automatically).

---

## ⚠️ Runtime Warnings & behavior

### 1. `DeprecationWarning: The punycode module is deprecated`
> **Status**: **OPEN**
> **Impact**: Console warning, currently harmless but needs future-proofing.

**Issue Description:**
On launch, the internal Node.js process logs: `[DEP0040] DeprecationWarning: The punycode module is deprecated. Please use a userland alternative instead.`

**Technical Root Cause:**
- **Origin**: This is likely coming from a deep dependency (possibly `markdown-it`, `whatwg-url`, or an older version of `tough-cookie` used by `youtube-dl` or similar libraries).
- **Node.js**: Newer Node.js versions (bundled with Electron 39) have deprecated the core `punycode` module.

**Roadmap:**
1.  Identify the dependency chain using `npm explain punycode` or `yarn why punycode`.
2.  Update the offending package to a version that uses the userland `punycode/` package or a modern alternative.
3.  If it's a direct dependency, replace it.

---

### 2. "YouTube server running on localhost"
> **Status**: **INTENTIONAL BEHAVIOR**
> **Impact**: Information only. Internal architecture detail.

**Issue Description:**
Logs show `YouTube server running on http://localhost:xxxxx`.

**Technical Context:**
- **Problem**: In production, Electron serves the app from `file://` protocols (or custom schemes like `app://`). YouTube's embedded player (iframe) enforces strict `Referer` checks. Browsers (and Electron) often strip `Referer` headers when originating from `file://`, breaking the embed (Error 153).
- **Solution (`src/main/youtube.js`)**: The main process spins up a minimal HTTP server on a random localhost port.
- **Mechanism**: The app requests `http://localhost:Port/embed/VideoID`. The local server responds with an HTML page containing the YouTube iframe. Since this page is served via HTTP, it can send a valid `Referer` to YouTube, satisfying their requirements.

---

### 3. GitHub Cookie / Unhandled Promise Rejection
> **Status**: **RESOLVED**
> **Resolution**: Added error handling to `updater.js`.
> **Impact**: App crash or "Transcoder Stopped" message on launch.

**Issue Description:**
Logs show a large JSON object containing GitHub cookies, followed by `UnhandledPromiseRejectionWarning` and `[Transcoder] Stopped`.

**Technical Root Cause:**
- **Origin**: `electron-updater`'s `autoUpdater.checkForUpdates()` method returns a Promise.
- **Failure**: If the update check fails (e.g., private repo, network error, invalid config), the Promise rejects.
- **Crash**: The code in `updater.js` called this method without a `.catch()` block. Node.js treats unhandled promise rejections as fatal errors (or warns noisily), often leading to process termination.

**Resolution:**
Added `.catch(() => {})` to the `checkForUpdates()` call in `electron/src/main/updater.js` to silently swallow the error and prevent the app from crashing.

---

### 4. FFmpeg Binary Not Found (ENOENT)
> **Status**: **RESOLVED**
> **Resolution**: Added binary to `extraResources` in `package.json` and updated path in `transcoder.js`.
> **Impact**: Transcoding failed with `ENOENT`.

**Issue Description:**
`[Transcoder] Error: spawn .../app.asar.unpacked/build/ffmpeg ENOENT`

**Technical Root Cause:**
- **Bundling**: Webpack ignores the `ffmpeg` binary in `node_modules`.
- **Missing Binary**: `electron-builder` does not automatically unpack `ffmpeg-static` binaries unless configured.
- **Incorrect Path**: The app was looking in `app.asar.unpacked` which was empty.

**Resolution:**
1.  Modified `electron/package.json` to copy `node_modules/ffmpeg-static/ffmpeg` to `resources/bin/ffmpeg` via `extraResources`.
2.  Updated `electron/src/main/transcoder.js` to use `path.join(process.resourcesPath, 'bin', 'ffmpeg')` in production.
