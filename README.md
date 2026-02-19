<p align="center">
  <a href="https://github.com/Emekalim/FroYoflix_v2">
    <img src=".github/docs/assets/logo_filled.svg" width="380" alt="FroYo">
  </a>
</p>

<h3 align="center">Manage your personal media library, organize your collection,<br>and stream your content in real time — no waiting required.</h3>

<p align="center">
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/">📚 Wiki</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/features/">✨ Features</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/faq/">❓ FAQ</a> •
  <a href="#-installation">⬇️ Install</a> •
  <a href="#%EF%B8%8F-development-setup">🔧 Dev Setup</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/">🚀 Latest Release</a> •
  <a href="#-contributing">🤝 Contribute</a>
</p>

<p align="center">
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/"><img alt="Downloads" src="https://img.shields.io/github/downloads/Emekalim/FroYoflix_v2/total?style=flat-square&color=blue"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/"><img alt="Latest Release" src="https://img.shields.io/github/v/release/Emekalim/FroYoflix_v2?style=flat-square&color=green"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/commits"><img alt="Last Commit" src="https://img.shields.io/github/last-commit/Emekalim/FroYoflix_v2?style=flat-square"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/Emekalim/FroYoflix_v2?style=flat-square&color=yellow"></a>
  <a href="./LICENSE"><img alt="License: GPLv3" src="https://img.shields.io/badge/license-GPLv3-orange?style=flat-square"></a>
</p>

> [!IMPORTANT]
> FroYo **does not host, distribute, or provide media content**. It is a personal media library manager for content you **legally own**. Please respect all applicable copyright laws.

---

https://github.com/user-attachments/assets/3ff100f0-e008-4ff5-88f5-ad4290863f96

---

## ✨ Features

### Feature Overview

```mermaid
graph TB
    FY["🍦 FroYoFlix"]
    
    subgraph MEDIA ["📚 Content Types"]
        A["🎌 Anime\nAniList/MAL sync"]
        B["🎬 TV Shows\nTMDB metadata"]
        C["🎞️ Movies\nTraktDB ratings"]
    end
    
    subgraph PLAYBACK ["🎮 Playback"]
        D["🌊 Real-time Streaming\nno buffering"]
        E["📺 HLS + Transcoding\nASS/SSA/VTT subs"]
        F["🔊 Audio Sync\nMultiple tracks"]
    end
    
    subgraph DISCOVERY ["🔍 Discovery"]
        G["📅 Episode Calendar\nDub & Sub releases"]
        H["⭐ Ratings & Reviews\nPersonal tracking"]
        I["🎬 Trailers & Teasers\nin-app playback"]
    end
    
    subgraph SOCIAL ["👥 Social"]
        J["🖥️ Watch Together\nSync playback"]
        K["💬 Discord RPC\nShow your status"]
    end
    
    subgraph PLATFORMS ["🌐 Platforms"]
        L["🖥️ Windows/Linux/macOS"]
        M["📱 Android"]
    end
    
    subgraph EXTEND ["🔌 Extensibility"]
        N["Plugin System\ngh:, npm:, https:"]
    end
    
    FY --> MEDIA
    FY --> PLAYBACK
    FY --> DISCOVERY
    FY --> SOCIAL
    FY --> PLATFORMS
    FY --> EXTEND
```

### Detailed Features

