# Speaker notes — "I Don't Write Code. I Ship Video."

**Solo version** (`talk/deck.html`). For the two-hander with Luis see `JOINT-RUNNING-ORDER.md`.

**Full version:** ~9:30. **Target:** 7:30 with the two cuts. **Floor:** 6:00.
Chrome, `F` for full screen, `T` starts the timer, `N` shows these notes on your screen.

The shape is **who I am → why the old way doesn't scale → how it works → proof.**
The "how it works" run is three slides and it's what you asked to protect.

---

## Before you start

- [ ] `EVENT` filled in at the bottom of `deck.html` — feeds the title slide, the end card
      **and** the demo prompt.
- [ ] Demo pre-flight done (`DEMO.md`).
- [ ] `T` as you open your mouth.

## Cutting

| | Slide | Saves | What to do |
|---|---|---|---|
| **Cut 1** | Three things | 0:35 | Drop it. Fold the last line into the handoff. |
| **Cut 2** | Shipped work | 0:30 | Drop it if the wall has landed. Say the campaign names over the wall instead. |

**Do not cut** *What Remotion is*, *Great engine / terrible taste*, or *Then I put it all in
one place*. If you're badly over, shorten the demo instead.

---

## 01 · Cold open — the clip · 0:20

**Say nothing for ten seconds.** Let them watch it.

> "That's a marketing video for one of our products. It took about four minutes.
>
> I've been making videos like that by hand for years — and that one would have cost me an
> afternoon."

Beat. Advance.

## 02 · Title · 0:20

> "I'm Filip, I do video at Apify — we're a web scraping and AI agent platform.
>
> I am not an engineer. I've never written production code in my life. But I built the tool
> that made that, and I want to show you how it works."

## 03 · The day job · 0:30

> "I've been Apify's video content producer for about two years. I make the company's videos
> — that's the job, every day.
>
> And a lot of that is motion graphics and animation. Also every day.
>
> Here's the part that makes this a strange talk: **I like doing it.** I like sitting in
> Premiere and After Effects. I'm not up here because I couldn't do the work."

## 04 · The problem · 0:45 — *the setup for everything after*

> "So the problem is timing, not skill.
>
> To make one animation the old way: first there's a design. I make it, or I ask the design
> team and wait for it.
>
> Then I convert it. Figma out, Adobe in. Every single time.
>
> Then I animate it. Layer by layer. And if you've ever opened a real Figma file you know
> there are a **lot** of layers.
>
> That's completely fine for a launch video. You do that three times a year, it's worth it.
>
> But I'm making YouTube videos. I need this most weeks, sometimes twice a week. At that
> cadence it just doesn't work."

## 05 · What Remotion is · 1:00 — *the mechanics start here*

> "At the start of this year I started using Claude, and it introduced me to something called
> Remotion. It's open source, and it renders React components to video.
>
> Here's the whole idea. Your scene is a component. It asks one question — what frame are we
> on? — and Remotion says 47. And you return what frame 47 looks like. That's the entire API.
>
> To export, Remotion opens a headless Chrome, steps the frame counter, screenshots every
> frame, and hands the pile to ffmpeg.
>
> Look at what that removes. No Figma export. No converting anything. **No layers.** A video
> is a text file.
>
> And here's the bit that makes it work: language models are *extraordinarily* good at
> writing React. Better at React than at almost anything, because that's what the internet is
> made of.
>
> So I'm not asking a model to imagine a video — the thing they're bad at. I'm asking it to
> write a React file, the thing they're best at."

*Optional, if you want the origin in: this came out of our internal AI hackathon.*

## 06 · Great engine. Terrible taste. · 0:50

> "One problem. Remotion could animate literally anything — and the style was all over the
> place. Every scene looked like a different company made it.
>
> So I taught it our house style. And it's worth being precise about what that means, because
> it isn't 'we fine-tuned a model'. Nothing here is trained in that sense. It's **fed**.
>
> **Tokens.** Our real palette is ported out of the design system into one file, and every
> scene imports from it. Writing a raw hex code is a hard rule violation. It's not
> approximating our orange from memory — it's importing the actual value.
>
> **Components.** 29 scenes built from our real marketing. And it doesn't get a *description*
> of them — it has a tool that opens the actual source file.
>
> **References.** On the first message it gets real frames from real Apify videos, as images.
> So it *sees* the house style instead of reading an adjective like 'clean'.
>
> **Limits** — my favourite. The moves I've banned: no blur on an entrance, no fade from
> black, no PowerPoint wipe. Those aren't instructions it has to remember. The function that
> sets an animation takes an enum with seven values, and those moves aren't in it. They're not
> forbidden. They're **unsayable**.
>
> If you take one idea home tonight, take that one. Don't ask a model to remember a rule —
> take the rule out of the vocabulary."

