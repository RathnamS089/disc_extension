// Keeps the list of tabs with something to play and passes commands to them.
// The service worker can be stopped at any time, so the list lives in session storage.

import { AUTO_POP_KEY, type RuntimeMessage, type TabMedia } from "@/shared/types"

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

const tabs = new Map<number, TabMedia>()
const ready = chrome.storage.session.get("tabs").then((r) => {
  for (const t of (r.tabs as TabMedia[] | undefined) ?? []) tabs.set(t.tabId, t)
})

function list(): TabMedia[] {
  // playing first, then most recently changed
  return [...tabs.values()].sort((a, b) => Number(b.playing) - Number(a.playing) || b.updatedAt - a.updatedAt)
}

function publish() {
  const all = list()
  chrome.storage.session.set({ tabs: all }).catch(() => {})
  chrome.runtime.sendMessage({ type: "media:list", tabs: all } satisfies RuntimeMessage).catch(() => {})
}

/** Tell the mini player in whichever tab you're looking at. */
async function toMini(msg: RuntimeMessage) {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (active?.id != null) send(active.id, msg)
}

/** A tab with no mini player yet (discarded and restored, say) gets one, then the message. */
async function send(tabId: number, msg: RuntimeMessage) {
  try {
    await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 })
  } catch {
    if (msg.type !== "mini:state" || !msg.pop) return
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["mini.js"] })
      await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 })
    } catch {
      // a page we may not touch (chrome://, the Web Store, the new tab page)
    }
  }
}

/** Every tab's card, not just the active one: they all stay up while the music plays. */
async function toAllMinis(msg: RuntimeMessage) {
  const all = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] })
  for (const t of all) if (t.id != null) chrome.tabs.sendMessage(t.id, msg, { frameId: 0 }).catch(() => {})
}

// The track whose card you closed: it stays closed on every tab until the next track.
const trackKey = (t: TabMedia) => `${t.tabId}|${t.title}|${t.artist}`
let dismissed: string | null = null
chrome.storage.session.get("dismissed").then((r) => {
  dismissed = (r.dismissed as string | undefined) ?? null
})
function setDismissed(key: string | null) {
  dismissed = key
  chrome.storage.session.set({ dismissed: key }).catch(() => {})
}

async function autoPop(): Promise<boolean> {
  const r = await chrome.storage.local.get(AUTO_POP_KEY)
  return r[AUTO_POP_KEY] !== false
}

function hostOf(url?: string): string {
  try {
    return new URL(url ?? "").hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, sender, reply) => {
  ;(async () => {
    await ready
    if (msg.type === "media:update") {
      const tab = sender.tab
      if (!tab?.id || sender.frameId !== 0) return
      const prev = tabs.get(tab.id)
      if (msg.snapshot) {
        const media: TabMedia = {
          ...msg.snapshot,
          tabId: tab.id,
          windowId: tab.windowId,
          site: hostOf(tab.url),
          favIconUrl: tab.favIconUrl,
          updatedAt: Date.now(),
        }
        tabs.set(tab.id, media)
        // pop on a start or a new track, not on every pause
        const started = media.playing && (!prev?.playing || prev.title !== media.title || prev.artist !== media.artist)
        if (started && dismissed !== trackKey(media)) setDismissed(null)
        toMini({ type: "mini:state", media, pop: started && !dismissed && (await autoPop()) })
      } else if (tabs.delete(tab.id)) {
        toAllMinis({ type: "mini:gone", tabId: tab.id })
      } else return
      publish()
    } else if (msg.type === "mini:ready") {
      if (sender.tab?.id != null && sender.tab.active && sender.frameId === 0) popOn(sender.tab.id)
    } else if (msg.type === "mini:dismiss") {
      const t = tabs.get(msg.tabId)
      if (t) setDismissed(trackKey(t))
      toAllMinis({ type: "mini:gone", tabId: msg.tabId })
    } else if (msg.type === "media:get") {
      reply(list())
    } else if (msg.type === "media:cmd") {
      chrome.tabs.sendMessage(msg.tabId, { type: "media:run", cmd: msg.cmd } satisfies RuntimeMessage, { frameId: 0 }).catch(() => {
        // the tab is gone or the page predates the extension
        if (tabs.delete(msg.tabId)) publish()
      })
    } else if (msg.type === "media:focus") {
      const t = tabs.get(msg.tabId)
      if (!t) return
      await chrome.tabs.update(t.tabId, { active: true })
      await chrome.windows.update(t.windowId, { focused: true })
    }
  })()
  return msg.type === "media:get" // keep the channel open for the async reply
})

// Chrome only adds content scripts to pages loaded after the extension is, so a
// tab already open on install, update or reload would stay invisible until you
// refreshed it. Add them to those tabs now. The bridge goes first so it's
// listening when the hook reports.
chrome.runtime.onInstalled.addListener(async () => {
  const open = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] })
  await Promise.all(
    open.map(async (t) => {
      if (t.id == null || t.discarded) return
      const target = { tabId: t.id }
      try {
        await chrome.scripting.executeScript({ target, files: ["bridge.js", "mini.js"] })
        await chrome.scripting.executeScript({ target, files: ["hook.js"], world: "MAIN" })
      } catch {
        // a page we may not touch (Web Store, error pages)
      }
    }),
  )
})

// Switching to another tab while something plays pops the card there too, so the
// music follows you around, unless you closed it for this track.
async function popOn(tabId: number) {
  await ready
  const playing = list().find((t) => t.playing)
  if (!playing || dismissed === trackKey(playing) || !(await autoPop())) return
  send(tabId, { type: "mini:state", media: playing, pop: true })
}

chrome.tabs.onActivated.addListener(({ tabId }) => popOn(tabId))

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return
  const [active] = await chrome.tabs.query({ active: true, windowId })
  if (active?.id != null) popOn(active.id)
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ready
  if (!tabs.delete(tabId)) return
  toAllMinis({ type: "mini:gone", tabId })
  publish()
})