| Category | Highlights |
|----------|-----------|
| 🎌 **Anime** | AniList & MyAnimeList sync, episode auto-detection, dub/sub notifications, trailers, ratings |
| 🎬 **Multi-Media** | TV shows, movies, and anime — unified search and library |
| 🌊 **Streaming** | Real-time playback from your own files — no buffering wait |
| 🔌 **Extensions** | Plugin system for custom sources (`gh:`, `npm:`, HTTP, local) |
| 📺 **Video Player** | HLS + smart transcoding fallback, ASS/SSA/VTT subtitles, PiP, Discord RPC |
| 📅 **Schedule** | Upcoming episode calendar for dub & sub releases |
| 👥 **Watch Together** | Synchronized playback with others |
| 🖥️ **Desktop** | Windows, Linux, macOS (Electron) |
| 📱 **Mobile** | Android (Capacitor) |

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
| `` ` `` | Open keybinds editor (drag & drop to remap) |

</details>

### User Journeys

```mermaid
graph TB
    subgraph ENDUSER ["🎬 End User"]
        EU["Install app<br/>(Windows/Linux/macOS/Android)"]
        EU --> EU1["Add media files<br/>to library"]
        EU1 --> EU2["Search & browse<br/>content"]
        EU2 --> EU3["Click Play"]
        EU3 --> EU4["Stream or sync<br/>with friends"]
        EU4 --> EU5["Enjoy with<br/>Discord RPC"]
    end
    
    subgraph DEVELOPER ["👨‍💻 Developer"]
        DEV["Clone repo"]
        DEV --> DEV1["Run pnpm install<br/>in electron/ or capacitor/"]
        DEV1 --> DEV2{Platform?}
        DEV2 -->|Desktop| DEV3["pnpm start<br/>Hot reload"]
        DEV2 -->|Mobile| DEV4["pnpm dev:start<br/>Deploy to ADB device"]
        DEV3 --> DEV5["Modify components<br/>& modules"]
        DEV4 --> DEV5
        DEV5 --> DEV6["Test in dev<br/>environment"]
        DEV6 --> DEV7["Run linting &<br/>tests"]
    end
    
    subgraph CONTRIBUTOR ["🔧 Contributor"]
        CONTRIB["Fork & clone"]
        CONTRIB --> CONTRIB1["Create feature<br/>branch"]
        CONTRIB1 --> CONTRIB2["Read docs/<br/>CONTRIBUTING.md"]
        CONTRIB2 --> CONTRIB3["Make code changes"]
        CONTRIB3 --> CONTRIB4["Test & lint"]
        CONTRIB4 --> CONTRIB5["Push & open PR"]
        CONTRIB5 --> CONTRIB6["Respond to<br/>review feedback"]
        CONTRIB6 --> CONTRIB7["✅ Merged!"]
    end
    
    subgraph EXTENDER ["🔌 Extension Creator"]
        EXT["Build extension"]
        EXT --> EXT1["Target: gh:, npm:,<br/>https:, or local"]
        EXT1 --> EXT2["Manifest + resolver<br/>functions"]
        EXT2 --> EXT3["Users discover &<br/>enable extension"]
        EXT3 --> EXT4["Runs in Web Worker<br/>via Comlink RPC"]
    end
```



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

---

## 🏗️ Architecture

FroYo is a **pnpm monorepo** with five packages. `electron/` and `capacitor/` are thin platform shells — all UI and business logic lives in `common/`.

### Package Dependency Graph

```mermaid
graph TD
    E["🖥️ electron/\nElectron 39 · FFmpeg · Discord RPC"]
    C["📱 capacitor/\nCapacitor 6 · Android Service"]
    CO["📦 common/\nSvelte UI + all business logic"]
    CL["🌊 client/\nWebTorrent wrapper"]
    EX["🔌 extensions/\nBuilt-in source manifests"]

    E --> CO
    C --> CO
    CO --> CL
    CO --> EX
```

### Application Layers

```mermaid
flowchart TD
    UI["**UI Layer**\nRouter.svelte → Home · Search · Player · Settings\nTorrent Manager · Watch Together · Schedule\nModals: Details · Torrents · Trailers · Notifications"]

    BL["**Business Logic** — common/modules/\nMedia Providers · Content Resolver · Cache · Settings\nAniList/MAL sync · Torrent bridge · Sections · Navigation"]

    EW["**Extension Workers** — common/modules/extensions/\nWeb Workers via Comlink RPC\nManifest cache → spawn → execute → return"]

    TC["**Torrent Client** — client/core/webtorrent.js\nTorrentClient extends WebTorrent\nAll IPC via send() message passing"]

    PL["**Platform Layer**\nElectron: FFmpeg transcoding · electron-builder · FS\nCapacitor: Android foreground service · File picker · ADB"]

    UI --> BL
    BL --> EW
    BL --> TC
    TC --> PL
