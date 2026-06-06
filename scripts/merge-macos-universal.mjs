import fs from "node:fs";
import path from "node:path";
import { makeUniversalApp } from "@electron/universal";

const [x64AppPath, arm64AppPath, outAppPath] = process.argv.slice(2);

if (!x64AppPath || !arm64AppPath || !outAppPath) {
  console.error("Usage: node scripts/merge-macos-universal.mjs <x64-app> <arm64-app> <out-app>");
  process.exit(1);
}

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

console.log(`Created universal app at ${outAppPath}`);
