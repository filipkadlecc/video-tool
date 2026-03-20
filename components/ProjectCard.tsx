"use client";

import React, { useState } from "react";
import type { ProjectMeta } from "@/lib/types";

interface ProjectCardProps {
  project: ProjectMeta;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  broll: { label: "B-Roll", color: "#5C8374" },
  animation: { label: "Animation", color: "#5C8374" },
  svg: { label: "SVG", color: "#7C5C83" },
};

export default function ProjectCard({ project, onClick, onDelete, onDuplicate }: ProjectCardProps) {
  const badge = TYPE_BADGE[project.animationType] ?? TYPE_BADGE.animation;
  const [thumbError, setThumbError] = useState(false);

  const specs = [
    project.settings.resolution.toUpperCase(),
    `${project.settings.fps}fps`,
    project.settings.orientation === "horizontal" ? "16:9" : project.settings.orientation === "vertical" ? "9:16" : "1:1",
  ].join(" / ");

  const date = new Date(project.updatedAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onClick={onClick}
      className="group relative bg-[#0a1a1a] rounded-2xl p-4 cursor-pointer hover:bg-[#183D3D]/40 transition-colors border border-[#183D3D]"
    >
      {/* Action buttons */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1.5 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="bg-black/60 text-muted hover:text-foreground text-[11px] px-2.5 py-1 rounded-lg"
        >
          Duplicate
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="bg-black/60 text-muted hover:text-red-400 text-[11px] px-2.5 py-1 rounded-lg"
        >
          Delete
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5">
        {/* Left: Thumbnail */}
        <div className="w-[45%] shrink-0">
          <div className="aspect-video rounded-xl overflow-hidden bg-[#1a1a1a]">
            {!thumbError ? (
              <img
                src={`/api/projects/${project.id}/thumbnail?t=${project.updatedAt}`}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setThumbError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#183D3D]/30">
                <div className="text-[#93B1A6]/60 text-xs">No preview</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Project info */}
        <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
          {/* Name */}
          <h3 className="text-lg font-bold text-foreground truncate">{project.name}</h3>

          {/* Badge + Specs row */}
          <div className="flex items-center gap-3 mt-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full"
              style={{ color: "#fff", backgroundColor: badge.color }}
            >
              {badge.label}
            </span>
            <span className="text-xs text-muted">{specs}</span>
          </div>

          {/* Description box */}
          <div className="mt-3 bg-white/5 border border-[#5C8374]/30 rounded-lg px-3 py-2">
            <p className="text-xs text-foreground/80 line-clamp-2">{project.initialPrompt}</p>
          </div>

          {/* Date */}
          <p className="text-[11px] text-muted mt-3">{date}</p>
        </div>
      </div>
    </div>
  );
}
