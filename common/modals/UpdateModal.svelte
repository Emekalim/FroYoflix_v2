<script context="module">
  import { click } from "@/modules/click.js";
  import { writable } from "simple-store-svelte";
  import { version } from "@/routes/settings/SettingsPage.svelte";
  import { BadgeAlert, ExternalLink } from "lucide-svelte";
  import { SUPPORTS } from "@/modules/support.js";
  import ChangelogSk from "@/components/skeletons/ChangelogSk.svelte";
  import SoftModal from "@/components/modals/SoftModal.svelte";
  import Changelog, {
    changeLog,
    latestVersion,
  } from "@/routes/settings/components/Changelog.svelte";
  import { settings } from "@/modules/settings.js";
  import { page, modal } from "@/modules/navigation.js";
  import { createDeferred } from "@/modules/util.js";
  import { IPC } from "@/modules/bridge.js";
  import {
    updaterState as electronUpdaterState,
    UPDATE_PHASES as ELECTRON_UPDATE_PHASES,
    shouldShowUpdateModal as shouldShowElectronUpdateModal,
  } from "@/modules/updater.js";
  import { toast } from "svelte-sonner";

  const sanitizeVersion = (version) =>
    (version || "").match(/[\d.]+/g)?.join("") || "";
  async function getChangelog(updateVersion) {
    const changelog = await changeLog;
    if (!changelog?.length) return null;
    const updateIndex = changelog.findIndex(
      (entry) =>
        sanitizeVersion(entry.version) === sanitizeVersion(updateVersion),
    );
    if (updateIndex === -1)
      return { entry: changelog[0], previousVersion: null };
    return {
      entry: changelog[updateIndex],
      previousVersion: changelog[updateIndex + 1]?.version || null,
    };
  }

  const androidUpdateState = writable("up-to-date");
  const androidUpdateVersion = writable();
  const androidUpdateProgress = writable(0);
  let lastElectronNotificationKey = "";

  if (!SUPPORTS.isAndroid) {
    electronUpdaterState.subscribe((state) => {
      const shouldNotify =
        settings.value.systemNotify &&
        state.targetVersion &&
        [ELECTRON_UPDATE_PHASES.AVAILABLE, ELECTRON_UPDATE_PHASES.DOWNLOADED].includes(
          state.phase,
        );
      const notificationKey = shouldNotify
        ? `${state.phase}:${state.targetVersion}`
        : "";

      if (shouldNotify && notificationKey !== lastElectronNotificationKey) {
        lastElectronNotificationKey = notificationKey;
        IPC.emit("notification", {
          title: "Update Available!",
          message:
            state.phase === UPDATE_PHASES.DOWNLOADED
              ? `An update to v${state.targetVersion} has been downloaded and is ready to install.`
              : `An update to v${state.targetVersion} is available for download.`,
          button: [
            { text: "Update Now", activation: "froyo://update/" },
            { text: `What's New`, activation: "froyo://changelog/" },
          ],
          activation: {
            type: "protocol",
            launch: "froyo://show/",
          },
        });
      }
    });
  } else {
    IPC.on("update-available", () => {
      if (androidUpdateState.value !== "ready") {
        androidUpdateState.value = "downloading";
      }
    });

    IPC.on("update-available", (version) => {
      if (
        androidUpdateState.value !== "ignored" &&
        latestVersion === version &&
        androidUpdateVersion.value !== version &&
        (!document.fullscreenElement || page.value !== page.PLAYER)
      ) {
        androidUpdateVersion.set(version);
        androidUpdateState.value = "ready";
        IPC.emit("notification", {
          title: "Update Available!",
          message: `An update to v${version} is available for download and installation.`,
          button: [
            { text: "Update Now", activation: "froyo://update/" },
            { text: `What's New`, activation: "froyo://changelog/" },
          ],
          activation: {
            type: "protocol",
            launch: "froyo://show/",
          },
        });
      }
    });

    IPC.on("update-progress", (progress) => androidUpdateProgress.set(progress));
  }
