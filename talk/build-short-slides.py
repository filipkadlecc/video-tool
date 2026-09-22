"""The two-slide version of "how it works" — the short cut.

Same content as how-it-works-slides.pptx boiled down to the two things that
actually matter: how it makes the video, and why it stays on brand. Bigger type,
no trailing clauses.

Run: python3 talk/build-short-slides.py
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _deckkit import (prs, slide, rect, text, head, points, kicker,
                      W, H, M, BG, BORDER, TEXT, MUTED, SUBTLE, ORANGE,
                      Inches, Pt, Emu, RGBColor, PP_ALIGN)

# ── S1 · how a video gets made ────────────────────────────────────────────────
s = slide()
head(s, "How it works", [("Prompt in. ", {}), ("Video out.", {"color": ORANGE})])
y = points(s, [
    ("In",     "I describe the scene in a sentence.", ""),
    ("Writes", "Claude writes it as a React component.", ""),
    ("Looks",  "It renders real frames and checks its own work.", ""),
    ("Out",    "Chrome screenshots every frame. ffmpeg stitches them.", ""),
], top=Inches(2.6), row_h=Inches(1.0), size=22)
kicker(s, [("No project file. No layers. ", {}), ("A video is a text file.", {"color": ORANGE})], y)

# ── S2 · why it stays on brand ────────────────────────────────────────────────
s = slide()
head(s, "How it works", [("It ", {}), ("can't", {"color": ORANGE}), (" go off-brand.", {})])
y = points(s, [
    ("Tokens",     "Our real palette, imported. Never guessed.", ""),
    ("Components", "29 branded scenes. It reads the real source.", ""),
    ("References", "Real frames from real Apify videos.", ""),
    ("Limits",     "The banned moves are a seven-value enum.", ""),
], top=Inches(2.6), row_h=Inches(1.0), size=22)
kicker(s, [("Not fine-tuned. ", {}), ("Fed.", {"color": ORANGE})], y)

prs.save("talk/how-it-works-short.pptx")
print("slides:", len(prs.slides.__iter__.__self__._sldIdLst))
