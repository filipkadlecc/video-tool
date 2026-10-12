/**
 * Offline tests for the beat analysis, the loudness plan and the measured
 * checks (lib/beats.ts, lib/loudness.ts, lib/scene-checks.ts).
 *
 *   npx tsx scripts/test-audio-checks.ts
 *
 * Everything is synthetic — a track built sample by sample with a known tempo,
 * bar lines and drop; probe frames and thumbnails written by hand — so no
 * media, browser or ffmpeg is needed and every expected answer is exact.
 */
import { analyzeBeats } from "../lib/beats";
import { beatsOnTimeline, musicNoteForScene, musicOutline } from "../lib/beats-grid";
import { gainFilter, parseEbur128, planGain } from "../lib/loudness";
import {
  analyzeFlashes, analyzeLayout, analyzeSounds, describeFinding, isSoundEffect, parseProbeLogs,
  placeSounds, PROBE_LOG_PREFIX, reportForModel, SIG_H, SIG_W, type ProbeBlock, type ProbeFrame,
} from "../lib/scene-checks";

let pass = 0, fail = 0;
const a = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log("  FAIL: " + m); } };
const head = (t: string) => console.log("\n--- " + t + " ---");
const near = (x: number, y: number, tol: number) => Math.abs(x - y) <= tol;

// ── a synthetic house track ─────────────────────────────────────────────────
// 128 BPM. Bar lines at FIRST_BAR + 4n beats, with one pickup beat before the
// first bar. Bars 1–8 are a breakdown (hats and a quiet pad, no kick, no bass);
// from bar 9 the kick, the bass and a crash on every bar line come in: the drop.
const SR = 22050;
const BPM = 128;
const BEAT = 60 / BPM;
const FIRST_BAR = 0.31 + BEAT;
const BARS = 20;
function synthTrack(): Float32Array {
  const len = Math.ceil((FIRST_BAR + BARS * 4 * BEAT + 1) * SR);
  const out = new Float32Array(len);
  let seed = 7;
  const noise = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  const add = (t0: number, dur: number, f: (t: number) => number) => {
    const s0 = Math.round(t0 * SR);
    for (let i = 0; i < dur * SR && s0 + i < len; i++) if (s0 + i >= 0) out[s0 + i] += f(i / SR);
  };
  for (let b = -1; b < BARS * 4; b++) {
    const t = FIRST_BAR + b * BEAT;
    const bar = Math.floor(b / 4);
    const dropped = bar >= 8;
    // Off-beat hats throughout, so the grid is findable in the breakdown too.
    add(t + BEAT / 2, 0.03, (x) => 0.18 * noise() * Math.exp(-x * 120));
    add(t, 0.03, (x) => 0.12 * noise() * Math.exp(-x * 120));
    if (dropped) {
      add(t, 0.15, (x) => 0.8 * Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-x * 30)) * x) * Math.exp(-x * 18));
      add(t, BEAT, (x) => 0.35 * Math.sin(2 * Math.PI * (b % 4 === 0 ? 41 : 49) * x));
      if (b % 4 === 0) add(t, 0.35, (x) => 0.3 * noise() * Math.exp(-x * 9));
    } else {
      add(t, BEAT, (x) => 0.05 * Math.sin(2 * Math.PI * 330 * x));
    }
  }
  return out;
}

