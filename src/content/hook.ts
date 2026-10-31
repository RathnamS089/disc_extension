// Runs in the page's own JS world at document_start, before the player loads.
// It keeps hold of the handlers the page gives the Media Session (the same ones
// your keyboard's media keys trigger), so the side panel can call them later,
// and it reports what's playing to the bridge script.

import type { BridgeMessage, HookMessage, MediaCommand, MediaSnapshot } from "@/shared/types"

const HOOK: HookMessage["source"] = "disc-deck:hook"
const BRIDGE: BridgeMessage["source"] = "disc-deck:bridge"

const handlers = new Map<MediaSessionAction, MediaSessionActionHandler>()
let lastMedia: HTMLMediaElement | null = null

const ms = navigator.mediaSession
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
    canNext: handlers.has("nexttrack"),
    canPrev: handlers.has("previoustrack"),
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
  if (m?.source === BRIDGE) run(m.cmd)
})

for (const type of ["play", "pause", "ended", "loadedmetadata"]) document.addEventListener(type, report, true)
setInterval(report, 1000)
