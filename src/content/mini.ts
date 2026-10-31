// The pop-up: a rounded rectangle that slides into the tab you're looking at
// when something plays and stays there until the music stops or you close it.
// It sits bottom-right, above where players keep their own bar, and you can drag
// it anywhere by its top strip; the spot is remembered for every tab.
// The card is a frame onto the extension's own mini page (src/mini), which draws
// the 3D disc with React. The frame is only created when the card pops and is
// dropped again when it hides, so ordinary pages carry nothing extra.

import type { RuntimeMessage } from "@/shared/types"

const PAGE = "src/mini/index.html"
const POS_KEY = "miniPos"
const WIDTH = 360
const HEIGHT = 190
const MARGIN = 16
// clear of the player bars at the bottom of YouTube Music, Spotify and SoundCloud
const DEFAULT_POS = { right: 16, bottom: 96 }

const CSS = `
:host{all:initial}
.card{position:fixed;z-index:2147483647;box-sizing:border-box;
  width:${WIDTH}px;height:${HEIGHT}px;max-width:calc(100vw - ${MARGIN * 2}px);border-radius:18px;overflow:hidden;background:#0b0b0d;
  box-shadow:0 24px 60px -18px rgba(0,0,0,.65),0 0 0 1px rgba(236,235,231,.12);
  opacity:0;transform:translateY(16px) scale(.96);pointer-events:none;
  transition:opacity .22s ease,transform .42s cubic-bezier(.2,.8,.2,1)}
.card[data-open]{opacity:1;transform:none;pointer-events:auto}
.card[data-dragging]{transition:none}
.card[data-dragging] iframe{pointer-events:none}
iframe{display:block;width:100%;height:100%;border:0;color-scheme:dark}
.grip{position:absolute;top:0;left:0;right:40px;height:16px;cursor:grab;touch-action:none;display:grid;place-items:center}
.grip::after{content:"";width:36px;height:4px;border-radius:99px;background:rgba(236,235,231,.22);opacity:0;transition:opacity .15s}
.card:hover .grip::after,.card[data-dragging] .grip::after{opacity:1}
.card[data-dragging] .grip{cursor:grabbing}
.x{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:22px;height:22px;margin:0;padding:0;
  border:1px solid rgba(236,235,231,.18);border-radius:999px;background:rgba(18,18,21,.8);color:#ecebe7;cursor:pointer;
  opacity:0;transition:opacity .15s}
.x.pip{right:38px}
.card:hover .x,.x:focus-visible{opacity:1}
@media (prefers-reduced-motion:reduce){.card{transition:none}}
`
const POP_OUT =
  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 10V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><rect x="2" y="13" width="9" height="7" rx="1"/></svg>'
const CLOSE =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

type Pos = { right: number; bottom: number }

// Document Picture-in-Picture: a small always-on-top window that floats over every
// tab, the New Tab page and other apps, where no page script can reach. It needs a
// click to open. Not in TypeScript's DOM types yet.
type DocumentPiP = { requestWindow(o: { width: number; height: number }): Promise<Window> }
const docPip = (window as Window & { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture

let card: HTMLElement | null = null
let host: HTMLElement | null = null
let frame: HTMLIFrameElement | null = null
let tabId: number | null = null
let pos: Pos = DEFAULT_POS

function send(msg: RuntimeMessage) {
  try {
    chrome.runtime.sendMessage(msg).catch(() => {})
  } catch {
    // the extension was reloaded; this copy is an orphan
  }
}

/** Keep the whole card on screen, whatever the window size. */
function place() {
  if (!card) return
  const w = Math.min(WIDTH, innerWidth - MARGIN * 2)
  const right = Math.max(MARGIN, Math.min(pos.right, innerWidth - w - MARGIN))
  const bottom = Math.max(MARGIN, Math.min(pos.bottom, innerHeight - HEIGHT - MARGIN))
  card.style.right = right + "px"
  card.style.bottom = bottom + "px"
}

function draggable(c: HTMLElement, grip: HTMLElement) {
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    grip.setPointerCapture(e.pointerId)
    c.setAttribute("data-dragging", "")
    const start = { x: e.clientX, y: e.clientY, ...pos }
    const move = (m: PointerEvent) => {
      pos = { right: start.right - (m.clientX - start.x), bottom: start.bottom - (m.clientY - start.y) }
      place()
    }
    const up = () => {
      c.removeAttribute("data-dragging")
      grip.removeEventListener("pointermove", move)
      // store what's on screen, so a spot clamped by a small window doesn't come back
      pos = { right: parseFloat(c.style.right), bottom: parseFloat(c.style.bottom) }
      chrome.storage.local.set({ [POS_KEY]: pos }).catch(() => {})
    }
    grip.addEventListener("pointermove", move)
    grip.addEventListener("pointerup", up, { once: true })
    grip.addEventListener("pointercancel", up, { once: true })
  })
}

