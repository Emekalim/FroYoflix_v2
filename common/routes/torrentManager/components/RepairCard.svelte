<script context="module">
    import { Film, EllipsisVertical, Wrench, AlertCircle } from "lucide-svelte";
    import { onDestroy, onMount } from "svelte";
</script>

<script>
    import { IPC } from "@/modules/bridge.js";
    import { click } from "@/modules/click.js";
    import { cancelRepair } from "@/modules/jobs.js";
    import { toast } from "svelte-sonner";

    export let data;

    const hash = data.id;

    let options;
    let isCancelling = false;

    function toggleDropdown() {
        options.classList.toggle("active");
        options.closest(".dropdown").classList.toggle("show");
    }

    async function stopRepair() {
        isCancelling = true;
        toggleDropdown();
        const result = await cancelRepair(hash);
        if (result.success) {
            toast.success("Repair cancelled", { description: "The repair process has been stopped." });
        } else {
            toast.error("Failed to cancel repair", { description: result.error });
        }
        isCancelling = false;
    }

    onMount(() => {
        // Basic click-away listener for dropdown
        const closeDropdown = (e) => {
            if (options && !options.contains(e.target)) {
                const dropdown = options.closest(".dropdown");
                if (dropdown && dropdown.classList.contains("show")) {
                    options.classList.remove("active");
                    dropdown.classList.remove("show");
                }
            }
        };
        window.addEventListener("click", closeDropdown);
        return () => window.removeEventListener("click", closeDropdown);
    });
</script>

<div
    role="button"
    tabindex="0"
    class="details border-top py-20 text-wrap text-break-word d-flex not-reactive option pointer"
    aria-label="Repair Job"
>
    <div class="d-flex flex-row w-full load-in mw-0">
        <div class="p-5 ml-20 name flex-shrink-0 d-flex flex-column" style="width: 400px;">
            <div
                class="font-weight-bold overflow-hidden d-flex align-items-center"
                style="white-space: nowrap;"
            >
                <span
                    class="mr-2 d-inline-flex align-items-center align-middle bg-primary-dim px-3 py-3 rounded flex-shrink-0"
                    title="Repair"
                >
                    <Wrench size="2rem" />
                </span>
                <span class="ml-10 text-truncate">{data.name}</span>
            </div>
            <div class="text-muted overflow-hidden flex-shrink-0" title={hash} style="white-space: nowrap; text-overflow: ellipsis; margin-left: 3.5rem; font-size: 0.9rem;">
                {hash}
            </div>
        </div>

        <!-- Status Section -->
        <div class="p-5 d-none d-md-flex align-items-center justify-content-center font-size-12 text-muted flex-shrink-0" style="width: 80px;">
            {#if data.status === "queued"}
                Queued...
            {:else if data.status === "starting"}
                Starting...
            {:else if data.status === "error"}
                Error
            {:else if data.status === "complete"}
                Complete
            {:else}
                Encoding
            {/if}
        </div>

        <!-- Progress Bar Section -->
        <div class="p-5 flex-1 d-flex flex-column justify-content-center px-20" style="margin-left: 30px;">
            <div class="d-flex justify-content-end mb-5 font-size-12 text-muted">
                {#if data.status === "queued"}
                    —
                {:else}
                    {data.progress.toFixed(1)}%
                {/if}
            </div>
            <div
                class="progress w-full h-10 bg-dark-light rounded overflow-hidden"
            >
                <div
                    class="progress-bar bg-primary h-full transition-all duration-300"
                    style="width: {data.progress}%;"
                ></div>
            </div>
        </div>

        <div class="d-none d-lg-flex align-items-center" style="width: 90px; padding: 0.5rem 0.75rem;">
            {data.status === "queued" ? "—" : data.speed}
        </div>

        <div class="d-none d-lg-flex align-items-center mr-5 mr-md-20" style="width: 110px; padding: 0.5rem 0.75rem;">
            {data.status === "queued" ? "—" : data.eta}
        </div>
    </div>

    <div
        class="dropdown with-arrow right-0 mr-5 mr-md-20 w-40 h-auto d-flex align-items-center"
        use:click={toggleDropdown}
    >
        <span
            bind:this={options}
            class="btn btn-square h-full bg-transparent shadow-none border-0 options d-flex align-items-center muted justify-content-center flex-shrink-0 h-full w-40"
            title="Options"><EllipsisVertical size="2rem" /></span
        >
        <div
            class="dropdown-menu dropdown-menu-right pt-5 pb-5 ml-10 text-capitalize w-auto text-nowrap"
        >
            {#if data.status === "queued" || data.status === "starting" || data.status === "repairing"}
                <div
                    role="button"
                    class="pointer d-flex align-items-center justify-content-center font-size-16 rounded option details py-5 px-10 text-danger"
                    class:disabled={isCancelling}
                    aria-label="Stop Repair"
                    title="Stop Repair"
                    use:click={!isCancelling ? stopRepair : null}
                >
                    {isCancelling ? "Cancelling..." : "Stop Repair"}
                </div>
            {/if}
            {#if data.status === "error"}
                <div class="d-flex align-items-center font-size-12 py-5 px-10 text-danger">
                    <AlertCircle size="1rem" class="mr-5" />
                    {data.error || "Unknown error"}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .py-3 {
        padding-top: 0.3rem;
        padding-bottom: 0.3rem;
    }
    .px-3 {
        padding-left: 0.3rem;
        padding-right: 0.3rem;
    }
    .mr-2 {
        margin-right: 0.2rem;
    }
    .ml-10 {
        margin-left: 1rem;
    }
    .px-20 {
        padding-left: 2rem;
        padding-right: 2rem;
    }
    .details {
        border: 0.1rem solid transparent;
    }
    .option:hover {
        background-color: var(--dark-color-light);
        border: 0.1rem solid var(--highlight-color) !important;
    }
    .text-danger {
        color: var(--danger-color, #ff4d4d) !important;
    }
    .progress {
        background-color: var(--dark-color-very-light);
    }
    .progress-bar {
        transition: width 0.3s ease;
    }
    .duration-300 {
        transition-duration: 300ms;
    }
</style>
