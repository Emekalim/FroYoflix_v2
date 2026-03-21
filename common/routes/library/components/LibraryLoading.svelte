<script>
  import { Loader2 } from 'lucide-svelte'
</script>

<div class='library-loading d-flex flex-column align-items-center justify-content-center load-in'>
  <Loader2 size='3.5rem' class='spin text-muted mb-15' />
  <div class='text-muted font-scale-16'>Loading Library...</div>
</div>

<style>
  .library-loading {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: var(--dark-color);
    pointer-events: none;
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
