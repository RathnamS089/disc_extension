// The mini player: a small card in the corner of the active tab that slides in
// when a track starts or changes, and tucks itself away after a few seconds.
// Plain DOM in a closed shadow root, so the page's CSS can't touch it and this
// script stays a single import-free file.

import type { MediaCommand, RuntimeMessage, TabMedia } from "@/shared/types"

const HIDE_AFTER = 6000

// lucide paths: play, pause, skip-forward, skip-back, x
const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
  prev: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
}
const icon = (paths: string, size: number) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const CSS = `
:host{all:initial}
.card{position:fixed;right:16px;bottom:16px;z-index:2147483647;box-sizing:border-box;display:flex;align-items:center;gap:12px;
  width:320px;max-width:calc(100vw - 32px);padding:10px 10px 10px 12px;border-radius:14px;
  background:rgba(18,18,21,.88);color:#ecebe7;border:1px solid rgba(236,235,231,.12);
  box-shadow:0 18px 40px -12px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);
  font:13px/1.3 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
  opacity:0;transform:translateY(14px) scale(.97);pointer-events:none;
  transition:opacity .22s ease,transform .38s cubic-bezier(.2,.8,.2,1)}
.card[data-open]{opacity:1;transform:none;pointer-events:auto}
.disc{position:relative;flex:none;width:46px;height:46px;border-radius:50%;overflow:hidden;
  background:conic-gradient(from 30deg,#3a3a42,#8d9196,#2a2a30,#c4c7cb,#3a3a42);
  animation:spin 5s linear infinite;animation-play-state:paused}
.card[data-playing] .disc{animation-play-state:running}
.disc img{display:block;width:100%;height:100%;object-fit:cover}
.disc::after{content:"";position:absolute;inset:39%;border-radius:50%;background:#121215;box-shadow:0 0 0 2px rgba(236,235,231,.55)}
.meta{flex:1;min-width:0;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.t,.a{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t{font-weight:600}
.a{margin-top:2px;font-size:11.5px;opacity:.6}
.ctl{display:flex;align-items:center;gap:2px}
.b{display:grid;place-items:center;width:30px;height:30px;margin:0;padding:0;border:0;border-radius:999px;
  background:none;color:inherit;cursor:pointer;transition:background .15s,transform .15s}
.b:hover{background:rgba(236,235,231,.1)}
.b:active{transform:scale(.9)}
.b.p{width:36px;height:36px;margin:0 2px;background:#ecebe7;color:#121215}
.b.p:hover{background:#fff}
.b:focus-visible,.meta:focus-visible{outline:2px solid #ecebe7;outline-offset:2px}
.x{position:absolute;top:-7px;left:-7px;width:20px;height:20px;background:#2a2a30;border:1px solid rgba(236,235,231,.18);
  opacity:0;transition:opacity .15s}
.card:hover .x,.x:focus-visible{opacity:1}
@keyframes spin{to{transform:rotate(1turn)}}
@media (prefers-reduced-motion:reduce){.card{transition:none}.disc{animation:none}}
`

type UI = { host: HTMLElement; card: HTMLElement; img: HTMLImageElement; title: HTMLElement; artist: HTMLElement; toggle: HTMLElement }

let ui: UI | null = null
let current: TabMedia | null = null
let timer = 0
let hovering = false

function send(msg: RuntimeMessage) {
  chrome.runtime.sendMessage(msg).catch(() => {})
}

function mount(): UI {
  if (ui) {
    // a page that rebuilds its document can drop us; put the card back
    if (!ui.host.isConnected) document.documentElement.appendChild(ui.host)
    return ui
  }
  const host = document.createElement("disc-deck-mini")
  const root = host.attachShadow({ mode: "closed" })
  root.innerHTML =
    `<style>${CSS}</style>` +
    `<div class="card" role="region" aria-label="Now playing">` +
    `<button class="b x" data-act="close" aria-label="Close">${icon(ICONS.close, 11)}</button>` +
    `<div class="disc"><img alt="" referrerpolicy="no-referrer"></div>` +
    `<button class="meta" data-act="focus" title="Go to tab"><span class="t"></span><span class="a"></span></button>` +
    `<div class="ctl">` +
    `<button class="b" data-act="prev" aria-label="Previous track">${icon(ICONS.prev, 16)}</button>` +
    `<button class="b p" data-act="toggle" aria-label="Play"></button>` +
    `<button class="b" data-act="next" aria-label="Next track">${icon(ICONS.next, 16)}</button>` +
    `</div></div>`
  document.documentElement.appendChild(host)

  const $ = <T extends Element>(s: string) => root.querySelector(s) as T
  ui = { host, card: $(".card"), img: $("img"), title: $(".t"), artist: $(".a"), toggle: $("[data-act=toggle]") }
  ui.img.addEventListener("error", () => (ui!.img.hidden = true))

  ui.card.addEventListener("click", (e) => {
    const act = (e.target as Element).closest("[data-act]")?.getAttribute("data-act")
    if (!act || !current) return
    if (act === "close") return hide()
    if (act === "focus") send({ type: "media:focus", tabId: current.tabId })
    else send({ type: "media:cmd", tabId: current.tabId, cmd: act as MediaCommand })
    schedule()
  })
  ui.card.addEventListener("mouseenter", () => {
    hovering = true
    clearTimeout(timer)
  })
  ui.card.addEventListener("mouseleave", () => {
    hovering = false
    schedule()
  })
  return ui
}

function render(m: TabMedia) {
  const u = mount()
  const changed = current?.artwork !== m.artwork
  current = m
  u.title.textContent = m.title
  u.artist.textContent = m.artist || m.site
  if (changed) {
    u.img.hidden = !m.artwork
    if (m.artwork) u.img.src = m.artwork
    else u.img.removeAttribute("src")
  }
  u.toggle.innerHTML = icon(m.playing ? ICONS.pause : ICONS.play, 16)
  u.toggle.setAttribute("aria-label", m.playing ? "Pause" : "Play")
  u.card.toggleAttribute("data-playing", m.playing)
}

function schedule() {
  clearTimeout(timer)
  if (!hovering) timer = window.setTimeout(hide, HIDE_AFTER)
}

function open() {
  const u = mount()
  // a frame between insert and open, so the slide-in transition runs
  requestAnimationFrame(() => u.card.setAttribute("data-open", ""))
  schedule()
}

function hide() {
  clearTimeout(timer)
  ui?.card.removeAttribute("data-open")
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === "mini:state") {
    if (msg.pop) {
      render(msg.media)
      open()
    } else if (current?.tabId === msg.media.tabId) render(msg.media)
  } else if (msg.type === "mini:gone" && current?.tabId === msg.tabId) {
    hide()
    current = null
  }
})
