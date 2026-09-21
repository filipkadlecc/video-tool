# Premiere Pro templates (.mogrt) from the short-form kit

`build-mogrt.jsx` builds the kit as After Effects comps and exports each as a
Motion Graphics Template, so an editor can drop one on a Premiere timeline and
retype the text in the Essential Graphics panel.

## Before it will run

After Effects → **Settings → Scripting & Expressions** → tick
**"Allow Scripts to Write Files and Access Network"**.

Without it AE refuses every file write, including the `.mogrt` export itself,
with `Permission denied`. This applies however the script is started — from the
menu or from a shell.

## Running it

After Effects → File → Scripts → Run Script File… → `build-mogrt.jsx`.
Templates land in `data/mogrt/`.

## Using them in Premiere

Checked against the strings in Premiere Pro **26.5** rather than from memory,
because the panels were renamed and older instructions are wrong:

- **Graphics Templates** panel — where templates are installed and browsed.
  Double-clicking a `.mogrt` puts it here; Premiere's own dialog says so:
  *"Motion Graphics Templates cannot be imported into the Project panel. We have
  installed your Motion Graphics Templates in the Graphics Templates panel
  instead."* Drag one onto the timeline from there.
- **Properties** panel — where you edit the fields (First name, Headline, Box
  colour…) once a template is selected on the timeline. Its header carries a
  "Browse graphics templates" button back to the panel above.

"Essential Graphics" is what this panel used to be called, and the name is still
present in 26.5, but it is not where the current flow sends you.

## Requirements on any machine that opens them

GT Walsheim Light / Regular / Medium must be installed. A `.mogrt` references
fonts by name; it does not embed them.

## Why the numbers here are trustworthy

Every size, colour and coordinate is the same value the Remotion scenes use,
and those are checked against the Figma exports by `scripts/figma-diff.ts`.

What is NOT claimed is pixel equality with the Remotion output: After Effects
is a third text renderer and will set type fractionally differently. The boxes
grow to fit whatever is typed, which is the point of a template and something
no fixed Figma frame can specify anyway.

## Checking what Premiere will show

```
node scripts/ae/verify-mogrt.mjs
```

Reads each template's `definition.json` and prints its Essential Graphics
controls and the fonts it needs. Exporting without an error is not evidence the
controls are right: a field labelled "Source Text", a template that published
nothing, or a layer that quietly fell back to a non-brand font all look like
success until you open the panel.

## What AE calls the controls

The label comes from the **layer name** (or the effect name for a colour or
checkbox). The scripting API for renaming controllers indexes them in an order
that does not match the order they are added — using it put "Box colour" on a
text field — so layers are simply named for the editor instead.

## Templates

| Template | Controls |
|---|---|
| Title (boxed) | Sub-headline, Headline, Headline colour |
| Title (plain) | Sub-headline, Headline |
| Statement box | Statement |
| Lower third (name, boxed) | First name, Surname, Role, Box colour |
| Lower third (name, plain) | Name, Role |
| Lower third (place, boxed) | Place or event, Box colour |
| End card | Headline, Button label |
| Watch the full video | Message, Button label |
| Funky title (3 words) | Word 1-3, Box colour |
| Funky title (5 words) | Word 1-5, Box colour |
| Logo outro | Monochrome white |

Boxes keep Figma's height and grow in width to fit what is typed — to the right
for the left-aligned lower thirds, symmetrically for the centred titles.

The funky titles keep Figma's angles and centres — those are hand-placed per
word with no rule behind them — while each box grows around whatever is typed.
Emptying a word hides its box, so a five-slot template can carry fewer words.
The two layouts are separate templates because Figma's 5-word arrangement is its
own composition, not the 3-word one scaled.

## Deliberately not templates

**Collab + case study** — needs a partner logo, so it wants a media-replacement
slot and a monochrome treatment; worth doing, but it is its own piece of work.

**Geometric shapes** — the decorative line illustrations are not included. They
are off by default in the kit.
