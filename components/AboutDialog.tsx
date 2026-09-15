"use client";

import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ApifySymbol from "@/components/ui/ApifySymbol";
import { version as APP_VERSION } from "../package.json";

/**
 * 5j — About.
 *
 * The narrowest dialog on the ladder, and the one with a job beyond saying
 * hello: the Copy button puts the version somewhere it can be pasted into a
 * bug report, which is the only reason anyone opens an About box.
 */
export default function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  // Local date, not UTC — at 00:40 local a UTC stamp reads as yesterday, which
  // looks like a stale build to the person reporting a bug.
  const build = `${APP_VERSION} · build ${new Date().toLocaleDateString("en-CA")}`;
  const info = `Video tool ${build}\n${typeof navigator !== "undefined" ? navigator.userAgent : ""}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the version is on screen either way.
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={380} padded>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
        <ApifySymbol size={40} />
        <div className="t-title" style={{ color: "var(--ink-primary)" }}>Video tool</div>
        <div className="t-data-m" style={{ color: "var(--ink-tertiary)" }}>{build}</div>
        <Button size="chrome" variant="secondary" icon={copied ? "check" : "copy"} onClick={copy}>
          {copied ? "Copied" : "Copy version info"}
        </Button>
      </div>
    </Modal>
  );
}