```

### Content Resolution Flow

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

### Playback State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle: App Starts
    
    Idle --> Searching: User searches for content
    Searching --> Idle: No results
    Searching --> LibraryBrowse: Results found
    
    LibraryBrowse --> DetailView: Click on media
    DetailView --> EpisodeList: Loaded
    EpisodeList --> ResolverReady: Episode selected
    
    ResolverReady --> Resolving: start resolve()
    Resolving --> ResolveFailed: Parser fails
    ResolveFailed --> DetailView: Show error
    Resolving --> MetadataFetch: Parsed title
    MetadataFetch --> PlayerInit: Metadata retrieved
    
    PlayerInit --> Loading: Initialize HLS.js + JASSUB
    Loading --> ReadyToPlay: Manifest + subs loaded
    ReadyToPlay --> Playing: User clicks play
    
    Playing --> Paused: User pauses
    Paused --> Playing: User resumes
    Playing --> Seeking: User seeks
    Seeking --> Playing: Seek complete
    
    Playing --> Buffering: Network slow
    Buffering --> Playing: Data ready
    
    Playing --> Finished: Video ends
    Finished --> EpisodeList: Show next episode prompt
    Finished --> Idle: User closes player
    
    Playing --> Idle: User exits
    Paused --> Idle: User exits
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

## ⬇️ Installation

### Installation Paths

```mermaid
flowchart TD
    START["🍦 FroYoFlix Installation"]
    
    START --> PLATFORM{Choose Your<br/>Platform}
    
    PLATFORM -->|Windows| WIN{Installation<br/>Method}
    PLATFORM -->|Linux| LIN{Distro}
    PLATFORM -->|macOS| MAC["Download from<br/>Release Page"]
    PLATFORM -->|Android| AND["Download APK<br/>from Releases"]
    
    WIN -->|Package Manager| WINGET["winget install froyo"]
    WIN -->|Manual| WININST["Download EXE Installer<br/>or Portable"]
    
    LIN -->|Arch Linux| ARCH["paru -S froyo<br/>yay -S froyo"]
    LIN -->|Debian/Ubuntu| DEB["apt install<br/>linux-FroYo-*.deb"]
    
    MAC --> MACREL["Extract & Launch<br/>macOS .dmg"]
    AND --> APKINST["Enable Unknown Sources<br/>Install APK"]
    
    WINGET --> OK["✅ Ready to use"]
    WININST --> OK
    ARCH --> OK
    DEB --> OK
    MACREL --> OK
    APKINST --> OK
```

### 🖥️ Desktop

**Windows**

```bash
# Via winget (Windows 10 1809+ or Windows 11)
winget install froyo
```

Or download from the [releases page](https://github.com/Emekalim/FroYoflix_v2/releases/latest/):
- `win-FroYo-vx.x.x-installer.exe` — standard installer
- `win-FroYo-vx.x.x-portable.exe` — no install required

**Linux — Arch**

```bash
paru -S froyo
# or
yay -S froyo
```

**Linux — Debian / Ubuntu**

```bash
# Download linux-FroYo-version.deb from releases, then:
apt install ./linux-FroYo-*.deb
```

**macOS**

Download from the [releases page](https://github.com/Emekalim/FroYoflix_v2/releases/latest/) and extract the `.dmg` file.

### 📱 Android

Download the latest APK from the [releases page](https://github.com/Emekalim/FroYoflix_v2/releases/latest/) and install it on your device. Enable "Install from unknown sources" in Android settings if prompted.

---

## 🛠️ Development Setup

### Prerequisites Overview

```mermaid
graph LR
    subgraph CORE["🔧 Core"]
        NODE["Node.js<br/>22.21.1"]
        PNPM["pnpm<br/>latest"]
    end
    
    subgraph DESKTOP["🖥️ Desktop Dev"]
        VS["Visual Studio<br/>2022"]
    end
    
    subgraph ANDROID["📱 Android Dev"]
        DOCKER["Docker<br/>+ WSL on Win"]
        ADB["ADB +<br/>Android Studio"]
        JAVA["Java JDK<br/>21"]
    end
    
    CORE --> DESKTOP
    CORE --> ANDROID
    
    ADB --> SDK["SDK 34"]
    JAVA --> BUILD["Android<br/>Builds"]
