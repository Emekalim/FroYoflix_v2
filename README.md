c<p align="center">
  <a href="https://github.com/Emekalim/FroYoflix_v2">
    <img src=".github/docs/assets/logo_filled.svg" width="380" alt="FroYo">
  </a>
</p>

<h3 align="center">Manage your personal media library, organize your collection,<br>and stream your content in real time — no waiting required.</h3>

<p align="center">
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/">Wiki</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/features/">Features</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/faq/">FAQ</a> •
  <a href="#installation">Install</a> •
  <a href="#development-setup">Dev Setup</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/">Latest Release</a> •
  <a href="#contributing">Contribute</a>
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20Android-blue?style=flat-square">
  <a href="./LICENSE"><img alt="License: GPLv3" src="https://img.shields.io/badge/license-GPLv3-orange?style=flat-square"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/"><img alt="Latest Release" src="https://img.shields.io/github/v/release/Emekalim/FroYoflix_v2?style=flat-square&color=green"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/"><img alt="Downloads" src="https://img.shields.io/github/downloads/Emekalim/FroYoflix_v2/total?style=flat-square&color=blue"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/commits"><img alt="Last Commit" src="https://img.shields.io/github/last-commit/Emekalim/FroYoflix_v2?style=flat-square"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/Emekalim/FroYoflix_v2?style=flat-square&color=yellow"></a>
</p>

> [!IMPORTANT]
> FroYo is intended for **personal use only**. It does not host, distribute, or provide media content. It is a personal media library manager for content you **legally own**. Please respect all applicable copyright laws.

---

<img src=".github/docs/assets/app.webp" alt="FroYo App" width="100%">

---

## Feature Overview

- 📺 **Stream torrents** while downloading via WebTorrent + HLS
- 🎬 **Smart transcoding** with FFmpeg and HandBrake repair fallback for corrupted files
- 🔍 **Multi-provider search** across AniList, TMDB, MAL, and Trakt
- 📅 **Schedule & tracking** — AniList + MAL sync, episode progress, airing calendar
- 🧩 **Extension system** — install torrent source plugins from GitHub or npm at runtime
- 🤝 **Watch Together** — synchronized playback across devices
- 🖥️ **Cross-platform** — Windows, Linux (Electron) + Android (Capacitor)
- ⚡ **Performance** — IndexedDB caching, banner rotation, reactive UI

<details>
<summary><b>Keyboard Shortcuts</b></summary>

| Key | Action |
|-----|--------|
| `S` | Skip opening (seek +90s) |
| `R` | Seek back 90s |
| `→` / `←` | Seek ±2s |
| `↑` / `↓` | Volume up/down |
| `M` | Mute |
| `C` | Cycle subtitle tracks |
| `F` | Toggle fullscreen |
| `P` | Toggle Picture-in-Picture |
| `N` / `B` | Next / previous episode |
| `O` | View anime details |
| `[` / `]` | Increase / decrease playback speed |
| `\` | Reset playback speed |
| `I` | Video stats overlay |
| `` ` `` | Open keybinds editor (drag and drop to remap) |

</details>

### Screenshots

<p align="center">
  <img src=".github/docs/assets/app.webp" width="49%" alt="Home screen">
  <img src=".github/docs/assets/videoplayer.webp" width="49%" alt="Video player">
</p>
<p align="center">
  <img src=".github/docs/assets/search.webp" width="49%" alt="Search">
  <img src=".github/docs/assets/episodes.webp" width="49%" alt="Episode list">
</p>
<p align="center">
  <img src=".github/docs/assets/subtitles.webp" width="49%" alt="Subtitle support">
  <img src=".github/docs/assets/schedule.webp" width="49%" alt="Schedule view">
</p>
<p align="center">
  <img src=".github/docs/assets/w2g.webp" width="49%" alt="Watch Together">
</p>

---

## Architecture

FroYo is a **pnpm monorepo** with five packages. `electron/` and `capacitor/` are thin platform shells — all UI and business logic lives in `common/`.

### Package Dependency Graph

```mermaid
graph TD
    E["electron/\nElectron 39 · FFmpeg · Discord RPC"]
    C["capacitor/\nCapacitor 6 · Android Service"]
    CO["common/\nSvelte UI + all business logic"]
    CL["client/\nWebTorrent wrapper"]
    EX["extensions/\nBuilt-in source manifests"]

    E --> CO
    C --> CO
    CO --> CL
    CO --> EX
```

### Application Layers

