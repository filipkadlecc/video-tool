"use client";

import { useState, useSyncExternalStore } from "react";
import type { EditorDoc } from "@/lib/editor-doc";

const MAX_HISTORY = 100;

export interface DocHistoryControls {
  pushSnapshot: (doc: EditorDoc) => void;
  undo: () => EditorDoc | null;
  redo: () => EditorDoc | null;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo/redo for the editor document.
 *
 * The invariant this exists to protect: the CURRENT state stays at the top of
 * the stack, so one Cmd+Z steps back exactly one edit. (The earlier bug was
 * callers pushing only the pre-edit state, which left the first edit with
 * nothing to undo to and made later undos jump a step too far.)
 *
 * Documents are plain data, so a snapshot is the document itself — no
 * serialisation, and every edit already returns a new object.
 *
 * Backed by a subscribable store rather than bare refs. Refs alone cannot tell
 * React that `canUndo`/`canRedo` changed, so a toolbar button could never grey
 * itself out — which the design requires. `getSnapshot` returns a NUMBER, not
 * an object: returning a fresh object each call makes useSyncExternalStore
 * loop forever.
 */
function createHistoryStore() {
  let history: EditorDoc[] = [];
  let index = -1;
  let version = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    version++;
    listeners.forEach((l) => l());
  };

  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    getSnapshot: () => version,
    push(doc: EditorDoc) {
      if (index >= 0 && history[index] === doc) return;
      history = history.slice(0, index + 1);
      history.push(doc);
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      index = history.length - 1;
      emit();
    },
    undo(): EditorDoc | null {
      if (index <= 0) return null;
      index--;
      emit();
      return history[index];
    },
    redo(): EditorDoc | null {
      if (index >= history.length - 1) return null;
      index++;
      emit();
      return history[index];
    },
    get canUndo() { return index > 0; },
    get canRedo() { return index < history.length - 1; },
  };
}

export function useDocHistory(): DocHistoryControls {
  // useState's lazy initialiser rather than a ref: the store is created once,
  // and reading it during render is safe.
  const [store] = useState(createHistoryStore);

  // The third argument matters: this runs inside a client component Next may
  // prerender, and omitting getServerSnapshot throws.
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return {
    pushSnapshot: store.push,
    undo: store.undo,
    redo: store.redo,
    canUndo: store.canUndo,
    canRedo: store.canRedo,
  };
}
