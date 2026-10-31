import type { ReactNode } from "react"
import { Pause, Play, SkipBack, SkipForward } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MediaCommand, TabMedia } from "@/shared/types"

type Props = {
  media: TabMedia
  onCommand: (cmd: MediaCommand) => void
  onFocus: () => void
}

function IconButton({ label, onClick, primary, children }: { label: string; onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid place-items-center rounded-full transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        primary
          ? "size-11 bg-foreground text-background hover:opacity-90"
          : "size-9 border border-border text-foreground hover:bg-foreground/10",
      )}
    >
      {children}
    </button>
  )
}

export function PlayerBar({ media, onCommand, onFocus }: Props) {
  return (
    <div className="flex items-center gap-3 border-t border-border bg-muted/60 px-4 py-3 backdrop-blur">
      <button type="button" onClick={onFocus} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Go to tab">
        {media.favIconUrl ? <img src={media.favIconUrl} alt="" className="size-4 shrink-0 rounded-sm" /> : null}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{media.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{media.artist || media.site}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton label="Previous track" onClick={() => onCommand("prev")}>
          <SkipBack className="size-4" />
        </IconButton>
        <IconButton label={media.playing ? "Pause" : "Play"} onClick={() => onCommand("toggle")} primary>
          {media.playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
        </IconButton>
        <IconButton label="Next track" onClick={() => onCommand("next")}>
          <SkipForward className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}