```

### Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | 22.21.1 | All |
| pnpm | latest | All |
| Docker (+ WSL on Windows) | any | Android native modules |
| ADB + Android Studio | SDK 34 | Android development |
| Java JDK | 21 | Android builds |
| Visual Studio | 2022 | Windows native modules |

---

### 🖥️ Desktop (Electron)

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
    G --> J["Watches & rebuilds\nweb bundle only"]
    H --> K["electron-builder packages\napp into dist/"]
```

**Step by step:**

```bash
cd electron
pnpm install --frozen-lockfile

# Development (hot reload)
pnpm start

# Watch web assets only (run alongside pnpm electron:start)
pnpm web:watch

# Production release build
pnpm build
```

---

### 📱 Android (Capacitor)

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
    H -->|Fix port forwarding| K["pnpm dev:adb-port\nadb reverse tcp:5001 tcp:5001"]
    H -->|Release APK| L["pnpm build:app"]
    I --> M["Webpack serve +\nADB deploy + port forward"]
    J --> N["cap run android\non connected device"]
    L --> O["Unsigned APK in\nandroid/app/build/outputs/"]
```

**Step by step:**

```bash
cd capacitor
pnpm install --frozen-lockfile

# Verify all dependencies are present
pnpm exec cap doctor

# First time only — build native Node modules
pnpm build:native        # Linux
pnpm build:native-win    # Windows

# (Optional) Regenerate app icons & splash screens
pnpm build:assets

# Open project in Android Studio
pnpm exec cap open android

# Development — requires a connected ADB device
pnpm dev:start           # webpack serve + deploy + port forward

# If port forwarding drops during dev
pnpm dev:adb-port

# Production APK (unsigned — see NoCrypt/sign-android for signing)
pnpm build:app
```

> [!NOTE]
> `pnpm dev:start` simultaneously runs the webpack dev server and deploys to your device. The device must be connected and visible to ADB before running this command.

---

### 🧪 Running Tests

Tests use vanilla Node.js — no test framework required:

```bash
# From the repo root
node common/modules/__tests__/mediaType.test.mjs
node common/modules/extensions/__tests__/run-all.mjs
node common/modules/providers/__tests__/run-all.mjs
node common/modules/resolver/__tests__/run-all.mjs
```

Android unit tests live in `capacitor/android/app/src/test/` and run via Android Studio or Gradle.

### 🔍 Linting

```bash
# From electron/ or capacitor/
pnpm exec eslint src/
```

---

## 📁 Project Structure

### Directory Organization

```mermaid
graph TD
    ROOT["📦 FroYoflix/"]
    
    ROOT --> COMMON["📂 common/\nShared Svelte UI +<br/>business logic"]
    ROOT --> CLIENT["📂 client/\nWebTorrent wrapper"]
    ROOT --> ELECTRON["📂 electron/\nDesktop shell"]
    ROOT --> CAPACITOR["📂 capacitor/\nAndroid shell"]
    ROOT --> EXTENSIONS["📂 extensions/\nBuilt-in manifests"]
    ROOT --> DOCS["📂 docs/\nDocumentation"]
    ROOT --> PATCHES["📂 patches/\npnpm dependency patches"]
    
    COMMON --> COMP["components/\nReusable UI elements"]
    COMMON --> MODALS["modals/\nDetail, Torrent, Manager"]
    COMMON --> MODULES["modules/\nCore business logic"]
    COMMON --> VIEWS["views/\nPage-level views"]
    
    MODULES --> ANIME["anime/\nFilename & hash parser"]
    MODULES --> EXT["extensions/\nWeb Worker manager"]
    MODULES --> PROV["providers/\nAniList, MAL, TMDB"]
    MODULES --> RESOLVER["resolver/\nTitle/episode resolver"]
    MODULES --> CACHE["cache.js\nIndexedDB persistence"]
    MODULES --> SETTINGS["settings.js\nReactive settings"]
    
    CLIENT --> WEBTORRENT["core/webtorrent.js\nTorrentClient"]
    
    ELECTRON --> MAINAPP["src/main/app.js\nLifecycle, FFmpeg,<br/>Discord RPC"]
    
    CAPACITOR --> CAPMAIN["src/main/app.js\nForeground service,<br/>file picker"]
    
    DOCS --> KNOWN["Known_Issues.md"]
    DOCS --> IMPROVE["Improvements_Tracker.md"]
    DOCS --> PROD["production_known_issues.md"]
