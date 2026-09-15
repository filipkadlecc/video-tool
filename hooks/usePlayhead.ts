"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";

/**
 * The playhead, as a subscribable store rather than page state.
 *
 * Before this, a requestAnimationFrame loop called setState on the whole
 * 1,460-line editor page on every frame of playback. Everything hung off that
 * — modals, the chat panel, the inspector — and every callback that closed
 * over `currentFrame` got a fresh identity each frame, which cascaded new
 * props into the preview and the timeline. A hidden re-render amplifier.
 *
 * Now only the components that genuinely change every frame subscribe: the
 * canvas, the transport and the timeline. Everything that merely needs the
 * frame AT CLICK TIME reads `getFrame()` in the handler instead, which also
 * takes `currentFrame` out of their dependency arrays.
 */
export interface PlayheadStore {
  subscribe: (l: () => void) => () => void;
  getFrame: () => number;
  getPlaying: () => boolean;
  /** Called by the rAF loop. No-ops when nothing actually changed. */
  set: (frame: number, playing: boolean) => void;
}

export function createPlayheadStore(): PlayheadStore {
  let frame = 0;
  let playing = false;
  const listeners = new Set<() => void>();
  return {
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    getFrame: () => frame,
    getPlaying: () => playing,
    set(nextFrame, nextPlaying) {
      // The early return is the whole point: a paused editor stops
      // re-rendering entirely instead of ticking forever.
      if (nextFrame === frame && nextPlaying === playing) return;
      frame = nextFrame;
      playing = nextPlaying;
      listeners.forEach((l) => l());
    },
  };
}

export const PlayheadContext = createContext<PlayheadStore | null>(null);

/** The store itself — for reading in an event handler. Does NOT subscribe. */
export function usePlayheadStore(): PlayheadStore {
  const s = useContext(PlayheadContext);
  if (!s) throw new Error("usePlayheadStore must be used inside <PlayheadContext.Provider>");
  return s;
}

/** Subscribes. Use ONLY in components that must repaint every frame. */
export function usePlayheadFrame(): number {
  const s = usePlayheadStore();
  return useSyncExternalStore(s.subscribe, s.getFrame, s.getFrame);
}

export function usePlayheadPlaying(): boolean {
  const s = usePlayheadStore();
  return useSyncExternalStore(s.subscribe, s.getPlaying, s.getPlaying);
}

/** Creates one store per editor mount. */
export function useNewPlayheadStore(): PlayheadStore {
  const [store] = useState(createPlayheadStore);
  return store;
}
