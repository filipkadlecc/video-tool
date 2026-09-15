"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";

/**
 * 5a / 5b / 5c — the three dialogs that replace every native
 * alert / prompt / confirm in the app.
 *
 * They are promise-based on purpose: the call sites they replace are
 * imperative (`const name = window.prompt(...)`), so `await prompt(...)` drops
 * straight in where the native call was, instead of forcing each caller to
 * hoist open/close state.
 *
 * Universal rules, applied here so no caller has to remember them:
 *   - One primary, never two.
 *   - Destructive is OUTLINED danger, and where it competes with a safe
 *     default it sits at the OPPOSITE end of the footer, so it cannot be hit
 *     on momentum.
 */

export interface ConfirmOptions {
  title: string;
  /** What it costs you. Not a restatement of the title. */
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface PromptOptions {
  title: string;
  label?: string;
  /** Prefilled AND text-selected, so typing replaces it. */
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** A Caption line stating what follows — "41 projects keep their assignment." */
  consequence?: React.ReactNode;
}

export type UnsavedChoice = "save" | "discard" | "cancel";

export interface UnsavedOptions {
  title?: string;
  body?: React.ReactNode;
  saveLabel?: string;
}

interface DialogsApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  unsaved: (o?: UnsavedOptions) => Promise<UnsavedChoice>;
}

const DialogsContext = createContext<DialogsApi | null>(null);

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used inside <DialogProvider>");
  return ctx;
}

type Pending =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: "unsaved"; opts: UnsavedOptions; resolve: (v: UnsavedChoice) => void };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [draft, setDraft] = useState("");
  const resolved = useRef(false);

  const open = useCallback((p: Pending, initial = "") => {
    resolved.current = false;
    setDraft(initial);
    setPending(p);
  }, []);

  const api = useMemo<DialogsApi>(() => ({
    confirm: (opts) => new Promise<boolean>((resolve) => open({ kind: "confirm", opts, resolve })),
    prompt: (opts) => new Promise<string | null>((resolve) =>
      open({ kind: "prompt", opts, resolve }, opts.value ?? "")),
    unsaved: (opts = {}) => new Promise<UnsavedChoice>((resolve) =>
      open({ kind: "unsaved", opts, resolve })),
  }), [open]);

  /** Every exit path goes through here, so a dismissed dialog still settles. */
  const settle = useCallback((value: boolean | string | null | UnsavedChoice) => {
    if (!pending || resolved.current) return;
    resolved.current = true;
    if (pending.kind === "confirm") pending.resolve(value as boolean);
    else if (pending.kind === "prompt") pending.resolve(value as string | null);
    else pending.resolve(value as UnsavedChoice);
    setPending(null);
  }, [pending]);

  const cancel = useCallback(() => {
    if (!pending) return;
    settle(pending.kind === "confirm" ? false : pending.kind === "prompt" ? null : "cancel");
  }, [pending, settle]);

  return (
    <DialogsContext.Provider value={api}>
      {children}

      {/* 5a — Delete. The title carries the name; the body says what it costs. */}
      {pending?.kind === "confirm" && (
        <Modal
          open
          padded
          width={440}
          onClose={cancel}
          title={pending.opts.title}
          footer={
            <>
              <div style={{ flex: 1 }} />
              <Button size="dialog" variant="ghost" onClick={cancel}>
                {pending.opts.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                size="dialog"
                variant={pending.opts.destructive ? "danger" : "primary"}
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.opts.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          {pending.opts.body && (
            <div className="t-body" style={{ color: "var(--ink-secondary)" }}>{pending.opts.body}</div>
          )}
        </Modal>
      )}

      {/* 5b — Rename / Create. Same dialog; Create just starts empty. */}
      {pending?.kind === "prompt" && (
        <Modal
          open
          padded
          width={440}
          onClose={cancel}
          title={pending.opts.title}
          footer={
            <>
              <div style={{ flex: 1 }} />
              <Button size="dialog" variant="ghost" onClick={cancel}>Cancel</Button>
              <Button
                size="dialog"
                variant="primary"
                disabled={!draft.trim()}
                onClick={() => settle(draft.trim())}
              >
                {pending.opts.confirmLabel ?? "Save"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.opts.label && (
              <label className="t-control" style={{ color: "var(--ink-secondary)" }}>
                {pending.opts.label}
              </label>
            )}
            <Input
              value={draft}
              onChange={setDraft}
              placeholder={pending.opts.placeholder}
              autoFocus
              selectOnFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) { e.preventDefault(); settle(draft.trim()); }
              }}
            />
            {pending.opts.consequence && (
              <div className="t-caption" style={{ color: "var(--ink-tertiary)" }}>
                {pending.opts.consequence}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 5c — Unsaved changes. Footer is space-between: Discard is far left so
          it cannot be hit on the way to Save. */}
      {pending?.kind === "unsaved" && (
        <Modal
          open
          padded
          width={440}
          onClose={cancel}
          title={pending.opts.title ?? "Save changes before closing?"}
          footer={
            <>
              <Button size="dialog" variant="ghost" onClick={() => settle("discard")}
                style={{ color: "var(--danger)" }}>
                Discard
              </Button>
              <div style={{ flex: 1 }} />
              <Button size="dialog" variant="ghost" onClick={cancel}>Cancel</Button>
              <Button size="dialog" variant="primary" onClick={() => settle("save")}>
                {pending.opts.saveLabel ?? "Save"}
              </Button>
            </>
          }
        >
          {pending.opts.body && (
            <div className="t-body" style={{ color: "var(--ink-secondary)" }}>{pending.opts.body}</div>
          )}
        </Modal>
      )}
    </DialogsContext.Provider>
  );
}
