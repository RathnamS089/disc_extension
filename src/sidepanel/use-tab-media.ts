import { useEffect, useState } from "react"
import type { MediaCommand, RuntimeMessage, TabMedia } from "@/shared/types"

/** The tabs that have something to play, kept live by the background. */
export function useTabMedia() {
  const [tabs, setTabs] = useState<TabMedia[]>([])

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "media:get" } satisfies RuntimeMessage).then((t: TabMedia[]) => setTabs(t ?? []))
    const onMessage = (msg: RuntimeMessage) => {
      if (msg.type === "media:list") setTabs(msg.tabs)
    }
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  return tabs
}

export function sendCommand(tabId: number, cmd: MediaCommand) {
  chrome.runtime.sendMessage({ type: "media:cmd", tabId, cmd } satisfies RuntimeMessage)
}

export function focusTab(tabId: number) {
  chrome.runtime.sendMessage({ type: "media:focus", tabId } satisfies RuntimeMessage)
}
