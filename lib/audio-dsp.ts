import { spawn } from "child_process";

/**
 * The small amount of signal processing the audio checks need, with no
 * dependency beyond the ffmpeg the render pipeline already requires.
 *
 * Decoding is ffmpeg's job (it reads every format a user can drop on the
 * timeline); everything after that is plain arithmetic on a Float32Array, so
 * it runs the same on this Mac, in Docker and on a hosted box, and it can be
 * tested with synthetic signals and no files at all.
 */

/** Decode any audio or video file to mono float samples at `sampleRate`. */
export function decodeMono(file: string, sampleRate: number): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-v", "error", "-nostdin", "-i", file,
      "-vn", "-ac", "1", "-ar", String(sampleRate), "-f", "f32le", "-",
    ]);
    const chunks: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(stderr.trim() || `ffmpeg exited ${code}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      // Copy into an aligned buffer: a Buffer's byteOffset need not be a
      // multiple of 4, and a Float32Array view over it throws when it isn't.
      const out = new Float32Array(Math.floor(buf.length / 4));
      for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
      resolve(out);
    });
  });
}

/**
 * In-place radix-2 FFT. `re` and `im` must be the same power-of-two length.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * Power spectrum per frame, summed into `bands` log-spaced bands between
 * `loHz` and the Nyquist frequency.
 *
 * Bands rather than raw bins because everything downstream asks about the
 * shape of the sound (is the kick in, did the mix get brighter), not about
 * individual frequencies, and 40 numbers per frame is cheap to keep.
 */
export function bandSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  opts: { size: number; hop: number; bands: number; loHz: number },
): { frames: Float32Array[]; edgesHz: number[]; frameRate: number } {
  const { size, hop, bands, loHz } = opts;
  const nyquist = sampleRate / 2;
  const edgesHz: number[] = [];
  for (let b = 0; b <= bands; b++) edgesHz.push(loHz * Math.pow(nyquist / loHz, b / bands));
  const binHz = sampleRate / size;
  // Which band every bin belongs to (bins below loHz are dropped).
  const bandOf = new Int16Array(size / 2 + 1).fill(-1);
  for (let k = 1; k <= size / 2; k++) {
    const hz = k * binHz;
    if (hz < loHz) continue;
    let b = 0;
    while (b < bands - 1 && hz >= edgesHz[b + 1]) b++;
    bandOf[k] = b;
  }
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);

  const count = samples.length < size ? 0 : Math.floor((samples.length - size) / hop) + 1;
  const frames: Float32Array[] = [];
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let f = 0; f < count; f++) {
    const off = f * hop;
    for (let i = 0; i < size; i++) { re[i] = samples[off + i] * window[i]; im[i] = 0; }
    fft(re, im);
    const row = new Float32Array(bands);
    for (let k = 1; k <= size / 2; k++) {
      const b = bandOf[k];
      if (b >= 0) row[b] += re[k] * re[k] + im[k] * im[k];
    }
    frames.push(row);
  }
  return { frames, edgesHz, frameRate: sampleRate / hop };
}

/** A second-order section, for the one or two fixed filters the checks use. */
export function biquadHighpass(samples: Float32Array, sampleRate: number, cutoffHz: number): Float32Array {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const b2 = (1 + cos) / 2 / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const out = new Float32Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return out;
}

/** Linear power to decibels, floored so silence is a number rather than -Infinity. */
export function toDb(power: number, floorDb = -120): number {
  return power > 0 ? Math.max(floorDb, 10 * Math.log10(power)) : floorDb;
}

/** Median of a numeric array (copied, not sorted in place). */
export function median(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
