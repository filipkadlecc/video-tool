"use client";

import { useCallback, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

const MAX_HISTORY = 50;

export interface CodeSnapshot {
  code: string;
  chat: ChatMessage[];
}

export interface CodeHistoryControls {
  pushSnapshot: (code: string, chat: ChatMessage[]) => void;
  undo: () => CodeSnapshot | null;
  redo: () => CodeSnapshot | null;
  canUndo: boolean;
  canRedo: boolean;
}

export function useCodeHistory(): CodeHistoryControls {
  const historyRef = useRef<CodeSnapshot[]>([]);
  const indexRef = useRef(-1);

  // A version captures both the code AND the conversation that produced it, so
  // reverting rewinds the chat in lockstep with the preview. Without this the
  // chat keeps growing while the code rolls back — the model then sees stale
  // "already done that" turns and ignores the user's re-prompt.
  const pushSnapshot = useCallback((code: string, chat: ChatMessage[]) => {
    const history = historyRef.current;
    const idx = indexRef.current;

    // Don't push if both code and chat match the current version.
    if (idx >= 0 && history[idx].code === code && history[idx].chat.length === chat.length) return;

    // Discard any redo history
    historyRef.current = history.slice(0, idx + 1);
    historyRef.current.push({ code, chat });

    // Cap history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY);
    }

    indexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback((): CodeSnapshot | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    return historyRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): CodeSnapshot | null => {
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
