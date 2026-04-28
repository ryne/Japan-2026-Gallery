# Japan 2026 Gallery

A cinematic, high-performance photo and video gallery featuring a gesture-driven UI and an auto-hiding carousel. Built with **React 18**, **Vite**, **Tailwind CSS**, and **Video.js**.

---

## Folder Structure

After setup, your project root should look like this:

```
japan-gallery/
├── media/                        ← YOUR MEDIA GOES HERE
│   ├── 1 - Tokyo (Asakusa)/
│   │   ├── PXL_20260325_193715308.jpg
│   │   └── PXL_20260325_201830123.mp4
│   ├── 2 - Kyoto (Higashiyama)/
│   │   └── ...
│   └── ... (folders 3–7)
├── public/
│   ├── thumbnails/               ← auto-generated, do not edit
│   └── manifest.json             ← auto-generated, do not edit
├── scripts/
│   └── generate-thumbnails.mjs
├── src/
│   ├── components/
│   │   ├── CarouselStrip.jsx
│   │   ├── MediaInfo.jsx
│   │   ├── NavArrows.jsx
│   │   ├── PresentationView.jsx
│   │   └── ThumbCard.jsx
│   ├── hooks/
│   │   ├── useCarouselReveal.js
│   │   ├── useGallery.js
│   │   └── useLazyLoad.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── .prettierrc
```

---

## Prerequisites

- **Node.js** v18 or later
- **ffmpeg** installed and available on your system PATH
  - macOS: `brew install ffmpeg`
  - Windows: Download from https://ffmpeg.org/download.html and add to PATH
  - Linux: `sudo apt install ffmpeg`

---

## Quick Start

### 1 — Install dependencies

```bash
npm install
```

### 2 — Add your media

Create a `media/` folder in the `public/` folder.  
Copy your trip folders into it exactly as they are named:

Example:

```
media/
  1 - Tokyo (Asakusa)/
  2 - Kyoto (Higashiyama)/
  3 - Osaka (Namba)/
  4 - Kyoto (Higashiyama)/
  5 - Kamakura/
  6 - Lake Kawaguchi (Mt. Fuji)/
  7 - Tokyo (Ikebukuro)/
```

> The script reads the folder names directly, so keep the `N - Location` format.
> Files inside each folder are sorted **alphabetically by filename**, which for Pixel naming
> equals **chronological order** (oldest → newest).

### 3 — Generate thumbnails + manifest

```bash
npm run thumbnails
```

This will:

- Scan all `media/` subfolders for `.jpg` and `.mp4` files
- Generate 208×208 JPEG thumbnails into `public/thumbnails/`
- Extract the **first frame** of every `.mp4` as its thumbnail (requires ffmpeg)
- Write `public/manifest.json` with all metadata

Re-run this any time you add or remove media files.

### 4 — Start the dev server

```bash
npm run dev
```

Then open http://localhost:3000

### 5 — Production build

```bash
npm run build
```

The `thumbnails` script runs automatically before the build.  
Output goes to `dist/`. Serve with any static host (Netlify, Vercel, nginx, etc.).

---

## How It Works

| Feature        | Implementation                                                           |
| -------------- | ------------------------------------------------------------------------ |
| Thumbnails     | `sharp` (images) + `fluent-ffmpeg` first-frame (videos)                  |
| Lazy loading   | Native `IntersectionObserver` via `useLazyLoad` hook                     |
| Gallery state  | Flat item array with "Pins" for region-based navigation.                 |
| Carousel       | Auto-hiding filmstrip with an interactive, gesture-reactive peek handle. |
| Metadata       | Filename parsing (`YYYYMMDD_HHMMSS`) with JST timezone adjustment.       |
| Video Player   | **Video.js** integration with volume persistence via `localStorage`.     |
| Cinematic Zoom | High-detail image overlay with panning and pinch-to-zoom.                |
| Gestures       | Pointer-based `useSwipe` hook for navigation, reveal, and hide.          |
| Responsive UI  | Dynamic layouts for Media Info (split on mobile, stacked on desktop).    |

---

## Interaction & Gestures

### Desktop

- **Double-Click**: Toggles Zoom Mode (Images) or Native Fullscreen (Videos).
- **Mouse Wheel**: Smoothly zooms in/out while in Cinematic View.
- **Click & Drag**: Pans zoomed images or navigates between items.

### Mobile / Touch

- **Pinch-to-Zoom**: Pinch in to enter Cinematic View; pinch out significantly to exit.
- **Double-Tap**: Toggles Cinematic View (Images) or Fullscreen (Videos).
- **Swipe Up/Down**: Reveals or hides the carousel strip via the peek bar.
- **Swipe Left/Right**: Navigates through the media gallery.

---

## Keyboard Shortcuts

| Key                    | Action                                             |
| ---------------------- | -------------------------------------------------- |
| `←` / `→`              | Navigate to previous/next item.                    |
| `Shift` + `←` / `→`    | Jump to the previous/next pinned section (Region). |
| `↑` / `↓`              | Toggle the Carousel visibility.                    |
| `F` or `Alt` + `Enter` | Toggle Zoom (Images) or Fullscreen (Videos).       |
| `H`                    | Show/Hide keyboard shortcuts help.                 |
| `Esc`                  | Exit Zoom, Fullscreen, or Modals.                  |

---

## Customisation

### Carousel height

Edit `--carousel-height` and `--carousel-peek` in `src/index.css`:

```css
:root {
  --carousel-height: 148px; /* height of the scrollable strip */
  --carousel-peek: 28px; /* visible "tease" strip when hidden */
}
```

### Thumbnail size

Edit `THUMB_WIDTH`, `THUMB_HEIGHT`, `THUMB_QUALITY` at the top of `scripts/generate-thumbnails.mjs`, then re-run `npm run thumbnails`.

### Colors / fonts

All design tokens live in `:root` in `src/index.css` and `tailwind.config.js`.

### Adding more trips / folders

Just add new numbered folders to `media/` and re-run `npm run thumbnails`. No code changes needed.

---

## Troubleshooting

**`ffmpeg` not found**  
Make sure ffmpeg is installed and on your PATH. Test with `ffmpeg -version`.

**`manifest.json not found` error in browser**  
You need to run `npm run thumbnails` before `npm run dev`. The manifest is generated at build-time.

**Thumbnails look wrong / out of date**  
Delete `public/thumbnails/` and `public/manifest.json`, then re-run `npm run thumbnails`. The script skips existing thumbnails by default to save time; deleting them forces a full regeneration.

**Videos won't autoplay**  
Browsers block autoplay with sound. The video element is set to `muted` so autoplay should work. If it doesn't, click the video to start it — browser controls are enabled.
