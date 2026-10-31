import { useMemo, useState } from "react"
import { Disc3, PictureInPicture2 } from "lucide-react"
import DiscCascadeCarousel, { type DiscCascadeItem } from "@/components/ui/disc-cascade-carousel"
import { PlayerBar } from "@/components/player-bar"
import { cn } from "@/lib/utils"
import { focusTab, sendCommand, useAutoPop, useTabMedia } from "./use-tab-media"

const BAR_HEIGHT = "68px"

function PopToggle() {
  const [on, setOn] = useAutoPop()
  const label = on ? "Mini player pops up on play: on" : "Mini player pops up on play: off"
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={() => setOn(!on)}
      className={cn(
        "absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-full border border-border transition hover:bg-foreground/10",
        on ? "text-foreground" : "text-muted-foreground opacity-60",
      )}
    >
      <PictureInPicture2 className="size-4" />
    </button>
  )
}

export default function App() {
  const tabs = useTabMedia()
  // Follow the chosen tab by id, so the selection holds while the list reorders.
  const [chosenId, setChosenId] = useState<number | null>(null)

  const index = Math.max(
    0,
    tabs.findIndex((t) => t.tabId === chosenId),
  )
  const chosen = tabs[index]

  const items = useMemo<DiscCascadeItem[]>(
    () =>
      tabs.map((t) => ({
        title: t.title,
        src: t.artwork,
        alt: t.album || t.title,
        credits: [
          ...(t.artist ? [{ label: "Artist", value: t.artist }] : []),
          ...(t.album ? [{ label: "Album", value: t.album }] : []),
          { label: "Playing on", value: t.site },
        ],
      })),
    [tabs],
  )

  if (!chosen) {
    return (
      <div className="relative grid h-full place-items-center p-8 text-center">
        <PopToggle />
        <div className="max-w-60">
          <Disc3 className="mx-auto mb-4 size-10 opacity-40" />
          <p className="text-sm font-semibold">Nothing playing</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start a track on YouTube, Spotify, SoundCloud or any other player and it shows up here. Tabs opened before
            the extension was installed need a reload.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <PopToggle />
      <DiscCascadeCarousel
        items={items}
        index={index}
        onIndexChange={(i) => setChosenId(tabs[i]?.tabId ?? null)}
        onSelect={() => focusTab(chosen.tabId)}
        height={`calc(100vh - ${BAR_HEIGHT})`}
        discSize="clamp(150px, 62vw, 340px)"
        spin={chosen.playing ? 18 : 0}
        brand="disc deck"
        indexLabel={tabs.length > 1 ? "Tabs" : ""}
        reviews={false}
        controls={false}
        hint=""
        background="radial-gradient(120% 90% at 50% 40%, #1d1d21, #0b0b0d)"
        color="#ecebe7"
        ariaLabel="Tabs playing media"
      />
      <PlayerBar media={chosen} onCommand={(cmd) => sendCommand(chosen.tabId, cmd)} onFocus={() => focusTab(chosen.tabId)} />
    </div>
  )
}
