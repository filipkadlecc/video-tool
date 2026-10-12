import fs from "fs";
import { bandSpectrogram, decodeMono, median, toDb } from "./audio-dsp";
import { BEATS_VERSION, type BeatAnalysis } from "./beats-grid";

export { BEATS_VERSION, beatsOnTimeline, musicNoteForScene, musicOutline, type BeatAnalysis } from "./beats-grid";

/**
 * The beat of a music track, measured from the audio itself.
 *
 * Generated scenes are written on a beat grid (lib/prompts/base.ts), and until
 * now that grid was always an assumed 120 BPM "so a track can be dropped in
 * later". This measures the track that WAS dropped in: its tempo, where each
 * beat and bar falls, and the drop — so a reveal can land on the real kick and
 * the key moment on the real drop, and the timeline can draw where they are.
 *
 * Three decisions, each from a failure mode of the obvious version:
 *
 *  - The grid is FITTED, not tracked. Almost every marketing track is made in a
 *    DAW at one constant tempo, so a single tempo + phase that best explains
 *    every onset in the song is both more accurate and far more useful to a
 *    scene ("beat n is at OFFSET + n * BEAT") than a list of beats that wobble
 *    with the drummer. A track that doesn't fit a steady grid says so
 *    (`bpm: null`) rather than handing over a grid that is wrong.
 *
 *  - The drop is found by BASS energy, bar by bar. An auto beat grid can't tell
 *    you where the song arrives; the kick and bass coming back after a build
 *    can, and a loudness-only measure is fooled by a bright build-up.
 *
 *  - Bars assume 4/4. Every track this tool has been used with is in four; a
 *    waltz would get bar lines a beat off, and the beats themselves stay right.
 */