</script>

<script>
  import {
    checkForUpdates,
    dismissUpdate,
    downloadUpdate,
    getUpdaterStatusMessage,
    installUpdate,
    updaterState,
    UPDATE_PHASES,
    shouldShowUpdateModal,
  } from "@/modules/updater.js";

  let androidUpdating = false;
  let updatePromise = createDeferred();

  $: electronState = $updaterState;
  $: activeUpdateVersion = SUPPORTS.isAndroid
    ? $androidUpdateVersion
    : electronState.targetVersion || latestVersion;
  $: activeProgress = SUPPORTS.isAndroid
    ? $androidUpdateProgress
    : electronState.downloadProgress;
  $: updating = SUPPORTS.isAndroid
    ? androidUpdating
    : [
        UPDATE_PHASES.CHECKING,
        UPDATE_PHASES.DOWNLOADING,
        UPDATE_PHASES.INSTALLING,
      ].includes(electronState.phase);
  $: if (
    !SUPPORTS.isAndroid &&
    shouldShowUpdateModal(electronState) &&
    (!document.fullscreenElement || page.value !== page.PLAYER)
  ) {
    modal.open(modal.UPDATE_PROMPT);
  }
  $: if (!SUPPORTS.isAndroid && !shouldShowUpdateModal(electronState)) {
    modal.close(modal.UPDATE_PROMPT);
  }
  $: if (SUPPORTS.isAndroid && $androidUpdateState === "ready") {
    modal.open(modal.UPDATE_PROMPT);
  }
  $: if (
    SUPPORTS.isAndroid &&
    ($androidUpdateState === "up-to-date" || $androidUpdateState === "downloading")
  ) {
    closeAndroid();
  }

  function closeAndroid(ignored = false) {
    if (androidUpdating) return;
    if (ignored) $androidUpdateState = "ignored";
    modal.close(modal.UPDATE_PROMPT);
  }

  async function closeElectron(kind = "remind-later") {
    if (updating) return;
    if (kind) await dismissUpdate(kind);
    modal.close(modal.UPDATE_PROMPT);
  }

  function close(ignored = false) {
    if (SUPPORTS.isAndroid) {
      closeAndroid(ignored);
      return;
    }
    closeElectron(ignored ? "remind-later" : null);
  }

  function compareVersions(currentVersion, previousVersion) {
    const a = sanitizeVersion(currentVersion).split(".").map(Number);
    const b = sanitizeVersion(previousVersion).split(".").map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const numA = a[i] || 0;
      const numB = b[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }

  function getTitle() {
    if (SUPPORTS.isAndroid) return "Update Available!";
    if (electronState.phase === UPDATE_PHASES.ERROR) return "Update Failed";
    if (electronState.phase === UPDATE_PHASES.DOWNLOADED)
      return "Install Update";
    return "Update Available!";
  }

  function getElectronPrimaryLabel() {
    switch (electronState.phase) {
      case UPDATE_PHASES.AVAILABLE:
        return electronState.manualDownloadOnly
          ? "Download ZIP"
          : "Download Update";
      case UPDATE_PHASES.DOWNLOADING:
        return "Downloading...";
      case UPDATE_PHASES.DOWNLOADED:
        return "Install and Restart";
      case UPDATE_PHASES.INSTALLING:
        return "Installing...";
      case UPDATE_PHASES.ERROR:
        return electronState.error?.stage === "download"
          ? (electronState.manualDownloadOnly ? "Retry ZIP Download" : "Retry Download")
          : "Check Again";
      default:
        return "Check for Updates";
    }
  }

  function getPrimaryLabel() {
    if (SUPPORTS.isAndroid) {
      if ($androidUpdateState !== "aborted") {
        return androidUpdating ? "Downloading..." : "Download";
      }
      return androidUpdating ? "Updating..." : "Update";
    }
    return getElectronPrimaryLabel();
  }

  function getDescription() {
    if (SUPPORTS.isAndroid) {
      return `v${activeUpdateVersion} is available for download and installation.`;
    }
    if (!activeUpdateVersion && electronState.phase === UPDATE_PHASES.ERROR) {
      return "The app could not complete the last update action.";
    }
    return getUpdaterStatusMessage(electronState);
  }

  async function confirmElectron() {
    switch (electronState.phase) {
      case UPDATE_PHASES.AVAILABLE:
        await downloadUpdate();
        break;
      case UPDATE_PHASES.DOWNLOADED:
        await installUpdate();
        break;
      case UPDATE_PHASES.ERROR:
        if (electronState.error?.stage === "download") await downloadUpdate();
        else await checkForUpdates(true);
        break;
      default:
        await checkForUpdates(true);
    }
  }

  function confirmAndroid() {
    if (androidUpdating) return;
    androidUpdating = true;
    updatePromise = createDeferred();
    const id = toast.loading("Downloading Update", {
      duration: Infinity,
      description: "Please wait while the latest version is downloaded...",
    });
    updatePromise.promise
      .then(() => {
        toast.success("Update Complete", {
          id,
          duration: 6_000,
          description:
            "Update was successfully applied. The app will now restart...",
        });
      })
      .catch(() => {
        toast.error("Update Aborted", {
          id,
          duration: 15_000,
          description:
            "Update was not installed. The process was canceled or an error occurred.",
        });
      });
    IPC.emit("quit-and-install");
  }

  function confirm() {
    if (SUPPORTS.isAndroid) {
      confirmAndroid();
      return;
    }
    confirmElectron();
  }

  function handleSkipVersion() {
    closeElectron("skip-version");
  }

  function handleRemindLater() {
    if (SUPPORTS.isAndroid) {
      closeAndroid(true);
      return;
    }
    closeElectron("remind-later");
  }

  IPC.on("update-aborted", (aborted) => {
    if (!androidUpdating) return;
    androidUpdating = false;
    $androidUpdateProgress = 0;
    if (aborted) $androidUpdateState = "aborted";
    updatePromise.reject();
  });
</script>

<SoftModal
  class="m-0 pt-0 d-flex flex-column rounded bg-very-dark scrollbar-none viewport-md-4-3 border-md w-full h-full rounded-10"
  css="z-105 m-0 p-0 modal-soft-ellipse"
  innerCss="m-0 p-0"
  showModal={$modal[modal.UPDATE_PROMPT]}
  close={() => {}}
  id={modal.UPDATE_PROMPT}
>
  <p class="mt-20 px-20 px-md-40 overflow-y-auto">
    {#await getChangelog(activeUpdateVersion || latestVersion)}
      <ChangelogSk />
    {:then changelog}
      {@const isLesser =
        changelog?.previousVersion &&
        (compareVersions(version, changelog.previousVersion) < 0 ||
          (compareVersions(version, changelog.previousVersion) > 0 &&
            compareVersions(version, latestVersion) < 0))}
      <div class="row px-md-20 position-relative">
        <div class="text-muted w-full mt-30 mt-md-0">
          <h3
            class="font-weight-bold text-white title font-scale-34 d-flex mb-5"
          >
            <BadgeAlert class="mr-20 block-scale-43" strokeWidth="2" /> {getTitle()}
          </h3>
          <div class="font-scale-20">
            {activeUpdateVersion || latestVersion} - {changelog?.entry
              ? new Date(changelog.entry.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : ""}
          </div>
          <hr class="my-20" />
          <div class="mt-20">
            {getDescription()}
          </div>
          <div
            class="mt-20"
            class:d-none={
              SUPPORTS.isAndroid ||
              electronState.phase !== UPDATE_PHASES.ERROR ||
              !electronState.error?.message
            }
          >
            <strong>Error:</strong> {electronState.error?.message}
          </div>
          <div class="mt-20" class:d-none={!isLesser}>
            It looks like you're upgrading from an earlier version, consider
            checking out the <a
              class="custom-link"
              href="https://github.com/Emekalim/FroYoflix_v2/releases/latest"
              target="_blank">past release notes</a
            >.
          </div>
          <div class:mt-20={!isLesser}>
            Consider <span
              class="custom-link"
              use:click={() =>
                IPC.emit("open", "https://github.com/sponsors/Emekalim")}
              >donating on GitHub</span
            > to help support future FroYo development.
          </div>
          <hr class="my-20" />
          {#if changelog?.entry?.body?.trim().length}
            <h4 class="mt-0 font-weight-bold text-white">Changelog</h4>
            <Changelog class="ml-10" body={changelog.entry.body} />
          {/if}
        </div>
      </div>
      <div class="mt-20">
        <span
          class="custom-link font-weight-bold d-flex"
          class:d-none={!changelog?.entry?.url}
          use:click={() =>
            IPC.emit(
              "open",
              electronState.releaseNotesUrl || changelog.entry.url,
            )}
          >View on GitHub <ExternalLink class="ml-10" size="1.8rem" /></span
        >
      </div>
      <div class="mt-20 font-italic" class:d-none={!SUPPORTS.isAndroid}>
        This update was delivered directly from the GitHub release. If you
        originally downloaded this app from F-Droid or IzzyOnDroid, note that
        updating through this method bypasses the extra review and screening
        normally conducted by those platforms.
      </div>
    {:catch e}
      <ChangelogSk />
    {/await}
  </p>
  <div class="mt-auto border-top px-40">
    {#if !SUPPORTS.isAndroid && electronState.phase === UPDATE_PHASES.AVAILABLE}
      <div class="d-flex my-20 flex-column-reverse flex-md-row font-enlarge-14">
        <button
          class="btn btn-close mr-5 font-weight-bold rounded-2 w-full mt-10 mt-md-0 py-10 h-auto py-md-2 w-md-auto px-md-30"
          type="button"
          disabled={updating}
          on:click={handleSkipVersion}>Skip This Version</button
        >
        <button
          class="btn btn-close mr-5 font-weight-bold rounded-2 w-full mt-10 mt-md-0 py-10 h-auto py-md-2 w-md-auto px-md-30"
          type="button"
          disabled={updating}
          on:click={handleRemindLater}>Remind Me Later</button
        >
        <button
          class="btn btn-secondary update-button position-relative overflow-hidden border-0 text-dark font-weight-bold ml-md-auto rounded-2 w-full py-10 h-auto py-md-2 w-md-auto px-md-30"
          type="button"
          disabled={!electronState.canDownload}
          on:click={confirm}>{getPrimaryLabel()}</button
        >
      </div>
    {:else}
      <div class="d-flex my-20 flex-column-reverse flex-md-row font-enlarge-14">
        <button
          class="btn btn-close mr-5 font-weight-bold rounded-2 w-full mt-10 mt-md-0 py-10 h-auto py-md-2 w-md-auto px-md-30"
          type="button"
          disabled={updating}
          on:click={() => close(true)}>{SUPPORTS.isAndroid ? "Not now" : "Remind Me Later"}</button
        >
        <button
          class="btn btn-secondary update-button position-relative overflow-hidden border-0 text-dark font-weight-bold ml-md-auto rounded-2 w-full py-10 h-auto py-md-2 w-md-auto px-md-30"
          type="button"
          disabled={SUPPORTS.isAndroid ? androidUpdating : getPrimaryLabel().includes("...")}
          on:click={confirm}
          style={activeProgress > 0
            ? `--update-progress: ${activeProgress}%`
            : ""}
          >{getPrimaryLabel()}</button
        >
      </div>
    {/if}
  </div>
</SoftModal>

<style>
  @media (hover: hover) and (pointer: fine) {
    .btn-close:hover {
      background-color: var(--gray-color-light) !important;
    }
  }
  .update-button::before {
    content: "";
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    height: 100%;
    width: var(--update-progress, 0%);
    border-radius: inherit;
    background: var(--white-color-dim);
    transition: width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
</style>
