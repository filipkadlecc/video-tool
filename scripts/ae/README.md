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
