// Runs in the page's own JS world at document_start, before the player loads.
// It keeps hold of the handlers the page gives the Media Session (the same ones
// your keyboard's media keys trigger), so the side panel can call them later,
// and it reports what's playing to the bridge script.
//
// It can also arrive late, added to an already-open tab after an install or
// update. Then it may find an earlier copy of itself already in the page, and
// leaves that one in charge so commands don't run twice.

import type { BridgeMessage, HookMessage, MediaCommand, MediaSnapshot, QueueItem } from "@/shared/types"

const HOOK: HookMessage["source"] = "disc-deck:hook"
const BRIDGE: BridgeMessage["source"] = "disc-deck:bridge"

// Fallback buttons for sites that don't hand next/previous to the Media Session.
const NEXT_BUTTONS = [
  ".ytp-next-button",
  "[data-testid='control-button-skip-forward']",
  ".skipControl__next",
  "tp-yt-paper-icon-button.next-button",
]
const PREV_BUTTONS = [
  ".ytp-prev-button",
  "[data-testid='control-button-skip-back']",
  ".skipControl__previous",
  "tp-yt-paper-icon-button.previous-button",
]

// three discs behind the playing one: enough to see what's coming without crowding the card
const QUEUE_MAX = 3

// The page's own "Up next" list, read off its DOM. Each row knows how to start itself.
type QueueRow = QueueItem & { play: () => void }

const text = (root: Element, sel: string) => root.querySelector(sel)?.textContent?.trim() ?? ""

// YouTube's rows are Polymer elements carrying the data they were drawn from; the hook
// runs in the page's world, so it can read it. Shapes vary by row type, hence the loose type.
type RowData = { thumbnail?: { thumbnails?: { url?: string }[] }; videoId?: string }
function rowData(root: Element): RowData | undefined {
  const el = root as Element & { data?: RowData; __data?: { data?: RowData } }
  return el.data ?? el.__data?.data
}

