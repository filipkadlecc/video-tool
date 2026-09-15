"use client";

import React from "react";

/**
 * The M5 icon set.
 *
 * One grid for everything: a 24-unit viewBox at stroke-width 1.5, round caps
 * and joins, no fills. Rendered at 12-16px.
 *
 * Glyphs marked DS are the Apify design system's exact paths and must not be
 * redrawn — search, settings, plus, dots, chevrons, list, check, x, code, link,
 * play, folder, copy, help, home, external, user, filter. Everything else is
 * video-specific and drawn on the same grid so the two sets sit together.
 *
 * Two rules the design calls out explicitly:
 *   - undo/redo are CIRCULAR ARROWS, never back/forward chevrons.
 *   - play is the OUTLINE triangle, never a filled one.
 */
const paths: Record<string, React.ReactNode> = {
  // ---- Design system, exact ----
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  check: <path d="M5 12l5 5L20 7" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  dots: <path d="M12 6h.01M12 12h.01M12 18h.01" />,
  dotsHorizontal: <path d="M6 12h.01M12 12h.01M18 12h.01" />,
  search: <path d="M21 21l-5-5M16 11a5 5 0 11-10 0 5 5 0 0110 0z" />,
  settings: <g><path d="M12 9a3 3 0 100 6 3 3 0 000-6z" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></g>,
  list: <path d="M3 5h18M3 12h18M3 19h18" />,
  code: <path d="M8 6l-6 6 6 6M16 18l6-6-6-6" />,
  link: <path d="M10 13a5 5 0 007.07 0l2-2a5 5 0 00-7.07-7.07l-1.5 1.5M14 11a5 5 0 00-7.07 0l-2 2a5 5 0 007.07 7.07l1.5-1.5" />,
  play: <path d="M5 3l14 9-14 9V3z" />,
  folder: <path d="M3 7a2 2 0 012-2h4l2 3h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,
  copy: <g><path d="M8 8h12v12H8z" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></g>,
  help: <path d="M12 17v.01M9.09 9a3 3 0 015.83 1c0 2-3 2-3 4M12 21a9 9 0 100-18 9 9 0 000 18z" />,
  home: <path d="M3 12l9-9 9 9M5 10v10h14V10" />,
  external: <path d="M14 3h7v7M21 3L10 14M21 14v7H3V3h7" />,
  user: <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />,
  /** Real directional arrows — for "old -> new" receipts and Next actions.
      NOT for undo/redo (circular) and NOT for back (chevronLeft). */
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  arrowUp: <path d="M12 20V4M6 10l6-6 6 6" />,
  arrowDown: <path d="M12 4v16M6 14l6 6 6-6" />,
  bell: <path d="M6 8a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 22a2 2 0 004 0" />,
  calendar: <path d="M6 3v3M18 3v3M3 9h18M5 5h14v16H5z" />,
  book: <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z" />,
  storage: <path d="M3 5h18v14H3zM3 10h18M10 5v14" />,

  // ---- Transport ----
  pause: <path d="M9 4v16M15 4v16" />,
  stop: <path d="M5 5h14v14H5z" />,
  skipBack: <path d="M19 4l-11 8 11 8V4zM5 4v16" />,
  skipForward: <path d="M5 4l11 8-11 8V4zM19 4v16" />,
  loop: <path d="M4 12a8 8 0 018-8 8 8 0 018 8 8 8 0 01-8 8 8 8 0 01-8-8M16 1l4 3-4 3" />,

  // ---- Undo / redo: CIRCULAR arrows. Never chevrons. ----
  undo: <path d="M4 8h11a5 5 0 010 10h-7M4 8l4-4M4 8l4 4" />,
  redo: <path d="M20 8H9a5 5 0 000 10h7M20 8l-4-4M20 8l-4 4" />,
  /** Reset a property to its default — the same circular arrow at row scale. */
  reset: <path d="M4 10a8 8 0 112 6M4 4v6h6" />,

  // ---- Editing ----
  trash: <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" />,
  duplicate: <g><path d="M4 4h10v10H4z" /><path d="M8 18h10a2 2 0 002-2V8" /></g>,
  download: <path d="M12 3v12M7 11l5 5 5-5M3 20h18" />,
  upload: <path d="M12 16V4M7 8l5-5 5 5M3 20h18" />,
  send: <path d="M3 12l18-8-7 18-3-7z" />,
  attach: <path d="M16 10l-7 7a3.5 3.5 0 01-5-5l8.5-8.5a2.5 2.5 0 014 4l-8.5 8.5a1.5 1.5 0 01-2-2l7.5-7.5" />,
  /** Razor — the timeline split tool. */
  razor: <path d="M8 3l5 9M16 3l-5 9M7 20a3 3 0 100-6 3 3 0 000 6zM17 20a3 3 0 100-6 3 3 0 000 6z" />,
  scissors: <path d="M8 3l5 9M16 3l-5 9M7 20a3 3 0 100-6 3 3 0 000 6zM17 20a3 3 0 100-6 3 3 0 000 6z" />,
  /** In / out points. */
  markIn: <path d="M6 4v16M10 12h9M15 8l4 4-4 4" />,
  markOut: <path d="M18 4v16M14 12H5M9 8l-4 4 4 4" />,
  /** Fit the frame to the viewport. */
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  expand: <path d="M4 14v6h6M20 10V4h-6M20 4l-7 7M4 20l7-7" />,
  collapse: <path d="M10 20v-6H4M14 4v6h6M14 10l7-7M10 14l-7 7" />,
  maximize: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  minimize: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  lock: <path d="M6 11h12v9H6zM9 11V7a3 3 0 016 0v4" />,
  unlock: <path d="M6 11h12v9H6zM9 11V7a3 3 0 015.6-1.5" />,
  eye: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z" />,
  eyeOff: <path d="M4 4l16 16M10 5.2A9.6 9.6 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.3 7.6A16.8 16.8 0 002 12s3.5 7 10 7a9.7 9.7 0 004-.85M9.9 9.9a3 3 0 004.2 4.2" />,
  /** Keyframe diamond — an 8x8 square rotated 45 degrees, on the 24 grid. */
  diamond: <path d="M12 4l8 8-8 8-8-8z" />,
  snap: <path d="M6 4v9a6 6 0 0012 0V4M6 9h12" />,

  // ---- Media kinds ----
  film: <path d="M3 4h18v16H3zM8 4v16M16 4v16M3 9h5M16 9h5M3 15h5M16 15h5" />,
  image: <path d="M3 4h18v16H3zM9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3M4 18l5-5 4 4 3-3 5 5" />,
  movie: <path d="M3 6h18v14H3zM7 6L5 2M13 6l-2-4M19 6l-2-4" />,
  speaker: <path d="M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 010 6" />,
  speakerOff: <path d="M4 9h4l5-4v14l-5-4H4zM17 10l4 4M21 10l-4 4" />,
  subtitles: <path d="M3 5h18v14H3zM7 14h4M14 14h3" />,
  type: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,

  // ---- Layout / chrome ----
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  rows: <path d="M3 5h18v6H3zM3 13h18v6H3z" />,
  aspect: <path d="M3 5h18v14H3zM3 10h5v9" />,
  monitor: <path d="M3 4h18v12H3zM8 20h8M12 16v4" />,
  checkerboard: <path d="M3 3h18v18H3zM3 12h18M12 3v18" />,
  chat: <path d="M3 5h18v11H8l-5 4V5z" />,
  sparkle: <path d="M12 3l2 6.5L20.5 12 14 14l-2 7-2-7-6.5-2L10 9.5z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  zoomIn: <path d="M21 21l-5-5M16 11a5 5 0 11-10 0 5 5 0 0110 0zM11 9v4M9 11h4" />,
  zoomOut: <path d="M21 21l-5-5M16 11a5 5 0 11-10 0 5 5 0 0110 0zM9 11h4" />,

  // ---- Status ----
  warn: <path d="M12 3l9 17H3zM12 9v5M12 17v.01" />,
  info: <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v.01M12 11v6" />,
  square: <path d="M4 4h16v16H4z" />,
};

export const ICON_NAMES = Object.keys(paths);

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: string;
  size?: number;
}

export default function Icon({ name, size = 16, ...rest }: IconProps) {
  const glyph = paths[name];
  if (!glyph) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Icon] unknown glyph "${name}"`);
    }
    return null;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      {...rest}
    >
      {glyph}
    </svg>
  );
}
