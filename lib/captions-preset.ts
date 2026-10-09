import { makeId, trackAboveAt } from "./editor-doc";
import type { AudioItem, CaptionToken, CaptionsItem, EditorDoc, VideoItem } from "./editor-doc";
import { wordsForItem } from "./editor-transcript";

/**
 * Where one file's transcript goes on the timeline, as a captions layer.
 *
 * Transcript times are relative to the MEDIA FILE; a captions item stores times
 * relative to ITSELF. Bridging those by subtracting the first word's start
 * desyncs every caption by however long the speaker takes to begin: 1.6s of
 * room tone at the top of a clip drags the whole layer 1.6s ahead of the audio.
 * Anchoring to the clip instead makes a word at source time `ts` land on exactly
 * the frame the footage plays it.
 *
 * Every clip cut from the file counts, not just the first. One source becomes
 * many clips the moment anything is split or trimmed, and taking the first match
 * alone captioned that clip's range and silently dropped every word after it.
 * A graded clip plays a graded COPY of the file, so it is matched through the
 * asset it was graded from.
 *
 * Returns null when none of the file's words are heard anywhere. `doc` may have
 * gained a track to hold the layer.
 */
export function placeCaptions(
  doc: EditorDoc,
  src: string,
  tokens: CaptionToken[],
  fps: number,
  playhead: number,
): { doc: EditorDoc; trackId: string; from: number; spanSec: number; tokens: CaptionToken[] } | null {
  // The AI editor stores footage URLs percent-encoded, the timeline stores them
  // raw, so "My clip.mov" has two spellings.
  const decode = (s: string) => {
    try { return decodeURIComponent(s); } catch { return s; }
  };
  const assetId = doc.assets.find((a) => decode(a.src) === decode(src))?.id;
  const clips = assetId
    ? doc.tracks.flatMap((track) =>
        track.items.filter(
          (i): i is VideoItem | AudioItem =>
            (i.type === "video" || i.type === "audio") &&
            (i.assetId === assetId || (i.type === "video" && i.baseAssetId === assetId)),
        ),
      )
    : [];

  const words = tokens.map((t) => ({ text: t.text, start: t.startSec, end: t.endSec }));
  const heard = clips
    .map((item) => ({ item, timed: wordsForItem(item, words, fps) }))
    .filter((c) => c.timed.length > 0);

  let placed: CaptionToken[];
  let from: number;
  let spanSec: number;

  if (heard.length > 0) {
    from = Math.min(...heard.map((c) => c.item.from));
    const end = Math.max(...heard.map((c) => c.item.from + c.item.durationInFrames));
    spanSec = Math.max(1 / fps, (end - from) / fps);

    const spans = heard
      .flatMap((c) => c.timed)
      .map((w) => ({
        text: w.text,
        // One recorded word: Whisper can give two different words the same start.
        source: `${w.text}@${w.sourceStart}-${w.sourceEnd}`,
        startSec: (w.fromFrame - from) / fps,
        endSec: (w.toFrame - from) / fps,
      }))
      .sort((a, b) => a.startSec - b.startSec);

    // Stitch a word back together across a cut. wordsForItem keeps a word that
    // straddles an edge on BOTH sides and clamps it, which is right for finding
    // silence but would caption the same word twice at every split. Only the two
    // halves of the SAME source word merge. Matching on text instead also merged
    // real stutters, since Whisper often butts repeats together with no gap
    // ("I@56.94-58.34 I@58.34-58.92"). The same rule folds a video clip and its
    // own audio clip, which hear identical words, into one.
    const touching = 1 / fps + 1e-6;
    const stitched = spans.reduce<typeof spans>((acc, w) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.source === w.source && w.startSec - prev.endSec <= touching) {
        prev.endSec = Math.max(prev.endSec, w.endSec);
        return acc;
      }
      acc.push({ ...w });
      return acc;
    }, []);
    placed = stitched.map((w) => ({ text: w.text, startSec: w.startSec, endSec: w.endSec }));
  } else {
    // Nothing from this file is on the timeline yet, so there is no clip to
    // anchor to: fall back to the playhead, rebased off the first word.
    if (tokens.length === 0) return null;
    const base = tokens[0].startSec;
    placed = tokens.map((t) => ({ ...t, startSec: t.startSec - base, endSec: t.endSec - base }));
    from = playhead;
    spanSec = Math.max(1 / fps, placed[placed.length - 1].endSec);
  }

  if (placed.length === 0) return null;

  // Over everything playing at the time, never on or under the footage. addItem
  // pushes an item past anything it overlaps, so dropping the layer on the
  // footage's own track (all a one-track edit has) moved every caption to after
  // the last clip.
  const host = trackAboveAt(doc, from, Math.max(1, Math.round(spanSec * fps)));
  return { doc: host.doc, trackId: host.trackId, from, spanSec, tokens: placed };
}