head("beats: a synthetic 128 BPM track with a breakdown and a drop");
{
  const r = analyzeBeats(synthTrack(), SR);
  a(r.bpm !== null && near(r.bpm, BPM, 0.1), `tempo is 128 (got ${r.bpm})`);
  a(r.confidence > 0.5, `confident about a steady beat (got ${r.confidence})`);
  const offGrid = r.beats.map((t) => Math.abs(((t - FIRST_BAR) / BEAT) - Math.round((t - FIRST_BAR) / BEAT)) * BEAT);
  a(Math.max(...offGrid) < 0.02, `every beat within 20 ms of the true grid (worst ${(Math.max(...offGrid) * 1000).toFixed(1)} ms)`);
  const barOff = r.downbeats.map((t) => (t - FIRST_BAR) / BEAT);
  a(barOff.every((k) => near(((k % 4) + 4) % 4, 0, 0.1) || near(((k % 4) + 4) % 4, 4, 0.1)), `bar lines on beat 1 of each bar (first at ${r.downbeats[0]})`);
  a(r.drop !== null && near(r.drop.atSec, FIRST_BAR + 8 * 4 * BEAT, 0.05), `the drop at bar 9, ${(FIRST_BAR + 32 * BEAT).toFixed(2)}s (got ${r.drop?.atSec})`);
}

head("beats: no steady beat in noise or silence");
{
  const silence = analyzeBeats(new Float32Array(SR * 10), SR);
  a(silence.bpm === null && silence.beats.length === 0, "silence has no beat");
  let seed = 3;
  const noise = Float32Array.from({ length: SR * 12 }, () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 0.4; });
  a(analyzeBeats(noise, SR).bpm === null, "white noise has no beat");
  a(analyzeBeats(new Float32Array(SR * 2), SR).bpm === null, "too short to say");
}

head("beats: mapping onto the timeline");
{
  const r = analyzeBeats(synthTrack(), SR);
  const fps = 30;
  // The clip starts 2 s into the file and sits at frame 100 on the timeline.
  const grid = beatsOnTimeline(r, { startFrame: 100, durationInFrames: 600, sourceInSec: 2, rate: 1 }, fps);
  a(grid.beats.every((f) => f >= 99.5 && f < 700), "only beats inside the clip");
  const first = r.beats.find((t) => t >= 2)!;
  a(near(grid.beats[0], 100 + (first - 2) * fps, 0.01), "a beat 2 s into the file lands at the clip start + its offset");
  const fast = beatsOnTimeline(r, { startFrame: 0, durationInFrames: 300, sourceInSec: 0, rate: 2 }, fps);
  a(near(fast.beats[1] - fast.beats[0], (BEAT / 2) * fps, 0.05), "a 2x clip has beats twice as close");
  const outline = musicOutline(r, { startFrame: 0, durationInFrames: 1800, sourceInSec: 0, rate: 1 }, fps);
  a(!!outline && outline.includes("128 BPM") && outline.includes("the drop at"), `outline names the tempo and the drop: ${outline}`);
  const note = musicNoteForScene("track.mp3", r, { startFrame: 0, durationInFrames: 1800, sourceInSec: 0, rate: 1 }, 0, 1800, fps)!;
  a(note.includes("const BPM = 128") && note.includes("FIRST = "), "scene note hands over the grid as code");
  const dropFrame = (FIRST_BAR + 32 * BEAT) * fps;
  a(note.includes(`scene frame ${Math.round(dropFrame * 100) / 100}`) || note.includes("drop"), "scene note places the drop in scene frames");
  // A scene that starts later sees the same music at earlier local frames.
  const later = musicNoteForScene("track.mp3", r, { startFrame: 0, durationInFrames: 1800, sourceInSec: 0, rate: 1 }, 300, 600, fps)!;
  const firstBarLocal = Number(later.match(/FIRST = ([\d.]+)/)![1]);
  a(firstBarLocal >= 0 && firstBarLocal < (BEAT * 4 * fps) + 0.01, `scene-local first bar line is within the first bar (${firstBarLocal})`);
  const none = musicNoteForScene("vo.wav", { ...r, bpm: null }, { startFrame: 0, durationInFrames: 900, sourceInSec: 0, rate: 1 }, 0, 900, fps);
  a(none === null, "no grid for a track without a beat");
}

