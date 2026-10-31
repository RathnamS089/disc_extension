# Disc Deck

A Chrome extension (Manifest V3) that shows whatever is playing in your tabs as spinning discs in the side panel, with play/pause, next and previous. No streaming-service API keys: it reads the browser's Media Session, the same data Chrome's own media controls use.

Works with YouTube, YouTube Music, Spotify Web, SoundCloud, Apple Music web, Deezer, Bandcamp and most other web players.

## Run it

```bash
npm install
npm run build        # or: npm run dev  (rebuilds on save)
```

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → pick the `dist` folder.
3. Click the toolbar icon to open the side panel, then play something in a tab. Tabs that were open before you loaded the extension need a reload.

After a rebuild, press the reload icon on the extension card.

## How it works

```
page (MAIN world)          isolated world            service worker             side panel (React)
src/content/hook.ts  ──▶  src/content/bridge.ts  ──▶  src/background/index.ts  ──▶  src/sidepanel/App.tsx
   postMessage        ◀──    chrome.runtime      ◀──     chrome.tabs           ◀──    player bar buttons
```

- **hook.ts** runs inside the page before the player loads. It wraps `navigator.mediaSession.setActionHandler` to keep the site's own play/pause/next/previous handlers (the ones media keys trigger) and calls them on command. Sites without handlers fall back to the `<audio>/<video>` element, or to clicking known next/previous buttons.
- **bridge.ts** relays between the page and the extension (only the isolated world can use `chrome.runtime`).
- **background** keeps the list of tabs with media in `chrome.storage.session` and forwards commands.
- **mini.ts** pops a 360×190 card into the tab you are looking at when a track starts or changes, or when you switch tabs while something plays. It stays until the music stops or you close it (closed stays closed for that track), sits bottom-right above the players' own bars, and can be dragged by its top strip; the spot is remembered. The card frames `src/mini` (the 3D disc carousel plus title and controls), created only while the card is showing. Toggle it with the picture-in-picture button in the side panel.
- **Side panel** renders the tabs with `DiscCascadeCarousel` (album art becomes the disc label, the chosen disc spins while playing) and a lucide-react player bar.

## Project layout

shadcn-style: components in `src/components/ui`, `cn()` in `src/lib/utils.ts`, Tailwind v4 via `@tailwindcss/vite`, `@/` → `src/`. Add shadcn components with `npx shadcn@latest add <name>`.

The three content scripts must build to single files with no imports, because Chrome loads them as classic scripts. Keep their imports from `src/shared` type-only.

## Limits

- Native desktop apps (the Spotify app etc.) aren't visible. That would need the service's own API.
- Players inside iframes aren't picked up (main frame only).
- A site that neither uses the Media Session nor matches a fallback selector can play/pause but not skip.
