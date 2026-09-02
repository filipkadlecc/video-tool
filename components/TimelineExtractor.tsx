"use client";
/* eslint-disable react-hooks/refs -- this component deliberately collects sequence
   registrations + media into refs across the hidden Player's renders and reads them
   back in an effect; the reads never happen during THIS component's render. */

/**
 * Hidden, off-screen runtime extractor. It renders the composition in a tiny
 * hidden <Player> with Remotion's studio sequence-registration turned on ONLY
 * for this subtree (via RemotionEnvironmentContext), collects the resolved
 * position of every <Sequence>/<Series.Sequence>/<TransitionSeries.Sequence>,
 * sweeps a few frames to capture each clip's media, and reports a display-only
 * ResolvedTimeline. Never touches the visible preview. Fully additive: if it
 * yields nothing, the timeline falls back to its static parsers.
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Internals } from "remotion";
import { evalSceneCode } from "@/remotion/DynamicScene";
import {
  buildResolvedTimeline,
  type MediaCapture,
  type ResolvedTimeline,
  type SeqRegistration,
} from "@/lib/timeline-extract";

interface Props {
  code: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  onResolved: (rt: ResolvedTimeline | null) => void;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export default function TimelineExtractor({ code, width, height, fps, durationInFrames, onResolved }: Props) {
  const regRef = useRef<Map<string, SeqRegistration>>(new Map());
  const mediaRef = useRef<Map<string, MediaCapture>>(new Map());
  const playerRef = useRef<PlayerRef>(null);

  const onMedia = useCallback((m: MediaCapture) => {
    if (m.enclosingId) mediaRef.current.set(m.enclosingId, m);
  }, []);

  // Stable studio-env + collecting sequence-manager for the hidden subtree.
  const contexts = useMemo(() => {
    let env: Record<string, unknown>;
    try {
      env = { ...(Internals.getRemotionEnvironment() as object), isStudio: true };
    } catch {
      env = { isStudio: true, isRendering: false, isPlayer: false, isReadOnlyStudio: false, isClientSideRendering: false };
    }
    const seqManager = {
      sequences: [],
      registerSequence: (s: { id: string; from: number; duration: number; parent: string | null; displayName?: string }) => {
        regRef.current.set(s.id, { id: s.id, from: s.from, duration: s.duration, parent: s.parent ?? null, displayName: s.displayName });
      },
      unregisterSequence: () => {},
    };
    return { env, seqManager };
  }, []);

  const Root = useMemo(() => {
    const r = evalSceneCode(code, { onMedia });
    if (!r || r.error) return null;
    const Scene = r.component;
    const RootComp: React.FC = () =>
      React.createElement(
        Internals.RemotionEnvironmentContext.Provider,
        { value: contexts.env as never },
        React.createElement(
          Internals.SequenceManager.Provider,
          { value: contexts.seqManager as never },
          React.createElement(Scene),
        ),
      );
    return RootComp;
  }, [code, onMedia, contexts]);

  useEffect(() => {
    regRef.current = new Map();
    mediaRef.current = new Map();
    if (!Root) {
      onResolved(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Wait for the hidden Player to mount and register its sequences. Big/4K
        // comps mount slowly, so poll until the count stabilizes (3 steady frames)
        // rather than a fixed delay — a fixed wait was racy (sometimes read zero).
        let lastCount = -1;
        let stable = 0;
        for (let i = 0; i < 180 && stable < 3; i++) {
          await nextFrame();
          if (cancelled) return;
          const n = regRef.current.size;
          if (n > 0 && n === lastCount) stable++;
          else stable = 0;
          lastCount = n;
        }
        // Positions are known now; sweep each clip's start so its media renders
        // and gets captured (media only renders while its sequence is active).
        const positions = buildResolvedTimeline([...regRef.current.values()], []);
        const p = playerRef.current;
        if (p && positions.clips.length) {
          const maxF = Math.max(0, durationInFrames - 1);
          for (const c of positions.clips) {
            if (cancelled) return;
            try {
              p.seekTo(Math.min(maxF, Math.max(0, Math.round(c.from + 1))));
            } catch {
              /* ignore seek errors */
            }
            await nextFrame();
          }
        }
        if (cancelled) return;
        const rt = buildResolvedTimeline([...regRef.current.values()], [...mediaRef.current.values()]);
        console.log("[TimelineExtractor] scan done:", { registrations: regRef.current.size, media: mediaRef.current.size, clips: rt.clips.length });
        onResolved(rt);
      } catch (err) {
        console.log("[TimelineExtractor] scan error:", err);
        if (!cancelled) onResolved(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [Root, durationInFrames, onResolved]);

  if (!Root) return null;

  return (
    <div aria-hidden style={{ position: "fixed", left: -99999, top: -99999, width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
      <Player
        ref={playerRef}
        component={Root}
        durationInFrames={Math.max(1, Math.round(durationInFrames))}
        fps={fps || 25}
        compositionWidth={Math.max(1, Math.round(width))}
        compositionHeight={Math.max(1, Math.round(height))}
        style={{ width: 1, height: 1 }}
      />
    </div>
  );
}