```mermaid
flowchart TD
    UI["UI Layer\nRouter.svelte dispatches to: Home · Search · Player · Settings\nTorrent Manager · Watch Together · Schedule\nModals: Details · Torrents · Trailers · Notifications"]

    BL["Business Logic — common/modules/\nMedia Providers · Content Resolver · Cache · Settings\nAniList/MAL sync · Torrent bridge"]

    EW["Extension Workers — common/modules/extensions/\nWeb Workers via Comlink RPC\nManifest cache → spawn → execute → return"]

    TC["Torrent Client — client/core/webtorrent.js\nTorrentClient extends WebTorrent\nAll IPC via send() message passing"]

    PL["Platform Layer\nElectron: FFmpeg transcoding · electron-builder · filesystem\nCapacitor: Android foreground service · file picker · ADB"]

    UI --> BL
    UI -->|"via torrent.js"| TC
    BL --> EW
    BL --> TC
    TC --> PL
```

### Content Resolution Sequence

When a user presses play, data flows across four major subsystems:

```mermaid
sequenceDiagram
    actor U as User
    participant P as PlayerPage.svelte
    participant T as torrent.js
    participant TC as TorrentClient
    participant R as resolver/index.js
    participant PR as AniList / TMDB Provider
    participant V as HLS.js + JASSUB

    U->>P: Click "Play" on media item
    P->>T: send('stream', { file, hash })
    T->>TC: IPC message (postMessage)
    TC->>TC: Locate/download torrent pieces
    TC-->>P: Stream URL ready (HTTP localhost)

    P->>R: resolve(filename)
    R->>R: AnimeParser / TVShowParser / MovieParser
    R->>PR: fetchMetadata(title, episode)
    PR-->>R: Episode info, artwork, progress
    R-->>P: Resolved media info

    P->>V: Initialize player (HLS manifest + subtitle tracks)
    V-->>U: Playback starts
```

### Extension System Lifecycle

```mermaid
flowchart TD
    A["Extension URI\n(gh: / npm: / https: / local)"]
    B{Manifest\ncached?}
    C["Load from\nIndexedDB"]
    D["Fetch manifest\nfrom remote"]
    E{Fetch\nsucceeded?}
    F["Update IndexedDB\ncache (7–14 day TTL)"]
    G["Offline fallback\nfrom stale cache"]
    H["Spawn Web Worker\n(Comlink RPC bridge)"]
    I["Extension executes\nquery / resolve / fetch"]
    J["Result returned to UI"]

    A --> B
    B -->|Yes, fresh| C
    B -->|Expired / missing| D
    D --> E
    E -->|Yes| F
    E -->|No| G
    F --> H
    C --> H
    G --> H
    H --> I
    I --> J
```

---

## Installation

### Windows

**Via winget (Windows 10 1809+ or Windows 11)**

```bash
winget install froyo
```

