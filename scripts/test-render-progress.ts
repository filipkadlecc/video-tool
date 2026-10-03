/**
 * Unit tests for the export progress parser (lib/render-queue.ts).
 *
 *   npx tsx scripts/test-render-progress.ts
 *
 * `readProgress` is pure — a job in, mutations out — and it is the only thing
 * standing between a healthy two-hour export and a dialog that reads as hung.
 * The fixture is the real CLI transcript, captured with no TTY, because that is
 * the shape this code actually receives and it is not the shape the TTY shows:
 * the muxer prints "Encoded X/Y", not the padded "Encoded video <bar> X/Y".
 * A regex written against the TTY form matches nothing here, silently.
 */
import { readProgress, type RenderJob } from "../lib/render-queue";

let pass = 0, fail = 0;
const a = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log("  FAIL: " + m); } };
const head = (t: string) => console.log("\n--- " + t + " ---");

const job = (): RenderJob => ({ id: "t", sceneId: "s", status: "rendering", progress: 0 });
const feed = (j: RenderJob, ...chunks: string[]) => { for (const c of chunks) readProgress(j, c); return j; };

/** The captured transcript, verbatim. */
const REAL = [
  "Bundling 50%",
  "Bundling 100%",
  "Rendered 1/25, time remaining: 3s",
  "Rendered 24/25, time remaining: 0s",
  "Rendered 25/25",
  "Encoded 17/25",
  "Encoded 25/25",
];

head("the real transcript, one line at a time");
{
  const j = feed(job(), ...REAL);
  a(j.phase === "encoding", "ends in the encoding phase");
  a(j.renderedFrames === 25 && j.totalFrames === 25, "every frame was counted");
  a(j.encodedFrames === 25 && j.encodedTotalFrames === 25, "and every frame was written");
  a(typeof j.encodeStartedAt === "number", "the encode's start is stamped, so it can have its own estimate");
}

head("phases map into bands, and the bar only moves forward");
{
  const seen: number[] = [];
  const j = job();
  for (const line of REAL) { readProgress(j, line); seen.push(j.progress); }
  a(seen.every((v, i) => i === 0 || v >= seen[i - 1]), `progress never goes backwards (${seen.join(" -> ")})`);
  a(seen[seen.length - 1] < 100, "and never reaches 100 — that is reserved for a finished file");
  const mid = feed(job(), "Rendered 25/25");
  a(mid.progress === 90, "all frames rendered reads 90, not 100, because the encode still has to run");
}

head("the encode is never dragged back to counting frames");
{
  // Both phases in one chunk: the later one wins.
  const j = feed(job(), "Rendered 25/25\nEncoded 7/25");
  a(j.phase === "encoding" && j.encodedFrames === 7, "a stale Rendered line below an Encoded line is ignored");
  // And across chunks, which the in-chunk ordering alone would not settle.
  readProgress(j, "Rendered 25/25");
  a(j.phase === "encoding" && j.encodedFrames === 7, "a late Rendered chunk cannot reopen the frame phase");
}

head("chunks hold several lines; the last one is the current state");
{
  const j = feed(job(), "Encoded 10/25\nEncoded 11/25\nEncoded 12/25");
  a(j.encodedFrames === 12, "the newest count in the chunk wins, not the first");
}

head("prose is not progress");
{
  const j1 = feed(job(), "Rendered 25/25");
  readProgress(j1, "Encoding video to /Users/me/Movies/2026/04/clip.mov");
  a(j1.phase === "frames", "a date in a file path does not start an encode");
  const j2 = feed(job(), "Rendered 25/25");
  readProgress(j2, "Error: Encoding failed, see src/foo.ts:12/34 for details");
  a(j2.encodedFrames === undefined, "a source location in an error does not become a frame count");
  const j3 = feed(job(), "Rendered 25/25");
  readProgress(j3, "Encoded 99/25");
  a(j3.encodedFrames === undefined, "a count larger than its own total is never real");
  const j4 = feed(job(), "Rendered 100/100");
  readProgress(j4, "Encoded audio 50/200");
  a(j4.encodedFrames === undefined, "an audio pass does not write into the video counters");
  const j5 = feed(job(), "Encoded video ━━━━ 5096ms");
  a(j5.encodedFrames === undefined, "the TTY's finished form carries no counts and claims none");
}

head("the TTY form still parses, for anyone running this attached to a terminal");
{
  const j = feed(job(), "Rendered 25/25", "Encoded video ━━━━━  18/25");
  a(j.phase === "encoding" && j.encodedFrames === 18, "the padded form with a bar is read too");
}

head("bundling cannot outrank a real frame");
{
  const j = feed(job(), "Bundling 100%");
  a(j.progress <= 10, `bundling stays in its own band (was ${j.progress})`);
  readProgress(j, "Rendered 0/600");
  a(j.progress >= 10, "and the first frame does not drop the bar to zero");
}

head("the bounded gap keeps a pathological chunk cheap");
{
  const nasty = "Encoded " + "1".repeat(64 * 1024);
  const t0 = Date.now();
  readProgress(job(), nasty);
  const ms = Date.now() - t0;
  a(ms < 100, `a 64KB digit-heavy chunk parses in ${ms}ms, not seconds`);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fail) process.exit(1);
