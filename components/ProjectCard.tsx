"use client";

import React, { useState } from "react";
import type { ProjectMeta } from "@/lib/types";
import TypeBadge from "@/components/ui/TypeBadge";
import Icon from "@/components/ui/Icon";

interface ProjectCardProps {
  project: ProjectMeta;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function ProjectCard({ project, onClick, onDelete, onDuplicate }: ProjectCardProps) {
  const [hover, setHover] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const specs = [
    project.settings.resolution.toUpperCase(),
    `${project.settings.fps}FPS`,
    project.settings.orientation === "horizontal"
      ? "16:9"
      : project.settings.orientation === "vertical"
        ? "9:16"
        : "1:1",
  ].join(" · ");

  const date = new Date(project.updatedAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        position: "relative",
        cursor: "pointer",
        background: "var(--bg-2)",
        border: "0.5px solid var(--line-2)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        transition: "transform 160ms, border-color 160ms, box-shadow 160ms",
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? "var(--sh-card)" : "none",
        borderColor: hover ? "var(--line-3)" : "var(--line-2)",
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", overflow: "hidden" }}>
        {!thumbError ? (
          <img
            src={`/api/projects/${project.id}/thumbnail?t=${project.updatedAt}`}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setThumbError(true)}
          />
        ) : (
          <div
            className="vt-ph"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>No preview</span>
          </div>
        )}
        {/* Ratio badge */}
        <div
          className="mono"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "2px 5px",
            fontSize: 9,
            color: "rgba(255,255,255,0.6)",
            background: "rgba(0,0,0,0.5)",
            borderRadius: 2,
            backdropFilter: "blur(4px)",
          }}
        >
          {project.settings.orientation === "horizontal"
            ? "16:9"
            : project.settings.orientation === "vertical"
              ? "9:16"
              : "1:1"}
        </div>
      </div>

      {/* Hover actions */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          display: "flex",
          gap: 4,
          opacity: hover ? 1 : 0,
          transition: "opacity 120ms",
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Duplicate"
          style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            border: "none",
            background: "rgba(10,10,14,0.8)",
            backdropFilter: "blur(6px)",
            color: "var(--text-0)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="duplicate" size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
          style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            border: "none",
            background: "rgba(10,10,14,0.8)",
            backdropFilter: "blur(6px)",
            color: "var(--text-0)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <TypeBadge type={project.animationType} />
          <span className="mono nums" style={{ fontSize: 10, color: "var(--text-2)", marginLeft: "auto" }}>
            {date}
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.1, marginBottom: 4 }}>
          {project.name}
        </div>
        <div className="mono nums" style={{ fontSize: 10, color: "var(--text-2)", marginBottom: 8 }}>
          {specs}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--text-1)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {project.initialPrompt}
        </div>
      </div>
    </div>
  );
}
