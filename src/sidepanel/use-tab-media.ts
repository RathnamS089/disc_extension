import { useEffect, useState } from "react"
import { AUTO_POP_KEY, type MediaCommand, type RuntimeMessage, type TabMedia } from "@/shared/types"

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

/** Whether the mini player pops up by itself, kept in sync with storage. */
export function useAutoPop(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true)

  useEffect(() => {
    chrome.storage.local.get(AUTO_POP_KEY).then((r) => setOn(r[AUTO_POP_KEY] !== false))
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && AUTO_POP_KEY in changes) setOn(changes[AUTO_POP_KEY].newValue !== false)
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  return [on, (next) => chrome.storage.local.set({ [AUTO_POP_KEY]: next })]
}

export function sendCommand(tabId: number, cmd: MediaCommand) {
  chrome.runtime.sendMessage({ type: "media:cmd", tabId, cmd } satisfies RuntimeMessage)
}

export function focusTab(tabId: number) {
  chrome.runtime.sendMessage({ type: "media:focus", tabId } satisfies RuntimeMessage)
}
