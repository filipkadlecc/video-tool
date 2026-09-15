/**
 * One timecode format everywhere: MM:SS:FF.
 *
 * Hours appear ONLY once a project passes an hour — and then in all four
 * places at once, so a running timecode never changes width mid-session.
 * Pass `withHours` from the composition's own length, not from the frame being
 * formatted, or the playhead would grow an extra field as it crossed 01:00:00.
 */
export function timecode(frame: number, fps: number, withHours = false): string {
  const safeFps = fps > 0 ? fps : 25;
  const total = Math.max(0, Math.round(frame));
  const frames = total % safeFps;
  const seconds = Math.floor(total / safeFps);
  const pad = (n: number) => String(n).padStart(2, "0");
  const mm = pad(withHours ? Math.floor((seconds % 3600) / 60) : Math.floor(seconds / 60));
  const tail = `${mm}:${pad(seconds % 60)}:${pad(frames)}`;
  return withHours ? `${pad(Math.floor(seconds / 3600))}:${tail}` : tail;
}

/** Whether a composition of this length should show the hours field at all. */
export function needsHours(totalFrames: number, fps: number): boolean {
  const safeFps = fps > 0 ? fps : 25;
  return totalFrames / safeFps >= 3600;
}

/**
 * Durations are the exception — they read as FRAMES, never as a timecode.
 * `112f`, `12f · ease-out`.
 */
export function frameCount(n: number): string {
  return `${Math.max(0, Math.round(n))}f`;
}
