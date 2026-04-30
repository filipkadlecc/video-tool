"use client";

import { useCallback, useRef } from "react";

const MAX_HISTORY = 50;

export interface CodeHistoryControls {
  pushSnapshot: (code: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export function useCodeHistory(): CodeHistoryControls {
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef(-1);

  const pushSnapshot = useCallback((code: string) => {
    const history = historyRef.current;
    const idx = indexRef.current;

    // Don't push if same as current
    if (idx >= 0 && history[idx] === code) return;

    // Discard any redo history
    historyRef.current = history.slice(0, idx + 1);
    historyRef.current.push(code);

    // Cap history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY);
    }

    indexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback((): string | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    return historyRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): string | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current++;
    return historyRef.current[indexRef.current];
  }, []);

  return {
    pushSnapshot,
    undo,
    redo,
    get canUndo() {
      return indexRef.current > 0;
    },
    get canRedo() {
      return indexRef.current < historyRef.current.length - 1;
    },
  };
}
