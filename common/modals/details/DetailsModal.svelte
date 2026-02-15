<script>
  import { onDestroy } from "svelte";
  import {
    formatMap,
    genreIcons,
    getEpisodeMetadataForMedia,
    getKitsuMappings,
    getMediaMaxEp,
    playMedia,
  } from "@/modules/anime/anime.js";
  import { openTorrentModal } from "@/modals/torrent/TorrentModal.svelte";
  import { copyToClipboard } from "@/modules/clipboard.js";
  import { settings } from "@/modules/settings.js";
  import { mediaCache } from "@/modules/cache.js";
  import { add } from "@/modules/torrent.js";
  import { anilistClient } from "@/modules/anilist.js";
  import { isValidNumber } from "@/modules/util.js";
  import { click } from "@/modules/click.js";
  import { fetchTMDBTVDetails } from "@/modules/sections.js";
  import Details from "@/modals/details/components/Details.svelte";
  import EpisodeList from "@/modals/details/components/EpisodeList.svelte";
  import ToggleList from "@/modals/details/components/ToggleList.svelte";
  import Scoring from "@/components/Scoring.svelte";
  import TMDBScoring from "@/components/TMDBScoring.svelte";
  import TrailerModal from "@/modals/TrailerModal.svelte";
  import { getProgress } from "@/modules/tmdb/tmdb-progress.js";
  import {
    fetchRecommendations,
    fetchExternalIds,
    getTMDBUrl,
    getIMDbUrl,
  } from "@/modules/tmdb/tmdb-api.js";
  import SmartImage from "@/components/visual/SmartImage.svelte";
  import AudioLabel from "@/components/AudioLabel.svelte";
  import Following from "@/modals/details/components/Following.svelte";
  import { IPC } from "@/modules/bridge.js";
  import SmallCard from "@/components/cards/SmallCard.svelte";
  import SmallCardSk from "@/components/skeletons/SmallCardSk.svelte";
  import Helper from "@/modules/helper.js";
  import { modal } from "@/modules/navigation.js";
  import DOMPurify from "dompurify";
  import { marked } from "marked";
  import {
    Clapperboard,
    Users,
    Heart,
    Play,
    Timer,
    TrendingUp,
    Tv,
    Hash,
    ArrowDown01,
    ArrowUp10,
  } from "lucide-svelte";

  $: view = $modal[modal.ANIME_DETAILS]?.data;
  function close() {
    modal.close(modal.ANIME_DETAILS);
  }

  let _modal;
  let container = null;
  let scrollTags = null;
  let scrollGenres = null;
  let staticMedia;
  $: media = mediaCache.value[view?.id] || view;
  $: {
    if (media && (!staticMedia || staticMedia?.id !== media?.id)) {
      staticMedia = media;
      seasonFilter = 1; // Reset season filter when media changes
    } else if (!media && staticMedia) staticMedia = null;
  }
  mediaCache.subscribe((value) => {
    if (value && JSON.stringify(value[media?.id]) !== JSON.stringify(media))
      media = value[media?.id];
  });

  // Fetch TMDB TV details when TMDB TV show opens to get accurate episode count
  $: if (
    staticMedia?.source === "TMDB" &&
    staticMedia?.format === "TV" &&
    !staticMedia?._detailsFetched
  ) {
    fetchTMDBTVDetails(staticMedia.tmdbId).then((details) => {
      if (details && staticMedia) {
        staticMedia.episodes = details.episodes;
        staticMedia.totalEpisodes = details.totalEpisodes;
        staticMedia.seasons = details.seasons;
        staticMedia._detailsFetched = true;
        // Update cache with the fetched details
        import("@/modules/cache.js").then(({ cache }) => {
          cache.updateMedia([staticMedia]);
        });
      }
    });
  }

  // Lazy-fetch TMDB trailer when modal opens
  $: if (
    staticMedia?.source === "TMDB" &&
    !staticMedia?.trailer?.id &&
    !staticMedia?._trailerFetched
  ) {
    (async () => {
      staticMedia._trailerFetched = true;
      const { fetchTMDBVideos } = await import("@/modules/sections.js");
      const trailer = await fetchTMDBVideos(
        staticMedia.tmdbId,
        staticMedia.format,
      );
      if (trailer?.id && staticMedia) {
        staticMedia = { ...staticMedia, trailer };
        // Update cache with the fetched trailer
        import("@/modules/cache.js").then(({ cache }) => {
          cache.updateMedia([staticMedia]);
        });
      }
    })();
  }

  $: episodeOrder = !!staticMedia;

  // TMDB progress tracking
  let tmdbProgress = null;
  $: if (staticMedia?.source === "TMDB" && staticMedia?.tmdbId) {
    getProgress(staticMedia.tmdbId).then((progress) => {
      tmdbProgress = progress;
    });
  }

  $: watched =
    media &&
    ((media?.source !== "TMDB" &&
      media?.mediaListEntry?.status === "COMPLETED") ||
      (media?.source === "TMDB" && tmdbProgress?.status === "COMPLETED"));
  $: userProgress =
    media &&
    ((media?.source !== "TMDB" &&
      ["CURRENT", "REPEATING", "PAUSED", "DROPPED"].includes(
        media?.mediaListEntry?.status,
      ) &&
      media?.mediaListEntry?.progress) ||
      (media?.source === "TMDB" && tmdbProgress?.progress));
  $: missingIds = staticMedia && [];
  $: recommendations =
    staticMedia &&
    staticMedia?.id &&
    staticMedia?.source !== "TMDB" &&
    anilistClient.recommendations({ id: staticMedia.id });

  // TMDB recommendations
  let tmdbRecommendations = [];
  let tmdbExternalIds = null;
  $: if (staticMedia?.source === "TMDB" && staticMedia?.tmdbId) {
    tmdbRecommendations = []; // Clear previous recommendations immediately
    const currentTmdbId = staticMedia.tmdbId;
    fetchRecommendations(
      currentTmdbId,
      staticMedia.format === "TV" ? "tv" : "movie",
    ).then((recs) => {
      // Prevent race condition: ensure we are still looking at the same media
      if (staticMedia?.tmdbId !== currentTmdbId) return;

      // Update cache so SmallCard can find the data IMMEDIATELY
      if (recs && recs.length > 0) {
        // Create a map of IDs to media objects
        const updateMap = {};
        recs.forEach((rec) => {
          updateMap[rec.id] = rec;
        });
        // Merge into existing cache synchronously
        mediaCache.update((currentCache) => ({
          ...currentCache,
          ...updateMap,
        }));
      }
      // Set local state matching the items we just put in cache
      tmdbRecommendations = recs;
    });
    const currentTmdbIdExt = staticMedia.tmdbId;
    fetchExternalIds(
      currentTmdbIdExt,
      staticMedia.format === "TV" ? "tv" : "movie",
    ).then((ids) => {
      if (staticMedia?.tmdbId !== currentTmdbIdExt) return;
      tmdbExternalIds = ids;
    });
  }
  $: searchIDS =
    staticMedia &&
    staticMedia?.id &&
    (async () => {
      // For TMDB sources, skip relations and recommendations lookup
      if (staticMedia?.source === "TMDB") {
        return Promise.resolve([]);
      }
      const recommendationsData = await recommendations;
      const searchIDS = [
        ...(staticMedia?.relations?.edges
          ?.filter(({ node }) => node.type === "ANIME")
          .map(({ node }) => node.id) || []),
        ...(recommendationsData?.data?.Media?.recommendations?.edges?.map(
          ({ node }) => node.mediaRecommendation?.id,
        ) || []),
      ];
      if (searchIDS.length === 0) {
        missingIds = searchIDS.filter((id) => !mediaCache.value[id]);
        return Promise.resolve([]);
      }
      const result = await anilistClient.searchAllIDS({
        page: 1,
        perPage: 50,
        id: searchIDS,
      });
      missingIds = searchIDS.filter((id) => !mediaCache.value[id]);
      return Promise.resolve({
        ...result,
        data: {
          ...result.data,
          Page: {
            ...result.data.Page,
            media: (result?.data?.Page?.media || []).filter(
              (media) => mediaCache.value[media.id],
            ),
          },
        },
      });
    })();
  $: staticMedia &&
    (_modal?.focus(),
    container && container.scrollTo({ top: 0, behavior: "smooth" }));
  $: staticMedia &&
    modal.length === 1 &&
    $modal[modal.ANIME_DETAILS] &&
    _modal?.focus();
  $: {
    if (staticMedia) {
      if (scrollTags) scrollTags.scrollLeft = 0;
      if (scrollGenres) scrollGenres.scrollLeft = 0;
    }
  }
  function checkClose({ keyCode }) {
    if (keyCode === 27) close();
  }
  function play(media, episode, force = false) {
    if (!media) return;
    if (isValidNumber(episode))
      return openTorrentModal(media, episode, force, seasonFilter);
    if (media.status === "NOT_YET_RELEASED") return;
    playMedia(media);
  }
  function getPlayButtonText(media) {
    if (media?.source !== "TMDB" && media?.mediaListEntry) {
      const { status, progress } = media.mediaListEntry;
      if (progress) {
        if (status === "COMPLETED") {
          return "Rewatch Now";
        } else {
          return "Continue Now";
        }
      }
    }
    return "Watch Now";
  }
  $: playButtonText = getPlayButtonText(media);
  function toggleFavourite() {
    media.isFavourite = anilistClient.favourite({ id: media.id });
  }

  function handlePlay(id, episode, torrentOnly) {
    const cachedMedia = mediaCache.value[id];
    if (!cachedMedia) return;
    const cachedEpisode = isValidNumber(episode)
      ? episode
      : cachedMedia?.source !== "TMDB" && cachedMedia?.mediaListEntry?.progress;
    const desiredEpisode = isValidNumber(episode)
      ? episode
      : cachedEpisode && cachedEpisode !== 0
        ? cachedEpisode + 1
        : cachedEpisode;
    if (torrentOnly) {
      if (desiredEpisode) return openTorrentModal(cachedMedia, desiredEpisode);
      if (cachedMedia?.status === "NOT_YET_RELEASED") return;
      playMedia(cachedMedia);
    } else play(cachedMedia, desiredEpisode);
  }

  IPC.on("play-media", (id, episode, torrentOnly) => {
    handlePlay(id, episode, torrentOnly);
  });

  window.addEventListener("play-media", (event) => {
    const { id, episode, torrentOnly } = event.detail;
    handlePlay(id, episode, torrentOnly);
  });

  window.addEventListener("play-torrent", (event) =>
    add(event.detail.magnet, null, null, null, event.detail.base64),
  );

  IPC.on("play-torrent", (detail) =>
    add(detail.magnet, null, null, null, detail.base64),
  );

  function sanitize(body) {
    if (!body) return "";
    const cleanBody = body
      .trim()
      .replace(/\.\.+(?=\s*$)/gm, ".") // Remove excessive trailing "..."
      .replace(/\n/g, "<br>") // Convert all \n to <br>
      .replace(/(<br\s*\/?>){2,}/gi, "<br><br>") // Then collapse 2+ <br> to exactly 2
      .replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, ""); // Remove any prepended or appended <br>.
    return DOMPurify.sanitize(
      marked
        .parse(cleanBody, {
          pedantic: false,
          breaks: true,
          gfm: true,
        })
        .trim(),
      {
        ALLOWED_TAGS: [
          "p",
          "br",
          "span",
          "div",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "strong",
          "em",
          "b",
          "i",
          "u",
          "s",
          "del",
          "ins",
          "mark",
          "ul",
          "ol",
          "li",
          "blockquote",
          "code",
          "pre",
          "a",
          "img",
          "table",
          "thead",
          "tbody",
          "tfoot",
          "tr",
          "th",
          "td",
          "hr",
          "details",
          "summary",
          "input",
        ],
        ALLOWED_ATTR: [
          "href",
          "target",
          "rel",
          "title",
          "src",
          "alt",
          "width",
          "height",
          "class",
          "id",
          "align",
          "type",
          "checked",
          "disabled",
        ],
      },
    );
  }

  let episodeList = [];
  let episodeLoad;
  let seasonFilter = 1; // Default to season 1 for TMDB TV shows
  $: if (episodeLoad) {
    episodeLoad.then((episodes) => {
      episodeList = episodes;
    });
  }

  let resizeObserver;
  let leftColumn, rightColumn;
  function syncHeights() {
    if (leftColumn && rightColumn) {
      const leftHeight = leftColumn.offsetHeight;
      if (rightColumn.style.height !== `${leftHeight}px`) {
        rightColumn.style.height = `${leftHeight}px`;
      }
    }
  }

  $: {
    resizeObserver?.disconnect();
    if (staticMedia) {
      resizeObserver = new ResizeObserver(syncHeights);
      if (leftColumn) resizeObserver.observe(leftColumn);
    }
  }

  onDestroy(() => resizeObserver?.disconnect());