```

### Full Structure

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
│   └── views/                 # Page-level views (Home, Search, Player, etc.)
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

> Changing these affects 45–67 other files. Use `roam preflight <name>` before editing.

| Module | Dependents | Role |
|--------|-----------|------|
| `common/modules/cache.js` | 66 | IndexedDB persistence |
| `common/modules/util.js` | 55 | General utilities |
| `common/modules/settings.js` | 47 | Reactive settings store |
| `common/modules/anilist.js` | 45 | AniList GraphQL client |
| `common/components/CustomDropdown.svelte` | 61 | Core UI dropdown |

---

## 🤝 Contributing

### Contribution Workflow

```mermaid
flowchart TD
    IDEA["💡 Have an idea<br/>or found a bug?"]
    ISSUE["📋 Check existing<br/>GitHub Issues"]
    FOUND{Issue<br/>exists?}
    NEW["✏️ Create new<br/>GitHub Issue"]
    READ["📖 Read<br/>CONTRIBUTING.md"]
    FORK["🍴 Fork repo<br/>& clone locally"]
    BRANCH["🌿 Create feature branch<br/>following naming convention"]
    CODE["💻 Code changes"]
    TEST["🧪 Run tests<br/>& linting"]
    COMMIT["💾 Commit with<br/>descriptive message"]
    PUSH["⬆️ Push to your fork"]
    PR["🔄 Create Pull Request<br/>with description"]
    REVIEW["👀 Maintainer review<br/>& feedback"]
    MERGE{Changes<br/>approved?}
    DONE["✅ Merged!"]
    REVISE["🔄 Address feedback<br/>& update PR"]
    
    IDEA --> ISSUE
    ISSUE --> FOUND
    FOUND -->|Yes| READ
    FOUND -->|No| NEW
    NEW --> READ
    READ --> FORK
    FORK --> BRANCH
    BRANCH --> CODE
    CODE --> TEST
    TEST --> COMMIT
    COMMIT --> PUSH
    PUSH --> PR
    PR --> REVIEW
    REVIEW --> MERGE
    MERGE -->|No| REVISE
    REVISE --> TEST
    MERGE -->|Yes| DONE
```

### Getting Started

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for the full guide including:
- **Branch naming conventions** — `feature/`, `fix/`, `docs/`, `chore/`
- **PR process** — description requirements, review checklist
- **Code style** — ESLint, formatting, naming conventions
- **Testing requirements** — unit tests, integration tests
- **Commit message standards** — clear, descriptive messages

**Quick Links:**
- 📋 [GitHub Issues](https://github.com/Emekalim/FroYoflix_v2/issues) — Report bugs or request features
- 🔀 [Pull Requests](https://github.com/Emekalim/FroYoflix_v2/pulls) — Submit your changes
- 📚 [Project Wiki](https://github.com/Emekalim/FroYoflix_v2/wiki/) — In-depth documentation

---

## 📜 License

[GPLv3](./LICENSE) — © Emekalim
