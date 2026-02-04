<script>
    import { writable } from "simple-store-svelte";
    import { toast } from "svelte-sonner";
    import { X, Bookmark, PencilLine } from "lucide-svelte";
    import { click } from "@/modules/click.js";
    import { createListener } from "@/modules/util.js";
    import {
        getProgress,
        setProgress,
        deleteProgress,
    } from "@/modules/tmdb/tmdb-progress.js";

    /** @type {Object} TMDB media object */
    export let media;
    export let viewAnime = false;
    export let previewAnime = false;

    let scoringModal;
    const showModal = writable(false);
    $: setTimeout(() => $showModal && scoringModal?.focus());

    let score = 0;
    let status = "NOT IN LIST";
    let episode = 0;
    let totalEpisodes = "?";
    let tmdbProgress = null;

    const scoreName = {
        10: "(Masterpiece)",
        9: "(Great)",
        8: "(Very Good)",
        7: "(Good)",
        6: "(Fine)",
        5: "(Average)",
        4: "(Bad)",
        3: "(Very bad)",
        2: "(Horrible)",
        1: "(Appalling)",
        0: "Not Rated",
    };

    // Load progress when modal opens
    async function toggleModal(state) {
        if (state.save || state.delete) {
            showModal.set(false);
            if (state.save) {
                await saveEntry();
            } else if (state.delete) {
                await deleteEntry();
            }
        } else {
            // Load from IndexedDB
            tmdbProgress = await getProgress(media.tmdbId);

            score = tmdbProgress?.score || 0;
            status = tmdbProgress?.status || "NOT IN LIST";
            episode = tmdbProgress?.progress || 0;
            totalEpisodes =
                media.format === "TV"
                    ? media.totalEpisodes || media.episodes || "?"
                    : "1";

            showModal.set(!$showModal);
        }
    }

    async function deleteEntry() {
        try {
            await deleteProgress(media.tmdbId);
            score = 0;
            episode = 0;
            status = "NOT IN LIST";
            tmdbProgress = null;

            toast.success("Removed from List", {
                description: `${media.title?.userPreferred || media.title} has been removed from your list.`,
                duration: 4000,
            });
        } catch (error) {
            console.error("[TMDB Scoring] Delete error:", error);
            toast.error("Failed to Remove", {
                description: "Could not remove from your list.",
                duration: 4000,
            });
        }
    }

    async function saveEntry() {
        if (!status.includes("NOT IN LIST")) {
            try {
                await setProgress(media.tmdbId, {
                    mediaType: media.format === "TV" ? "tv" : "movie",
                    title: media.title?.userPreferred || media.title,
                    status,
                    progress: episode,
                    score,
                });

                // Reload progress
                tmdbProgress = await getProgress(media.tmdbId);

                const description = `Title: ${media.title?.userPreferred || media.title}\nStatus: ${getStatusName(status)}\n${media.format === "TV" ? `Episode: ${episode} / ${totalEpisodes}\n` : ""}${score !== 0 ? `Your Score: ${score}` : ""}`;

                toast.success("List Updated", {
                    description,
                    duration: 4000,
                });
            } catch (error) {
                console.error("[TMDB Scoring] Save error:", error);
                toast.error("Failed to Update", {
                    description: "Could not save to your list.",
                    duration: 4000,
                });
            }
        } else {
            await deleteEntry();
        }
    }

    function getStatusName(status) {
        const names = {
            PLANNING: "Planning",
            CURRENT: "Watching",
            COMPLETED: "Completed",
            PAUSED: "Paused",
            DROPPED: "Dropped",
            REPEATING: "Rewatching",
        };
        return names[status] || status;
    }

    /**
     * @param {Event & { currentTarget: HTMLInputElement }} event
     */
    function handleEpisodes(event) {
        const enteredValue = event.currentTarget.value;
        if (/^\d+$/.test(enteredValue)) {
            const maxEpisodes = parseInt(totalEpisodes) || 999;
            if (parseInt(enteredValue) > maxEpisodes) {
                episode = maxEpisodes;
                event.currentTarget.value = episode;
            } else {
                episode = parseInt(enteredValue);
                event.currentTarget.value = episode;
            }
        } else {
            episode = 0;
        }
    }

    $: {
        if ($showModal) {
            const { reactive, init } = createListener([
                `tmdb-scoring`,
                `tmdb-scoring-btn`,
            ]);
            init(true, true);
            reactive.subscribe((value) => {
                if (!value) {
                    showModal.set(false);
                    init(false, true);
                }
            });
        }
    }
</script>

<div
    class="score-dropdown {viewAnime ? `z-10` : `z-1`} {$$restProps.class}"
    class:ml-10={!$$restProps.class}