function mount(): HTMLElement {
  if (host && card) {
    // a page that rebuilds its document can drop us; put the card back
    if (!host.isConnected) document.documentElement.appendChild(host)
    return card
  }
  host = document.createElement("disc-deck-mini")
  const root = host.attachShadow({ mode: "closed" })
  root.innerHTML = `<style>${CSS}</style><div class="card" role="region" aria-label="Now playing"><div class="grip" title="Drag to move"></div>${docPip ? `<button class="x pip" aria-label="Float over all tabs" title="Float over all tabs">${POP_OUT}</button>` : ""}<button class="x" aria-label="Close">${CLOSE}</button></div>`
  document.documentElement.appendChild(host)
  const c = root.querySelector(".card") as HTMLElement
  c.querySelector(".pip")?.addEventListener("click", popOut)
  c.querySelector(".x:not(.pip)")!.addEventListener("click", () => {
    hide()
    if (tabId != null) send({ type: "mini:dismiss", tabId })
  })
  draggable(c, c.querySelector(".grip") as HTMLElement)
  addEventListener("resize", place)
  card = c
  place()
  return c
}

function show(id: number) {
  const c = mount()
  tabId = id
  if (frame) {
    frame.contentWindow?.postMessage({ discDeck: "show", tabId: id }, new URL(frame.src).origin)
    c.setAttribute("data-open", "")
    return
  }
  frame = document.createElement("iframe")
  frame.title = "Disc Deck mini player"
  frame.src = chrome.runtime.getURL(PAGE) + "?tab=" + id
  // slide in once the disc is drawn, not onto an empty frame
  frame.addEventListener("load", () => requestAnimationFrame(() => c.setAttribute("data-open", "")), { once: true })
  // the grip and close button stay above the frame
  c.prepend(frame)
}

function hide() {
  if (!card) return
  card.removeAttribute("data-open")
  const f = frame
  // drop the frame after the slide-out, unless the card popped again meanwhile
  setTimeout(() => {
    if (f && frame === f && !card?.hasAttribute("data-open")) {
      f.remove()
      frame = null
    }
  }, 450)
}

/** Move the card into a floating window that follows you to every tab. */
async function popOut() {
  if (!docPip || tabId == null) return
  let win: Window
  try {
    win = await docPip.requestWindow({ width: WIDTH, height: HEIGHT })
  } catch {
    return // no click to open it with, or the page doesn't allow it
  }
  const doc = win.document
  doc.title = "Disc Deck"
  doc.body.style.cssText = "margin:0;background:#0b0b0d;overflow:hidden"
  const f = doc.createElement("iframe")
  f.title = "Disc Deck mini player"
  f.src = chrome.runtime.getURL(PAGE) + "?tab=" + tabId
  f.style.cssText = "display:block;width:100vw;height:100vh;border:0;color-scheme:dark"
  doc.body.appendChild(f)
  win.addEventListener("pagehide", () => send({ type: "mini:pip", open: false }), { once: true })
  hide()
  send({ type: "mini:pip", open: true })
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === "mini:state" && msg.pop) show(msg.media.tabId)
  else if (msg.type === "mini:hide") hide()
  else if (msg.type === "mini:gone" && msg.tabId === tabId) {
    hide()
    tabId = null
  }
})

chrome.storage.local
  .get(POS_KEY)
  .then((r) => {
    if (r[POS_KEY]) pos = r[POS_KEY] as Pos
    place()
  })
  .catch(() => {})

// a page that loads while something plays gets the card straight away
if (document.visibilityState === "visible") send({ type: "mini:ready" })
