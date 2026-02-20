# Versioning & Release Design — 2026-02-20

## Goal

Ship FroYo v1.0.0 and establish a repeatable release process going forward.

## Version Locations

| File | Current | Target |
|------|---------|--------|
| `electron/package.json` | `6.5.0` | `1.0.0` |
| `capacitor/package.json` | `1.1.0` | `1.0.0` |

`build.gradle` reads `capacitor/package.json` directly — no separate Android version to maintain.

## Release Trigger

**Tag-based.** Pushing a tag matching `v*.*.*` fires the CI release pipeline. Branch pushes do not trigger releases.

Rationale: explicit control over what ships. A release only happens when you push a version tag, not on every merged PR.

## Release Chain

```
git push origin v1.0.0  (tag push)
    └── main.yml (Electron Build and Release)
            ├── release-windows  →  windows-FroYo-v1.0.0.exe + portable
            ├── release-linux    →  linux-FroYo-v1.0.0.AppImage + .deb
            └── release-macos    →  mac-FroYo-v1.0.0.dmg
                    ↓ on success
            android.yml (Android Build)
                    └── APK signed + uploaded to same GitHub Release v1.0.0
```

`electron-builder` creates the GitHub Release and uploads Electron artifacts + `latest.yml`. The Android workflow attaches the signed APK to that same release.

## Changes Required

### 1. Version bumps
- `electron/package.json`: `"version": "1.0.0"`
- `capacitor/package.json`: `"version": "1.0.0"`

### 2. Fix main.yml trigger
Replace:
```yaml
on:
  push:
    branches:
      - 'main'
      - 'master'
```
With:
```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```
Keep `workflow_dispatch` for manual runs.

### 3. Fix main.yml pnpm bug
Three occurrences of `npm run publish` → `pnpm run publish`.

### 4. Update CHANGELOG.md
`[Unreleased]` → `[1.0.0] - 2026-02-20`

### 5. Add docs/releasing.md
Short runbook documenting how to cut future releases. One source of truth for the release process.

## Release Runbook (for v1.0.0 and all future releases)

```bash
# 1. Bump version in both package.json files
# 2. Update CHANGELOG.md (Unreleased → vX.Y.Z)
# 3. Commit and push to stable_base
git add electron/package.json capacitor/package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git push origin stable_base

# 4. Tag the commit
git tag vX.Y.Z
git push origin vX.Y.Z

# CI fires automatically — monitor at GitHub Actions
```

## Out of Scope

- In-app auto-updater UI (deferred to future version)
- macOS code signing (requires Apple Developer account)
- Release notes automation
