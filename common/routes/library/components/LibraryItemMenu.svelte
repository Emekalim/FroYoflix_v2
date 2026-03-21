<script>
  import { onDestroy } from 'svelte'
  import { startLibraryManualMatch } from '@/modules/library/manualMatch.js'
  import { EllipsisVertical, Search } from 'lucide-svelte'

  export let item
  export let overlay = false

  let root
  let open = false

  function canModifyMetadata() {
    return !!(item?.preferredFile?.absolutePath || item?.absolutePath)
  }

  function actionLabel() {
    if (item?.statusSummary === 'unmatched') return 'Match File'
    return 'Select Metadata'
  }

  export function openMenu() {
    if (!canModifyMetadata()) return
    open = true
  }

  export function closeMenu() {
    open = false
  }

  function toggleMenu(event) {
    event?.stopPropagation?.()
    if (!canModifyMetadata()) return
    open = !open
  }

  function handleOutside(event) {
    if (open && root && !root.contains(event.target)) open = false
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') open = false
  }

  function selectMetadata(event) {
    event?.stopPropagation?.()
    open = false
    startLibraryManualMatch(item)
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', handleOutside, true)
    document.addEventListener('keydown', handleKeydown, true)
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', handleOutside, true)
      document.removeEventListener('keydown', handleKeydown, true)
    }
  })
</script>

{#if canModifyMetadata()}
  <div bind:this={root} class="dropdown library-item-menu" class:show={open} class:overlay>
    <button
      type="button"
      class="btn btn-square bg-dark-light shadow-none border-0 d-flex align-items-center justify-content-center menu-toggle"
      class:active={open}
      on:click|stopPropagation={toggleMenu}
      aria-label={actionLabel()}
      title={actionLabel()}
    >
      <EllipsisVertical size="1.8rem" />
    </button>

    <div class="dropdown-menu dropdown-menu-right pt-5 pb-5 text-nowrap" class:show={open} on:click|stopPropagation>
      <div
        role="button"
        class="pointer d-flex align-items-center font-size-16 rounded option details py-5 px-12"
        on:click|stopPropagation={selectMetadata}
      >
        <Search size="1.5rem" class="mr-8" />
        {actionLabel()}
      </div>
    </div>
  </div>
{/if}

<style>
  .library-item-menu {
    z-index: 45;
  }
  .library-item-menu.overlay {
    position: absolute;
    top: 0.8rem;
    right: 0.8rem;
  }
  .menu-toggle {
    width: 3.2rem;
    height: 3.2rem;
    border-radius: 999px;
    backdrop-filter: blur(1rem);
  }
  .overlay .menu-toggle {
    opacity: 0;
    transition: opacity 0.18s ease;
  }
  :global(.library-poster-item:hover) .overlay .menu-toggle,
  :global(.library-poster-item:focus-within) .overlay .menu-toggle,
  .overlay.show .menu-toggle {
    opacity: 1;
  }
  .dropdown-menu {
    min-width: 17rem;
  }
  .option:hover {
    background: var(--dark-border-color);
  }
</style>
