"""Filip's half of the joint talk, as a .pptx that Google converts to Slides.

Import into the shared deck with File > Import slides — that only ever adds.
Run: python3 talk/build-slides.py
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _deckkit import (prs, slide, rect, text, head, points, kicker,
                      W, H, M, BG, BORDER, TEXT, MUTED, SUBTLE, ORANGE,
                      Inches, Pt, Emu, RGBColor, PP_ALIGN)

# ── F1 · who I am, and what the day looks like ────────────────────────────────
s = slide()
head(s, "Filip · the day job", [("I've made Apify's videos for ", {}), ("two years", {"color": ORANGE}), (".", {})])
points(s, [
    ("The role", "Video content producer at Apify.", "Videos for the company, every day."),
    ("The work", "A lot of it is motion graphics and animation.", "Also every day."),
    ("The catch", "I like doing it. In Premiere and After Effects.", "That's what makes this a strange talk."),
])

# ── F2 · why it doesn't scale ─────────────────────────────────────────────────
s = slide()
head(s, "Filip · the problem", [("I love motion design. It just takes ", {}), ("all day", {"color": ORANGE}), (".", {})])
y = points(s, [
    ("Design", "Make the design — or wait for the design team to make one.", ""),
    ("Convert", "Figma out, Adobe in.", "Every single time."),
    ("Animate", "Layer by layer.", "And there are a lot of layers."),
], top=Inches(2.5), row_h=Inches(0.82))
kicker(s, [("That's fine for a launch video. ", {}),
           ("It's impossible at YouTube cadence.", {"color": ORANGE})], y)

# ── F3 · Remotion ─────────────────────────────────────────────────────────────
s = slide()
head(s, "How it works · 1", [("Then I met ", {}), ("Remotion", {"color": ORANGE}), (".", {})])
y = points(s, [
    ("Ask", "Your scene asks one question: what frame are we on?", "Remotion says 47."),
    ("Answer", "You return what frame 47 looks like.", "That's the whole API."),
    ("Export", "Headless Chrome screenshots every frame.", "ffmpeg stitches them."),
], top=Inches(2.5), row_h=Inches(0.82))
kicker(s, [("No Figma export. No layers. A video is a ", {}), ("text file", {"color": ORANGE}),
           (" — and models are exceptionally good at writing React.", {})], y)

# ── F4 · teaching it the house style ──────────────────────────────────────────
s = slide()
head(s, "How it works · 2", [("Great engine. ", {}), ("Terrible taste.", {"color": ORANGE})])
y = points(s, [
    ("The problem", "Remotion could animate anything — and the style was all over the place.",
     "So I taught it our house style."),
    ("Tokens", "Our palette, ported out of the design system.",
     "Every scene imports it; a raw hex code is a rule violation."),
    ("Components", "29 scenes built from our real marketing.",
     "It opens the actual source file before it copies one."),
    ("References", "Real frames from real Apify videos, as images.",
     "It sees the house style instead of reading the word “clean”."),
    ("Limits", "The banned moves are a seven-value enum.",
     "No entrance blur, no fade from black, no slide-wipe — unsayable, not forbidden."),
], top=Inches(2.3), row_h=Inches(0.8))

# ── F5 · the app ──────────────────────────────────────────────────────────────
s = slide()
head(s, "How it works · 3", [("Then I put it all in ", {}), ("one place", {"color": ORANGE}), (".", {})])
y = points(s, [
    ("Prompt", "Describe a scene. It animates it.", ""),
    ("Templates", "Or drop in a branded block that's already made.", ""),
    ("Edit", "Give it footage: it cuts the dead air on its own.", ""),
    ("Compose", "Or builds the finished video — footage and animation together.", ""),
    ("SVG", "Hand it a logo or a diagram and it animates the file itself.", ""),
], top=Inches(2.3), row_h=Inches(0.8))
kicker(s, [("It turned out ", {}), ("far more powerful", {"color": ORANGE}),
           (" than I thought it would be.", {})], y)

# ── F6 · the loop (spare) ─────────────────────────────────────────────────────
s = slide()
head(s, "Spare · if there's time", [("It looks at its ", {}), ("own work", {"color": ORANGE}), (".", {})])
bw, gap = Inches(2.78), Inches(0.14)
for i, (n, word) in enumerate([("01", "Write"), ("02", "Render"), ("03", "Look"), ("04", "Fix")]):
    x = M + i * (bw + gap)
    on = word == "Look"
    box = rect(s, x, Inches(2.6), bw, Inches(1.28), RGBColor(0x2a, 0x1a, 0x0e) if on else BG)
    box.line.color.rgb = ORANGE if on else BORDER
    box.line.width = Pt(1.25)
    text(s, x + Inches(0.26), Inches(2.82), bw, Inches(0.25), n,
         size=10, color=ORANGE if on else SUBTLE, font="Roboto Mono")
    text(s, x + Inches(0.26), Inches(3.16), bw, Inches(0.5), word, size=24, bold=True)
text(s, M, Inches(4.35), W - 2*M - Inches(1.2), Inches(1.5),
     [("It writes the scene, renders real frames, ", {}),
      ("looks at them", {"color": ORANGE, "bold": True}),
      (", and fixes what it got wrong — before I ever see it.", {})],
     size=20, spacing=1.4)

# ── F7 · the wall ─────────────────────────────────────────────────────────────
s = slide()
pic = s.shapes.add_picture("talk/assets/wall.png", 0, 0, width=W)
pic.top = int((H - pic.height) / 2)
panel = rect(s, 0, H - Inches(2.5), Inches(7.5), Inches(2.5), BG)
panel.line.color.rgb = BORDER; panel.line.width = Pt(1)
text(s, Inches(0.6), H - Inches(2.1), Inches(6.5), Inches(0.6),
     [("313", {"color": ORANGE}), (" projects. Six months.", {})], size=28, bold=True, spacing=1.05)
text(s, Inches(0.6), H - Inches(1.4), Inches(6.5), Inches(1.0),
     "Chronological. The top rows are March — rainbow, before I taught it anything. "
     "The bottom rows are last week. You can watch it learn the house style.",
     size=14, color=MUTED, spacing=1.35)
text(s, W - Inches(4.4), H - Inches(0.62), Inches(3.8), Inches(0.3),
     "Every project, in order", size=10, color=MUTED, align=PP_ALIGN.RIGHT,
     caps=True, font="Roboto Mono")

prs.save("talk/filip-half.pptx")
print("slides:", len(prs.slides.__iter__.__self__._sldIdLst))