const SR = 22050;
const SIZE = 1024;
const HOP = 256;
const BANDS = 36;
/** Bands below this are "the kick and the bass". */
const LOW_HZ = 150;
const MIN_BPM = 55;
const MAX_BPM = 200;
/** Below this the onsets don't follow a grid — a voiceover, an ambient pad. */
const STEADY_RATIO = 2.0;

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Analyse decoded mono samples. Pure — the tests feed it synthetic tracks. */
export function analyzeBeats(samples: Float32Array, sampleRate = SR): BeatAnalysis {
  const durationSec = samples.length / sampleRate;
  const empty: BeatAnalysis = {
    version: BEATS_VERSION, durationSec: round3(durationSec), bpm: null, confidence: 0,
    beats: [], downbeats: [], drop: null, sections: [],
  };
  if (durationSec < 4) return empty;

  const { frames, edgesHz, frameRate: fr } = bandSpectrogram(samples, sampleRate, { size: SIZE, hop: HOP, bands: BANDS, loHz: 30 });
  const n = frames.length;
  if (n < 16) return empty;
  // Frame f is a window that STARTS at f / fr, but a sound shows up in it when
  // it reaches the middle — so frame times are read a half window late. Without
  // this every beat came out ~30 ms early: a frame at 30 fps, on every cut.
  const lag = (SIZE / 2) / sampleRate;
  const at = (sec: number) => (sec - lag) * fr;
  const lowBands = edgesHz.slice(1).filter((hi) => hi <= LOW_HZ).length || 1;

  // Per-band level in dB, floored 80 dB under the loudest band so near-silence
  // doesn't turn the first bar of music into an enormous "onset".
  let maxDb = -Infinity;
  const db: Float32Array[] = frames.map((row) => {
    const out = new Float32Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      out[b] = toDb(row[b]);
      if (out[b] > maxDb) maxDb = out[b];
    }
    return out;
  });
  const floor = maxDb - 80;
  for (const row of db) for (let b = 0; b < BANDS; b++) if (row[b] < floor) row[b] = floor;

  // Onset strength: how much louder each band got since the previous frame.
  const onset = new Float64Array(n);
  const lowOnset = new Float64Array(n);
  for (let t = 1; t < n; t++) {
    let all = 0;
    let low = 0;
    for (let b = 0; b < BANDS; b++) {
      const rise = db[t][b] - db[t - 1][b];
      if (rise > 0) {
        all += rise;
        if (b < lowBands) low += rise;
      }
    }
    onset[t] = all / BANDS;
    lowOnset[t] = low / lowBands;
  }
  const env = smooth(onset);
  const lowEnv = smooth(lowOnset);

  // ── tempo: autocorrelation, weighted toward 120 BPM by a log-normal prior ──
  let mean = 0;
  for (let t = 0; t < n; t++) mean += env[t];
  mean /= n;
  const x = Float64Array.from(env, (v) => v - mean);
  const minLag = Math.floor((fr * 60) / MAX_BPM);
  const maxLag = Math.min(n - 1, Math.ceil((fr * 60) / MIN_BPM));
  const acf = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1 && lag < n; lag++) {
    let s = 0;
    for (let t = 0; t + lag < n; t++) s += x[t] * x[t + lag];
    acf[lag] = s / (n - lag);
  }
  // The autocorrelation's peaks are candidates, not answers: a syncopated
  // groove peaks as strongly at one and a half beats as at one, which is how a
  // 129 BPM track reads as 86. Every peak and its metrical relatives is tried
  // against the grid fit below, and the grid that explains the onsets best wins.
  const acfPeaks: { lag: number; value: number }[] = [];
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (acf[lag] > 0 && acf[lag] >= acf[lag - 1] && acf[lag] >= acf[lag + 1]) acfPeaks.push({ lag, value: acf[lag] });
  }
  if (acfPeaks.length === 0) return empty;
  acfPeaks.sort((a, b) => b.value - a.value);
  const candidates: number[] = [];
  for (const { lag } of acfPeaks.slice(0, 6)) {
    // Parabolic interpolation between lags: a whole lag is ~1.5 BPM at 120.
    const y0 = acf[lag - 1], y1 = acf[lag], y2 = acf[lag + 1];
    const denom = y0 - 2 * y1 + y2;
    const exact = lag + (denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0);
    const bpm = (fr * 60) / exact;
    for (const r of [1, 2, 0.5, 1.5, 2 / 3, 4 / 3, 3 / 4]) {
      const c = bpm * r;
      if (c >= MIN_BPM && c <= MAX_BPM && candidates.every((o) => Math.abs(o - c) / c > 0.01)) candidates.push(c);
    }
  }

  // ── grid fit: the one tempo and phase that best explain every onset ────────
  const sampleEnv = (sec: number) => {
    const i = at(sec);
    const i0 = Math.floor(i);
    if (i0 < 0 || i0 + 1 >= n) return 0;
    const f = i - i0;
    return env[i0] * (1 - f) + env[i0 + 1] * f;
  };
  const fit = (bpm: number, from = 0, to = durationSec) => {
    const period = 60 / bpm;
    const steps = Math.max(8, Math.round(period * fr * 2));
    let best = { phase: 0, score: -Infinity };
    let total = 0;
    for (let s = 0; s < steps; s++) {
      const phase = (s / steps) * period;
      let sum = 0;
      let count = 0;
      for (let t = from + phase; t < to; t += period) { sum += sampleEnv(t); count++; }
      const score = count ? sum / count : 0;
      total += score;
      if (score > best.score) best = { phase, score };
    }
    return { bpm, phase: best.phase, score: best.score, meanScore: total / steps };
  };
  // Candidates are compared on short windows, each with its own phase, so a
  // tempo a fraction of a percent off isn't penalised for drifting over five
  // minutes — that is the fine fit's job, once a candidate has won.
  const WIN = 16;
  const windows: number[] = [];
  const spare = Math.max(0, durationSec - WIN);
  const count = Math.min(8, Math.max(1, Math.floor(durationSec / WIN)));
  for (let i = 0; i < count; i++) windows.push(count === 1 ? 0 : (spare * i) / (count - 1));
  const windowScore = (bpm: number) => {
    let s = 0;
    for (const w of windows) s += fit(bpm, w, Math.min(durationSec, w + WIN)).score;
    return s / windows.length;
  };
  let bpmGuess = candidates[0];
  let guessScore = -Infinity;
  for (const c of candidates) {
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(c / 120) / 0.9, 2));
    const score = Math.max(windowScore(c * 0.996), windowScore(c), windowScore(c * 1.004)) * prior;
    if (score > guessScore) { guessScore = score; bpmGuess = c; }
  }
  let best = fit(bpmGuess);
  for (const [span, step] of [[0.04, 0.05], [0.006, 0.005]] as const) {
    const center = best.bpm;
    for (let bpm = center * (1 - span); bpm <= center * (1 + span); bpm += step) {
      const f = fit(bpm);
      if (f.score > best.score) best = f;
    }
  }
  const ratio = best.meanScore > 0 ? best.score / best.meanScore : 0;
  // How much better the best grid explains the onsets than an average phase.
  // Searching hundreds of tempos and phases flatters chance, and flatters it
  // more the fewer beats there are, so the bar rises for short clips: white
  // noise scored 2.2–2.3 at 12 s and 1.7–1.8 at 30–60 s, speech ~1.2, while
  // every real track measured scored 2.6 or more (house 3–6).
  const beatCount = durationSec / (60 / best.bpm);
  const bar = Math.max(STEADY_RATIO, 1 + 7 / Math.sqrt(Math.max(1, beatCount)));
  const confidence = Math.max(0, Math.min(1, (ratio - 1) / (2 * (bar - 1))));
  if (ratio < bar) return { ...empty, confidence: Math.round(confidence * 100) / 100 };

  // A tempo DJs would type in: whole numbers when the fit is that close.
  const bpm = Math.abs(best.bpm - Math.round(best.bpm)) < 0.06 ? Math.round(best.bpm) : Math.round(best.bpm * 100) / 100;
  const period = 60 / best.bpm;
  const beats: number[] = [];
  for (let t = best.phase; t < durationSec; t += period) beats.push(t);

  // ── bars: which of the four beats is "one" ─────────────────────────────────
  // Beat-synchronous band levels, so a change of section shows up as a jump
  // between the beats either side of it.
  const beatLevels: Float64Array[] = beats.map((t, k) => {
    const a = Math.max(0, Math.floor(at(t)));
    const z = Math.max(a + 1, Math.floor(at(beats[k + 1] ?? t + period)));
    const out = new Float64Array(BANDS);
    let c = 0;
    for (let f = a; f < z && f < n; f++, c++) for (let b = 0; b < BANDS; b++) out[b] += db[f][b];
    if (c) for (let b = 0; b < BANDS; b++) out[b] /= c;
    return out;
  });
  const novelty = beats.map((_, k) => {
    if (k < 4 || k + 4 > beats.length) return 0;
    let s = 0;
    for (let b = 0; b < BANDS; b++) {
      let before = 0, after = 0;
      for (let j = 1; j <= 4; j++) before += beatLevels[k - j][b];
      for (let j = 0; j < 4; j++) after += beatLevels[k + j][b];
      s += Math.abs(after - before) / 4;
    }
    return s / BANDS;
  });
  // What arrives ON a beat: how much each band rose from the beat before.
  // Crashes, chord changes and bass notes land on beat 1 far more than on the
  // others, which is the cue a listener uses to hear where the bar starts.
  const arrival = beats.map((_, k) => {
    if (k === 0) return 0;
    let r = 0;
    for (let b = 0; b < BANDS; b++) r += Math.max(0, beatLevels[k][b] - beatLevels[k - 1][b]);
    return r / BANDS;
  });
  const kick = beats.map((t) => {
    // The strongest low-band onset within a frame or two of the beat.
    const i = Math.round(at(t));
    let m = 0;
    for (let f = i - 2; f <= i + 2; f++) if (f >= 0 && f < n && lowEnv[f] > m) m = lowEnv[f];
    return m;
  });
  const phaseScores = [0, 1, 2, 3].map((p) => {
    let k = 0, nv = 0, ar = 0, c = 0;
    for (let i = p; i < beats.length; i += 4) { k += kick[i]; nv += novelty[i]; ar += arrival[i]; c++; }
    return { kick: c ? k / c : 0, novelty: c ? nv / c : 0, arrival: c ? ar / c : 0 };
  });
  const mean4 = (key: "kick" | "novelty" | "arrival") => phaseScores.reduce((s, v) => s + v[key], 0) / 4 || 1;
  const kickMean = mean4("kick"), novMean = mean4("novelty"), arrMean = mean4("arrival");
  let barPhase = 0;
  let barBest = -Infinity;
  phaseScores.forEach((v, p) => {
    // Section changes (novelty) are the strongest single cue but rare; what
    // arrives on each beat decides the bars in between; the kick separates
    // beats 1 and 3 from 2 and 4 in anything that isn't four-on-the-floor.
    const score = v.arrival / arrMean + 0.5 * (v.kick / kickMean) + v.novelty / novMean;
    if (score > barBest) { barBest = score; barPhase = p; }
  });
  const downbeats = beats.filter((_, i) => i % 4 === barPhase);

  // ── the drop and the other section changes, bar by bar ─────────────────────
  const barLow: number[] = [];
  const barFull: number[] = [];
  for (let j = 0; j < downbeats.length; j++) {
    const a = Math.max(0, Math.floor(at(downbeats[j])));
    const z = Math.min(n, Math.floor(at(downbeats[j + 1] ?? downbeats[j] + 4 * period)));
    let low = 0, full = 0, c = 0;
    for (let f = a; f < z; f++, c++) {
      for (let b = 0; b < BANDS; b++) {
        full += frames[f][b];
        if (b < lowBands) low += frames[f][b];
      }
    }
    barLow.push(toDb(c ? low / c : 0));
    barFull.push(toDb(c ? full / c : 0));
  }
  const loudestBar = Math.max(...barFull);
  const clampDb = (v: number) => Math.max(loudestBar - 60, v);
  const w = Math.max(1, Math.min(4, Math.floor(downbeats.length / 6)));
  const avg = (arr: number[], from: number, to: number) => {
    let s = 0;
    for (let i = from; i < to; i++) s += clampDb(arr[i]);
    return s / (to - from);
  };
  let drop: BeatAnalysis["drop"] = null;
  const changes: { j: number; change: number }[] = [];
  for (let j = w; j + w <= downbeats.length; j++) {
    const beforeFull = avg(barFull, j - w, j);
    const lowRise = avg(barLow, j, j + w) - avg(barLow, j - w, j);
    const fullRise = avg(barFull, j, j + w) - beforeFull;
    changes.push({ j, change: fullRise });
    // Music has to be playing before it can drop; out of silence is a start.
    if (beforeFull < loudestBar - 30) continue;
    const rise = 0.7 * lowRise + 0.3 * fullRise;
    if (rise >= 6 && (!drop || rise > drop.riseDb)) drop = { atSec: downbeats[j], riseDb: rise };
  }
  if (drop) drop = { atSec: round3(drop.atSec), riseDb: Math.round(drop.riseDb * 10) / 10 };

  // Local peaks of change, at least four bars apart, the biggest eight.
  const peaks = changes.filter((c, i) => {
    if (Math.abs(c.change) < 3) return false;
    const prev = changes[i - 1]?.change ?? 0;
    const next = changes[i + 1]?.change ?? 0;
    return Math.abs(c.change) >= Math.abs(prev) && Math.abs(c.change) >= Math.abs(next);
  });
  peaks.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const kept: typeof peaks = [];
  for (const p of peaks) {
    if (kept.length >= 8) break;
    if (kept.every((k) => Math.abs(k.j - p.j) >= 4)) kept.push(p);
  }
  kept.sort((a, b) => a.j - b.j);
  const sections = kept.map((p) => ({ atSec: round3(downbeats[p.j]), changeDb: Math.round(p.change * 10) / 10 }));

  return {
    version: BEATS_VERSION,
    durationSec: round3(durationSec),
    bpm,
    confidence: Math.round(confidence * 100) / 100,
    beats: beats.map(round3),
    downbeats: downbeats.map(round3),
    drop,
    sections,
  };
}

