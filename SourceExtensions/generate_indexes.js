import { writeFileSync } from 'fs';

const sources = [
  {
    id: "nyaa",
    name: "Nyaa",
    icon: "https://nyaa.si/static/favicon.png",
    type: "torrent",
    version: "1.0.1"
  },
  {
    id: "sukebei",
    name: "Sukebei",
    icon: "https://sukebei.nyaa.si/static/favicon.png",
    type: "torrent",
    nsfw: true,
    version: "1.0.1"
  },
];

const REPO_BASE = "https://raw.githubusercontent.com/ReWelp/HayasexShiru-Extensions/main";

// Shiru index
const shiruIndex = sources.map((s) => ({
  id: `${s.id}src`,
  name: s.name + " SRC",
  version: s.version,
  main: `sources/${s.id}src`, // Source dir
  type: s.type,
  nsfw: s.nsfw || false,
  description: `Shiru extension for ${s.name} (custom)`,
  icon: s.icon,
  update: "gh:ReWelp/HayasexShiru-Extensions/shiru",
}));

writeFileSync("./shiru/index.json", JSON.stringify(shiruIndex, null, 2));

// Shiru package
const shiruPackage = {
  "name": "@rewelp/shiru-extensions",
  "version": "1.0.0",
  "description": "Nyaa and Sukebei extensions for Shiru",
  "license": "GPLv3",
  "main": "index.json",
  "types": "sources/index.d.ts"
};

writeFileSync("./shiru/package.json", JSON.stringify(shiruPackage, null, 2));

// Hayase index
const hayaseIndex = sources.map((s) => ({
  id: `hayase.extension.${s.id}`,
  name: s.name,
  version: "1.0.2",
  type: s.type,
  accuracy: "medium",
  ratio: 0,
  media: s.id === "sukebei" ? "both" : "sub",
  languages: ["all"],
  nsfw: s.nsfw || false,
  icon: s.icon,
  update: `${REPO_BASE}/hayase/index.json`,
  code: `${REPO_BASE}/hayase/${s.id}.js`,
}));

writeFileSync("./hayase/index.json", JSON.stringify(hayaseIndex, null, 2));

// Root index
const rootIndex = [
  {
    "main": "gh:ReWelp/HayasexShiru-Extensions/shiru"
  }
];

writeFileSync("./index.json", JSON.stringify(rootIndex, null, 2));

console.log("All indexes generated successfully!");