head("loudness: the gain plan");
{
  const quiet = planGain({ integrated: -24, truePeak: -12 });
  a(quiet.gainDb === 10 && !quiet.limit && !quiet.heldBack && !quiet.skip, "a quiet mix with headroom gets plain gain");
  const loud = planGain({ integrated: -9, truePeak: -0.2 });
  a(loud.gainDb === -5 && !loud.limit, "a loud mix is turned down, never limited");
  const peaky = planGain({ integrated: -26, truePeak: -10 });
  a(peaky.limit && !peaky.heldBack && peaky.gainDb === 12, "peaks up to 4 dB over the ceiling are limited, target still reached");
  const over = planGain({ integrated: -26, truePeak: -6 });
  a(over.limit && over.heldBack && over.gainDb === 9, `peaks 7 dB over would be squashed: held back to +9 (got ${over.gainDb})`);
  const spiky = planGain({ integrated: -30, truePeak: -2 });
  a(spiky.heldBack && spiky.gainDb === 5 && spiky.limit, `a hit 15 dB over would be squashed: held back to +5 (got ${spiky.gainDb})`);
  a(planGain({ integrated: -70, truePeak: -60 }).skip, "silence is left alone");
  a(planGain({ integrated: -Infinity, truePeak: -Infinity }).skip, "no measurable sound is left alone");
  a(planGain({ integrated: -14.05, truePeak: -3 }).skip, "already on target is left alone");
  a(planGain({ integrated: -50, truePeak: -40 }).gainDb === 20 && planGain({ integrated: -50, truePeak: -40 }).heldBack, "never more than +20 dB");
  a(gainFilter(quiet) === "volume=10.00dB", "plain gain is one volume filter");
  const f = gainFilter(peaky)!;
  a(f.startsWith("volume=12.00dB,alimiter=") && f.includes("level=disabled") && f.includes("latency=1"), "the limiter adds no make-up gain and no delay");
  a(gainFilter(planGain({ integrated: -80, truePeak: -80 })) === null, "nothing to do is no filter");
}

head("loudness: reading ffmpeg's meter");
{
  const log = `[Parsed_ebur128_0 @ 0x1] Summary:\n\n  Integrated loudness:\n    I:         -21.4 LUFS\n    Threshold: -31.5 LUFS\n\n  Loudness range:\n    LRA:         6.2 LU\n\n  True peak:\n    Peak:       -2.7 dBFS\n`;
  const m = parseEbur128(log)!;
  a(m.integrated === -21.4 && m.truePeak === -2.7, "integrated and true peak");
  a(parseEbur128("no summary here") === null, "no summary is null");
  const silent = parseEbur128(`Summary:\n  Integrated loudness:\n    I:         -70.0 LUFS\n  True peak:\n    Peak:       -inf dBFS\n`)!;
  a(silent.integrated === -70 && silent.truePeak === -Infinity, "silence reads as -70 and -inf");
}

// ── layout ────────────────────────────────────────────────────────────────────
const block = (k: string, t: string, x: number, y: number, w: number, h: number, extra: Partial<ProbeBlock> = {}): ProbeBlock => ({
  k, t, b: [x, y, w, h], r: [[x, y, w, h]], v: 1, e: "", c: "", o: 1, ...extra,
});
const frames = (n: number, make: (f: number) => ProbeBlock[]): Map<number, ProbeFrame> => {
  const m = new Map<number, ProbeFrame>();
  for (let f = 0; f < n; f++) m.set(f, { f, w: 1920, h: 1080, blocks: make(f) });
  return m;
};

