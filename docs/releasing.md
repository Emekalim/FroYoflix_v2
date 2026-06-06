# Release Process

## How to cut a release

Releases are triggered by pushing a version tag. CI builds Electron for Windows and macOS automatically, along with the Android release pipeline.

### Steps

1. **Bump versions** in both `electron/package.json` and `capacitor/package.json`
2. **Update `CHANGELOG.md`** — add a new `## [X.Y.Z] - YYYY-MM-DD` entry with the customer-facing notes you want shown in FroYo's update dialog
3. **Commit and push** to `stable_base`

```bash
git add electron/package.json capacitor/package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git push origin stable_base
```

4. **Tag the commit and push the tag**

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

CI fires automatically. Monitor at: https://github.com/Emekalim/FroYoflix_v2/actions

After the Windows and macOS publish jobs finish, CI copies the matching `CHANGELOG.md` section into the GitHub Release body. FroYo's in-app update dialog reads those GitHub release notes directly.

---

## Version locations

| File | Purpose |
|------|---------|
| `electron/package.json` | Electron app version + GitHub Release tag |
| `capacitor/package.json` | Android APK version (read by `build.gradle`) |

Keep both in sync — they should always have the same version number.

---

## What CI produces

| Artifact | Platform |
|----------|----------|
| `windows-FroYo-vX.Y.Z.exe` | Windows installer |
| `windows-FroYo-vX.Y.Z-portable.exe` | Windows portable |
| `mac-FroYo-vX.Y.Z.zip` | macOS universal build |
| `android-FroYo-vX.Y.Z.apk` | Android (signed) |
| `latest.yml` | Windows Electron auto-updater manifest |
| `latest-mac.yml` | macOS Electron auto-updater manifest |
| `latest-android.yml` | Android auto-updater manifest |

---

## Semver guide

- `vX.0.0` — Major: breaking changes or significant new features
- `vX.Y.0` — Minor: new features, backwards compatible
- `vX.Y.Z` — Patch: bug fixes only
