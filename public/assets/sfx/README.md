# Sound effects (SFX)

Licensed sound effects the AI can drop into generated animations.

## How it works

- `sfx.json` is the manifest: each entry is `{ file, category, useWhen }`.
- The AI is told about a sound **only if its `file` actually exists in this folder** (`lib/sfx.ts → listSfx()`). So placeholder rows here are harmless — nothing is advertised until you add the matching `.mp3`.
- The AI references a sound with `staticFile("assets/sfx/<file>")` inside a Remotion `<Audio>`, placed on a frame with `<Sequence from={frame}>`. Remotion bakes the audio into the export automatically.

## Adding sounds (Epidemic Sound → here)

1. Download the `.mp3` from Epidemic Sound.
2. Name it to match a `file` in `sfx.json` (or add a new entry).
3. Drop it in this folder. Keep clips short (a one-shot, not a loop).
4. Tweak the `useWhen` text so the AI knows when to reach for it.

Licensing: these files are covered by the Epidemic Sound subscription — keep this folder out of any public distribution. (It still ships in the app's `public/` build, which is fine for the local/Tailscale deployment.)