head("layout: cut-off text");
{
  const fps = 30;
  // At rest, half past the right edge for 2 s.
  const resting = analyzeLayout(frames(60, () => [block("0.1", "Headline", 1500, 80, 860, 100, { v: 0.49, e: "r", c: "canvas" })]), fps);
  a(resting.length === 1 && resting[0].kind === "cut-off", "text resting past the edge is reported");
  a(resting[0]?.kind === "cut-off" && resting[0].edge === "r" && resting[0].by === "canvas", "with the edge and what clips it");
  // Sliding in from the right: partly off for 20 frames, but moving.
  const sliding = analyzeLayout(frames(60, (f) => {
    const x = Math.max(800, 2000 - f * 60);
    const v = x + 300 > 1920 ? Math.max(0, (1920 - x) / 300) : 1;
    return [block("0.1", "Sliding", x, 450, 300, 70, { v, e: v < 1 ? "r" : "", c: v < 1 ? "canvas" : "" })];
  }), fps);
  a(sliding.length === 0, "text sliding in from the edge is not reported");
  // Briefly at rest past the edge, shorter than the hold.
  const brief = analyzeLayout(frames(60, (f) => [block("0.1", "Brief", 1700, 80, 400, 100, f >= 20 && f < 28 ? { v: 0.5, e: "r", c: "canvas" } : { v: 1 })]), fps);
  a(brief.length === 0, "a quarter-second graze is not reported");
  // Faded out text doesn't count.
  const faded = analyzeLayout(frames(60, () => [block("0.1", "Ghost", 1500, 80, 860, 100, { v: 0.49, e: "r", c: "canvas", o: 0.2 })]), fps);
  a(faded.length === 0, "nearly transparent text is not reported");
  // Giant designed bleed.
  const giant = analyzeLayout(frames(60, () => [block("0.1", "APIFY", -400, 0, 3200, 900, { v: 0.6, e: "lr", c: "canvas" })]), fps);
  a(giant.length === 0, "type far bigger than the frame is a designed bleed");
  const boxed = analyzeLayout(frames(60, () => [block("0.2", "Clipped label", 100, 100, 300, 50, { v: 0.7, e: "b", c: "box" })]), fps);
  a(boxed[0]?.kind === "cut-off" && boxed[0].by === "box", "clipped by a container is told apart from the frame edge");
}

head("layout: overlapping text");
{
  const fps = 30;
  const two = analyzeLayout(frames(40, () => [block("0.2", "Overlap one", 200, 300, 345, 50), block("0.3", "Overlap two", 230, 320, 343, 50)]), fps);
  a(two.length === 1 && two[0].kind === "overlap", "two labels on top of each other");
  const glow = analyzeLayout(frames(40, () => [block("0.2", "Glow", 200, 300, 345, 50), block("0.3", "Glow", 202, 302, 345, 50)]), fps);
  a(glow.length === 0, "a duplicated layer of the same words is deliberate");
  const nested = analyzeLayout(frames(40, () => [block("0.2", "Card title", 200, 300, 345, 50), block("0.2.1", "Badge", 210, 305, 80, 30)]), fps);
  a(nested.length === 0, "a block nested inside another is not an overlap");
  const apart = analyzeLayout(frames(40, () => [block("0.2", "Left", 100, 300, 200, 50), block("0.3", "Right", 400, 300, 200, 50)]), fps);
  a(apart.length === 0, "side by side is fine");
  const graze = analyzeLayout(frames(40, () => [block("0.2", "One", 100, 300, 200, 50), block("0.3", "Two", 290, 300, 200, 50)]), fps);
  a(graze.length === 0, "touching edges (under a fifth of the smaller one) is fine");
}

head("layout: reading the probe's console lines");
{
  const line = `${PROBE_LOG_PREFIX}${JSON.stringify({ f: 3, w: 1920, h: 1080, blocks: [] })}`;
  const parsed = parseProbeLogs([line, "unrelated", `${PROBE_LOG_PREFIX}{broken`, `prefix ${line}`]);
  a(parsed.size === 1 && parsed.get(3)?.w === 1920, "valid lines parsed, junk skipped");
}

