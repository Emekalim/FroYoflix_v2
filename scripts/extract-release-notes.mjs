import fs from "node:fs";
import path from "node:path";

const requestedVersion = (process.argv[2] || process.env.GITHUB_REF_NAME || "")
  .trim()
  .replace(/^v/i, "");

if (!requestedVersion) {
  console.error("Missing version. Usage: node scripts/extract-release-notes.mjs <version>");
  process.exit(1);
}

const changelogPath = path.resolve(process.cwd(), "CHANGELOG.md");
const changelog = fs.readFileSync(changelogPath, "utf8");
const escapedVersion = requestedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sectionPattern = new RegExp(
  `^## \\[${escapedVersion}\\] - .*$([\\s\\S]*?)(?=^## \\[|\\Z)`,
  "m",
);
const match = changelog.match(sectionPattern);

if (!match) {
  console.error(`Could not find release notes for ${requestedVersion} in CHANGELOG.md`);
  process.exit(1);
}

const notes = match[1].trim();
process.stdout.write(`${notes}\n`);
