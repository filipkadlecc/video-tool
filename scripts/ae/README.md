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
Templates land in `data/mogrt/`. In Premiere: Window → Essential Graphics →
Browse → the folder, or double-click a `.mogrt` to install it.

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
| Logo outro | Monochrome white |

Boxes keep Figma's height and grow in width to fit what is typed — to the right
for the left-aligned lower thirds, symmetrically for the centred titles.

## Deliberately not templates

**Funky title** — the rotated word boxes are hand-placed per word in Figma, with
no rule behind the angles. As a template an editor could only retype words into
fixed slots, and any change of length breaks the arrangement. Use the tool for
these.

**Collab + case study** — needs a partner logo, so it wants a media-replacement
slot and a monochrome treatment; worth doing, but it is its own piece of work.

**Geometric shapes** — the decorative line illustrations are not included. They
are off by default in the kit.
