<script context="module">
  import SoftModal from "@/components/modals/SoftModal.svelte";
  import TorrentResults from "@/modals/torrent/components/TorrentResults.svelte";
  import { findInCurrent } from "@/components/MediaHandler.svelte";
  import { page, modal } from "@/modules/navigation.js";

  export function openTorrentModal(
    media,
    episode = 1,
    force = false,
    season = undefined,
  ) {
    episode = Number(episode);
    episode = isNaN(episode) ? 1 : episode;

    // Extract season from media object if not explicitly provided
    // For TV shows, try to get season from media.season or media.currentSeason
    const seasonNumber = season || media?.season || media?.currentSeason;

    console.log("[TorrentModal] openTorrentModal called with:", {
      episode,
      season,
      "media.format": media?.format
    });

    if (!force && findInCurrent({ media, episode })) {
      page.navigateTo(page.PLAYER);
      return;
    }
    modal.open(modal.TORRENT_MENU, { media, episode, season: seasonNumber });
  }
</script>

<script>
  function close() {
    modal.close(modal.TORRENT_MENU);
  }
</script>

<SoftModal
  class="m-0 w-full wm-1150 h-full rounded bg-very-dark pt-0 mx-20"
  bind:showModal={$modal[modal.TORRENT_MENU]}
  {close}
  id={modal.TORRENT_MENU}
>
  <TorrentResults search={modal.value[modal.TORRENT_MENU].data} {close} />
</SoftModal>