/** A cover big enough for a disc label. */
function bigger(url: string): string {
  // YouTube Music's lh3 thumbnails take their size in the URL
  return url.replace(/=w\d+-h\d+/, "=w544-h544").replace(/^\/\//, "https://")
}

// The <img> in a row only gets its picture once the row scrolls into view, so read the
// cover from the row's data first, then fall back to the video's own thumbnail.
function img(root: Element): string | undefined {
  const d = rowData(root)
  const thumbs = d?.thumbnail?.thumbnails?.filter((t) => t.url)
  if (thumbs?.length) return bigger(thumbs[thumbs.length - 1].url!)
  const src = root.querySelector("img")?.src
  if (src && src.startsWith("http")) return bigger(src)
  if (d?.videoId) return `https://i.ytimg.com/vi/${d.videoId}/hqdefault.jpg`
  return undefined
}

/** Rows after the selected one, or every row when nothing is marked as playing. */
function after<T extends Element>(rows: T[]): T[] {
  const i = rows.findIndex((r) => r.hasAttribute("selected"))
  return rows.slice(i + 1, i + 1 + QUEUE_MAX)
}

function readQueue(): QueueRow[] {
  try {
    return queueRows()
  } catch {
    return [] // a page whose markup moved on; what's playing still reports
  }
}

function queueRows(): QueueRow[] {
  const host = location.hostname
  if (host === "music.youtube.com") {
    // the queue panel's rows, with Automix suggestions after them in page order
    const rows = Array.from(document.querySelectorAll("ytmusic-player-queue ytmusic-player-queue-item"))
    return after(rows).map((r) => ({
      title: text(r, ".song-title"),
      artist: text(r, ".byline"),
      artwork: img(r),
      play: () => (r.querySelector<HTMLElement>("ytmusic-play-button-renderer") ?? r.querySelector<HTMLElement>(".song-info") ?? (r as HTMLElement)).click(),
    }))
  }
  if (host.endsWith("youtube.com")) {
    // a playlist's panel if there is one, else the suggestions beside the video
    const list = Array.from(document.querySelectorAll("ytd-playlist-panel-renderer #items ytd-playlist-panel-video-renderer"))
    if (list.length)
      return after(list).map((r) => ({
        title: text(r, "#video-title"),
        artist: text(r, "#byline"),
        artwork: img(r),
        play: () => r.querySelector<HTMLElement>("a#wc-endpoint")?.click(),
      }))
    return Array.from(document.querySelectorAll("#secondary ytd-compact-video-renderer"))
      .slice(0, QUEUE_MAX)
      .map((r) => ({
        title: text(r, "#video-title"),
        artist: text(r, "ytd-channel-name #text"),
        artwork: img(r),
        play: () => r.querySelector<HTMLElement>("a#thumbnail")?.click(),
      }))
  }
  return []
}

function install(ms: MediaSession | undefined) {
  const handlers = new Map<MediaSessionAction, MediaSessionActionHandler>()
  let lastMedia: HTMLMediaElement | null = null

  if (ms) {
    const setActionHandler = ms.setActionHandler.bind(ms)
    ms.setActionHandler = (action, handler) => {
      if (handler) handlers.set(action, handler)
      else handlers.delete(action)
      setActionHandler(action, handler)
    }
  }

  // Players like Spotify keep their <audio> out of the DOM, so remember whichever element last played.
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    lastMedia = this
    return play.call(this)
  }

  function media(): HTMLMediaElement | null {
    if (lastMedia && (lastMedia.isConnected || lastMedia.currentSrc)) return lastMedia
    const els = Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video"))
    return els.find((el) => !el.paused) ?? els.find((el) => el.duration > 0) ?? null
  }

  function clickFirst(selectors: string[]): boolean {
    for (const s of selectors) {
      const el = document.querySelector<HTMLElement>(s)
      if (el) {
        el.click()
        return true
      }
    }
    return false
  }

  function call(action: MediaSessionAction): boolean {
    const h = handlers.get(action)
    if (!h) return false
    h({ action })
    return true
  }

  function isPlaying(): boolean {
    if (ms && ms.playbackState !== "none") return ms.playbackState === "playing"
    const el = media()
    return !!el && !el.paused
  }

  function run(cmd: MediaCommand) {
    const el = media()
    if (cmd === "toggle") cmd = isPlaying() ? "pause" : "play"
    if (cmd === "play") call("play") || el?.play()
    else if (cmd === "pause") call("pause") || el?.pause()
    else if (cmd === "next") call("nexttrack") || clickFirst(NEXT_BUTTONS)
    else if (cmd === "prev") call("previoustrack") || clickFirst(PREV_BUTTONS) || (el && (el.currentTime = 0))
    setTimeout(report, 150)
  }

  function largest(art: readonly MediaImage[]): string | undefined {
    let best: MediaImage | undefined
    let bestSize = -1
    for (const a of art) {
      const size = Math.max(0, ...(a.sizes ?? "").split(/\s+/).map((s) => parseInt(s, 10) || 0))
      if (size > bestSize) {
        best = a
        bestSize = size
      }
    }
    return best?.src
  }

  function snapshot(): MediaSnapshot | null {
    const meta = ms?.metadata
    const el = media()
    if (!meta?.title && !(el && el.duration > 0)) return null
    return {
      title: meta?.title || document.title,
      artist: meta?.artist ?? "",
      album: meta?.album ?? "",
      artwork: meta ? largest(meta.artwork) : undefined,
      playing: isPlaying(),
      // A handler registered before a late install is out of reach, but the button fallbacks still skip.
      canNext: handlers.has("nexttrack"),
      canPrev: handlers.has("previoustrack"),
      queue: readQueue()
        .filter((q) => q.title)
        .map(({ title, artist, artwork }) => ({ title, artist, artwork })),
    }
  }

  let last = ""
  function report() {
    const s = snapshot()
    const key = JSON.stringify(s)
    if (key === last) return
    last = key
    window.postMessage({ source: HOOK, snapshot: s } satisfies HookMessage, "*")
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window) return
    const m = e.data as BridgeMessage | undefined
    if (m?.source !== BRIDGE) return
    if ("sync" in m) {
      last = ""
      report()
    } else if ("queue" in m) {
      const rows = readQueue().filter((q) => q.title)
      ;(rows[m.queue.index]?.title === m.queue.title ? rows[m.queue.index] : rows.find((q) => q.title === m.queue.title))?.play()
      setTimeout(report, 300)
    } else run(m.cmd)
  })

  for (const type of ["play", "pause", "ended", "loadedmetadata"]) document.addEventListener(type, report, true)
  setInterval(report, 1000)
}

const w = window as Window & { __discDeckHook?: true }
const session = navigator.mediaSession as MediaSession | undefined
// An own setActionHandler means a copy from before this flag existed is already wrapping it.
if (!w.__discDeckHook && !(session && Object.prototype.hasOwnProperty.call(session, "setActionHandler"))) {
  w.__discDeckHook = true
  install(session)
}
