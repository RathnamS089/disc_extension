// Keeps the list of tabs with something to play and passes commands to them.
// The service worker can be stopped at any time, so the list lives in session storage.

import type { RuntimeMessage, TabMedia } from "@/shared/types"

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
      if (msg.snapshot) {
        tabs.set(tab.id, {
          ...msg.snapshot,
          tabId: tab.id,
          windowId: tab.windowId,
          site: hostOf(tab.url),
          favIconUrl: tab.favIconUrl,
          updatedAt: Date.now(),
        })
      } else if (!tabs.delete(tab.id)) return
      publish()
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

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ready
  if (tabs.delete(tabId)) publish()
})
