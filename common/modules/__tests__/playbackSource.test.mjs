import assert from "assert";

import {
  createLibraryPlaybackSource,
  createTorrentPlaybackSource,
  getNowPlayingSnapshot,
  PLAYBACK_SOURCE_KIND,
} from "../playback/source.js";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           PLAYBACK SOURCE UNIT TESTS                     ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failCount++;
  }
}

test("createTorrentPlaybackSource normalizes torrent playback metadata", () => {
  const source = createTorrentPlaybackSource({
    name: "Episode 01.mkv",
    path: "/tmp/Episode 01.mkv",
    url: "http://localhost/video",
    subtitleFiles: [{ path: "/tmp/sub.vtt", language: "eng" }],
    media: {
      media: { id: 101, format: "TV" },
      episode: 1,
      season: 2,
      parseObject: {
        anime_title: "Show",
        episode_number: 1,
        anime_season: 2,
      },
    },
  });

  assert.strictEqual(source.kind, PLAYBACK_SOURCE_KIND.TORRENT);
  assert.strictEqual(source.target, "builtin");
  assert.strictEqual(source.media.id, 101);
  assert.strictEqual(source.episode, 1);
  assert.strictEqual(source.season, 2);
  assert.strictEqual(source.file.path, "/tmp/Episode 01.mkv");
  assert.strictEqual(source.subtitles.length, 1);
  assert.strictEqual(source.subtitles[0].subtitle, true);
});

test("createLibraryPlaybackSource normalizes library playback metadata", () => {
  const source = createLibraryPlaybackSource(
    {
      name: "Movie.mkv",
      path: "/library/Movie.mkv",
      url: "file:///library/Movie.mkv",
      subtitleFiles: [{ path: "/library/Movie.en.vtt" }],
      media: {
        media: { id: 202, format: "MOVIE" },
        episode: null,
        season: null,
        parseObject: { file_name: "Movie.mkv" },
      },
    },
    {
      media: { id: 202, format: "MOVIE" },
      title: "Movie Title",
      thumbnail: "https://img.example/movie.jpg",
      resume: { currentTime: 55, duration: 90 },
    },
  );

  assert.strictEqual(source.kind, PLAYBACK_SOURCE_KIND.LIBRARY);
  assert.strictEqual(source.media.id, 202);
  assert.strictEqual(source.title, "Movie Title");
  assert.strictEqual(source.thumbnail, "https://img.example/movie.jpg");
  assert.deepStrictEqual(source.resume, { currentTime: 55, duration: 90 });
  assert.strictEqual(source.subtitles[0].subtitle, true);
});

test("subtitle normalization filters nulls and marks subtitles explicitly", () => {
  const source = createLibraryPlaybackSource(
    {
      name: "Episode 02.mkv",
      path: "/library/Episode 02.mkv",
      media: {
        media: { id: 303 },
        parseObject: { file_name: "Episode 02.mkv" },
      },
      subtitleFiles: [null, { path: "/library/Episode 02.ass", language: "eng" }],
    },
    {},
  );

  assert.strictEqual(source.subtitles.length, 1);
  assert.strictEqual(source.subtitles[0].subtitle, true);
  assert.strictEqual(source.subtitles[0].language, "eng");
});

test("getNowPlayingSnapshot derives compatibility nowPlaying shape", () => {
  const snapshot = getNowPlayingSnapshot({
    media: { id: 404 },
    episode: 7,
    season: 1,
    parseObject: { anime_title: "Show" },
    failed: false,
    zeroEpisode: false,
    episodeRange: { first: 7, last: 8 },
    title: "Show",
    episodeTitle: "Double Episode",
    thumbnail: "https://img.example/show.jpg",
    resume: { currentTime: 120, duration: 1440 },
  });

  assert.deepStrictEqual(snapshot, {
    media: { id: 404 },
    episode: 7,
    season: 1,
    parseObject: { anime_title: "Show" },
    failed: false,
    zeroEpisode: false,
    episodeRange: { first: 7, last: 8 },
    title: "Show",
    episodeTitle: "Double Episode",
    thumbnail: "https://img.example/show.jpg",
    resume: { currentTime: 120, duration: 1440 },
  });
});

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
}
