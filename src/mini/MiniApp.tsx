// The pop-up card's contents, framed into the page by src/content/mini.ts:
// the 3D disc on the left, what's playing and the controls on the right.
// The discs stacked behind the playing one are the page's "Up next" queue:
// click one to bring it forward, click it again (or press play) to start it.

import { useEffect, useMemo, useState } from "react"
import { Pause, Play, SkipBack, SkipForward } from "lucide-react"
import DiscCascadeCarousel, { type DiscCascadeItem } from "@/components/ui/disc-cascade-carousel"
import { IconButton } from "@/components/player-bar"
import { focusTab, playQueued, sendCommand, toDiscItem, useTabMedia } from "@/lib/tab-media"
import type { QueueItem } from "@/shared/types"

const HEIGHT = "190px"
const SERIF = '"Instrument Serif", "Bodoni Moda", Didot, "Times New Roman", serif'

const queuedDisc = (q: QueueItem): DiscCascadeItem => ({
  title: q.title,
  src: q.artwork,
  alt: q.title,
  credits: q.artist ? [{ label: "Artist", value: q.artist }] : [],
})

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

  const chosen = tabs.find((t) => t.tabId === chosenId) ?? tabs[0]
  const queue = chosen?.queue ?? []

  // Next-up sits right behind the playing disc, on the side the card has room for:
  // the queue runs backwards and the playing track is the last disc.
  const items = useMemo(
    () => (chosen ? [...[...queue].reverse().map(queuedDisc), toDiscItem(chosen)] : []),
    [chosen, queue],
  )
  const current = items.length - 1
  const [view, setView] = useState(current)

  // a new track (or a new queue) brings the playing disc back to the front
  const trackKey = chosen ? `${chosen.tabId}|${chosen.title}|${queue.length}` : ""
  useEffect(() => setView(current), [trackKey, current])

  if (!chosen) return <div style={{ height: HEIGHT, background: "#0b0b0d" }} />

  // before the first list arrives there is no disc to view (current is -1); anything out of range means the playing one
  const viewing = view >= 0 && view <= current ? view : current
  const queued = viewing < current ? { index: current - 1 - viewing, item: queue[current - 1 - viewing] } : null
  const playQueuedItem = () => queued && playQueued(chosen.tabId, queued.index, queued.item.title)

  const title = queued ? queued.item.title : chosen.title
  const byline = queued ? queued.item.artist : chosen.artist || chosen.album

  return (
    <div className="flex overflow-hidden" style={{ height: HEIGHT, background: "radial-gradient(120% 120% at 20% 50%, #1d1d21, #0b0b0d)" }}>
      <div className="relative w-[164px] shrink-0 overflow-hidden">
        <DiscCascadeCarousel
          items={items}
          index={viewing}
          onIndexChange={setView}
          onSelect={(_, i) => (i === current ? focusTab(chosen.tabId) : playQueuedItem())}
          loop={false}
          height={HEIGHT}
          discSize="124px"
          spin={chosen.playing && !queued ? 14 : 0}
          details={false}
          reviews={false}
          controls={false}
          indexLabel=""
          hint=""
          frame={false}
          background="transparent"
          color="#ecebe7"
          ariaLabel="Now playing and up next"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-4 pr-4 pl-3">
        <button type="button" onClick={() => focusTab(chosen.tabId)} className="flex min-w-0 items-center gap-1.5 pr-7 text-left" title="Go to tab">
          {queued ? null : chosen.favIconUrl ? <img src={chosen.favIconUrl} alt="" className="size-3 shrink-0 rounded-sm" /> : null}
          <span className="truncate text-[9px] font-semibold tracking-[.16em] text-muted-foreground uppercase">
            {queued ? `Up next · ${queued.index + 1} of ${queue.length}` : chosen.site}
          </span>
        </button>
        <h2 className="mt-2 line-clamp-2 text-[19px] leading-[1.02] break-words uppercase" style={{ fontFamily: SERIF }} title={title}>
          {title}
        </h2>
        <p className="mt-1.5 truncate border-t border-foreground/30 pt-1.5 text-[11px] text-foreground/85">{byline}</p>
        <div className="mt-auto flex items-center gap-2">
          <IconButton label="Previous track" onClick={() => sendCommand(chosen.tabId, "prev")}>
            <SkipBack className="size-4" />
          </IconButton>
          {queued ? (
            <IconButton label={`Play ${queued.item.title}`} onClick={playQueuedItem} primary>
              <Play className="size-5 translate-x-px" />
            </IconButton>
          ) : (
            <IconButton label={chosen.playing ? "Pause" : "Play"} onClick={() => sendCommand(chosen.tabId, "toggle")} primary>
              {chosen.playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
            </IconButton>
          )}
          <IconButton label="Next track" onClick={() => sendCommand(chosen.tabId, "next")}>
            <SkipForward className="size-4" />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
