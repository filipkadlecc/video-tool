import { spawn } from "child_process";

/**
 * Levelling an export's sound to the loudness the platforms play at.
 *
 * YouTube, Instagram, TikTok and LinkedIn all normalise playback toward about
 * −14 LUFS. They turn a louder file DOWN, so mastering hotter buys nothing; most
 * of them never turn a quieter file up, so a −24 LUFS export simply plays quiet
 * next to everything else in the feed. Remotion mixes the sound at whatever
 * level the clips and effects add up to, so until now that is what shipped.
 *
 * The gain is linear — one number for the whole file, which keeps every
 * relationship inside the mix exactly as it was built. Only when that number
 * would push a peak over the ceiling does a limiter come in, and it is allowed
 * to take at most `MAX_LIMIT_DB` off the loudest moments: past that the file is
 * left quieter than the target rather than squashed, and the result says so.
 *
 * Every number reported is measured on the DELIVERED file, after the AAC
 * encode, never taken from what the filter was asked to do.
 */

export const TARGET_LUFS = -14;
/** True-peak ceiling. −1 dBTP is what YouTube and Spotify ask for. */
export const CEILING_DBTP = -1;
/** The most the limiter may shave off a peak before the gain is held back. */
export const MAX_LIMIT_DB = 4;
/** Never boost a whisper into a shout: past this it is a mix problem, not a level one. */
export const MAX_BOOST_DB = 20;
/** Quieter than this is silence (or room tone) — nothing worth levelling. */
const SILENT_LUFS = -60;

export interface LoudnessMeasure {
  /** Integrated loudness, LUFS. */
  integrated: number;
  /** True peak, dBTP. */
  truePeak: number;
}

export interface GainPlan {
  gainDb: number;
  /** Whether the limiter is needed to keep peaks under the ceiling. */
  limit: boolean;
  /** The target couldn't be reached without squashing the peaks more than allowed. */
  heldBack: boolean;
  /** Nothing to level: silent, or already within a tenth of a dB. */
  skip: boolean;
}

/** How much gain to apply. Pure, so the edge cases are tested without ffmpeg. */
export function planGain(m: LoudnessMeasure, target = TARGET_LUFS, ceiling = CEILING_DBTP): GainPlan {
  if (!Number.isFinite(m.integrated) || m.integrated < SILENT_LUFS) {
    return { gainDb: 0, limit: false, heldBack: false, skip: true };
  }
  let gain = target - m.integrated;
  let heldBack = false;
  if (gain > MAX_BOOST_DB) { gain = MAX_BOOST_DB; heldBack = true; }
  const peak = Number.isFinite(m.truePeak) ? m.truePeak : ceiling;
  const over = peak + gain - ceiling;
  if (over > MAX_LIMIT_DB) {
    gain -= over - MAX_LIMIT_DB;
    heldBack = true;
  }
  const rounded = Math.round(gain * 100) / 100;
  if (Math.abs(rounded) < 0.1) return { gainDb: 0, limit: false, heldBack: false, skip: true };
  return { gainDb: rounded, limit: peak + rounded > ceiling, heldBack, skip: false };
}

/**
 * The ffmpeg audio filter for a plan, or null for "leave it alone".
 *
 * `level=disabled` matters: alimiter otherwise adds make-up gain and lands the
 * file louder than the target it was added to protect. `latency=1` matters
 * too: without it the limiter's 5 ms lookahead delays the whole soundtrack.
 * The limit is a sample peak, so it sits half a dB under the true-peak ceiling
 * to leave room for the peaks that appear between samples and in the encode.
 */
export function gainFilter(plan: GainPlan, ceiling = CEILING_DBTP): string | null {
  if (plan.skip) return null;
  const parts = [`volume=${plan.gainDb.toFixed(2)}dB`];
  if (plan.limit) {
    const limit = Math.pow(10, (ceiling - 0.5) / 20).toFixed(4);
    parts.push(`alimiter=limit=${limit}:level=disabled:attack=5:release=50:latency=1`);
  }
  return parts.join(",");
}

/**
 * The plan, corrected for what the limiter actually costs.
 *
 * A limiter that shaves the loudest moments also lowers the integrated level —
 * a 30-second spot that is mostly one big hit came out at −15.2 instead of −14
 * — so when the plan needs one, the chain is run once over the sound alone
 * (seconds, no video) and the gain is topped up by the shortfall, still within
 * the same squash allowance.
 */
export async function refinePlan(file: string, measured: LoudnessMeasure, plan: GainPlan, target = TARGET_LUFS, ceiling = CEILING_DBTP): Promise<GainPlan> {
  let current = plan;
  for (let pass = 0; pass < 2 && current.limit && !current.skip; pass++) {
    const filter = gainFilter(current, ceiling);
    if (!filter) break;
    const trial = await measureLoudness(file, filter);
    if (!trial || !Number.isFinite(trial.integrated)) break;
    const short = target - trial.integrated;
    if (short < 0.3) break;
    let gain = current.gainDb + short;
    let heldBack = current.heldBack;
    const peak = Number.isFinite(measured.truePeak) ? measured.truePeak : ceiling;
    const maxGain = Math.min(MAX_BOOST_DB, ceiling + MAX_LIMIT_DB + 1.5 - peak);
    if (gain > maxGain) { gain = maxGain; heldBack = true; }
    if (gain <= current.gainDb + 0.05) { current = { ...current, heldBack: true }; break; }
    current = { ...current, gainDb: Math.round(gain * 100) / 100, heldBack };
  }
  return current;
}

/**
 * Measure a file's soundtrack with ffmpeg's EBU R128 meter — optionally after
 * running it through `filter`, to see what a plan would deliver.
 *
 * Returns null when the file has no audio stream at all — distinct from a
 * silent one, which measures as −70.
 */
export function measureLoudness(file: string, filter?: string): Promise<LoudnessMeasure | null> {
  return new Promise((resolve, reject) => {
    const chain = filter ? `${filter},ebur128=peak=true:framelog=quiet` : "ebur128=peak=true:framelog=quiet";
    const proc = spawn("ffmpeg", [
      "-hide_banner", "-nostdin", "-i", file,
      "-vn", "-af", chain, "-f", "null", "-",
    ]);
    let err = "";
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("error", reject);
    proc.on("close", () => resolve(parseEbur128(err)));
  });
}

/** Read the summary block ffmpeg's ebur128 filter prints when it finishes. */
export function parseEbur128(log: string): LoudnessMeasure | null {
  const summary = log.slice(log.lastIndexOf("Summary:"));
  if (!summary.startsWith("Summary:")) return null;
  const i = summary.match(/I:\s+(-?[\d.]+|-inf)\s+LUFS/);
  const peak = summary.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS/);
  if (!i) return null;
  const num = (s: string | undefined) => (s === undefined || s === "-inf" ? -Infinity : parseFloat(s));
  return { integrated: num(i[1]), truePeak: num(peak?.[1]) };
}

/** Whether a file carries an audio stream. */
export function hasAudioStream(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("error", () => resolve(false));
    proc.on("close", () => resolve(out.trim().length > 0));
  });
}
