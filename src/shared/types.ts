// Types only: the content scripts import from here, and must stay import-free once built.

export type MediaCommand = "toggle" | "play" | "pause" | "next" | "prev"

/** A track waiting in the page's own queue ("Up next" on YouTube Music and YouTube). */
export type QueueItem = { title: string; artist: string; artwork?: string }

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
  /** What plays after this, in order, as far as the page shows it. */
  queue: QueueItem[]
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
/** `sync` asks the hook to report again even if nothing changed: a new bridge has arrived. */
/** `queue` plays the queue item at `index`; the title guards against the queue having moved meanwhile. */
export type BridgeMessage =
  | { source: typeof BRIDGE; cmd: MediaCommand }
  | { source: typeof BRIDGE; sync: true }
  | { source: typeof BRIDGE; queue: { index: number; title: string } }

// extension messages
export type RuntimeMessage =
  | { type: "media:update"; snapshot: MediaSnapshot | null }
  | { type: "media:get" }
  | { type: "media:list"; tabs: TabMedia[] }
  | { type: "media:cmd"; tabId: number; cmd: MediaCommand }
  | { type: "media:focus"; tabId: number }
  | { type: "media:run"; cmd: MediaCommand }
  | { type: "media:queue"; tabId: number; index: number; title: string }
  | { type: "media:runQueue"; index: number; title: string }
  // to the mini player in the active tab: `pop` opens it, otherwise it only refreshes what it shows
  | { type: "mini:state"; media: TabMedia; pop: boolean }
  | { type: "mini:gone"; tabId: number }
  // from the mini player: a page has loaded and can show the card; the card was closed
  | { type: "mini:ready" }
  | { type: "mini:dismiss"; tabId: number }

/** chrome.storage.local key: whether the mini player pops up on its own. Default on. */
export const AUTO_POP_KEY = "autoPop"