</script>

<div
  class="modal modal-full z-50"
  class:show={staticMedia}
  on:keydown={checkClose}
  tabindex="-1"
  role="button"
  bind:this={_modal}
>
  <div
    class="h-full modal-content bg-dark p-0 overflow-y-auto position-relative"
    bind:this={container}
  >
    {#if staticMedia}
      <button
        class="close pointer z-30 bg-dark-light top-20 right-0 position-fixed"
        type="button"
        use:click={() => close()}
      >
        &times;
      </button>
      <SmartImage
        class="w-full cover-img anime-details position-absolute"
        images={[
          staticMedia.bannerImage,
          ...(staticMedia.trailer?.id
            ? [
                `https://i.ytimg.com/vi/${staticMedia.trailer.id}/maxresdefault.jpg`,
                `https://i.ytimg.com/vi/${staticMedia.trailer.id}/hqdefault.jpg`,
              ]
            : []),
          () =>
            getKitsuMappings(staticMedia).then((metadata) => [
              metadata?.included?.[0]?.attributes?.coverImage?.original,
              metadata?.included?.[0]?.attributes?.coverImage?.large,
              metadata?.included?.[0]?.attributes?.coverImage?.small,
              metadata?.included?.[0]?.attributes?.coverImage?.tiny,
            ]),
          () =>
            getEpisodeMetadataForMedia(staticMedia).then(
              (metadata) => metadata?.[1]?.image,
            ),
        ]}
      />
      <div class="row px-20">
        <div class="col-lg-7 col-12 pb-10">
          <div bind:this={leftColumn}>
            <div
              class="d-flex flex-sm-row flex-column align-items-sm-end pb-20 mb-15"
            >
              <div
                class="cover d-flex flex-row align-items-sm-end align-items-center justify-content-center mw-full mb-sm-0 mb-20 w-full"
                style="max-height: 50vh;"
              >
                <div class="position-relative h-full">
                  <SmartImage
                    class="rounded cover-img overflow-hidden h-full w-full"
                    color={media.coverImage.color || "var(--tertiary-color)"}
                    images={[
                      staticMedia.coverImage?.extraLarge,
                      staticMedia.coverImage?.medium,
                      "./404_cover.png",
                    ]}
                  />
                  <AudioLabel media={staticMedia} viewAnime={true} />
                </div>
              </div>
              <div class="pl-sm-20 ml-sm-20">
                <h1
                  class="font-weight-very-bold text-white select-all mb-0 font-scale-40"
                >
                  {anilistClient.title(staticMedia)}
                </h1>
                <div class="d-flex flex-row font-size-18 flex-wrap mt-5">
                  {#if staticMedia.averageScore}
                    <div
                      class="d-flex flex-row mt-10"
                      title="{staticMedia.averageScore /
                        10} by {anilistClient.reviews(staticMedia)} reviews"
                    >
                      <TrendingUp class="mx-10" size="2.2rem" />
                      <span class="mr-20">
                        Rating: {staticMedia.averageScore + "%"}
                      </span>
                    </div>
                  {/if}
                  {#if staticMedia.format}
                    <div class="d-flex flex-row mt-10">
                      <Tv class="mx-10" size="2.2rem" />
                      <span class="mr-20 text-capitalize">
                        Format: {formatMap[staticMedia.format]}
                      </span>
                    </div>
                  {/if}
                  {#if staticMedia.episodes !== 1}
                    {@const maxEp = getMediaMaxEp(staticMedia)}
                    <div class="d-flex flex-row mt-10">
                      <Clapperboard class="mx-10" size="2.2rem" />
                      <span class="mr-20">
                        Episodes: {maxEp && maxEp !== 0 ? maxEp : "?"}
                      </span>
                    </div>
                  {:else if staticMedia.duration}
                    <div class="d-flex flex-row mt-10">
                      <Timer class="mx-10" size="2.2rem" />
                      <span class="mr-20">
                        Length: {staticMedia.duration + " min"}
                      </span>
                    </div>
                  {/if}
                  {#if staticMedia?.source !== "TMDB" && staticMedia.averageScore && staticMedia.stats?.scoreDistribution}
                    <div class="d-flex flex-row mt-10">
                      <Users class="mx-10" size="2.2rem" />
                      <span
                        class="mr-20"
                        title="{staticMedia.averageScore /
                          10} by {anilistClient.reviews(staticMedia)} reviews"
                      >
                        Reviews: {anilistClient.reviews(staticMedia)}
                      </span>
                    </div>
                  {/if}
                </div>
                <div class="d-flex flex-row flex-wrap play">
                  <button
                    class="btn btn-lg btn-secondary w-250 text-dark font-weight-bold shadow-none border-0 d-flex align-items-center justify-content-center mr-20 mt-20"
                    use:click={() => play(media)}
                    disabled={staticMedia.status === "NOT_YET_RELEASED"}
                  >
                    <Play class="mr-10" fill="currentColor" size="1.6rem" />
                    {playButtonText}
                  </button>
                  <div class="mt-20 d-flex">
                    {#if staticMedia?.source === "TMDB"}
                      <TMDBScoring class="mr-10" {media} viewAnime={true} />
                    {:else if Helper.isAuthorized()}
                      <Scoring class="mr-10 " {media} viewAnime={true} />
                    {/if}
                    {#if Helper.isAniAuth()}
                      <button
                        class="btn bg-dark-light btn-lg btn-square d-flex align-items-center justify-content-center shadow-none border-0 mr-10"
                        data-toggle="tooltip"
                        data-placement="top"
                        data-target-breakpoint="md"
                        data-title={media.isFavourite
                          ? "Unfavourite"
                          : "Favourite"}
                        use:click={toggleFavourite}
                        disabled={!Helper.isAniAuth()}
                      >
                        <div
                          class="favourite d-flex align-items-center justify-content-center"
                          title={media.isFavourite
                            ? "Unfavourite"
                            : "Favourite"}
                        >
                          <Heart
                            color={media.isFavourite
                              ? "var(--tertiary-color)"
                              : "currentColor"}
                            fill={media.isFavourite
                              ? "var(--tertiary-color)"
                              : "transparent"}
                            size="1.7rem"
                          />
                        </div>
                      </button>
                    {/if}
                    <TrailerModal {staticMedia} />
                    <button
                      class="btn bg-dark-light btn-lg btn-square d-none align-items-center justify-content-center shadow-none border-0 mr-10"
                      class:d-flex={staticMedia.id}
                      data-toggle="tooltip"
                      data-placement="top"
                      data-target-breakpoint="md"
                      data-title="Share to Clipboard"
                      use:click={() =>
                        copyToClipboard(
                          `https://anilist.co/anime/${staticMedia.id}`,
                          "share URL",
                        )}
                      on:contextmenu|preventDefault={() =>
                        IPC.emit(
                          "open",
                          `https://anilist.co/anime/${staticMedia.id}`,
                        )}
                    >
                      <img
                        class="rounded w-20"
                        src="./anilist_icon.png"
                        alt="Anilist"
                      />
                    </button>
                    <button
                      class="btn bg-dark-light btn-lg btn-square d-none align-items-center justify-content-center shadow-none border-0"
                      class:d-flex={staticMedia.idMal}
                      data-toggle="tooltip"
                      data-placement="top"
                      data-target-breakpoint="md"
                      data-title="Share to Clipboard"
                      use:click={() =>
                        copyToClipboard(
                          `https://myanimelist.net/anime/${staticMedia.idMal}`,
                          "share URL",
                        )}
                      on:contextmenu|preventDefault={() =>
                        IPC.emit(
                          "open",
                          `https://myanimelist.net/anime/${staticMedia.idMal}`,
                        )}
                    >
                      <img
                        class="rounded w-20"
                        src="./myanimelist_icon.png"
                        alt="MyAnimeList"
                      />
                    </button>
                    {#if staticMedia?.source === "TMDB" && staticMedia?.tmdbId}
                      <button
                        class="btn bg-dark-light btn-lg btn-square d-flex align-items-center justify-content-center shadow-none border-0 mr-10"
                        data-toggle="tooltip"
                        data-placement="top"
                        data-target-breakpoint="md"
                        data-title="TMDB Page"
                        use:click={() =>
                          copyToClipboard(
                            getTMDBUrl(
                              staticMedia.tmdbId,
                              staticMedia.format === "TV" ? "tv" : "movie",
                            ),
                            "TMDB URL",
                          )}
                        on:contextmenu|preventDefault={() =>
                          IPC.emit(
                            "open",
                            getTMDBUrl(
                              staticMedia.tmdbId,
                              staticMedia.format === "TV" ? "tv" : "movie",
                            ),
                          )}
                      >
                        <span
                          class="font-weight-bold"
                          style="font-size: 0.9rem;">TMDB</span
                        >
                      </button>
                      {#if tmdbExternalIds?.imdbId}
                        <button
                          class="btn bg-dark-light btn-lg btn-square d-flex align-items-center justify-content-center shadow-none border-0"
                          data-toggle="tooltip"
                          data-placement="top"
                          data-target-breakpoint="md"
                          data-title="IMDb Page"
                          use:click={() =>
                            copyToClipboard(
                              getIMDbUrl(tmdbExternalIds.imdbId),
                              "IMDb URL",
                            )}
                          on:contextmenu|preventDefault={() =>
                            IPC.emit(
                              "open",
                              getIMDbUrl(tmdbExternalIds.imdbId),
                            )}
                        >
                          <span
                            class="font-weight-bold"
                            style="font-size: 0.9rem;">IMDb</span
                          >
                        </button>
                      {/if}
                    {/if}
                  </div>
                </div>
                <Following media={staticMedia} />
              </div>
            </div>
            {#if staticMedia}
              <Details media={staticMedia} alt={recommendations} />
            {/if}
            <div
              bind:this={scrollTags}
              class="m-0 px-20 pb-0 pt-10 d-flex flex-row text-nowrap overflow-x-scroll text-capitalize align-items-start"
            >
              {#each staticMedia.tags as tag}
                <div
                  class="bg-dark-light px-20 py-10 mr-10 rounded text-nowrap d-flex align-items-center"
                >
                  <Hash class="mr-5" size="1.8rem" /><span
                    class="font-weight-bolder select-all">{tag.name}</span
                  ><span class="font-weight-light">: {tag.rank}%</span>
                </div>
              {/each}
            </div>
            <div
              bind:this={scrollGenres}
              class="m-0 px-20 pb-0 pt-10 d-flex flex-row text-nowrap overflow-x-scroll text-capitalize align-items-start"
            >
              {#each staticMedia.genres as genre}
                <div
                  class="bg-dark-light px-20 py-10 mr-10 rounded text-nowrap d-flex align-items-center select-all"
                >
                  <svelte:component
                    this={genreIcons[genre]}
                    class="mr-5"
                    size="1.8rem"
                  />
                  {genre}
                </div>
              {/each}
            </div>
            {#if staticMedia.description}
              <div
                class="w-full d-flex flex-row align-items-center pt-20 mt-10"
              >
                <hr class="w-full" />
                <div
                  class="font-size-18 font-weight-semi-bold px-20 text-white"
                >
                  Synopsis
                </div>
                <hr class="w-full" />
              </div>
              <div class="font-size-16 pt-20 select-all">
                {@html sanitize(staticMedia.description)}
              </div>
            {/if}
            {#if episodeList?.length}
              <div
                class="w-full d-flex d-lg-none flex-row align-items-center pt-20 mt-10 pointer"
                aria-hidden="true"
              >
                <hr class="w-full" />
                <div
                  class="position-absolute d-flex align-items-center gap-10"
                  style="left: 50%; transform: translateX(-50%);"
                >
                  {#if staticMedia?.source === "TMDB" && staticMedia?.format === "TV"}
                    <span
                      class="font-size-12 font-weight-semi-bold text-white text-nowrap"
                      >Season:</span
                    >
                    <select bind:value={seasonFilter} class="season-select">
                      {#each Array.from({ length: staticMedia?.seasons || 1 }, (_, i) => i + 1) as season}
                        <option value={season}>{season}</option>
                      {/each}
                    </select>
                  {:else}
                    <span
                      class="font-size-18 font-weight-semi-bold px-20 text-white"
                      >Episodes</span
                    >
                  {/if}
                </div>
                <hr class="w-full" />
                <div
                  class="ml-auto pl-20 font-size-12 more text-muted text-nowrap pr-20 pointer"
                  use:click={() => {
                    episodeOrder = !episodeOrder;
                  }}
                >
                  Reverse
                </div>
              </div>
            {/if}
            <div class="col-lg-5 col-12 d-lg-none flex-column mt-20">
              <EpisodeList
                bind:episodeList
                mobileList={true}
                media={staticMedia}
                {episodeOrder}
                {seasonFilter}
                bind:userProgress
                bind:watched
                episodeCount={getMediaMaxEp(media)}
                {play}
                class="h-600"
              />
            </div>
            <div class="d-lg-block">
              {#if staticMedia?.source !== "TMDB" && staticMedia.relations?.edges?.length}
                <ToggleList
                  list={staticMedia.relations?.edges
                    ?.filter(
                      ({ node, relationType }) =>
                        relationType !== "CHARACTER" &&
                        node.type === "ANIME" &&
                        node.format !== "MUSIC" &&
                        !(settings.value.adult === "none" && node.isAdult) &&
                        !(
                          settings.value.adult !== "hentai" &&
                          node.genres?.includes("Hentai")
                        ) &&
                        !missingIds.includes(node.id),
                    )
                    .sort(
                      (a, b) =>
                        (a.node.seasonYear || Infinity) -
                        (b.node.seasonYear || Infinity),
                    )}
                  promise={searchIDS}
                  let:item
                  let:promise
                  title="Relations"
                >
                  {#await promise}
                    <div class="small-card">
                      <SmallCardSk />
                    </div>
                  {:then res}
                    {#if res}
                      <div class="small-card">
                        <SmallCard
                          data={item.node}
                          type={item.relationType
                            .replace(/_/g, " ")
                            .toLowerCase()}
                        />
                      </div>
                    {/if}
                  {/await}
                </ToggleList>
              {/if}
              {#if staticMedia?.source === "TMDB" && tmdbRecommendations.length > 0}
                <ToggleList
                  list={tmdbRecommendations}
                  title="Recommendations"
                  promise={Promise.resolve()}
                  let:item
                >
                  <div class="small-card">
                    <SmallCard data={item} />
                  </div>
                </ToggleList>
              {:else if staticMedia?.source !== "TMDB"}
                {#await recommendations then res}
                  {@const media = res?.data?.Media}
                  {#if media}
                    <ToggleList
                      list={media.recommendations?.edges
                        ?.filter(
                          ({ node }) =>
                            node.mediaRecommendation &&
                            !(
                              settings.value.adult === "none" &&
                              node.mediaRecommendation.isAdult
                            ) &&
                            !(
                              settings.value.adult !== "hentai" &&
                              node.mediaRecommendation.genres?.includes(
                                "Hentai",
                              )
                            ) &&
                            !missingIds.includes(node.mediaRecommendation.id),
                        )
                        .sort((a, b) => b.node.rating - a.node.rating)}
                      promise={searchIDS}
                      let:item
                      let:promise
                      title="Recommendations"
                    >
                      {#await promise}
                        <div class="small-card">
                          <SmallCardSk />
                        </div>
                      {:then res}
                        {#if res}
                          <div class="small-card">
                            <SmallCard
                              data={item.node.mediaRecommendation}
                              type={item.node.rating}
                            />
                          </div>
                        {/if}
                      {/await}
                    </ToggleList>
                  {/if}
                {/await}
              {/if}
            </div>
          </div>
        </div>
        <div
          class="col-lg-5 col-12 d-none d-lg-flex flex-column pl-lg-20"
          bind:this={rightColumn}
        >
          {#if staticMedia?.source === "TMDB" && staticMedia?.format === "TV"}
            <div class="d-flex flex-row align-items-center mb-20 gap-15">
              <label
                for="season-select"
                class="font-weight-semi-bold text-white text-nowrap mb-0"
                >Select Season:</label
              >
              <select
                id="season-select"
                bind:value={seasonFilter}
                class="season-select"
              >
                {#each Array.from({ length: staticMedia?.seasons || 1 }, (_, i) => i + 1) as season}
                  <option value={season}>Season {season}</option>
                {/each}
              </select>
            </div>
          {/if}
          <button
            class="close order pointer z-30 bg-dark-light position-absolute"
            class:d-none={!episodeList?.length}
            data-toggle="tooltip"
            data-placement="top"
            data-target-breakpoint="md"
            data-title="Reverse Episodes"
            use:click={() => {
              episodeOrder = !episodeOrder;
            }}
          >
            <svelte:component
              this={episodeOrder ? ArrowDown01 : ArrowUp10}
              size="2rem"
            />
          </button>
          <EpisodeList
            bind:episodeLoad
            media={staticMedia}
            {episodeOrder}
            {seasonFilter}
            bind:userProgress
            bind:watched
            episodeCount={getMediaMaxEp(media)}
            {play}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .close {
    top: 5rem !important;
    left: unset !important;
    right: 3rem !important;
  }
  .order {
    top: 7rem !important;
    left: -5rem !important;
  }
  .play {
    justify-content: center;
  }
  @media (min-width: 577px) {
    .cover {
      max-width: 35% !important;
    }
    .play {
      justify-content: left;
    }
  }
  .row {
    padding-top: 12rem !important;
  }

  select {
    background-color: var(--bs-dark) !important;
    color: white !important;
    border: 1px solid var(--bs-dark-border-subtle) !important;
    padding: 0.375rem 0.75rem !important;
    border-radius: 0.25rem !important;
  }

  select option {
    background-color: var(--bs-dark) !important;
    color: white !important;
  }

  .season-select {
    background-color: var(--bs-dark) !important;
    color: white !important;
    border: 2px solid var(--bs-info) !important;
    border-radius: 6px !important;
    padding: 0.5rem 0.75rem !important;
    cursor: pointer !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 2px 8px rgba(0, 150, 200, 0.15) !important;
    min-width: 140px !important;
    font-weight: 500 !important;
  }

  .season-select:hover {
    border-color: var(--bs-info) !important;
    box-shadow: 0 4px 12px rgba(0, 150, 200, 0.3) !important;
  }

  .season-select:focus {
    outline: none !important;
    border-color: var(--bs-info) !important;
    box-shadow: 0 0 0 3px rgba(0, 150, 200, 0.25) !important;
  }
  @media (min-width: 769px) {
    .row {
      padding: 0 10rem;
    }
  }
  .cover {
    aspect-ratio: 7/10;
  }
</style>
