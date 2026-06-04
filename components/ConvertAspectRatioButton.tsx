"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Orientation } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

interface Props {
  projectId: string;
  currentOrientation: Orientation;
  disabled?: boolean;
}

const RATIOS = [
  { label: "Vertical \u00b7 9:16", value: "9:16", orientation: "vertical" },
  { label: "Horizontal \u00b7 16:9", value: "16:9", orientation: "horizontal" },
  { label: "Square \u00b7 1:1", value: "1:1", orientation: "square" },
] as const;

function OrientationPreview({ ratio }: { ratio: string }) {
  const dims =
    ratio === "16:9" ? { w: 24, h: 14 } : ratio === "9:16" ? { w: 14, h: 24 } : { w: 18, h: 18 };
  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        background: "var(--bg-4)",
        border: "0.5px solid var(--line-3)",
        borderRadius: 2,
      }}
    />
  );
}

export default function ConvertAspectRatioButton({ projectId, currentOrientation, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        icon="aspect"
        onClick={() => setOpen(!open)}
        disabled={disabled || converting}
      >
        {converting ? progress : "Convert ratio"}
        {!converting && <Icon name="chevronDown" size={12} />}
      </Button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 6,
            minWidth: 200,
            padding: 5,
            background: "var(--bg-3)",
            border: "0.5px solid var(--line-2)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--sh-float)",
            zIndex: 10,
          }}
        >
          <div className="mono cap" style={{ padding: "6px 8px", color: "var(--text-3)" }}>
            Duplicate to...
          </div>
          {availableRatios.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() => handleConvert(ratio.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 8px",
                fontSize: 12,
                background: "transparent",
                border: "none",
                color: "var(--text-0)",
                borderRadius: 4,
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-4)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <OrientationPreview ratio={ratio.value} />
              {ratio.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
