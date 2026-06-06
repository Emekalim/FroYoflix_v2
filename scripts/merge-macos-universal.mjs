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
const packageJsonPath = path.resolve("electron", "package.json");

function createUpdateConfig() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const publishConfig = Array.isArray(packageJson.build?.publish) ? packageJson.build.publish[0] : packageJson.build?.publish;
  if (!publishConfig?.provider || !publishConfig?.owner || !publishConfig?.repo) {
    throw new Error("Unable to build mac updater config from electron/package.json");
  }

  const updaterCacheDirName = `${packageJson.name}-updater`;
  const lines = [
    `owner: ${publishConfig.owner}`,
    `repo: ${publishConfig.repo}`,
    `provider: ${publishConfig.provider}`,
  ];

  if (publishConfig.releaseType) {
    lines.push(`releaseType: ${publishConfig.releaseType}`);
  }

  lines.push(`updaterCacheDirName: ${updaterCacheDirName}`);
  return `${lines.join("\n")}\n`;
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

const sourceUpdateConfigPath = [x64AppPath, arm64AppPath]
  .map(appPath => path.join(appPath, updateConfigRelativePath))
  .find(fs.existsSync);
const destinationUpdateConfigPath = path.join(outAppPath, updateConfigRelativePath);

fs.mkdirSync(path.dirname(destinationUpdateConfigPath), { recursive: true });
if (sourceUpdateConfigPath) {
  fs.copyFileSync(sourceUpdateConfigPath, destinationUpdateConfigPath);
} else {
  fs.writeFileSync(destinationUpdateConfigPath, createUpdateConfig(), "utf8");
}

console.log(`Created universal app at ${outAppPath}`);