/**
 * A captions item styled for the document's shape.
 *
 * Vertical gets the short-form treatment from the Figma kit: GT Walsheim rather
 * than Inter, a drop shadow so it survives over footage, and — the part that
 * matters — a position INSIDE the platform safe area. The old default put
 * captions 8% up from the bottom, which on a 1920-tall frame is y~1630, well
 * below TikTok's safe edge at ~1280 and squarely behind its own caption bar.
 * Figma places them at y=1021, and that is what this uses.
 *
 * Landscape now takes the same kit. It was the last thing still rendering in
 * Inter at 5.8% of frame height, which is why a 16:9 cut looked nothing like
 * the design while a 9:16 cut matched it.
 *
 * Everything is expressed against the kit's 1080x1920 design frame and scaled,
 * so a 4K document gets the same layout rather than the same pixels.
 */
export function captionItem(
  size: { width: number; height: number },
  from: number,
  fps: number,
  tokens: CaptionToken[],
  spanSec: number,
): CaptionsItem {
  const vertical = size.height > size.width;
  const durationInFrames = Math.max(1, Math.round(spanSec * fps));

  if (vertical) {
    const k = size.height / 1920; // the kit's design frame
    return {
      type: "captions" as const,
      id: makeId("captions"),
      from,
      durationInFrames,
      // Figma 2629:7 — 624x138 at (227, 1021) in the 1080x1920 frame.
      layout: {
        x: Math.round(227 * k),
        y: Math.round(1021 * k),
        width: Math.round(624 * k),
        height: Math.round(138 * k),
      },
      tokens,
      style: {
        fontFamily: "'GT Walsheim', Inter, sans-serif",
        fontSize: Math.round(68.751 * k),
        fontWeight: 400,
        color: "#FFFFFF",
        align: "center" as const,
        lineHeight: 1,
        textShadow: `0px ${Math.round(4 * k)}px ${Math.round(3 * k)}px rgba(0,0,0,0.25)`,
      },
      highlightColor: "#F86606",
      pageDurationMs: 1200,
      // Two lines is the brief, and 624px holds about three words a line at
      // this size.
      maxWordsPerPage: 5,
    };
  }

  // Landscape gets the same kit, scaled off the SHORT edge.
  //
  // The kit is drawn on a 1080x1920 frame, so its short edge is 1080 — the same
  // as a 1080p landscape frame's height. Scaling off height therefore gives a
  // landscape subtitle the same physical size as a vertical one, rather than
  // the same fraction of a much wider frame.
  //
  // What does NOT carry over is the y position. 1021 is where it sits to clear
  // TikTok's UI; a landscape frame has no such bands, so these stay anchored
  // near the bottom where a viewer expects subtitles.
  const k = size.height / 1080;
  const width = Math.round(624 * k);
  const height = Math.round(138 * k);
  return {
    type: "captions" as const,
    id: makeId("captions"),
    from,
    durationInFrames,
    layout: {
      x: Math.round((size.width - width) / 2),
      y: Math.round(size.height - height - size.height * 0.08),
      width,
      height,
    },
    tokens,
    style: {
      fontFamily: "'GT Walsheim', Inter, sans-serif",
      fontSize: Math.round(68.751 * k),
      fontWeight: 400,
      color: "#FFFFFF",
      align: "center" as const,
      lineHeight: 1,
      textShadow: `0px ${Math.round(4 * k)}px ${Math.round(3 * k)}px rgba(0,0,0,0.25)`,
    },
    highlightColor: "#F86606",
    pageDurationMs: 1200,
    // Same column width as vertical, so the same words fit on a line.
    maxWordsPerPage: 5,
  };
}
