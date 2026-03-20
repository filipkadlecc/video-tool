"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Orientation } from "@/lib/types";

interface Props {
  projectId: string;
  currentOrientation: Orientation;
  disabled?: boolean;
}

const RATIOS = [
  { label: "16:9", value: "16:9", orientation: "horizontal" },
  { label: "9:16", value: "9:16", orientation: "vertical" },
  { label: "1:1", value: "1:1", orientation: "square" },
] as const;

export default function ConvertAspectRatioButton({ projectId, currentOrientation, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const availableRatios = RATIOS.filter((r) => r.orientation !== currentOrientation);

  async function handleConvert(aspectRatio: string) {
    setOpen(false);
    setConverting(true);
    setProgress("Creating project...");

    try {
      const res = await fetch(`/api/projects/${projectId}/convert-aspect-ratio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectRatio }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Conversion failed");
      }

      setProgress("Converting layout...");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let newProjectId = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.done && parsed.projectId) {
              newProjectId = parsed.projectId;
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      if (newProjectId) {
        router.push(`/project/${newProjectId}`);
      } else {
        throw new Error("Conversion completed but no project ID received");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Conversion failed");
      setConverting(false);
      setProgress("");
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled || converting}
        className="px-3 py-1.5 text-xs text-muted border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
      >
        {converting ? progress : "Convert Aspect Ratio"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]">
          {availableRatios.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() => handleConvert(ratio.value)}
              className="w-full px-4 py-2.5 text-xs text-left text-foreground hover:bg-surface-hover transition-colors"
            >
              {ratio.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
