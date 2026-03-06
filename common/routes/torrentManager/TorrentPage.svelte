<script context="module">
  import { writable } from "simple-store-svelte";
  import { click } from "@/modules/click.js";
  import WPC from "@/modules/wpc.js";
  import { matchPhrase } from "@/modules/util.js";
  import { settings } from "@/modules/settings.js";
  import { status } from "@/modules/networking.js";
  import {
    loadedTorrent,
    completedTorrents,
    seedingTorrents,
    stagingTorrents,
  } from "@/modules/torrent.js";
  import {
    activeRepairs,
    queuedRepairs,
    completedRepairs,
    repairErrors,
    repairCacheSize,
    clearRepairCache,
    refreshRepairCacheSize,
    initializeJobsStore,
  } from "@/modules/jobs.js";
  import ErrorCard from "@/components/cards/ErrorCard.svelte";
  import ConfirmButton from "@/components/inputs/ConfirmButton.svelte";
  import TorrentCard from "@/routes/torrentManager/components/TorrentCard.svelte";
  import RepairCard from "@/routes/torrentManager/components/RepairCard.svelte";
  import {
    Search,
    RefreshCw,
    TriangleAlert,
    Package,
    Percent,
    Activity,
    Scale,
    Gauge,
    CloudDownload,
    CloudUpload,
    Sprout,
    Magnet,
    Timer,
    Trash2,
  } from "lucide-svelte";

  const rescanning = writable(true);
  WPC.listen("rescan_done", () => (rescanning.value = false));
</script>

<script>
  export let miniplayerPadding = "";

  import { onMount, onDestroy } from "svelte";
  import { toast } from "svelte-sonner";

  let searchText = "";
  let filteredLoaded = false;
  let filteredStaging = [];
  let filteredSeeding = [];
  let filteredCompleted = [];
  let disableRescan = false;
  let foundResults = true;
  let activeTab = "downloads";
  let clearingCache = false;

  let cacheInterval;

  onMount(() => {
    initializeJobsStore();
    // refresh the cache size periodically to reflect new repairs
    cacheInterval = setInterval(refreshRepairCacheSize, 5000);
  });

  onDestroy(() => {
    if (cacheInterval) clearInterval(cacheInterval);
  });

  async function handleClearCache() {
    clearingCache = true;
    try {
      const res = await clearRepairCache();
      if (res.success) {
        toast.success("Cache Cleared", {
          description: `Successfully cleared ${res.count} repaired file(s).`,
        });
      } else {
        toast.error("Failed to clear cache", { description: res.error });
      }
    } finally {
      clearingCache = false;
    }
  }

  function filterResults(results, searchText) {
    const dedupe = results.filter(
      (torrent, index, arr) =>
        arr.findIndex((_torrent) => _torrent.infoHash === torrent.infoHash) ===
        index,
    );
    if (!searchText?.length) return dedupe;
    return (
      dedupe.filter(({ name }) =>
        matchPhrase(searchText, name, 0.4, false, true),
      ) || []
    );
  }

  // Consolidated reactive block: compute all filtered results together
  $: {
    filteredLoaded = matchPhrase(
      searchText,
      $loadedTorrent?.name,
      0.4,
      false,
      true,
    );
    filteredStaging = filterResults($stagingTorrents, searchText) || [];
    filteredSeeding = filterResults($seedingTorrents, searchText) || [];
    filteredCompleted = filterResults($completedTorrents, searchText) || [];
  }

  // Separate reactive block: disableRescan depends on store state
  $: disableRescan =
    $seedingTorrents?.length + $stagingTorrents?.length + 1 >=
      settings.value.seedingLimit && !settings.value.torrentPersist;

  // Derived reactive block: foundResults depends on computed filter variables
  $: foundResults =
    activeTab === "repairs"
      ? $activeRepairs?.length > 0 || $queuedRepairs?.length > 0
      : !(
          searchText?.length &&
          !filteredLoaded &&
          !filteredStaging.length &&
          !filteredSeeding.length &&
          !filteredCompleted.length
        );
</script>

<div
  class="bg-dark h-full w-full root status-transition {$$restProps.class}"
  class:pt-safe-area={$$restProps.class && !$status.match(/offline/i)}
  style={miniplayerPadding}
