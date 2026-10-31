// The pop-up: a rounded rectangle in the corner of the active tab that slides in
// when a track starts or changes, and tucks itself away after a few seconds.
// The card is a frame onto the extension's own mini page (src/mini), which draws
// the 3D disc with React. The frame is only created when the card pops and is
// dropped again when it hides, so ordinary pages carry nothing extra.

import type { RuntimeMessage } from "@/shared/types"

const HIDE_AFTER = 6000
const PAGE = "src/mini/index.html"

const CSS = `
:host{all:initial}
.card{position:fixed;right:16px;bottom:16px;z-index:2147483647;box-sizing:border-box;
  width:360px;height:190px;max-width:calc(100vw - 32px);border-radius:18px;overflow:hidden;background:#0b0b0d;
  box-shadow:0 24px 60px -18px rgba(0,0,0,.65),0 0 0 1px rgba(236,235,231,.12);
  opacity:0;transform:translateY(16px) scale(.96);pointer-events:none;
  transition:opacity .22s ease,transform .42s cubic-bezier(.2,.8,.2,1)}
.card[data-open]{opacity:1;transform:none;pointer-events:auto}
iframe{display:block;width:100%;height:100%;border:0;color-scheme:dark}
.x{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:22px;height:22px;margin:0;padding:0;
  border:1px solid rgba(236,235,231,.18);border-radius:999px;background:rgba(18,18,21,.8);color:#ecebe7;cursor:pointer;
  opacity:0;transition:opacity .15s}
.card:hover .x,.x:focus-visible{opacity:1}
@media (prefers-reduced-motion:reduce){.card{transition:none}}
`
const CLOSE =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

let card: HTMLElement | null = null
let host: HTMLElement | null = null
let frame: HTMLIFrameElement | null = null
let tabId: number | null = null
let timer = 0
let hovering = false

function mount(): HTMLElement {
  if (host && card) {
    // a page that rebuilds its document can drop us; put the card back
    if (!host.isConnected) document.documentElement.appendChild(host)
    return card
  }
  host = document.createElement("disc-deck-mini")
  const root = host.attachShadow({ mode: "closed" })
  root.innerHTML = `<style>${CSS}</style><div class="card" role="region" aria-label="Now playing"><button class="x" aria-label="Close">${CLOSE}</button></div>`
  document.documentElement.appendChild(host)
  const c = root.querySelector(".card") as HTMLElement
  c.querySelector(".x")!.addEventListener("click", hide)
  c.addEventListener("mouseenter", () => {
    hovering = true
    clearTimeout(timer)
  })
  c.addEventListener("mouseleave", () => {
    hovering = false
    schedule()
  })
  card = c
  return c
}

function schedule() {
  clearTimeout(timer)
  if (!hovering) timer = window.setTimeout(hide, HIDE_AFTER)
}

function show(id: number) {
  const c = mount()
  tabId = id
  schedule()
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
  c.appendChild(frame)
}

function hide() {
  clearTimeout(timer)
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

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === "mini:state" && msg.pop) show(msg.media.tabId)
  else if (msg.type === "mini:gone" && msg.tabId === tabId) {
    hide()
    tabId = null
  }
})
