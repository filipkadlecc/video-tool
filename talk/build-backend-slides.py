"""The "how it works" backend slides, as a .pptx that Google converts to Slides.

A standalone appendix block — import it into the shared deck with
File > Import slides, which only ever ADDS slides. Nothing here touches or
replaces an existing deck.

Run: python3 talk/build-backend-slides.py
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _deckkit import (prs, slide, rect, text, head, points, kicker,
                      W, H, M, BG, BORDER, TEXT, MUTED, SUBTLE, ORANGE,
                      Inches, Pt, Emu, RGBColor, PP_ALIGN)

# ── B1 · a video is source code ───────────────────────────────────────────────
s = slide()
head(s, "Backend · 1", [("A video is ", {}), ("source code", {"color": ORANGE}), (".", {})])
y = points(s, [
    ("Remotion", "An open-source library that renders React components to video.", ""),
    ("Ask", "A scene asks one question: what frame are we on?", "Remotion says 47."),
    ("Answer", "It returns what frame 47 looks like.", "That's the whole API."),
    ("Export", "Headless Chrome screenshots every frame.", "ffmpeg stitches them."),
], top=Inches(2.5), row_h=Inches(0.82))
kicker(s, [("No project file, no binary — so a video can be read, diffed and re-rendered. ", {}),
           ("And models are exceptionally good at writing React.", {"color": ORANGE})], y)

# ── B2 · the generation pipeline ──────────────────────────────────────────────
s = slide()
head(s, "Backend · 2", [("What happens when you type a ", {}), ("prompt", {"color": ORANGE}), (".", {})])
points(s, [
    ("01", "The system prompt is assembled in layers.",
     "Base rules, colour system, layout, style preset, transitions — ~25,000 tokens, cached."),
    ("02", "Real Apify frames are attached as images.",
     "It sees the house style instead of reading a description of it."),
    ("03", "Claude Opus 4.8 writes the complete scene as a TSX file.", ""),
    ("04", "It renders its own frames and looks at them.",
     "Then returns a corrected file. Capped at 3 tool turns, 4 renders."),
    ("05", "The file is transpiled in the browser and plays immediately.", ""),
], top=Inches(2.25), row_h=Inches(0.82))

# ── B3 · the self-review loop ─────────────────────────────────────────────────
s = slide()
head(s, "Backend · 3", [("It looks at its ", {}), ("own work", {"color": ORANGE}), (".", {})])
bw, gap = Inches(2.78), Inches(0.14)
for i, (n, word) in enumerate([("01", "Write"), ("02", "Render"), ("03", "Look"), ("04", "Fix")]):
    x = M + i * (bw + gap)
    on = word == "Look"
    box = rect(s, x, Inches(2.5), bw, Inches(1.28), RGBColor(0x2a, 0x1a, 0x0e) if on else BG)
    box.line.color.rgb = ORANGE if on else BORDER
    box.line.width = Pt(1.25)
    text(s, x + Inches(0.26), Inches(2.72), bw, Inches(0.25), n,
         size=10, color=ORANGE if on else SUBTLE, font="Roboto Mono")
    text(s, x + Inches(0.26), Inches(3.06), bw, Inches(0.5), word, size=24, bold=True)
text(s, M, Inches(4.25), W - 2*M - Inches(1.0), Inches(1.4),
     [("The model renders real still frames of the scene it just wrote and gets them back ", {}),
      ("as images", {"color": ORANGE, "bold": True}),
      (" — then checks for text running off the edge, empty frames, off-brand colour, weak "
       "contrast and bad pacing, and returns a corrected file.", {})],
     size=19, spacing=1.4)
text(s, M, Inches(5.85), W - 2*M, Inches(0.8),
     [("It's what a coding agent already does: write, run, look, fix. ", {}),
      ("Pictures instead of error messages.", {"color": ORANGE})],
     size=19, bold=True, spacing=1.3)

# ── B4 · the brand guardrails ─────────────────────────────────────────────────
s = slide()
head(s, "Backend · 4", [("It ", {}), ("can't", {"color": ORANGE}), (" go off-brand.", {})])
y = points(s, [
    ("Tokens", "The real palette, ported out of the design system into one file.",
     "Every scene imports it; a raw hex code is a rule violation."),
    ("Components", "29 branded scenes built from real marketing.",
     "It opens the actual source file before it copies one."),
    ("References", "Real frames from real Apify videos, as images.", ""),
    ("Limits", "The banned moves are a seven-value enum.",
     "No entrance blur, no fade from black, no slide-wipe — not forbidden, unsayable."),
], top=Inches(2.4), row_h=Inches(0.82))
kicker(s, [("Nothing here is fine-tuned. The model isn't trained — ", {}), ("it's fed.", {"color": ORANGE})], y)

# ── B5 · the timeline ─────────────────────────────────────────────────────────
s = slide()
head(s, "Backend · 5", [("A timeline the AI can ", {}), ("drive", {"color": ORANGE}), (".", {})])
y = points(s, [
    ("Document", "Tracks, clips, trims, splits, captions, transforms — pure functions.", ""),
    ("WYSIWYG", "The same component renders the preview and the final export.", ""),
    ("Agent", "A second model (Opus 5) calls 23 tools onto that document instead of writing code.",
     "Move, trim, split, add captions, place a branded scene, cut a range."),
    ("Safety", "It can never invent an ID, and every tool speaks in absolute frames.",
     "No arithmetic to get wrong. Capped at 8 tool calls, 16 to build from empty."),
], top=Inches(2.4), row_h=Inches(0.82))
kicker(s, [("“Cut the dead air, add captions, end card on the last three seconds” is ", {}),
           ("one sentence", {"color": ORANGE}), (" — and still a timeline you can edit by hand.", {})], y)

# ── B6 · footage ──────────────────────────────────────────────────────────────
s = slide()
head(s, "Backend · 6", [("It understands the ", {}), ("footage", {"color": ORANGE}), (".", {})])
points(s, [
    ("Transcribe", "Whisper, locally, at word level, then cached.", "Nothing leaves the machine."),
    ("Cut", "Finds silences and filler words and proposes a cut.", ""),
    ("Shots", "Detects real visual cuts with ffmpeg.", ""),
    ("Reframe", "16:9 to 9:16 by tracking the subject with OpenCV.", ""),
    ("Captions", "Stored relative to their clip.", "Move or split a clip and the words stay in sync."),
], top=Inches(2.25), row_h=Inches(0.82))

# ── B7 · render and export ────────────────────────────────────────────────────
s = slide()
head(s, "Backend · 7", [("Out the ", {}), ("other end", {"color": ORANGE}), (".", {})])
y = points(s, [
    ("Queue", "Renders run one at a time, streaming progress.", ""),
    ("Presets", "Named for where the file is going, not the codec.",
     "H.264 to publish · ProRes 4444 for alpha · XQ for grading · QuickTime RLE for OBS · HEVC-alpha for CapCut."),
    ("Grade", "Colour LUTs baked in at export.", ""),
    ("Sizes", "4K down to arbitrary exact pixel dimensions.",
     "One spot rendered at 832×2496 for an event LED screen."),
], top=Inches(2.4), row_h=Inches(0.82))

# ── B8 · the stack ────────────────────────────────────────────────────────────
s = slide()
head(s, "Backend · 8", [("The ", {}), ("stack", {"color": ORANGE}), (".", {})])
y = points(s, [
    ("Built on", "Next.js, React, TypeScript, Remotion 4.", "38 API routes, ~2,100 test assertions."),
    ("Models", "Claude is the only AI in it.",
     "Opus 4.8 writes scenes · Opus 5 drives the timeline · Sonnet 4.6 for the cheaper jobs."),
    ("Local", "ffmpeg and Whisper run on my machine.",
     "Projects, media and renders all live in one folder. Only the prompt text leaves."),
], top=Inches(2.5), row_h=Inches(0.86))
kicker(s, [("315", {"color": ORANGE}), (" projects made with it so far.", {})], y)

prs.save("talk/how-it-works-slides.pptx")
print("slides:", len(prs.slides.__iter__.__self__._sldIdLst))
