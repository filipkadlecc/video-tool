# ActorRiser

A ~1-second "agent working in the background" riser. An Apify logo box + status
label are centered on screen; the label **hard-cuts** through a sequence of lines,
accelerating in pace so it feels like a system spinning up. Each line is centered
as a unit (the icon repositions at each cut), then the final line **freezes** for
a short hold at the end.

Built to be composited in **After Effects** as ProRes 4444 with alpha. The
background is **transparent by default**.

- **Composition id:** `ActorRiser`
- **Format:** 3840×2160 (4K), 25 fps
- **Length:** 33 frames of cuts (`0:00:01:08`) + 13-frame freeze = **46 frames (`0:00:01:21`)**
- **Source:** [`ActorRiser.tsx`](./ActorRiser.tsx)

---

## Editing the text & timings (no coding needed)

Everything you'll want to change lives in the **`EDIT ME`** block at the top of
`ActorRiser.tsx`:

```ts
const DEFAULT_SEGMENTS: Segment[] = [
  { label: "Thinking",   kind: "word",   frames: 7, chevron: false },
  { label: "Call-actor", kind: "tool",   frames: 5, chevron: true  },
  // ...the rest run at a steady 3-frame beat
];
const DEFAULT_FREEZE_FRAMES = 13; // ≈ 0.5s hold on the last line
```

- `label` — the words shown.
- `kind` — `"word"`/`"status"` render as normal sentence-case (Inter); `"tool"`
  renders in technical monospace (Roboto Mono) with hyphens kept intact
  (`Call-actor`, `Get-dataset-items`).
- `frames` — how long the line stays up. **25 frames = 1 second.** Smaller = faster.
- `chevron` — show a trailing `›`.
- `DEFAULT_FREEZE_FRAMES` — how long the **last line holds frozen** at the end.

**The total length is computed automatically** — you never set a duration by
hand. The default config is `7+5+3×7 = 33 frames` of cuts (`0:00:01:08`) `+ 13`
freeze `= 46 frames` (`0:00:01:21`). Nudge the `frames` numbers and
`DEFAULT_FREEZE_FRAMES` to hit your exact target in After Effects.

### Lining up click SFX in After Effects

There's no sound in the render — you add SFX in AE. On the first frame the scene
prints the exact cut frame of every line to the browser console (open it in
Remotion Studio / the app preview), e.g.:

```
CUT LIST (frames): Thinking@0, Call-actor@7, Searching real estate agencies in Miami@12, Scraping business listings@15, Extracting emails and phone numbers@18, Enriching social profiles@21, Collecting reviews and ratings@24, Ranking leads by relevance@27, Get-dataset-items@30 | cuts end @33, freeze holds to END@46
```

Drop a click at each `@frame`.

---

## Rendering

### ProRes 4444 + alpha (the After Effects deliverable)

The background is transparent by default, so it drops straight over your footage:

```bash
npx remotion render ActorRiser out/ActorRiser.mov \
  --codec=prores --prores-profile=4444 \
  --image-format=png --pixel-format=yuva444p10le
```

> In the app UI, the equivalent one-click export is the **CapCut (Transparent)**
> preset on the ActorRiser project — it produces an HEVC-with-alpha file.

### 1080p mp4 preview

Simplest: render the 4K composition downscaled to 1080p (no prop changes):

```bash
npx remotion render ActorRiser out/ActorRiser-1080.mp4 --scale=0.5
```

> mp4 has no alpha, so the transparent background shows as **black** here. To
> preview on a solid background instead, add `--props='{"bgColor":"#161718"}'`.

If you'd rather render **natively** at 1080p, set `scaleFactor` to `0.5` so the
layout is sized for a 1920×1080 canvas:

```bash
npx remotion render ActorRiser out/ActorRiser-1080-native.mp4 \
  --props='{"scaleFactor":0.5}' --width=1920 --height=1080
```

### Clean cuts (no motion)

`reducedMotion` disables the subtle per-swap label pops (the hard cuts stay):

```bash
npx remotion render ActorRiser out/ActorRiser.mov \
  --codec=prores --prores-profile=4444 \
  --image-format=png --pixel-format=yuva444p10le \
  --props='{"reducedMotion":true}'
```

---

## Props reference

| prop | default | notes |
|------|---------|-------|
| `apifyLogo` | `assets/apify/Apify symbol colors.svg` | logo mark centered in the box |
| `bgColor` | `"transparent"` | pass a hex (e.g. `"#161718"`) for a solid background |
| `fontSize` | `110` | label size in 4K design px; sized so the Miami line fits one line |
| `segments` | `DEFAULT_SEGMENTS` | the line sequence (see EDIT ME block) |
| `freezeFrames` | `13` | frames to hold the last line frozen at the end |
| `scaleFactor` | `1` | multiplies all sizes; `0.5` for native 1080p |
| `reducedMotion` | `false` | disables the label scale pops |

## Preview it in Studio

```bash
npx remotion studio
```

Open **ActorRiser**, scrub the timeline, and watch the console for the cut list.
