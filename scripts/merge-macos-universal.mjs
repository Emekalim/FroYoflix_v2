import fs from "node:fs";
import path from "node:path";
import { makeUniversalApp } from "@electron/universal";

const [x64AppPathArg, arm64AppPathArg, outAppPathArg] = process.argv.slice(2);

if (!x64AppPathArg || !arm64AppPathArg || !outAppPathArg) {
  console.error("Usage: node scripts/merge-macos-universal.mjs <x64-app> <arm64-app> <out-app>");
  process.exit(1);
}

const x64AppPath = path.resolve(x64AppPathArg);
const arm64AppPath = path.resolve(arm64AppPathArg);
const outAppPath = path.resolve(outAppPathArg);
const updateConfigRelativePath = path.join("Contents", "Resources", "app-update.yml");

for (const appPath of [x64AppPath, arm64AppPath]) {
  if (!fs.existsSync(appPath)) {
    console.error(`Missing app bundle: ${appPath}`);
    process.exit(1);
  }
}

fs.mkdirSync(path.dirname(outAppPath), { recursive: true });

await makeUniversalApp({
  x64AppPath,
  arm64AppPath,
  outAppPath,
  force: true,
  mergeASARs: true,
  singleArchFiles: "node_modules/+(register-scheme|utp-native|fs-native-extensions)/**",
  x64ArchFiles: "Contents/Resources/bin/{HandBrakeCLI,ffmpeg,ffprobe}",
});

const sourceUpdateConfigPath = [x64AppPath, arm64AppPath]
  .map(appPath => path.join(appPath, updateConfigRelativePath))
  .find(fs.existsSync);

if (sourceUpdateConfigPath) {
  const destinationUpdateConfigPath = path.join(outAppPath, updateConfigRelativePath);
  fs.mkdirSync(path.dirname(destinationUpdateConfigPath), { recursive: true });
  fs.copyFileSync(sourceUpdateConfigPath, destinationUpdateConfigPath);
}

console.log(`Created universal app at ${outAppPath}`);