/** A light three-tap blur, so an onset a frame off the grid still counts. */
function smooth(v: Float64Array): Float64Array {
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) {
    out[i] = 0.25 * (v[i - 1] ?? v[i]) + 0.5 * v[i] + 0.25 * (v[i + 1] ?? v[i]);
  }
  // Subtract a slow-moving median-ish baseline so a loud section doesn't
  // out-vote a quiet one in the grid fit.
  const win = 43; // ~0.5 s at 86 frames/s
  const base = new Float64Array(v.length);
  for (let i = 0; i < v.length; i += win) {
    const m = median(out.subarray(Math.max(0, i - win), Math.min(v.length, i + win)));
    for (let j = i; j < Math.min(v.length, i + win); j++) base[j] = m;
  }
  for (let i = 0; i < v.length; i++) out[i] = Math.max(0, out[i] - base[i]);
  return out;
}

/** Where the cached analysis for `file` lives — beside it, like the peaks cache. */
export function beatsCachePath(file: string): string {
  return `${file.replace(/\.[^./\\]+$/, "")}.beats.json`;
}

/**
 * The analysis for a file on disk, cached beside it.
 *
 * The cache records the source's size and modification time, so replacing a
 * track under the same name is re-measured instead of serving the old grid.
 */
export async function beatsForFile(file: string): Promise<BeatAnalysis> {
  const stat = fs.statSync(file);
  const cachePath = beatsCachePath(file);
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    if (cached?.version === BEATS_VERSION && cached.sourceBytes === stat.size && cached.sourceMtimeMs === stat.mtimeMs) {
      return cached.analysis as BeatAnalysis;
    }
  } catch { /* no cache yet, or unreadable — measure */ }
  const samples = await decodeMono(file, SR);
  const analysis = analyzeBeats(samples, SR);
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ version: BEATS_VERSION, sourceBytes: stat.size, sourceMtimeMs: stat.mtimeMs, analysis }), "utf-8");
  } catch { /* a read-only media folder still gets an answer */ }
  return analysis;
}

/** Only the cached analysis, never a fresh measurement — for code that can't wait. */
export function cachedBeats(file: string): BeatAnalysis | null {
  try {
    const stat = fs.statSync(file);
    const cached = JSON.parse(fs.readFileSync(beatsCachePath(file), "utf-8"));
    if (cached?.version === BEATS_VERSION && cached.sourceBytes === stat.size && cached.sourceMtimeMs === stat.mtimeMs) {
      return cached.analysis as BeatAnalysis;
    }
  } catch { /* none */ }
  return null;
}