## 07 · Then I put it all in one place · 0:50

> "Remotion gave me the engine. But I was still bouncing between a terminal, a code editor and
> a render folder — so I started building an app to do all the animation work in one place.
> That's the video-tool.
>
> And it turned out far more powerful than I expected.
>
> **Prompt** — I describe a scene, it animates it.
> **Templates** — or I skip that and drop in a branded block that's already built.
> **Edit** — I give it footage and it cuts the dead air on its own.
> **Compose** — or it builds the whole finished video, footage and animation together.
> **SVG** — and I can hand it a logo or a diagram as an SVG file and it animates that file.
> That one still surprises me."

## 08 · DEMO · 2:15 — see `DEMO.md`

Press `.` for black, Cmd-Tab to Chrome. **Kill at 90 seconds** — press `B`.

## 09 · The loop · 0:45

> "One more thing it does that I didn't expect to matter as much as it does.
>
> For the first few months the output was fine-ish. Sometimes text ran off the edge. Sometimes
> a frame was just empty, because a spring hadn't fired yet.
>
> Then I gave the model a tool that renders real frames of the scene it just wrote, and hands
> them back **as images**. It looks at its own work and fixes it before it ever reaches me.
>
> That one change did more for quality than every prompt edit I'd made put together.
>
> And it isn't clever — it's what a coding agent already does. Write, run, read the error, fix.
> Same loop, pictures instead of a stack trace."

## 10 · The wall · 0:40 — *your best slide, don't rush it*

> "This is every project still sitting in the tool. 313 of them. Six months.
>
> But look at the *order* — it's chronological. Top-left is March. Bottom-right is last week.
>
> Watch the top rows: rainbow. Blues, greens, pinks, whatever it felt like — that's before I
> taught it anything. Now the bottom: near-black and one orange.
>
> You can literally watch it learn the house style."

*(Three seconds of silence. Let them look.)*

## 11 · Shipped work · 0:30 *(CUT 2)*

Reel order: **x402 402-card → Build vs Buy → Apify AI → Verified emails → x402 finale.**

> "And it isn't a toy — these shipped. x402 is a payments protocol launch: eleven scenes,
> storyboarded and animated in about two days. That used to be a month and an agency invoice.
>
> Every clip in this deck was rendered by the tool this week, including the one you're
> watching."

## 12 · Three things · 0:35 *(CUT 1)*

> "Three things, quickly, if you want to build your own.
>
> **One — build for the job you already do.** I've made video for years, so I knew instantly
> when something looked wrong and I knew what to ask for. A tool for a job you don't do is a
> demo — you can't tell good from bad, so you ship bad.
>
> **Two — let it see.** Any loop where the model checks its own output beats any amount of
> prompt engineering.
>
> **Three — kill what doesn't earn its place.** I built a whole second rendering engine. Three
> months of evenings. It produced two videos, one of them a test. I deleted it and the tool
> got better."

## 13 · Handoff · 0:20

> "What I've shown you is the bespoke half. One scene, made properly. Slow, high-craft, and it
> does not scale past me.
>
> Luis built the other half — templated. Pick a concept, fill in the beats, and it comes out a
> hundred times, reliably.
>
> Neither half is the whole answer, which is why we're merging them. Over to Luis."

## 14 · End card

Leave it up while Luis sets up. Don't talk over it.

---

## Likely questions

**"Is it fine-tuned on your brand?"** — No. It's fed: our tokens as an import, our components
as readable source, real frames as reference images, and an enum that makes the banned moves
impossible. Cheaper and more auditable than training.

**"Do you still use After Effects?"** — Yes, for launch videos where the craft is worth the
afternoon. The tool is for the other 90% — the weekly stuff that used to not get made at all.

**"How much does it cost to run?"** — Pennies per scene. The system prompt is cached, so
iterations are ~10% of a first call.

**"Could a designer use it?"** — A designer would be better at it than me. It doesn't replace
taste, it removes the afternoon.

**"What about brand-new visual ideas?"** — Weakest there. Excellent at executing a style it's
been shown, mediocre at inventing one. Fine — brand work is mostly execution.

**"Why not Canva / an AI video generator?"** — Because I need the source. When legal asks to
change one word on frame 212, I change one word on frame 212 and re-render.
