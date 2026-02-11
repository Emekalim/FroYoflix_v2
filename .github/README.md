<p align="center">
	<a href="https://github.com/Emekalim/FroYoflix_v2">
		<img src="../.github/docs/assets/logo_filled.svg" width="400" alt="FroYo">
	</a>
</p>
<h4 align="center"><b>Manage your personal media library, organize your collection, and stream your content in real time, no waiting required!</b></h4>

<p align="center">
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/">📚 Wiki</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/features/">✨ Features</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/wiki/faq/">❓ FAQ</a> •
  <a href="#-building--development">🔧 Building & Development</a> •
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/">⬇️ Download</a>
</p>

> [!IMPORTANT]
> This application **does not host, distribute, or provide media content**.
> 
> FroYo is intended solely as a **personal media library manager** for organizing and playing content that you **legally own**. Please ensure that any media you use with this app is obtained **legally** and that you respect all applicable **copyright laws**.

https://github.com/user-attachments/assets/3ff100f0-e008-4ff5-88f5-ad4290863f96

<p align="center">
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/"><img alt="Downloads" src="https://img.shields.io/github/downloadsEmekalim/FroYoflix_v2/total?style=flat-square"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/releases/latest/"><img alt="Latest Release" src="https://img.shields.io/github/v/releaseEmekalim/FroYoflix_v2?style=flat-square"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/commits"><img alt="Last Commit" src="https://img.shields.io/github/last-commitEmekalim/FroYoflix_v2?style=flat-square"></a>
  <a href="https://github.com/Emekalim/FroYoflix_v2/stargazers"><img alt="Stargazers" src="https://img.shields.io/github/starsEmekalim/FroYoflix_v2?style=flat-square"></a>
  <a href="../LICENSE"><img alt="License: GPLv3" src="https://img.shields.io/github/licenseEmekalim/FroYoflix_v2?style=flat-square"></a>
</p>

## 📃 **About**

**FroYo** is designed to enhance your personal media experience with a feature-rich environment and full mobile support. It provides a seamless way to organize, track, and play content you legally own.

FroYo lets you enjoy your collection in real time, with fast playback, high-quality video, and a clean, ad-free interface.


### ✨ Key Features:
- 🪄 **Anime integration with AniList & MyAnimeList**
- 💬 **Full subtitle support** with softcoded and external files
- ⏩ **Seamless video controls** and keyboard shortcuts
- 🌐 **Real-time library playback** for fast access to content you own

---

### 🎥 **Anime Features**:
- 🪄 **Full AniList & MyAnimeList Integration:**
    - Filter by name, genre, season, year, format, and status.
    - Manage your watching & planning lists easily.
    - Automatically mark episodes as completed after watching.
    - Watch trailers and previews.
    - Rate and score anime.
    - Explore related anime.

- 🌐 **Advanced content fetching** (for legally owned media):
    - Recognize content by series.
    - Automatically detect episodes from file names.
    - Support for custom feeds and resolution preferences.
    - Stream your content in real time without waiting.
    - Support for custom [extensions](https://github.com/Emekalim/FroYoflix_v2/wiki/Extensions).
    - Adjustable network speeds.

- 🔔 **Dub & Sub Notifications**:
    - Schedules and tracking for both dub and sub releases.
    - Instant notifications on new episodes!

---

### 🎬 **Video Playback Features**:
- 💬 **Full Subtitle Support**:
    - Softcoded and external subtitles (VTT, SSA, ASS, SUB, TXT).
    - Picture-in-Picture (PiP) mode for multitasking.

- 🎮 **Keybindings**:
    - **S**: Skip opening (seek forward 90s).
    - **R**: Seek backwards 90s.
    - **→**: seek forwards 2 seconds.
    - **←**: seek backwards 2 seconds.
    - **↑**: increase volume.
    - **↓**: decrease volume.
    - **M**: Mute volume.
    - **C**: Cycle through subtitle tracks.
    - **F**: toggle fullscreen.
    - **P**: toggle picture in picture.
    - **N/B**: Next/previous episode.
    - **O**: View anime details.
    - **V**: Toggle volume limit increase.
    - **[**: Increase playback speed.
    - **]**: Decrease playback speed.
    - **\\**: reset playback speed to 1.
    - **I**: Show video stats.
    - **`**: Open keybinds UI (edit keybinds by drag and dropping any key).

- 👏 **Other Features**:
    - Miniplayer and media session support.
    - Pausing when window focus is lost.
    - Autoplaying the next episode.
    - Switching between multiple audios.
    - Discord Rich Presence integration.
    - Preview thumbnails and autoplay next episodes.
    - Progress indicators visible on the seek bar

## ⚙️ **Installation**

### 🐧 **Linux Installation**:

#### Arch:
```bash
paru -S froyo
```

Or if you use yay:

```bash
yay -S froyo
```

#### Debian/Ubuntu:
1. 🔗 Download the `linux-FroYo-version.deb` from the [releases page](https://github.com/Emekalim/FroYoflix_v2/releases/latest).
2. 📦 Install using the package manager:

    ```bash
    apt install linux-FroYo-*.deb
    ```

---

### 🖥️ Windows Installation:
#### Option 1: 💨 Install via Winget
For Windows 10 **1809** or later, or Windows 11:
```bash
winget install froyo
```

#### Option 2: 🔄 Installer or Portable Version
1. 🔗 Download from the [releases page](https://github.com/Emekalim/FroYoflix_v2/releases/latest):
   - **Installer:** `win-FroYo-vx.x.x-installer.exe`
   - **Portable:** `win-FroYo-vx.x.x-portable.exe` *(No installation required, just run it)*

## 🔧 Building & Development

Credit to [NoCrypt](https://github.com/NoCrypt) for doing the legwork on this.

### 📋 Requirements:
- PNPM (or any package manager)
- NodeJS 22.21.1
- Visual Studio 2022 (if on Windows)
- Docker (with WSL on Windows)
- ADB & Android Studio (SDK 34)
- Java 21 (JDK)

###  💻 Building for PC (Electron):
1. Navigate to the Electron directory:
   ```bash
   cd electron
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start development:
   ```bash
   pnpm start
   ```
4. Build for release:
   ```bash
   pnpm build
   ```

---

### 📱 Building for Android (Capacitor):
1. Navigate to the Capacitor directory:
   ```bash
   cd capacitor
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the doctor to check for missing dependencies:
   ```bash
   pnpm exec cap doctor
   ```
4. (First time only) Build native code:
   - Windows:
     ```bash
     pnpm build:native-win
     ```
   - Linux:
     ```bash
     pnpm build:native
     ```
5. (Optional) Generate assets:
   ```bash
   pnpm build:assets
   ```
6. Open the Android project:
   ```bash
   pnpm exec cap open android
   ```
7. Connect your device with ADB and start development:
   ```bash
   pnpm dev:start
   ```
8. Build the app for release (APK will not be [signed](https://github.com/NoCrypt/sign-android)):
   ```bash
   pnpm build:app
   ```

---

## 📜 License

This project follows the [GPLv3 License](../LICENSE).
