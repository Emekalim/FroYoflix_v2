<script>
  import Card from '@/components/cards/Card.svelte'
  import LibraryItemMenu from '@/routes/library/components/LibraryItemMenu.svelte'

  export let item
  export let card
  export let variables = null

  let itemMenu
</script>

<div class="library-poster-item mr-15 position-relative" on:contextmenu|preventDefault|stopPropagation={() => itemMenu?.openMenu()}>
  <LibraryItemMenu bind:this={itemMenu} {item} overlay={true} />
  <Card {card} {variables} />
</div>
