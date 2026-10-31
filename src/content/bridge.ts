// Runs in the extension's isolated world: the only side that can talk to the
// background. Relays snapshots up from the page hook and commands back down.

import type { BridgeMessage, HookMessage, RuntimeMessage } from "@/shared/types"

const HOOK: HookMessage["source"] = "disc-deck:hook"
const BRIDGE: BridgeMessage["source"] = "disc-deck:bridge"

function send(msg: RuntimeMessage) {
  // The extension may have been reloaded under this page; drop the message then.
  try {
    chrome.runtime.sendMessage(msg).catch(() => {})
  } catch {
    // context invalidated: this copy is orphaned and a fresh one has replaced it
  }
}

window.addEventListener("message", (e) => {
  if (e.source !== window) return
  const m = e.data as HookMessage | undefined
  if (m?.source === HOOK) send({ type: "media:update", snapshot: m.snapshot })
})

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === "media:run") window.postMessage({ source: BRIDGE, cmd: msg.cmd } satisfies BridgeMessage, "*")
  else if (msg.type === "media:runQueue")
    window.postMessage({ source: BRIDGE, queue: { index: msg.index, title: msg.title } } satisfies BridgeMessage, "*")
})

window.addEventListener("pagehide", () => send({ type: "media:update", snapshot: null }))

// If a hook is already running here (this bridge was added to an open tab), have it report afresh.
window.postMessage({ source: BRIDGE, sync: true } satisfies BridgeMessage, "*")