>
  <div
    class="w-full status-transition"
    class:pt-28px={$$restProps.class && !$status.match(/offline/i)}
  >
    <div class="d-flex align-items-center mb-10 w-full" style="padding-left: {$$restProps.class ? '20px' : '0'};">
      <h4 class="font-weight-bold m-0" style="white-space: nowrap;">Jobs Dashboard</h4>
      {#if activeTab === 'repairs'}
        <div style="position: fixed; right: 20px; top: 50px; display: flex; align-items: center; gap: 12px; z-index: 1000;">
          <span class="text-muted text-nowrap" style="height: 2rem; display: flex; align-items: center; flex: 0 0 auto; align-self: flex-start;">Repair Cache Size: {($repairCacheSize / (1024 * 1024)).toFixed(2)} MB</span>
          <div style="position: relative; width: 120px;">
            <ConfirmButton
              click={handleClearCache}
              confirmText="Yes, Clear"
              confirmClass="btn btn-sm btn-primary"
              cancelText="Cancel"
              cancelClass="btn btn-sm btn-outline-secondary"
              timeout={5000}
              disabled={clearingCache || $repairCacheSize === 0}
              class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center cache-widget-confirm"
              actionClass="cache-action"
              style="padding: 0.375rem 0.75rem; margin: 0; height: 2rem; width: 100%;"
              title="Clear the cache?"
            >
              <Trash2 size="1rem" class="mr-5" />
              Clear
            </ConfirmButton>
          </div>
        </div>
      {/if}
    </div>

    <!-- Tabs -->
    <div class="d-flex mb-20 border-bottom border-dark-light w-full">
      <button
        class="btn btn-transparent font-weight-bold px-20 py-10 rounded-0 d-flex align-items-center"
        class:text-primary={activeTab === "downloads"}
        style="border-bottom: {activeTab === 'downloads'
          ? '2px solid var(--primary-color)'
          : '2px solid transparent'}; border-top: none; border-left: none; border-right: none;"
        on:click={() => (activeTab = "downloads")}
      >
        Downloads
      </button>
      <button
        class="btn btn-transparent font-weight-bold px-20 py-10 rounded-0 d-flex align-items-center"
        class:text-primary={activeTab === "repairs"}
        style="border-bottom: {activeTab === 'repairs'
          ? '2px solid var(--primary-color)'
          : '2px solid transparent'}; border-top: none; border-left: none; border-right: none;"
        on:click={() => (activeTab = "repairs")}
      >
        Repairs
        {#if ($activeRepairs?.length ?? 0) + ($queuedRepairs?.length ?? 0) > 0}
          <span
            class="badge bg-primary text-dark ml-5 px-5 py-0 d-inline-flex align-items-center justify-content-center"
            style="border-radius: 12px; height: 16px;"
            >{($activeRepairs?.length ?? 0) +
              ($queuedRepairs?.length ?? 0)}</span
          >
        {/if}
      </button>
    </div>

    {#if activeTab === "downloads"}
      <div class="d-flex align-items-center">
        <div class="input-group wm-600">
          <Search
            size="2.6rem"
            strokeWidth="2.5"
            class="position-absolute z-10 text-dark-light h-full pl-10 pointer-events-none"
          />
          <input
            type="search"
            class="form-control bg-dark-very-light pl-40 rounded-1 h-40 text-truncate"
            autocomplete="off"
            spellcheck="false"
            data-option="search"
            placeholder="Filter torrents by text, or manually specify one by pasting a magnet link or torrent file"
            disabled={$rescanning}
            bind:value={searchText}
          />
        </div>
        <button
          type="button"
          use:click={() => {
            if (!disableRescan) {
              $rescanning = true;
              window.dispatchEvent(new Event("rescan"));
            }
          }}
          disabled={disableRescan || $rescanning}
          title={disableRescan
            ? "Enable Persist Files or Increase Seeding Limit"
            : $rescanning
              ? "Rescanning Cache..."
              : "Rescan Cache"}
          class="btn btn-primary d-flex align-items-center justify-content-center ml-20 mr-20 font-scale-16 h-full flex-shrink-0"
          class:cursor-wait={$rescanning}
          ><RefreshCw class="mr-10" size="1.8rem" strokeWidth="2.5" /><span
            >Rescan</span
          ></button
        >
      </div>
    {/if}
  </div>
  <div
    class="d-none"
    class:d-inline-block={disableRescan && activeTab === "downloads"}
  >
    <div
      class="alert bg-warning border-warning-dim text-warning-very-dim p-10 pl-15 mt-10 mb-5 d-flex {$$restProps.class
        ? `ml-20`
        : ``}"
    >
      <TriangleAlert class="flex-shrink-0" size="1.8rem" />
      <span class="ml-10"
        >You've reached your pre-download limit. To pre-download more torrents,
        stop seeding some, increase your seeding limit, or enable Persist Files
        in Client Settings.</span
      >
    </div>
  </div>

  <div
    class="d-flex flex-column w-full text-wrap text-break-word font-scale-16 mt-20"
  >
    {#if activeTab === "downloads"}
      <div class="d-flex flex-row mb-10 font-scale-18">
        <div class="font-weight-bold p-5 ml-20 mw-150 flex-1 w-auto">Name</div>
        <div class="font-weight-bold p-5 w-150 d-none d-md-block">
          <span class="d-none d-lg-block">Size</span><Package
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150">
          <span class="d-none d-lg-block">Progress</span><Percent
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150">
          <span class="d-none d-lg-block">Status</span><Activity
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150 d-none d-md-block">
          <span class="d-none d-lg-block">Ratio</span><Scale
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150 d-none d-md-block">
          <span class="d-none d-lg-block">Down Speed</span><CloudDownload
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150 d-block d-md-none">
          <span class="d-none d-lg-block">Speed</span><Gauge
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150 d-none d-md-block">
          <span class="d-none d-lg-block">Up Speed</span><CloudUpload
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150">
          <span class="d-none d-lg-block">Seeders</span><Sprout
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-150 d-none d-md-block">
          <span class="d-none d-lg-block">Leechers</span><Magnet
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-115 d-none d-md-block">
          <span class="d-none d-lg-block">ETA</span><Timer
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 w-40 mr-5 mr-md-20 flex-shrink-0" />
      </div>
      {#if foundResults}
        {#if !searchText?.length || filteredLoaded}
          <TorrentCard
            bind:data={$loadedTorrent}
            current={true}
            {disableRescan}
          />
        {/if}
        {#each filteredStaging as torrent (torrent.infoHash)}
          <TorrentCard data={torrent} {disableRescan} />
        {/each}
        {#each filteredSeeding as torrent (torrent.infoHash)}
          <TorrentCard data={torrent} {disableRescan} />
        {/each}
        {#each filteredCompleted as torrent (torrent.infoHash)}
          <TorrentCard data={torrent} completed={true} {disableRescan} />
        {/each}
      {:else}
        <ErrorCard
          promise={{ errors: [{ message: "found no torrent results" }] }}
        />
      {/if}
    {:else if activeTab === "repairs"}
      <div class="d-flex flex-row mb-10 font-scale-18">
        <div class="font-weight-bold p-5 ml-20 flex-shrink-0" style="width: 400px;">Name</div>
        <div class="font-weight-bold p-5 d-none d-md-flex align-items-center justify-content-center flex-shrink-0" style="width: 80px;">
          <span class="d-none d-lg-block">Status</span><Activity
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div class="font-weight-bold p-5 flex-1 px-20" style="margin-left: 30px;">
          <span class="d-none d-lg-block">Progress</span><Percent
            class="d-lg-none"
            size="2rem"
          />
        </div>
        <div
          class="font-weight-bold d-none d-lg-flex align-items-center"
          style="width: 90px; padding: 0.5rem 0.75rem;"
        >
          Speed
        </div>
        <div
          class="font-weight-bold d-none d-lg-flex align-items-center mr-5 mr-md-20"
          style="width: 110px; padding: 0.5rem 0.75rem;"
        >
          ETA
        </div>
        <div class="font-weight-bold p-5 w-40 mr-5 mr-md-20 flex-shrink-0" />
      </div>
      {#if foundResults}
        <!-- Active repairs -->
        {#each $activeRepairs as repair (repair.id)}
          <RepairCard data={repair} />
        {/each}
        <!-- Queued repairs -->
        {#each $queuedRepairs as repair (repair.id)}
          <RepairCard data={repair} />
        {/each}
        <!-- Failed repairs with error messages -->
        {#if Object.keys($repairErrors).length > 0}
          <div
            class="alert bg-danger border-danger-dim text-danger-very-dim p-10 pl-15 mt-10 mb-5 d-flex"
          >
            <span class="ml-10"
              >Some repairs failed. Please review and retry if needed.</span
            >
          </div>
          {#each Object.entries($repairErrors) as [hash, errorInfo] (hash)}
            <div
              class="alert bg-danger-dim border-danger-dim text-danger-very-dim p-10 pl-15 mt-5 mb-5 d-flex"
            >
              <span class="ml-10">{errorInfo.error}</span>
            </div>
          {/each}
        {/if}
      {:else}
        <ErrorCard
          promise={{ errors: [{ message: "no active repair processes" }] }}
        />
      {/if}
    {/if}
  </div>
</div>

<style>
  :global(.cache-widget-confirm) {
    width: 100% !important;
  }

  :global(.cache-action) {
    position: fixed !important;
    right: 20px;
    top: 20px;
    width: 120px;
    z-index: 2001;
    display: flex !important;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