>
    <button
        type="button"
        id="tmdb-list-btn"
        data-toggle="tooltip"
        data-placement={previewAnime ? "top-right" : "top"}
        data-target-breakpoint="md"
        data-title="List Editor"
        class="btn tmdb-scoring-btn font-size-{viewAnime
            ? `20 btn-lg`
            : `16`} btn-square shadow-none border-0 d-flex align-items-center justify-content-center"
        class:bg-dark-light={!previewAnime}
        use:click={() => toggleModal({ toggle: !$showModal })}
    >
        {#if tmdbProgress}
            <PencilLine size="1.7rem" />
        {:else}
            <Bookmark size="1.7rem" />
        {/if}
    </button>

    <div
        bind:this={scoringModal}
        class="modal tmdb-scoring position-absolute bg-very-dark shadow-lg rounded-3 p-20 z-30 {$showModal
            ? `visible`
            : `invisible`} {!previewAnime && !viewAnime
            ? `banner`
            : !previewAnime
              ? `viewAnime`
              : `previewAnime`} {!previewAnime || !viewAnime
            ? `w-auto h-auto`
            : ``}"
        use:click={() => {}}
    >
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="font-weight-bold">List Editor</h5>
            <button
                type="button"
                class="btn btn-square d-flex align-items-center justify-content-center"
                use:click={() => toggleModal({ toggle: false })}
                ><X size="1.7rem" strokeWidth="3" /></button
            >
        </div>
        <div class="modal-body">
            <div class="form-group mb-15">
                <label class="d-block mb-5" for="tmdb-status">Status</label>
                <select
                    class="form-control bg-dark-light"
                    class:noList={status?.includes("NOT IN LIST")}
                    id="tmdb-status"
                    required
                    bind:value={status}
                >
                    <option value="NOT IN LIST" selected disabled hidden
                        >Not on List</option
                    >
                    <option value="CURRENT">Watching</option>
                    <option value="PLANNING">Planning</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PAUSED">Paused</option>
                    <option value="DROPPED">Dropped</option>
                    <option value="REPEATING">Rewatching</option>
                </select>
            </div>
            {#if media.format === "TV"}
                <div class="form-group">
                    <label class="d-block mb-5" for="tmdb-episode"
                        >Episode</label
                    >
                    <div class="d-flex">
                        <input
                            class="form-control bg-dark-light w-full"
                            type="number"
                            id="tmdb-episode"
                            bind:value={episode}
                            on:input={handleEpisodes}
                        />
                        <div>
                            <span
                                class="total-episodes position-absolute text-right pointer-events-none"
                                >/ {totalEpisodes}</span
                            >
                        </div>
                    </div>
                </div>
            {/if}
            <div class="form-group">
                <label class="d-block mb-5" for="tmdb-score">Your Score</label>
                <input
                    class="w-full p-2 bg-dark-light"
                    type="range"
                    id="tmdb-score"
                    min="0"
                    max="10"
                    bind:value={score}
                />
                <div class="d-flex justify-content-center">
                    {#if score !== 0}
                        <span
                            class="text-center text-decoration-underline font-weight-bold"
                            >{score}</span
                        >
                        <span class="ml-5">/ 10</span>
                    {/if}
                    <span class="ml-5">{scoreName[score]}</span>
                </div>
            </div>
        </div>
        <div class="d-flex justify-content-center">
            {#if !status.includes("NOT IN LIST") && tmdbProgress}
                <button
                    type="button"
                    class="btn btn-delete btn-secondary text-dark mr-20 font-weight-bold shadow-none d-flex align-items-center justify-content-center"
                    use:click={() => toggleModal({ delete: true })}
                    ><span>Delete</span></button
                >
            {/if}
            <button
                type="button"
                class="btn btn-save btn-secondary text-dark font-weight-bold shadow-none d-flex align-items-center justify-content-center"
                use:click={() => toggleModal({ save: true })}
                ><span>Save</span></button
            >
        </div>
    </div>
</div>

<style>
    @media (hover: hover) and (pointer: fine) {
        .btn-delete:hover {
            color: white !important;
            background: darkred !important;
        }
        .btn-save:hover {
            color: white !important;
            background: darkgreen !important;
        }
    }
    .total-episodes {
        margin-top: 0.65rem;
        right: 4rem;
    }
    .previewAnime {
        top: 65%;
        margin-top: -25rem;
        width: 78% !important;
        left: -1.5rem;
        cursor: auto;
    }
    .viewAnime {
        top: auto;
        left: auto;
        margin-top: -20rem;
        margin-left: 5rem;
    }
    .banner {
        top: 0;
        left: auto;
        margin-top: 1rem;
        margin-left: -23.7rem;
    }
    .visible {
        animation: 0.15s ease 0s 1 load-in;
        will-change: transform, opacity;
    }
    .invisible {
        animation: load-out 0.15s ease-out forwards;
        will-change: transform, opacity;
    }
    .noList {
        color: var(--dm-input-placeholder-text-color) !important;
    }
    @keyframes load-in {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    @keyframes load-out {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(0.95);
        }
    }
</style>
