# Chromecast Support Implementation Plan

## Goal Description
Enable FroYoflix to stream media (both torrents and local files) to Chromecast devices. This involves exposing the internal media server to the local network, discovering Chromecast devices, and initiating playback via the Cast protocol.

## User Review Required
> [!IMPORTANT]
> **New Dependency**: This plan adds `chromecast-api` (or a similar Node.js Cast library) to the `electron` dependencies.
> **Network Exposure**: The WebTorrent HTTP server currently listens on `localhost`. To support Chromecast, it must listen on `0.0.0.0` (all interfaces) and we must identify the local LAN IP (e.g., `192.168.x.x`). This slightly increases the network footprint of the application when running.

## Proposed Changes

### Electron (Backend)
#### [NEW] [chromecast.js](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/electron/src/main/chromecast.js)
- Create a `ChromecastManager` class.
- Use `chromecast-api` to search for devices.
- Handle IPC events: `chromecast:scan`, `chromecast:play`, `chromecast:pause`, `chromecast:stop`, `chromecast:seek`.

#### [MODIFY] [main.js](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/electron/src/main/main.js) (or equivalent entry point)
- Initialize `ChromecastManager`.
- Register IPC handlers.

### Client (WebTorrent & UI)
#### [MODIFY] [webtorrent.js](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/client/core/webtorrent.js)
- Update `createServer` to listen on `0.0.0.0` or specific LAN IP.
- Add logic to detect local LAN IP (using `os.networkInterfaces`).
- Construct streaming URLs using the LAN IP instead of `localhost` when the `serverMode` is 'node'.

#### [MODIFY] [MediaHandler.svelte](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/common/components/MediaHandler.svelte)
- Add "Cast" button/icon to the player entries or a global cast menu.
- Implement logic to trigger device scan and selection modal.
- On selection, call the backend to cast the current media URL.

### UI Components
#### [NEW] [CastModal.svelte](file:///Users/franklin/Documents/Workspace/PersonalProjects/FroYoflix/common/components/modals/CastModal.svelte)
- Simple modal to list found Chromecast devices.
- Allow user to select a device.

## Verification Plan

### Automated Tests
- Unfortunately, testing Chromecast discovery and casting requires physical hardware and network permission, which cannot be easily automated in CI/CD or this environment.
- We will verify that the server binds correctly and returns a valid LAN URL.

### Manual Verification
1.  **Server Access**:
    -   Start playback of a torrent.
    -   Logs should show the streaming URL (e.g., `http://192.168.1.5:12345/...`).
    -   Attempt to access this URL from another device (e.g., phone) on the same network to confirm visibility.
2.  **Discovery**:
    -   Open Cast menu.
    -   Verify list of available Chromecast devices appears.
3.  **Playback**:
    -   Select a device.
    -   Video should appear on TV.
    -   Verify Play/Pause/Seek controls work from the desktop app.
