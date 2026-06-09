const DOWNLOAD_BUTTON = {
  label: "Download FroYo",
  url: "https://github.com/Emekalim/FroYoflix_v2/releases/latest",
};

export function buildWatchingActivity({
  nowPlaying,
  paused,
  currentTime,
  duration,
  w2gCode,
}) {
  const details = nowPlaying.title || undefined;
  const timeLeft = duration - currentTime;
  const timestamps = !paused
    ? {
        start: Date.now() - (currentTime > 0 ? currentTime * 1_000 : 0),
        end: Date.now() + timeLeft * 1_000,
      }
    : undefined;
  const activity = {
    details,
    state:
      details &&
      (nowPlaying.media?.format === "MOVIE" &&
      (nowPlaying.media?.episodes ?? 0) <= 1
        ? "The Movie"
        : nowPlaying.episode
          ? "Episode: " +
            nowPlaying.episode +
            (nowPlaying.media?.episodes
              ? " of " + nowPlaying.media.episodes
              : "")
          : "Streaming the Universe"),
    timestamps,
    party: {
      size:
        (nowPlaying.episode &&
          nowPlaying.media?.episodes && [
            nowPlaying.episode,
            nowPlaying.media.episodes,
          ]) ||
        undefined,
    },
    assets: {
      large_text: nowPlaying.title,
      large_image: nowPlaying.thumbnail,
      small_image: !paused ? "playing" : "paused",
      small_text: !paused ? "Playing" : "Paused",
    },
    instance: true,
    type: 3,
  };
  // cannot have buttons and secrets at once
  if (w2gCode) {
    activity.secrets = {
      join: w2gCode,
      match: w2gCode + "m",
    };
    activity.party.id = w2gCode + "p";
  } else {
    activity.buttons = [
      {
        label: "Watch on FroYo",
        url: `froyo://anime/${nowPlaying.media?.id}`,
      },
      DOWNLOAD_BUTTON,
    ];
  }
  return activity;
}

export function buildBrowsingActivity() {
  return {
    timestamps: { start: Date.now() },
    details: "Streaming anime instantly",
    state: "Exploring the anime library...",
    assets: {
      large_image: "icon",
      large_text: "https://github.com/Emekalim/FroYoflix_v2",
      small_image: "searching",
      small_text: "Browsing anime on FroYo",
    },
    buttons: [DOWNLOAD_BUTTON],
    instance: true,
    type: 3,
  };
}
