<script>
  import { page, modal, playPage } from '@/modules/navigation.js'
  import { nowPlaying as media } from '@/components/MediaHandler.svelte'
  import { hasUnreadNotifications } from '@/modals/NotificationsModal.svelte'
  import NavbarLink from '@/components/navigation/NavbarLink.svelte'
  import { openNowPlaying, openNowPlayingDetails } from '@/modules/nowPlayingNavigation.js'
  import { Home, Search, Download, Settings, Bell, BellDot, ListVideo, History, TvMinimalPlay } from 'lucide-svelte'
</script>

<nav class='navbar z-80 navbar-fixed-bottom d-block d-md-none border-0 bg-dark bt-10'>
  <div class='navbar-menu h-full d-flex flex-row justify-content-center align-items-center m-0 pb-5 animate'>
    <NavbarLink click={() => page.navigateTo(page.HOME)} _page={page.HOME} text='Home' let:active>
      <Home size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
    <NavbarLink click={() => page.navigateTo(page.SEARCH)} _page={page.SEARCH} icon='search' text='Search' let:active>
      <Search size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' stroke-width='2.5' stroke='currentColor' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
    {#if $media?.media || ($playPage && (Object.keys($media).length > 0))}
      {@const currentMedia = $modal[modal.ANIME_DETAILS]?.data}
      {@const lastWatched = !!$media?.display}
      {@const playerMaximized = !lastWatched && $page === page.PLAYER && !$modal[modal.ANIME_DETAILS]}
      <NavbarLink
        click={() => openNowPlaying($media)}
        rbClick={() => {
          openNowPlayingDetails($media)
        }} _page={lastWatched ? null : playerMaximized ? page.PLAYER : null} icon='queue_music' text={lastWatched ? 'Last Watched' : 'Now Playing'} _modal={modal.ANIME_DETAILS} let:active>
        <svelte:component this={lastWatched ? History : playerMaximized ? ListVideo : TvMinimalPlay} size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active && (currentMedia?.id === $media?.media?.id) ? 'currentColor' : 'var(--gray-color-very-dim)'} />
      </NavbarLink>
    {/if}
    <NavbarLink click={() => page.navigateTo(page.TORRENT_MANAGER)} _page={page.TORRENT_MANAGER} icon='download' text='Torrents' css='d-none d-sm-block' let:active>
      <Download size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
    <NavbarLink click={() => { modal.toggle(modal.NOTIFICATIONS) }} icon='bell' text='Notifications' _modal={modal.NOTIFICATIONS} let:active let:hovering>
      {#if $hasUnreadNotifications &&  $hasUnreadNotifications > 0}
        <BellDot size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded fill-1 notify' strokeWidth='2.5' color='currentColor' style='--fill-button-color: {hovering ? `var(--gray-color-very-dim)` : `var(--notify-color)`}'/>
      {:else}
        <Bell size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={$modal[modal.NOTIFICATIONS] ? 'currentColor' : 'var(--gray-color-very-dim)'}/>
      {/if}
    </NavbarLink>
    <NavbarLink click={() => page.navigateTo(page.SETTINGS)} _page={page.SETTINGS} icon='settings' text='Settings' let:active>
      <Settings size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
  </div>
</nav>

<style>
  .navbar .animate :global(.donate) {
    animation: pink_glow 1s ease-in-out infinite alternate;
    will-change: drop-shadow;
  }
  .navbar .animate :global(.notify) {
    animation: purple_glow 1s ease-in-out infinite alternate, bell_shake 10s infinite;
    will-change: drop-shadow;
  }
  .navbar :global(.fill-1) {
    color: var(--fill-button-color);
    text-shadow: 0 0 1rem var(--fill-button-color);
  }
  .bt-10 {
    border-top: .10rem var(--border-color-sp) solid !important;
  }
</style>
