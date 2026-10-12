/**
 * A measured beat grid, and where it falls on a timeline.
 *
 * Kept apart from lib/beats.ts (which decodes audio and touches the disk) so
 * the timeline can draw beats in the browser and the editor agent — pure by
 * contract — can describe them, from the same arithmetic.
 */

export const BEATS_VERSION = 1;

export interface BeatAnalysis {
  version: number;
  durationSec: number;
  /** Tempo in beats per minute, or null when the track has no steady beat. */
  bpm: number | null;
  /** 0..1 — how clearly the onsets line up with the fitted grid. */
  confidence: number;
  /** Seconds of every beat, from the first one in the file. Empty when bpm is null. */
  beats: number[];
  /** Seconds of every bar line (beat 1 of each bar). */
  downbeats: number[];
  /** Where the track arrives: the bar line with the biggest sustained bass rise. */
  drop: { atSec: number; riseDb: number } | null;
  /** Other bar lines where the music clearly changes level, in time order. */
  sections: { atSec: number; changeDb: number }[];
}

/**
 * Map a track's beats onto a stretch of the composition.
 *
 * `sourceInSec` is where in the file playback starts, `startFrame` where on the
 * timeline it does, `rate` the clip's speed. Returns composition frames, only
 * for the part of the clip that actually plays.
 */
export function beatsOnTimeline(
  analysis: BeatAnalysis,
  clip: { startFrame: number; durationInFrames: number; sourceInSec: number; rate: number },
  fps: number,
): { beats: number[]; downbeats: number[]; drop: number | null; sections: number[] } {
  const toFrame = (sec: number) => clip.startFrame + ((sec - clip.sourceInSec) / clip.rate) * fps;
  const inClip = (f: number) => f >= clip.startFrame - 0.5 && f < clip.startFrame + clip.durationInFrames;
  const map = (secs: number[]) => secs.map(toFrame).filter(inClip).map((f) => Math.round(f * 100) / 100);
  const drop = analysis.drop ? toFrame(analysis.drop.atSec) : null;
  return {
    beats: map(analysis.beats),
    downbeats: map(analysis.downbeats),
    drop: drop != null && inClip(drop) ? Math.round(drop * 100) / 100 : null,
    sections: map(analysis.sections.map((s) => s.atSec)),
  };
}

const f2 = (v: number) => (Math.round(v * 100) / 100).toString();

/**
 * One line about a music clip for the timeline AI's outline, in composition
 * frames — or null when the clip has no steady beat to speak of.
 */
export function musicOutline(
  analysis: BeatAnalysis,
  clip: { startFrame: number; durationInFrames: number; sourceInSec: number; rate: number },
  fps: number,
): string | null {
  if (!analysis.bpm) return null;
  const grid = beatsOnTimeline(analysis, clip, fps);
  if (!grid.beats.length) return null;
  const bpm = analysis.bpm * clip.rate;
  const beatFrames = (60 / bpm) * fps;
  const bars = grid.downbeats.slice(0, 6).map((f) => `${Math.round(f)}f`).join(", ");
  const parts = [
    `music ${f2(bpm)} BPM — a beat every ${f2(beatFrames)}f`,
    grid.downbeats.length ? `bar lines at ${bars}${grid.downbeats.length > 6 ? " …" : ""} (every ${f2(beatFrames * 4)}f)` : "",
    grid.drop != null ? `the drop at ${Math.round(grid.drop)}f (${(grid.drop / fps).toFixed(2)}s)` : "",
    grid.sections.length ? `the music changes at ${grid.sections.slice(0, 5).map((f) => `${Math.round(f)}f`).join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * The music grid in a SCENE's own frames, for the scene writer.
 *
 * `sceneStartFrame` is where the scene's frame 0 sits on the timeline (a block
 * that shows only a window of its scene starts before the block does). The
 * grid is handed over as numbers the beat-grid rule in the house prompt
 * already uses, so the scene's `at(n)` lands on the real track instead of an
 * assumed 120 BPM.
 */
export function musicNoteForScene(
  name: string,
  analysis: BeatAnalysis,
  clip: { startFrame: number; durationInFrames: number; sourceInSec: number; rate: number },
  sceneStartFrame: number,
  sceneLength: number,
  fps: number,
): string | null {
  if (!analysis.bpm) return null;
  const grid = beatsOnTimeline(analysis, clip, fps);
  const local = (f: number) => f - sceneStartFrame;
  const inScene = (f: number) => f >= 0 && f < sceneLength;
  const bars = grid.downbeats.map(local).filter(inScene);
  const beats = grid.beats.map(local).filter(inScene);
  if (!beats.length) return null;
  const bpm = analysis.bpm * clip.rate;
  const beat = (60 / bpm) * fps;
  const first = bars.length ? bars[0] : beats[0];
  const drop = grid.drop != null && inScene(local(grid.drop)) ? local(grid.drop) : null;
  const changes = grid.sections.map(local).filter(inScene);
  return [
    `MUSIC under this scene: "${name}" — measured at ${f2(bpm)} BPM, a beat every ${f2(beat)} frames at ${fps}fps.`,
    `In this scene's own frames, bar lines (beat 1) land at ${bars.slice(0, 8).map(f2).join(", ")}${bars.length > 8 ? `, and every ${f2(beat * 4)} frames after that` : ""}.`,
    drop != null ? `The drop — where the track arrives — is at scene frame ${f2(drop)}: put the key moment (the hero reveal, the biggest move) on it.` : "",
    changes.length ? `The music changes level at scene frames ${changes.slice(0, 5).map(f2).join(", ")}; those are natural places for a scene change.` : "",
    `Use this grid instead of the default 120 BPM: \`const BPM = ${f2(bpm)}; const BEAT = (60 / BPM) * fps; const FIRST = ${f2(first)}; const at = (beats: number) => Math.round(FIRST + beats * BEAT);\` — at(0) is ${bars.length ? "the first bar line" : "the first beat"}, at(4) the next bar, and negative beats reach back before it.`,
  ].filter(Boolean).join(" ");
}
