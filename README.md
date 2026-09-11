# Font Widget — animated font card

A pixel-faithful rebuild of the reference card in **HTML + Tailwind CSS + [Motion](https://motion.dev)**.

## Run

```bash
npm install
npm start        # builds CSS, then serves http://localhost:3000
```

Other scripts: `npm run dev` (server only), `npm run build` (CSS once), `npm run watch` (CSS watch).

## Layout

```
public/index.html   markup (Tailwind utilities)
public/main.js      Motion orchestration + the canvas halftone matrix
public/styles.css   built Tailwind output — do not edit
public/vendor/      motion.js (vendored, no CDN)
src/input.css       Tailwind source: tokens, card component, type scale
server.js           zero-dependency static server on :3000
```

The card is a CSS **container**, and every type size is expressed in `cqw`, so the
whole composition scales with the card at any viewport width.

## The motion

| What | How |
| --- | --- |
| Card entrance | Motion, 500ms, `cubic-bezier(0.23, 1, 0.32, 1)`, from `translateY(14px) scale(0.97)` |
| Contents | 55ms stagger behind the card, 420ms each |
| Count-up | `0.0M` → the family's figure, 1.5s — explanatory, seen once per font |
| Matrix | Canvas. A dithered wave of orange rises from the bottom and keeps moving at 24fps |
| Cursor | A spring-driven bump lifts the wave under the pointer |
| Font menu | Opens in 180ms from its trigger's corner, closes in 120ms — the exit snaps |
| Hover | The shadow deepens. Nothing moves or changes size. |

## The credit link

Under the card, *Inspiration from* **Pinterest.com** — underlined, opening the
source pin in a new tab. Hovering it raises a small preview of that page which then trails the
cursor — the chase is a critically damped spring rather than a direct mapping,
so it eases into place and settles instead of snapping to the pointer. It fades
in over 180ms and out over 110ms, flips sides near a viewport edge, and is
gated to fine pointers: there is no hover on a phone, and a panel appearing on
tap would only cover the link being opened.

The thumbnail inside the preview is **drawn in CSS** — a miniature of the pin
page: side rail, search bar, the pinned card, its metadata column with the red
Save button, and the masonry column beside it. It is drawn rather than
photographed because Pinterest blocks automated page loads, so its real
preview image could not be fetched or verified.

To use a real screenshot instead, save one as `public/pin-preview.png`. The
page probes for that file on load and swaps it in, falling back to the drawn
version when it is absent. The local dev server answers `204` rather than
`404` for that one path so a missing drop-in file is not a console error; on a
static host a missing file logs a harmless 404 instead.

## Fitting

The figure and the `Aa` sample are measured after every change and scaled down
if they would overrun their box — a five-character figure like `12.7M`, a broad
face like Playfair Display, or a wider fallback font all fit without clipping.
The sizes live in `--hero-size` / `--sample-size` on `:root`, because an
element's own style attribute is stripped when the entrance animation is
released. On phones the menu flips above the trigger when there is no room
below, rows grow for coarse pointers, and the chevron carries a 44px hit area.

## The font picker

The chevron beside the family name opens a list of Google Fonts. Choosing one
loads the family, then replays the entire entrance — card, stagger, wave and
count-up — so a swap feels like arriving rather than mutating. The `Aa` tile
renders in the selected family; long names step down a size rather than truncate.

Keyboard: `↓` opens and moves through the list, `Esc` closes and returns focus
to the trigger. A click outside closes it.

The download figures in `FONTS` (`public/main.js`) are **illustrative** — plausible
orders of magnitude per family, not real Google Fonts numbers. Replace them with
live values from the Google Fonts API if the card needs to be authoritative.

Conventions from [animations.dev](https://animations.dev): strong custom curves only,
`ease-out` for entrances, `transform`/`opacity` exclusively (the lifted shadow is a
crossfaded layer, not an animated `box-shadow`), hover motion gated behind
`(hover: hover) and (pointer: fine)`, and `prefers-reduced-motion` honoured — the
matrix renders one static frame and nothing moves.

The canvas stops rendering when the tab is hidden or the card scrolls out of view.

## Deploying to Vercel

The project is a static site — `server.js` is only for local development and
is not used in production.

`vercel.json` sets `buildCommand: npm run build` (Tailwind) and
`outputDirectory: public`, so a fresh clone builds its own CSS. Everything the
page loads is either in `public/` or root-relative, and `motion` is vendored
into `public/vendor/`, so there is no CDN dependency at runtime. Long-lived
cache headers are set for `/vendor/*`.

To ship it:

```bash
npx vercel
```

Then `npx vercel --prod` to promote. Or import the repository at
vercel.com/new and accept the detected settings — no environment variables and
no project settings are needed.