// ── flashes ───────────────────────────────────────────────────────────────────
const sig = (fill: (x: number, y: number) => number) => {
  const s = new Uint8Array(SIG_W * SIG_H);
  for (let y = 0; y < SIG_H; y++) for (let x = 0; x < SIG_W; x++) s[y * SIG_W + x] = fill(x, y);
  return s;
};
const scene = (shift: number) => sig((x, y) => (x + shift < 16 ? 30 : 200) - (y % 3) * 5);

head("flashes and blank frames");
{
  const steady = Array.from({ length: 30 }, () => scene(0));
  a(analyzeFlashes(steady).length === 0, "a still shot has none");
  const moving = Array.from({ length: 30 }, (_, i) => scene(Math.floor(i / 2)));
  a(analyzeFlashes(moving).length === 0, "steady motion has none");
  const cut = [...Array.from({ length: 15 }, () => scene(0)), ...Array.from({ length: 15 }, () => sig(() => 120))];
  a(analyzeFlashes(cut).length === 0, "a hard cut is not a flash");
  const flash = Array.from({ length: 30 }, (_, i) => (i === 12 ? sig((x, y) => 255 - ((x < 16 ? 30 : 200) - (y % 3) * 5)) : scene(0)));
  const f1 = analyzeFlashes(flash);
  a(f1.length === 1 && f1[0].kind === "flash" && f1[0].frame === 12, "an inverted frame is a one-frame flash");
  const white = analyzeFlashes(Array.from({ length: 30 }, (_, i) => (i === 12 ? sig(() => 255) : scene(0))));
  a(white.length === 1 && white[0].kind === "blank-frame" && white[0].frame === 12, "an all-white frame is a blank frame");
  const pop = Array.from({ length: 30 }, (_, i) => (i === 9 ? sig((x, y) => (x < 8 && y < 6 ? 255 : (x < 16 ? 30 : 200) - (y % 3) * 5)) : scene(0)));
  a(analyzeFlashes(pop)[0]?.kind === "flash", "a small corner pop for one frame is caught too");
  const two = Array.from({ length: 30 }, (_, i) => (i === 20 || i === 21 ? sig(() => 255) : scene(0)));
  const f2 = analyzeFlashes(two);
  a(f2.length === 1 && f2[0].kind === "flash" && f2[0].length === 2, "a two-frame flash is one finding");
  const gap = [...Array.from({ length: 10 }, () => scene(0)), sig(() => 2), ...Array.from({ length: 10 }, () => sig((x) => (x < 20 ? 220 : 10)))];
  const g = analyzeFlashes(gap);
  a(g.length === 1 && g[0].kind === "blank-frame" && g[0].frame === 10, "a black frame between two shots is a blank frame");
  const fade = Array.from({ length: 30 }, (_, i) => sig(() => Math.round(i * 8)));
  a(analyzeFlashes(fade).length === 0, "a gradual change is not a flash");
}

// ── sound ─────────────────────────────────────────────────────────────────────
head("sound: placements from the renderer's asset list");
{
  const asset = (id: string, frame: number, src: string, mediaFrame: number, volume = 1) => ({ type: "audio", src, id, frame, volume, mediaFrame, playbackRate: 1 });
  const perFrame = Array.from({ length: 40 }, (_, f) => ({
    frame: f,
    audioAndVideoAssets: [
      ...(f < 40 ? [asset("bed", f, f === 0 ? "http://x/api/media/p/music.mp3" : "same-as-bed-0", f)] : []),
      ...(f >= 10 && f < 20 ? [asset("fx", f, "/static-abc/assets/sfx/pop-1.wav", f - 10, 0.5)] : []),
      ...(f >= 30 && f < 35 ? [asset("fx", f, "/static-abc/assets/sfx/pop-1.wav", f - 30, 0.5)] : []),
    ],
  }));
  const placed = placeSounds(perFrame);
  a(placed.length === 3, `bed + two placements of the same effect (got ${placed.length})`);
  const bed = placed.find((p) => p.id === "bed")!;
  a(bed.src === "http://x/api/media/p/music.mp3" && bed.durationFrames === 40, "a compressed src is restored, duration counted");
  const fx = placed.filter((p) => isSoundEffect(p.src));
  a(fx.length === 2 && fx[0].startFrame === 10 && fx[1].startFrame === 30 && fx[1].trimLeftFrames === 0, "a replayed effect is a second hit");
  a(fx[0].volumes.length === 10 && fx[0].volumes[0] === 0.5, "per-frame volume kept");
}