Or download from the [releases page](https://github.com/Emekalim/FroYoflix_v2/releases/latest/):
- `win-FroYo-vx.x.x-installer.exe` — standard installer
- `win-FroYo-vx.x.x-portable.exe` — no install required

### Linux

**Arch Linux**

```bash
paru -S froyo
# or
yay -S froyo
```

**Debian / Ubuntu**

```bash
# Download linux-FroYo-version.deb from the releases page, then:
apt install ./linux-FroYo-*.deb
```

### Android

Download the latest APK from the [releases page](https://github.com/Emekalim/FroYoflix_v2/releases/latest/). Enable "Install from unknown sources" in Android settings if prompted, then install the APK.

---

## Development Setup

### Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | 22.21.1 | All |
| pnpm | latest | All |
| Docker (+ WSL on Windows) | any | Android native modules |
| ADB + Android Studio | SDK 34 | Android development |
| Java JDK | 21 | Android builds |
| Visual Studio | 2022 | Windows native modules |

### Desktop (Electron)

```mermaid
flowchart TD
    A([Start]) --> B{First time?}
    B -->|Yes| C["cd electron\npnpm install --frozen-lockfile"]
    B -->|No| D[cd electron]
    C --> E{Goal}
    D --> E
    E -->|Dev mode| F["pnpm start"]
    E -->|Web assets only| G["pnpm web:watch"]
    E -->|Production build| H["pnpm build"]
    F --> I["Webpack dev server\n+ Electron launches\nwith hot reload"]
    G --> J["Watches and rebuilds\nweb bundle only"]
    H --> K["electron-builder packages\napp into dist/"]
    K --> PUB["pnpm publish\nPublish release to GitHub"]
```

```bash
cd electron
pnpm install --frozen-lockfile

# Development with hot reload
pnpm start

# Watch web assets only (run alongside pnpm electron:start)
pnpm web:watch

# Production web build only
pnpm web:build

# Run Electron without rebuilding web (pair with pnpm web:watch)
pnpm electron:start

# electron-builder only (skips web rebuild)
pnpm electron:build

# Production release build
pnpm build

# Publish release to GitHub
pnpm publish
```

### Android (Capacitor)

```mermaid
flowchart TD
    A([Start]) --> B{First time?}
    B -->|Yes| C["cd capacitor\npnpm install --frozen-lockfile\npnpm exec cap doctor"]
    C --> D{Platform?}
    D -->|Linux| E["pnpm build:native\n(Docker required)"]
    D -->|Windows| F["pnpm build:native-win\n(Docker + WSL required)"]
    E --> G
    F --> G
    B -->|Returning| G["Connect Android device\nvia USB with ADB enabled"]
    G --> H{Goal}
    H -->|Dev with hot reload| I["pnpm dev:start"]
    H -->|Deploy to device| J["pnpm dev:android"]
    H -->|Fix port forwarding| K["pnpm dev:adb-port"]
    H -->|Release APK| L["pnpm build:app"]
    I --> M["Webpack serve +\nADB deploy + port forward"]
    J --> N["cap run android\non connected device"]
    L --> O["Unsigned APK in\nandroid/app/build/outputs/"]
```

```bash
cd capacitor
pnpm install --frozen-lockfile

# Verify all dependencies are present
pnpm exec cap doctor

# First time only — build native Node modules
pnpm build:native        # Linux
pnpm build:native-win    # Windows

# Open project in Android Studio
pnpm exec cap open android

# Development — requires a connected ADB device
pnpm dev:start           # webpack serve + deploy + port forward

# If port forwarding drops during development
pnpm dev:adb-port

# Production APK (unsigned)
pnpm build:app
```

> [!NOTE]
> `pnpm dev:start` simultaneously runs the webpack dev server and deploys to your device. The device must be connected and visible to ADB before running this command.

### Running Tests

Tests use vanilla Node.js — no test framework required:

```bash
# From the repo root
node common/modules/__tests__/mediaType.test.mjs
node common/modules/extensions/__tests__/run-all.mjs
node common/modules/providers/__tests__/run-all.mjs
node common/modules/resolver/__tests__/run-all.mjs
```

Android unit tests live in `capacitor/android/app/src/test/` and run via Android Studio or Gradle.

### Linting

```bash
# From electron/ or capacitor/
pnpm exec eslint src/
```

---

## Project Structure

```
FroYoflix/
├── common/                    # Shared Svelte UI + all business logic
│   ├── components/            # Reusable UI components (CustomDropdown, etc.)
│   ├── modals/                # Detail, Torrent, Manager, Trailer modals
│   ├── modules/               # Core logic modules
│   │   ├── anime/             # Anime filename resolver, hash, parser
│   │   ├── extensions/        # Extension manager (Web Worker + Comlink)
│   │   ├── providers/         # AniList, MAL, TMDB, Trakt adapters
│   │   ├── resolver/          # Title/episode resolver (TV, anime, movie)
│   │   ├── cache.js           # IndexedDB persistence layer (66 dependents)
│   │   ├── settings.js        # Reactive settings store (47 dependents)
│   │   ├── anilist.js         # AniList GraphQL client (45 dependents)
│   │   ├── torrent.js         # IPC bridge to client/
│   │   └── util.js            # General utilities (55 dependents)
│   └── routes/                # Page-level views (Home, Search, Player, etc.)
│
├── client/                    # WebTorrent client wrapper
│   └── core/webtorrent.js     # TorrentClient — all IPC via send()
│
├── electron/                  # Desktop app shell
│   └── src/main/app.js        # Entry point: lifecycle, FFmpeg, Discord RPC
│
├── capacitor/                 # Android app shell
│   └── src/main/app.js        # Entry point: foreground service, file picker
│
├── extensions/                # Built-in extension source manifests (JSON)
│
├── docs/                      # Project documentation
│   ├── Known_Issues.md
│   ├── Improvements_Tracker.md
│   └── production_known_issues.md
│
└── patches/                   # pnpm dependency patches
```

### High-Blast-Radius Modules

Changing these affects 45–67 other files. Use `roam preflight <name>` before editing.

| Module | Dependents | Role |
|--------|-----------|------|
| `common/modules/cache.js` | 66 | IndexedDB persistence |
| `common/modules/util.js` | 55 | General utilities |
| `common/modules/settings.js` | 47 | Reactive settings store |
| `common/modules/anilist.js` | 45 | AniList GraphQL client |
| `common/modules/providers/tmdb/mapper.js` | — | TMDB data mapping |
| `common/components/CustomDropdown.svelte` | 61 | Core UI dropdown |

---

## Contributing

Contributions are welcome. Please open an issue before starting significant work.

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for the full guide including:
- Branch naming conventions — `feature/`, `fix/`, `docs/`, `chore/`
- PR process — description requirements, review checklist
- Code style — ESLint, formatting, naming conventions
- Testing requirements — unit tests, integration tests
- Commit message standards — type prefix (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`), first line under 40 characters

**Links:**
- [GitHub Issues](https://github.com/Emekalim/FroYoflix_v2/issues) — report bugs or request features
- [Pull Requests](https://github.com/Emekalim/FroYoflix_v2/pulls) — submit changes
- [Project Wiki](https://github.com/Emekalim/FroYoflix_v2/wiki/) — in-depth documentation

---

## License

[GPLv3](./LICENSE) — Copyright Emekalim
