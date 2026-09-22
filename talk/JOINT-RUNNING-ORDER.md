# Joint talk — proposed running order

**Filip Kadlec + Luís Pinto · Thursday**
Working deck: https://docs.google.com/presentation/d/14znRKaxXNtp5PD884sXYNLtMojcSEI8YZ0dvk5aQgjc/edit
(a copy of Luis's original — his file is untouched)

This is a **proposal to settle with Luis**, not a decision. The timing is the part that needs
agreeing first.

---

## The problem to solve first: the slot is 5–10 minutes for *both of you*

Luis's spine — two problems → we showed each other → half of the same machine → merge — is a
duet, and a duet costs more than two monologues because you pay for the setup twice. Presented
properly it's already 8–10 minutes before either of you says "Remotion".

**So the live demo almost certainly doesn't fit.** At this length it's ~90 seconds of a
~4-minute half, and it's the riskiest 90 seconds. Recommendation: cut it, and let the **wall**
carry the proof instead. If you get a firm 10 minutes and want it back, it goes after
*It can't go off-brand* and gets a hard 60-second box.

---

## Proposed order — 8:00

Filip's slides are **F1–F7** in `talk/filip-half.pptx`.

| # | Slide | Who | Time |
|---|---|---|---|
| 1 | Quiet on set… Action! | both on stage | 0:20 |
| 2 | Before there was a tool, there were two problems | Luís sets it up | 0:20 |
| 3 | **F1 · I've made Apify's videos for two years** | **Filip** | 0:30 |
| 4 | **F2 · I love motion design. It just takes all day** | **Filip** | 0:40 |
| 5 | Luis's problem | Luís | 0:40 |
| 6 | Then we actually showed each other our tools | either | 0:15 |
| 7 | **F3 · Then I met Remotion** | **Filip** | 0:50 |
| 8 | **F4 · Great engine. Terrible taste.** | **Filip** | 0:45 |
| 9 | **F5 · Then I put it all in one place** | **Filip** | 0:40 |
| 10 | Luis's half — how his works | Luís | 1:30 |
| 11 | **We each had half of the same machine** | both | 0:30 |
| 12 | **F7 · The wall** — 313 projects | **Filip** | 0:40 |
| 13 | So we decided to merge them | both | 0:30 |
| 14 | CTA | Luís | 0:15 |

**The three that carry your half** are F2 (why the old way doesn't scale), F3 (Remotion) and
F4 (teaching it the house style). F2 → F3 is the hinge of the whole talk: Figma-convert-layers
is the old way, and Remotion deletes all three steps. Say them back to back if you can.

**If you're cut to 6 minutes:** drop F5 and F7, and give Luis the same two cuts.

**Spare slide:** F6, *It looks at its own work* — the render → look → fix loop. It's the most
interesting technical idea in the deck and it isn't in your Notion outline, so it's built but
parked. If you find 30 seconds, it goes after F4.

## Two things to fix in Luis's deck

**1. The stats slide says "inventar alguns números".** Don't invent them. Real ones, all
checkable:

- 313 projects in the tool, six months
- 197,000 lines of AI-written scene code across 307 of them
- 29 branded components it builds from
- x402: an 11-scene launch campaign, storyboarded and animated in about two days
- The whole tool: 57,000 lines, 72 commits, one person who isn't an engineer

**2. Everything after "So we decided to merge them" is still template** — *"Headline H1 potter
ipsum wand elf parchment"*, the table of contents, the leadership team slides. Worth deleting
the unused ones early so neither of you arrows into a lorem slide on stage.

---

## Getting Filip's slides in

`talk/filip-half.pptx` holds the seven slides above, built on the Apify dark palette
(`#161718` ground, one `#F86606` accent) so they sit next to Luis's template without a reskin.

In the working copy: **File → Import slides → Upload → `filip-half.pptx` → select all seven →
Keep original theme → Import.** Then drag them into the positions in the table.

They use **Inter** and **Roboto Mono**, both available in Google Slides, so nothing falls back.

To change the wording, edit `talk/build-slides.py` and re-run `python3 talk/build-slides.py` —
or just edit the slides directly in Google, which is faster for small changes.

---

## What happens to the HTML deck

`talk/deck.html` is now the **solo** version — the full 9:30 talk with the clips, the reel and
the live demo built in. Keep it. It's the one to give if you're ever asked to do this alone, and
it's the only version that plays video without depending on venue wifi.
