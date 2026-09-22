# Live demo runbook

One live generation, on stage, on conference wifi. This is the only part of the talk that can
eat the whole slot, so it gets its own page.

**Budget: 2 minutes 15 seconds. Kill at 90 seconds if nothing is on screen.**

---

## The prompt

Fill `EVENT` at the bottom of `talk/deck.html` and the deck builds this string for you — the
same text shows on the demo slide so the room can read along.

```
Intro card: «MEETUP NAME», «DATE», «VENUE» underneath. Kinetic style.
```

Keep it under ~180 characters. Long strings are the single most likely thing to go wrong
here: an intro card sized for a short headline will overflow with a long venue name. If the
venue name is long, shorten it to how people actually say it.

**Rehearse this exact string at least twice.** Not a variation of it — this one.

---

## T-30 minutes

- [ ] `npm run dev` running, `http://localhost:3000` open
- [ ] `ANTHROPIC_API_KEY` valid in `.env.local` — generate once to confirm, don't assume
- [ ] **Warm-up generation done.** The ~25K-token system prompt is prompt-cached, so a run in
      the last few minutes makes the stage run measurably faster. This is free speed — do it.
- [ ] A **fresh Animation project** created, named, empty, style set to **Kinetic**, sitting
      open and ready. Don't create it on stage.
- [ ] **Second tab**: the same prompt already generated and finished. This is fallback (a).
- [ ] Do Not Disturb on. Slack quit, not just muted.
- [ ] Browser at 100% zoom, dev tools closed, one window, bookmarks bar hidden
- [ ] Prompt text in a note you can paste from — do not type it live, typos cost you 20s
- [ ] Deck open in a separate Chrome window, full screen (`F`), timer started (`T`)
- [ ] Battery > 50% or plugged in; screen sleep disabled

## T-2 minutes

- [ ] Prompt on the clipboard
- [ ] Both windows arranged so Cmd-Tab goes deck → tool → deck with no hunting

---

## On stage, minute by minute

**0:00 — switch.** Press `.` (black), Cmd-Tab to Chrome. Press `.` again is *not* needed —
the deck stays black behind you.

**0:05 — paste and send.** Say what you're doing: *"I'm asking it for an intro card for
tonight."*

**0:10–1:20 — talk over it.** This is not dead air, it's the best part. Do not watch the
spinner in silence.

> "While that's going — it's writing a TypeScript file right now, top to bottom, the same way
> you'd watch a person type it."

**WHEN `render_frames` FIRES — point at the screen. This is the moment:**

> "See that? It just rendered its own frames so it can look at them. It's about to tell me
> what's wrong with its own work."

**1:20–2:00 — play it.** Let the preview loop once in silence, then:

> "That's the first pass. No one touched it."

**2:15 — back to the deck.** Cmd-Tab, press `.` to clear black, `→` to The Loop.

---

## When it goes wrong

Work down this list. Do not debug on stage — you have 90 seconds and then you move.

**(a) It's slow.** At 90 seconds with nothing on screen: Cmd-Tab to the deck, press `B`. The
recorded run plays. Talk over it exactly as if it were live:

> "Here's one I recorded, because conference wifi is conference wifi. Watch the middle —
> that's the model rendering its own frames to check its work."

**(b) It errored.** Same move — `B`. Don't read the stack trace out loud.

**(c) It worked but it's ugly.** *This is the best possible outcome and you should almost hope
for it.* Don't apologise:

> "That's the honest first pass. Now watch me tell it what's wrong."

Then type one correction — *"make the headline bigger and give the date more room"* — and let
the room see it as a conversation rather than a slot machine. If you're short on time, say the
line and move on without waiting for the fix.

**(d) The text overflows the card.** Point at it and use it:

> "And that's exactly the failure the self-review loop is meant to catch — it clearly didn't
> look hard enough."

Gets a laugh, and it sets up the next slide perfectly.

---

## Recording the fallback

During rehearsal, screen-record one **successful** run end to end and save it to:

```
talk/assets/clips/demo-fallback.mp4
```

Then compress it the same way as the other clips (silent, 1280 wide):

```bash
ffmpeg -i raw-recording.mov -an -vf "scale=1280:-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart \
  talk/assets/clips/demo-fallback.mp4
```

Trim it to **60–75 seconds**, and make sure the `render_frames` moment is in shot — that's
the only part that matters. Until this file exists, the `B` slide tells you it's missing.

Do the full rehearsal **twice**. The second one is the real measurement; the first is always
slower than you think.
