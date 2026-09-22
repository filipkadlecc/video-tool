# Talk: "I Don't Write Code. I Ship Video."

Thursday meetup, shared slot with Luis (his video studio is the second half).

| File | What it is |
|---|---|
| `deck.html` | The presentation. Open in Chrome, press `F`. |
| `NOTES.md` | Speaker notes per slide, plus the 5-minute cut and likely questions. |
| `DEMO.md` | The live-demo runbook. Read this one the morning of. |
| `render-clips.cjs` | Renders a stored project scene to a clip — how the reel was made. |
| `assets/` | Clips, the project wall, and (once recorded) the demo fallback. |
| `JOINT-RUNNING-ORDER.md` | The two-hander with Luis — proposed order, timings, what to cut. |
| `filip-half.pptx` | Filip's seven slides, for importing into the shared Google Slides deck. |
| `HOW-IT-WORKS.md` | Plain-text explainer of the backend, for sharing. |
| `how-it-works-slides.pptx` | The same explainer as 8 appendix slides, for importing. |
| `how-it-works-short.pptx` | **The 2-slide cut.** Use this one for the talk. |
| `build-slides.py` | Rebuilds `filip-half.pptx` (`python3 talk/build-slides.py`). |
| `build-backend-slides.py` | Rebuilds `how-it-works-slides.pptx`. |
| `build-short-slides.py` | Rebuilds `how-it-works-short.pptx`. |
| `_deckkit.py` | Shared palette and slide furniture both build scripts import. |

## Two versions exist

- **Solo** — `deck.html`, the full 9:30 talk with clips, reel and live demo. Offline-safe.
- **Joint** — Luis's Google Slides spine + `filip-half.pptx`. See `JOINT-RUNNING-ORDER.md`.

## Before the talk

1. Open `deck.html`, scroll to the bottom, fill in `EVENT` — name, venue, date. It feeds the
   title slide, the end card and the demo prompt together.
2. Record the demo fallback (see `DEMO.md`).

## Driving the deck

```
← →  move          f  full screen      n  speaker notes
 g   slide grid    t  timer (timecode) r  reset timer
 .   black screen  b  demo fallback    c  hide the on-screen chrome
```

The deck is one self-contained file — fonts are embedded, nothing is fetched from the
network, so venue wifi can't break it. Clips and the wall sit next to it in `assets/`.

## Re-rendering a clip

```bash
node talk/render-clips.cjs <outDir> <publicDir> "<project name>" ...
```

`publicDir` should be a small directory holding only the assets the scenes reference —
pointing at the real `public/` makes the bundler copy multiple GB of past renders.
