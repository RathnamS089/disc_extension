# Chrome Web Store submission

Everything the developer dashboard asks for, ready to paste. Upload `disc-deck.zip` (made by `npm run package`).

## Store listing tab

**Name:** Disc Deck

**Summary** (from the manifest, 125 of 132 characters):
See what's playing in your tabs as spinning 3D discs, with up next and play, pause and skip from a side panel or mini player.

**Category:** Entertainment (or Tools)

**Language:** English

**Description:**

> Disc Deck turns whatever is playing in your browser into a spinning 3D disc, with the album art as its label, and lets you control it without hunting for the tab.
>
> • Side panel: click the toolbar icon to see every tab that's playing as a disc. Drag between them, and play, pause or skip from the bar underneath.
> • Mini player: when a track starts, a small card with the disc slides into the corner of the tab you're on, and follows you from tab to tab. Drag it wherever suits you, or close it until the next track.
> • Up next: on YouTube Music and YouTube, the next three tracks sit behind the playing disc. Click one to bring it forward, click again to play it.
> • Works with YouTube Music, YouTube, Spotify, SoundCloud, Apple Music, Deezer, Bandcamp and most other web players. No accounts, no API keys, nothing to sign in to.
>
> Private by design: Disc Deck reads only what the page reports as playing (the same details Chrome's own media controls show), keeps it on your device, and sends nothing anywhere. No analytics, no tracking.
>
> Disc Deck isn't affiliated with or endorsed by YouTube, Spotify or any other service it works with.

**Icon:** `public/icons/icon-128.png`

**Screenshots** (at least 1, up to 5; 1280×800 or 640×400 PNG/JPEG). Take these yourself in Chrome:
1. The side panel open next to YouTube Music, a track playing.
2. The mini player card on another site (Wikipedia works well), with up-next discs behind.
3. The side panel with two or three tabs playing, mid-drag between discs.

**Small promo tile** (440×280, optional): the disc on a dark background with the name.

## Privacy practices tab

**Single purpose:**
Show the media playing in the user's tabs and let them control it (play, pause, skip, pick an up-next track) from a side panel or a mini player.

**Permission justifications:**

- `sidePanel`: The extension's main view is a side panel listing what's playing in each tab, with playback controls.
- `storage`: Keeps the list of tabs that are playing (session storage, cleared with the browser) and two settings, whether the mini player pops up and where the user dragged it (local storage). All on the device.
- `scripting`: Chrome only adds content scripts to pages loaded after install. On install or update, the extension adds its scripts to tabs that are already open, so playing media there is picked up without the user reloading every tab.
- Host permission `<all_urls>`: Media can play on any website, so the extension needs to read the Media Session (title, artist, album, cover art, play state) on whatever site the user is listening on, and pass play, pause and skip commands to that page's own player. It reads nothing else from the page.

**Remote code:** No, I am not using remote code. (All scripts are bundled in the package. The only remote content is cover images, loaded as `<img>`.)

**Data usage:** tick **none** of the data types. The extension collects and transmits no user data. Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** host `PRIVACY.md` somewhere public and paste the link (a public GitHub repo's file link works, or GitHub Pages).

## Distribution tab

- **Visibility:** Public, or Unlisted to share a link with testers first.
- **Regions:** all.

## Test instructions (for the reviewer, optional)

> No account needed. Open https://music.youtube.com and play any song (or any YouTube video). Click the Disc Deck toolbar icon to open the side panel: the track shows as a spinning disc with play/pause, previous and next. Switch to another tab: a mini player card appears bottom-right with the same controls. On YouTube Music, the discs behind the playing one are the next tracks in the queue; click one, then click it again to play it.
