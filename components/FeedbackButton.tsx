"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Icon from "@/components/ui/Icon";

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [includeShot, setIncludeShot] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Don't show the button on the viewer page itself.
  if (pathname === "/feedback") return null;

  const projectId = pathname?.startsWith("/project/")
    ? pathname.split("/")[2]
    : undefined;

  async function handleOpen() {
    setCapturing(true);
    // Capture the screen BEFORE the modal renders, so the modal isn't in the shot.
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        // Cap pixel ratio so the JPEG stays small.
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
      });
      setScreenshot(canvas.toDataURL("image/jpeg", 0.7));
    } catch {
      setScreenshot(null);
    } finally {
      setCapturing(false);
      setIncludeShot(true);
      setOpen(true);
    }
  }

  function reset() {
    setMessage("");
    setScreenshot(null);
    setSubmitting(false);
    setDone(false);
  }

  function handleClose() {
    setOpen(false);
    // Let the close animation play before clearing state.
    reset();
  }

  async function handleSubmit() {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          screenshot: includeShot && screenshot ? screenshot : undefined,
          projectId,
          url: pathname,
        }),
      });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1100);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={capturing}
        title="Send feedback"
        aria-label="Send feedback"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 40,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 38,
          padding: "0 14px",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--accent-ink)",
          background: "var(--accent)",
          border: "none",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--sh-float)",
          cursor: capturing ? "wait" : "pointer",
          opacity: capturing ? 0.7 : 1,
          transition: "opacity 120ms, transform 80ms",
        }}
      >
        <Icon name="chat" size={14} />
        Feedback
      </button>

      <Modal open={open} onClose={handleClose} width={460} title="Send feedback" stepLabel="Help shape the tool">
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {done ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "24px 0",
                color: "var(--text-1)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <Icon name="check" size={20} />
              </div>
              <span style={{ fontSize: 13 }}>Thanks — feedback sent.</span>
            </div>
          ) : (
            <>
              <Textarea
                value={message}
                onChange={setMessage}
                placeholder="What's working, what's broken, what's missing…"
                rows={5}
              />

              {screenshot && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 8,
                    background: "var(--bg-inset)",
                    border: "0.5px solid var(--line-2)",
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeShot}
                    onChange={(e) => setIncludeShot(e.target.checked)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshot}
                    alt="Screenshot preview"
                    style={{
                      width: 64,
                      height: 36,
                      objectFit: "cover",
                      borderRadius: "var(--r-xs)",
                      border: "0.5px solid var(--line-2)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-1)" }}>Include screenshot</span>
                </label>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  icon="send"
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                >
                  {submitting ? "Sending…" : "Send"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
