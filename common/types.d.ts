import type { SvelteComponentTyped } from 'svelte'

export {}

type Track = {
  selected: boolean
  enabled: boolean
  id: string
  kind: string
  label: string
  language: string
}

declare global {
  interface Window {
    IPC: any
    port: MessagePort
    version: {
      platform: string
      arch: string
      session: string
    }
    updater: {
      getState: () => Promise<{
        phase: string
        currentVersion: string
        targetVersion: string
        downloadProgress: number
        releaseNotesUrl: string
        releaseDate: string
        channel: string
        dismissedVersion: string
        error: { message: string, stage: string, manual: boolean } | null
        manualCheckInFlight: boolean
        canDownload: boolean
        canInstall: boolean
      } | null>
      checkForUpdates: (options?: { manual?: boolean }) => Promise<boolean>
      downloadUpdate: () => Promise<boolean>
      installUpdate: () => Promise<boolean>
      dismiss: (options: { kind: 'skip-version' | 'remind-later' }) => Promise<boolean>
    }
  }
  interface EventTarget {
    on: (type: string, callback: (any) => void, options?: boolean | {}) => void
    once: (type: string, callback: (any) => void, options?: boolean | {}) => void
    emit: (type: string, data?: any) => void
    dispatch: (type: string, data?: any) => void
    removeListener: (type: string, callback: (any) => void) => void
    off: (type: string, callback: (any) => void) => void
  }
  interface HTMLMediaElement {
    videoTracks: Track[]
    audioTracks: Track[]
  }

  interface ScreenOrientation {
    lock: Function
  }

  namespace svelteHTML {
    interface HTMLAttributes {
      'on:leavepictureinpicture'?: (
        event: Event<{
          target: EventTarget;
        }>
      ) => void;
    }
  }
}

declare module '*.svelte' {
  export default SvelteComponentTyped
}