head("sound: buried effects");
{
  const fps = 30;
  const sounds = [
    { id: "bed", src: "/api/media/p/music.mp3", type: "audio" as const, startFrame: 0, durationFrames: 300, trimLeftFrames: 0, playbackRate: 1, volumes: new Array(300).fill(1) },
    { id: "quiet", src: "/static/assets/sfx/pop-1.wav", type: "audio" as const, startFrame: 30, durationFrames: 10, trimLeftFrames: 0, playbackRate: 1, volumes: new Array(10).fill(0.1) },
    { id: "loud", src: "/static/assets/sfx/hit-deep.wav", type: "audio" as const, startFrame: 90, durationFrames: 30, trimLeftFrames: 0, playbackRate: 1, volumes: new Array(30).fill(1) },
    { id: "clicky", src: "/static/assets/sfx/click-1.wav", type: "audio" as const, startFrame: 150, durationFrames: 5, trimLeftFrames: 0, playbackRate: 1, volumes: new Array(5).fill(0.3) },
    { id: "alone", src: "/static/assets/sfx/pop-soft.wav", type: "audio" as const, startFrame: 400, durationFrames: 10, trimLeftFrames: 0, playbackRate: 1, volumes: new Array(10).fill(0.05) },
  ];
  // Peaks in dB at volume 1: the bed is loud and bassy, the click is all top end.
  const levels: Record<string, { full: number; high: number }> = {
    "music.mp3": { full: -3, high: -20 },
    "pop-1.wav": { full: -6, high: -14 },
    "hit-deep.wav": { full: -2, high: -15 },
    "click-1.wav": { full: -10, high: -11 },
    "pop-soft.wav": { full: -8, high: -14 },
  };
  const fileOf = (src: string) => src.split("/").pop()!;
  const peak = (file: string, _a: number, _b: number, high: boolean) => (high ? levels[file].high : levels[file].full);
  const { findings, effects } = analyzeSounds(sounds, fps, fileOf, peak);
  a(effects === 4, "four effects checked");
  a(findings.length === 1 && findings[0].kind === "buried-sound" && findings[0].frame === 30, `only the quiet pop is buried (got ${findings.map((f) => f.frame)})`);
  a(findings[0]?.kind === "buried-sound" && findings[0].sound === "pop-1.wav" && findings[0].under === "music.mp3", "named, and what buries it");
  a(findings[0]?.kind === "buried-sound" && findings[0].marginDb < -12, "with the margin");
  // The click is 17 dB under the bed broadband but cuts through in the top end.
  a(!findings.some((f) => f.frame === 150), "a crisp click over a bassy bed is audible");
  a(!findings.some((f) => f.frame === 400), "an effect with nothing under it is fine at any level");
  const lines = reportForModel({ findings, checked: { text: true, frames: true, sound: true, soundEffects: 4, every: 1 }, notes: [] }, fps);
  a(lines.includes("MEASURED CHECKS") && lines.includes("pop-1.wav"), "reported to the model");
  const clean = reportForModel({ findings: [], checked: { text: true, frames: false, sound: false, soundEffects: 0, every: 6 }, notes: ["skipped"] }, fps);
  a(clean.includes("Nothing found") && clean.includes("every 6th frame") && !clean.includes("sound effect can be heard"), "a clean report names only what ran");
  a(describeFinding({ kind: "flash", frame: 45, length: 1 }, 30).startsWith("0:01.5"), "times read as m:ss.s");
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fail) process.exit(1);
