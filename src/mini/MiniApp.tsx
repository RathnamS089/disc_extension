// The pop-up card's contents, framed into the page by src/content/mini.ts:
// the 3D disc on the left, what's playing and the controls on the right.

import { useEffect, useMemo, useState } from "react"
import { Pause, Play, SkipBack, SkipForward } from "lucide-react"
import DiscCascadeCarousel from "@/components/ui/disc-cascade-carousel"
import { IconButton } from "@/components/player-bar"
import { focusTab, sendCommand, toDiscItem, useTabMedia } from "@/lib/tab-media"

const HEIGHT = "190px"
const SERIF = '"Instrument Serif", "Bodoni Moda", Didot, "Times New Roman", serif'

export default function MiniApp() {
  const tabs = useTabMedia()
  const [chosenId, setChosenId] = useState<number | null>(() => Number(new URLSearchParams(location.search).get("tab")) || null)

  // the card asks for a tab when a new track pops it
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { discDeck?: string; tabId?: number } | null
      if (d?.discDeck === "show" && typeof d.tabId === "number") setChosenId(d.tabId)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const index = Math.max(
    0,
    tabs.findIndex((t) => t.tabId === chosenId),
  )
  const chosen = tabs[index]
  const items = useMemo(() => tabs.map(toDiscItem), [tabs])

  return (
    <div className="flex h-full overflow-hidden" style={{ height: HEIGHT, background: "radial-gradient(120% 120% at 20% 50%, #1d1d21, #0b0b0d)" }}>
      <div className="w-[170px] shrink-0">
        {chosen ? (
          <DiscCascadeCarousel
            items={items}
            index={index}
            onIndexChange={(i) => setChosenId(tabs[i]?.tabId ?? null)}
            onSelect={() => focusTab(chosen.tabId)}
            height={HEIGHT}
            discSize="128px"
            spin={chosen.playing ? 14 : 0}
            details={false}
            reviews={false}
            controls={false}
            indexLabel=""
            hint=""
            frame={false}
            background="transparent"
            color="#ecebe7"
            ariaLabel="Tabs playing media"
          />
        ) : null}
      </div>

      {chosen ? (
        <div className="flex min-w-0 flex-1 flex-col py-4 pr-4">
          <button type="button" onClick={() => focusTab(chosen.tabId)} className="flex min-w-0 items-center gap-1.5 pr-6 text-left" title="Go to tab">
            {chosen.favIconUrl ? <img src={chosen.favIconUrl} alt="" className="size-3 shrink-0 rounded-sm" /> : null}
            <span className="truncate text-[9px] font-semibold tracking-[.16em] text-muted-foreground uppercase">{chosen.site}</span>
          </button>
          <h2 className="mt-2 line-clamp-2 text-[22px] leading-[.95] uppercase" style={{ fontFamily: SERIF }}>
            {chosen.title}
          </h2>
          <p className="mt-1.5 truncate border-t border-foreground/40 pt-1.5 text-[11px]">{chosen.artist || chosen.album}</p>
          <div className="mt-auto flex items-center gap-2">
            <IconButton label="Previous track" onClick={() => sendCommand(chosen.tabId, "prev")}>
              <SkipBack className="size-4" />
            </IconButton>
            <IconButton label={chosen.playing ? "Pause" : "Play"} onClick={() => sendCommand(chosen.tabId, "toggle")} primary>
              {chosen.playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
            </IconButton>
            <IconButton label="Next track" onClick={() => sendCommand(chosen.tabId, "next")}>
              <SkipForward className="size-4" />
            </IconButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
