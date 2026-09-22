# How the video tool works

A local app for making short branded videos. You describe a scene, an AI writes it as code,
and you preview, edit and export it without leaving the app. Everything runs on my machine —
projects, media and renders all live in a `data/` folder. Nothing is uploaded anywhere except
the text of the prompt.

## The core idea: a video is source code

It's built on Remotion, an open-source library that renders React components to video.

A scene is a component that asks one question — what frame are we on? — and returns what that
frame looks like. To export, Remotion opens a headless Chrome, steps the frame counter,
screenshots every frame, and hands the pile to ffmpeg.

That matters because it means there's no project file and no binary. A video is a text file.
It can be read, diffed, searched, edited by hand, and re-rendered at any size.

And it's the reason an AI can make them well: language models are exceptionally good at
writing React. I'm not asking a model to imagine a video, which they're bad at. I'm asking it
to write a React file, which is the thing they're best at. The video is a side effect.

## What happens when you type a prompt

1. The app assembles a system prompt in layers: base rules (about 52 KB of it), the colour
   system, the Apify layout rules, whichever of the four style presets the project uses, the
   transition style, and a few overrides that are appended last so they win. About 25,000
   tokens in total, and it's cached, so follow-up messages cost roughly a tenth of the first.
2. Real frames from real Apify videos are attached as images on the first message, so the
   model sees the house style rather than reading a description of it.
3. Claude Opus 4.8 writes the complete scene as a TSX file.
4. **It then looks at its own work.** The model has a tool that renders real still frames of
   the scene it just wrote and hands them back as images. It checks them for text running off
   the edge, empty or frozen frames, off-brand colour, weak contrast, broken layout and bad
   pacing — and returns a corrected file. It also has a tool to open the real source of any
   branded component before copying it. Capped at 3 tool turns and 4 renders so it can't run
   away.
5. The finished file is transpiled in the browser and plays immediately in the preview.

That self-review step did more for output quality than every prompt edit put together. It's
not clever — it's what a coding agent already does: write, run, look at the result, fix. Same
loop, with pictures instead of error messages.

## How it can't go off-brand

Four things, and none of them is fine-tuning. The model isn't trained — it's fed.

- **Tokens.** The real palette is ported out of the design system into one file that every
  scene imports. Writing a raw hex code is a rule violation, so it never approximates the
  orange from memory.
- **Components.** 29 branded scenes built from real marketing — intro cards, lower thirds,
  stat callouts, end cards. The model opens the actual source file before it copies one.
- **References.** Real frames as images, as above.
- **Limits.** The banned moves — no blur on an entrance, no fade from black, no slide-wipe —
  aren't instructions it has to remember. The function that sets an animation takes an enum
  with seven values, and those moves aren't in it. They're not forbidden; they're unsayable.

## The timeline

Underneath the code there's a real editor: tracks, clips, drag, trim, split, captions,
transforms. It's a plain document of pure functions, and the same component renders both the
preview and the final export, so what you see is structurally what you get.

The AI can drive that document too. A second agent (Opus 5) has 23 tools — move, trim, split,
add text, add captions, place a branded scene, cut a range, read the transcript — and calls
them onto the document instead of writing code. Two rules keep it from corrupting anything: it
can never invent an ID, and every tool speaks in absolute frames rather than deltas, so it
never has to do arithmetic. Capped at 8 tool calls for an edit, 16 to build from empty.

So "cut the dead air, add captions, put the end card on the last three seconds" is one
sentence, and the result is a timeline you can still edit by hand.

## Footage

Upload a recording and it's transcribed locally with Whisper at word level — nothing leaves
the machine — then cached. From that it can find silences and filler words and propose a cut,
detect real shot changes with ffmpeg, and reframe 16:9 to 9:16 by tracking the subject with
OpenCV. Captions are stored relative to their clip, so moving or splitting a clip keeps the
words in sync with no extra bookkeeping.

## Rendering and export

Renders go through a queue, one at a time, streaming progress. Export presets are named for
where the file is going rather than the codec: H.264 for normal delivery, ProRes 4444 for
transparency, ProRes 4444 XQ for grading, QuickTime RLE for OBS, HEVC-alpha for CapCut. Colour
grading LUTs can be baked in at export. Canvas sizes go from 4K down to arbitrary exact pixel
dimensions — one spot was rendered at 832×2496 for an event LED screen.

## The stack

Next.js, React, TypeScript, Remotion 4, and the Anthropic SDK — Claude is the only AI in it.
Three models: Opus 4.8 writes scenes, Opus 5 drives the timeline, Sonnet 4.6 handles the
cheaper jobs like terminal recordings and aspect-ratio conversion. ffmpeg and Whisper run
locally. 38 API routes, about 2,100 assertions in the test suite.

315 projects made with it so far.
