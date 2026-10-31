// Types only: the content scripts import from here, and must stay import-free once built.

export type MediaCommand = "toggle" | "play" | "pause" | "next" | "prev"

/** What the page hook reads off a tab: the Media Session plus the media element. */
export type MediaSnapshot = {
  title: string
  artist: string
  album: string
  artwork?: string
  playing: boolean
  /** Whether the page registered its own next/previous handlers. */
  canNext: boolean
  canPrev: boolean
}

/** A snapshot as the background keeps it, with the tab it came from. */
export type TabMedia = MediaSnapshot & {
  tabId: number
  windowId: number
  site: string
  favIconUrl?: string
  updatedAt: number
}

// page hook <-> bridge, over window.postMessage
export const HOOK = "disc-deck:hook"
export const BRIDGE = "disc-deck:bridge"
export type HookMessage = { source: typeof HOOK; snapshot: MediaSnapshot | null }
export type BridgeMessage = { source: typeof BRIDGE; cmd: MediaCommand }

// extension messages
export type RuntimeMessage =
  | { type: "media:update"; snapshot: MediaSnapshot | null }
  | { type: "media:get" }
  | { type: "media:list"; tabs: TabMedia[] }
  | { type: "media:cmd"; tabId: number; cmd: MediaCommand }
  | { type: "media:focus"; tabId: number }
  | { type: "media:run"; cmd: MediaCommand }
