import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { springIn } from "../motion";

export const fps = 30;
export const durationInFrames = 750;

// ─── SPIKE Prague — hype cut ─────────────────────────────────────────────────
// Every pixel is a real capture of https://spikeprague.cz/ — 70 product cutouts
// with their real names and prices, the five category stickers, the mascot, the
// storefront. Nothing is illustrated and no price is invented.
//
// Cut on a 125 BPM grid. 125 BPM at 30fps is 14.4 frames a beat, which is not a
// whole frame, so beats are computed in TIME and rounded — max error 17ms, and a
// real 125 BPM track drops straight on.
//
// The grammar is hard cuts. Shots do not ease into each other and nothing fades:
// an element arrives by punching down from an over-scale with opacity already at
// 1, so the cut is the transition. 52 beats, 30 shots.

const W = 1080;
const H = 1350;
const PAPER = "#FFFFFF";
const INK = "#111111";
const YELLOW = "#FFD60A";
const FONT = "Inter, -apple-system, Helvetica Neue, sans-serif";

const BPM = 125;
const b = (n: number) => Math.round((n * 60 * 30) / BPM);

interface Prod { src: string; w: number; h: number; name: string; price: string; disc: string | null; isNew: boolean }
interface Pic { src: string; w: number; h: number }
interface Band { slug: string; y: number; h: number; src: string }

// --- generated:data-start ---
const PAGE = { width: 1080, totalHeight: 7366 };

const SECTIONS: Band[] = [
  { slug: "hero", y: 110, h: 357, src: "assets/spike/sections/01-hero.webp" },
  { slug: "bestsellers", y: 467, h: 563, src: "assets/spike/sections/02-bestsellers.webp" },
  { slug: "badges", y: 1030, h: 231, src: "assets/spike/sections/03-badges.webp" },
  { slug: "new-arrivals", y: 1261, h: 518, src: "assets/spike/sections/04-new-arrivals.webp" },
  { slug: "jordan", y: 1819, h: 518, src: "assets/spike/sections/05-jordan.webp" },
  { slug: "nike", y: 2377, h: 518, src: "assets/spike/sections/06-nike.webp" },
];

const STORE = { src: "assets/spike/sections/10-flagship.webp", w: 1080, h: 580 };
const ANNOUNCE = { y: 0, h: 42, src: "assets/spike/elements/announce.webp" };
const LOGO = { x: 475, y: 54, w: 130, h: 43, src: "assets/spike/elements/logo.webp" };

const BADGES: Pic[] = [
  { src: "assets/spike/elements/badge-0.webp", w: 186, h: 186 },
  { src: "assets/spike/elements/badge-1.webp", w: 186, h: 186 },
  { src: "assets/spike/elements/badge-2.webp", w: 186, h: 186 },
  { src: "assets/spike/elements/badge-3.webp", w: 186, h: 186 },
  { src: "assets/spike/elements/badge-4.webp", w: 186, h: 186 },
];
const MASCOT: Pic = { src: "assets/spike/elements/mascot.webp", w: 450, h: 819 };

const P: Record<string, Prod> = {
  "2-0": { src: "assets/spike/elements/card-2-0.webp", w: 240, h: 377, name: "YZY YS-01 Black", price: "€61.46", disc: "-27%", isNew: false },
  "2-1": { src: "assets/spike/elements/card-2-1.webp", w: 240, h: 378, name: "BE@RBRICK Series 47 blind box (100%)", price: "€20.21", disc: null, isNew: false },
  "2-2": { src: "assets/spike/elements/card-2-2.webp", w: 240, h: 378, name: "Fear of God Essentials Sweatshort (SS22) Light Oatmeal", price: "€115.08", disc: null, isNew: false },
  "2-3": { src: "assets/spike/elements/card-2-3.webp", w: 240, h: 377, name: "Nike Air Force 1 Low '07 White", price: "€102.70", disc: null, isNew: false },
  "2-4": { src: "assets/spike/elements/card-2-4.webp", w: 240, h: 378, name: "Nike Air Force 1 Low Supreme White", price: "€226.44", disc: null, isNew: false },
  "2-5": { src: "assets/spike/elements/card-2-5.webp", w: 240, h: 377, name: "YZY YS-01 Cream", price: "€61.46", disc: null, isNew: false },
  "2-6": { src: "assets/spike/elements/card-2-6.webp", w: 240, h: 377, name: "Jordan 4 Retro Black Cat (2025)", price: "€288.31", disc: null, isNew: false },
  "2-7": { src: "assets/spike/elements/card-2-7.webp", w: 240, h: 378, name: "Fear of God Essentials Hoodie Light Oatmeal", price: "€164.57", disc: null, isNew: false },
  "2-8": { src: "assets/spike/elements/card-2-8.webp", w: 240, h: 378, name: "Fear of God Essentials Sweatshort (SS22) Dark Oatmeal", price: "€115.08", disc: null, isNew: false },
  "2-9": { src: "assets/spike/elements/card-2-9.webp", w: 240, h: 377, name: "Nike Mind 001 Slide Triple Black", price: "€247.06", disc: null, isNew: false },
  "4-0": { src: "assets/spike/elements/card-4-0.webp", w: 240, h: 378, name: "adidas Yeezy Foam RNNR MX Sand Grey", price: "€131.58", disc: null, isNew: true },
  "4-1": { src: "assets/spike/elements/card-4-1.webp", w: 240, h: 378, name: "Nike Mind 001 Flyknit Slide Hyper Royal Black", price: "€267.69", disc: null, isNew: true },
  "4-2": { src: "assets/spike/elements/card-4-2.webp", w: 240, h: 378, name: "Nike Zoom Field Jaxx Travis Scott Light Chocolate", price: "€226.44", disc: null, isNew: false },
  "4-3": { src: "assets/spike/elements/card-4-3.webp", w: 240, h: 378, name: "Jordan 4 Retro SE Paris Olympics Wet Cement", price: "€267.69", disc: "-19%", isNew: false },
  "4-4": { src: "assets/spike/elements/card-4-4.webp", w: 240, h: 378, name: "Jordan 4 Retro White Cement (2025)", price: "€267.69", disc: null, isNew: false },
  "4-5": { src: "assets/spike/elements/card-4-5.webp", w: 240, h: 378, name: "Jordan 4 Retro Military Blue (2024)", price: "€267.69", disc: null, isNew: false },
  "4-6": { src: "assets/spike/elements/card-4-6.webp", w: 240, h: 377, name: "Jordan 4 Retro Midnight Navy", price: "€247.06", disc: null, isNew: false },
  "4-7": { src: "assets/spike/elements/card-4-7.webp", w: 240, h: 378, name: "Nike Air Force 1 Low Supreme White", price: "€226.44", disc: null, isNew: false },
  "4-8": { src: "assets/spike/elements/card-4-8.webp", w: 240, h: 377, name: "Nike Dunk Low Grey Fog", price: "€82.08", disc: null, isNew: false },
  "4-9": { src: "assets/spike/elements/card-4-9.webp", w: 240, h: 378, name: "Jordan 4 Retro Metallic Gold (Women's)", price: "€329.56", disc: "-11%", isNew: false },
  "5-0": { src: "assets/spike/elements/card-5-0.webp", w: 240, h: 377, name: "Jordan 1 Mid Chicago Toe", price: "€185.20", disc: null, isNew: true },
  "5-1": { src: "assets/spike/elements/card-5-1.webp", w: 240, h: 378, name: "Jordan 1 Retro Low OG SP Travis Scott Sail Tropical Pink", price: "€680.15", disc: null, isNew: false },
  "5-2": { src: "assets/spike/elements/card-5-2.webp", w: 240, h: 377, name: "Jordan 4 Retro Oxidized Green", price: "€143.95", disc: "-42%", isNew: false },
  "5-3": { src: "assets/spike/elements/card-5-3.webp", w: 240, h: 377, name: "Jordan 1 Mid Diamond Shorts", price: "€82.08", disc: "-43%", isNew: false },
  "5-4": { src: "assets/spike/elements/card-5-4.webp", w: 240, h: 378, name: "Jordan 1 Retro High OG Atmosphere (Women's)", price: "€82.08", disc: null, isNew: false },
  "5-5": { src: "assets/spike/elements/card-5-5.webp", w: 240, h: 377, name: "Jordan 1 Mid Lucky Green", price: "€82.08", disc: "-33%", isNew: false },
  "5-6": { src: "assets/spike/elements/card-5-6.webp", w: 240, h: 378, name: "Jordan 4 Retro Metallic Gold (Women's)", price: "€329.56", disc: "-11%", isNew: false },
  "5-7": { src: "assets/spike/elements/card-5-7.webp", w: 240, h: 377, name: "Jordan 4 Retro Cave Stone", price: "€263.56", disc: "-20%", isNew: false },
  "5-8": { src: "assets/spike/elements/card-5-8.webp", w: 240, h: 377, name: "Jordan 4 Retro Midnight Navy", price: "€247.06", disc: null, isNew: false },
  "5-9": { src: "assets/spike/elements/card-5-9.webp", w: 240, h: 378, name: "Jordan 1 Low Medium Soft Pink White (GS)", price: "€123.33", disc: null, isNew: false },
  "6-0": { src: "assets/spike/elements/card-6-0.webp", w: 240, h: 378, name: "Nike Mind 001 Flyknit Slide Hyper Royal Black", price: "€267.69", disc: null, isNew: true },
  "6-1": { src: "assets/spike/elements/card-6-1.webp", w: 240, h: 378, name: "Nike SB Dunk Low Pro ISO Orange Label Wolf Grey Gum", price: "€164.57", disc: null, isNew: false },
  "6-2": { src: "assets/spike/elements/card-6-2.webp", w: 240, h: 378, name: "Nike SB Dunk Low Pro ISO Light Cognac", price: "€123.33", disc: null, isNew: false },
  "6-3": { src: "assets/spike/elements/card-6-3.webp", w: 240, h: 377, name: "Nike Air Force 1 Low '07 White", price: "€102.70", disc: null, isNew: false },
  "6-4": { src: "assets/spike/elements/card-6-4.webp", w: 240, h: 378, name: "Nike SB Dunk Low Pro Bluetile Skateboards", price: "€247.06", disc: null, isNew: false },
  "6-5": { src: "assets/spike/elements/card-6-5.webp", w: 240, h: 378, name: "Nike Shox TL Black Max Orange (Women's)", price: "€205.82", disc: null, isNew: false },
  "6-6": { src: "assets/spike/elements/card-6-6.webp", w: 240, h: 377, name: "Nike Air Force 1 Rope Laces Pink", price: "€172.82", disc: null, isNew: false },
  "6-7": { src: "assets/spike/elements/card-6-7.webp", w: 240, h: 378, name: "Nike SB Dunk Low Court Purple (2021/2024)", price: "€164.57", disc: null, isNew: false },
  "6-8": { src: "assets/spike/elements/card-6-8.webp", w: 240, h: 377, name: "Nike SB Dunk Low Pro White Gum", price: "€185.20", disc: null, isNew: false },
  "6-9": { src: "assets/spike/elements/card-6-9.webp", w: 240, h: 377, name: "Nike Shox TL Seaweed Gunmetal", price: "€131.58", disc: null, isNew: false },
  "7-0": { src: "assets/spike/elements/card-7-0.webp", w: 240, h: 378, name: "adidas Yeezy Foam RNNR MX Sand Grey", price: "€131.58", disc: null, isNew: true },
  "7-1": { src: "assets/spike/elements/card-7-1.webp", w: 240, h: 378, name: "adidas Yeezy Boost 350 V2 Zebra (2017/2022/2023)", price: "€267.69", disc: null, isNew: false },
  "7-2": { src: "assets/spike/elements/card-7-2.webp", w: 240, h: 377, name: "adidas Yeezy Slide Dark Onyx", price: "€176.95", disc: null, isNew: false },
  "7-3": { src: "assets/spike/elements/card-7-3.webp", w: 240, h: 378, name: "adidas Yeezy Slide Bone (2022/2023 Restock)", price: "€156.32", disc: "-27%", isNew: false },
  "7-4": { src: "assets/spike/elements/card-7-4.webp", w: 240, h: 377, name: "adidas Campus 00s Core Black", price: "€82.08", disc: null, isNew: false },
  "7-5": { src: "assets/spike/elements/card-7-5.webp", w: 240, h: 378, name: "adidas Adilette Slides KoRn 30th Anniversary", price: "€61.46", disc: "-50%", isNew: false },
  "7-6": { src: "assets/spike/elements/card-7-6.webp", w: 240, h: 378, name: "adidas Fear of God Athletics '86 Lo Clay", price: "€61.46", disc: "-50%", isNew: false },
  "7-7": { src: "assets/spike/elements/card-7-7.webp", w: 240, h: 378, name: "adidas Adilette 22 Slides Magic Lime", price: "€40.83", disc: null, isNew: false },
  "7-8": { src: "assets/spike/elements/card-7-8.webp", w: 240, h: 378, name: "adidas Adistar Jellyfish Pharrell Williams White", price: "€494.54", disc: null, isNew: true },
  "7-9": { src: "assets/spike/elements/card-7-9.webp", w: 240, h: 378, name: "adidas Adistar Jellyfish Pharrell Williams Triple Black", price: "€494.54", disc: null, isNew: true },
  "8-0": { src: "assets/spike/elements/card-8-0.webp", w: 240, h: 378, name: "Supreme Larry Clark Neighbor Tee Powder Blue", price: "€164.57", disc: null, isNew: true },
  "8-1": { src: "assets/spike/elements/card-8-1.webp", w: 240, h: 378, name: "Supreme Larry Clark Neighbor Tee White", price: "€164.57", disc: null, isNew: true },
  "8-2": { src: "assets/spike/elements/card-8-2.webp", w: 240, h: 378, name: "Fear of God Essentials S25 Zip-Up Hoodie Timber", price: "€164.57", disc: null, isNew: true },
  "8-3": { src: "assets/spike/elements/card-8-3.webp", w: 240, h: 378, name: "Supreme Racing Lined Zip Up Hooded Sweatshirt Black", price: "€412.05", disc: null, isNew: true },
  "8-4": { src: "assets/spike/elements/card-8-4.webp", w: 240, h: 378, name: "Supreme Reflective Football Jersey White", price: "€288.31", disc: null, isNew: true },
  "8-5": { src: "assets/spike/elements/card-8-5.webp", w: 240, h: 378, name: "Supreme Hanes Plaid Boxers (4 Pack) Multicolor", price: "€115.08", disc: null, isNew: true },
  "8-6": { src: "assets/spike/elements/card-8-6.webp", w: 240, h: 378, name: "Fear of God Essentials Sweatshort (SS22) Light Oatmeal", price: "€115.08", disc: null, isNew: false },
  "8-7": { src: "assets/spike/elements/card-8-7.webp", w: 240, h: 378, name: "Fear of God Essentials Tee Stretch Limo", price: "€115.08", disc: "-20%", isNew: false },
  "8-8": { src: "assets/spike/elements/card-8-8.webp", w: 240, h: 378, name: "Supreme Performance Zip Up Hooded Sweatshirt Black", price: "€288.31", disc: "-13%", isNew: false },
  "8-9": { src: "assets/spike/elements/card-8-9.webp", w: 240, h: 378, name: "Fear of God Essentials Sweatshort (SS22) Stretch Limo", price: "€115.08", disc: "-20%", isNew: false },
  "9-0": { src: "assets/spike/elements/card-9-0.webp", w: 240, h: 378, name: "Nike Air Force 1 Low Supreme Black", price: "€226.44", disc: null, isNew: false },
  "9-1": { src: "assets/spike/elements/card-9-1.webp", w: 240, h: 378, name: "Nike Air Force 1 Low Supreme GOODENOUGH", price: "€267.69", disc: null, isNew: false },
  "9-2": { src: "assets/spike/elements/card-9-2.webp", w: 240, h: 378, name: "Nike Air Force 1 Low Supreme White", price: "€226.44", disc: null, isNew: false },
  "9-3": { src: "assets/spike/elements/card-9-3.webp", w: 240, h: 378, name: "Nike SB Dunk Low Supreme Rammellzee", price: "€535.79", disc: null, isNew: false },
  "9-4": { src: "assets/spike/elements/card-9-4.webp", w: 240, h: 378, name: "Nike SB Dunk Low Supreme Stars Black (2021)", price: "€535.79", disc: "-35%", isNew: false },
  "9-5": { src: "assets/spike/elements/card-9-5.webp", w: 240, h: 378, name: "Supreme Anarchy Hooded Sweatshirt Navy", price: "€255.31", disc: null, isNew: false },
  "9-6": { src: "assets/spike/elements/card-9-6.webp", w: 240, h: 377, name: "Supreme Angel Tee Black", price: "€123.33", disc: null, isNew: true },
  "9-7": { src: "assets/spike/elements/card-9-7.webp", w: 240, h: 377, name: "Supreme Angel Tee White", price: "€123.33", disc: null, isNew: false },
  "9-8": { src: "assets/spike/elements/card-9-8.webp", w: 240, h: 378, name: "Supreme ANTIHERO Hooded Sweatshirt (FW25) Ash Grey", price: "€412.05", disc: null, isNew: false },
  "9-9": { src: "assets/spike/elements/card-9-9.webp", w: 240, h: 378, name: "Supreme ANTIHERO Hooded Sweatshirt (FW25) Black", price: "€412.05", disc: null, isNew: false },
};
// --- generated:data-end ---

// ─── The cut ─────────────────────────────────────────────────────────────────
// `b` is the beat a shot lands on; it runs until the next shot's beat.

type Shot =
  | { b: number; k: "product"; id: string; bg?: string; show?: "none" | "full" | "grail" }
  | { b: number; k: "grid"; ids: string[]; cols: number; bg?: string; zoom?: number }
  | { b: number; k: "type"; lines: string[]; bg?: string; fg?: string; size?: number }
  | { b: number; k: "stamp" }
  | { b: number; k: "badges"; count: number; bg?: string }
  | { b: number; k: "mascot"; lines?: string[] }
  | { b: number; k: "page"; fromY: number; toY: number; scale?: number }
  | { b: number; k: "store"; lines?: string[] }
  | { b: number; k: "end" };

const ids = (sec: string, from: number, n: number) =>
  Array.from({ length: n }, (_, i) => `${sec}-${from + i}`);

const SHOTS: Shot[] = [
  // Open straight on the goods, full-bleed and silent. No logo, no title card.
  { b: 0,  k: "product", id: "5-1", show: "none" },
  { b: 1,  k: "product", id: "5-0", show: "none" },
  { b: 2,  k: "product", id: "2-0", show: "full" },
  { b: 3,  k: "stamp" },

  { b: 4,  k: "grid", ids: ids("6", 0, 4), cols: 2 },
  { b: 5,  k: "product", id: "2-1", show: "full" },
  { b: 6,  k: "grid", ids: ids("7", 0, 6), cols: 3, zoom: 1.3 },
  { b: 7,  k: "type", lines: ["-50 %"], bg: YELLOW, fg: INK, size: 300 },

  { b: 8,  k: "badges", count: 3, bg: INK },
  { b: 9,  k: "grid", ids: ids("8", 0, 4), cols: 2 },
  { b: 10, k: "product", id: "8-1", show: "full" },
  { b: 11, k: "type", lines: ["LIMITED", "IN PRAGUE"], bg: INK, fg: YELLOW, size: 175 },

  { b: 12, k: "page", fromY: 200, toY: 1460, scale: 1.05 },
  { b: 14, k: "product", id: "2-3", show: "full" },
  { b: 15, k: "grid", ids: ids("9", 0, 6), cols: 3 },
  { b: 16, k: "type", lines: ["TENISKY", "OBLEČENÍ", "SBĚRATELSKÉ"], bg: INK, fg: YELLOW, size: 130 },
  { b: 17, k: "mascot" },

  { b: 18, k: "grid", ids: ids("2", 0, 8), cols: 4, zoom: 1.34 },
  { b: 19, k: "product", id: "5-2", show: "full" },
  { b: 20, k: "type", lines: ["-42 %"], bg: YELLOW, fg: INK, size: 300 },
  { b: 21, k: "grid", ids: ids("4", 0, 6), cols: 3 },
  { b: 22, k: "product", id: "5-3", show: "full" },
  { b: 23, k: "grid", ids: ids("5", 0, 6), cols: 3, zoom: 1.28 },

  // The one place the cut stops moving — six beats on the grail.
  { b: 24, k: "product", id: "5-1", show: "grail" },

  { b: 30, k: "grid", ids: ids("6", 2, 6), cols: 3 },
  { b: 31, k: "product", id: "4-1", show: "full" },
  { b: 32, k: "badges", count: 5, bg: YELLOW },
  { b: 33, k: "store", lines: ["HAVELSKÁ 522/6", "PRAHA 1 · PO–NE 11–20"] },
  { b: 36, k: "type", lines: ["4,7 ★", "344 RECENZÍ"], bg: YELLOW, fg: INK, size: 150 },

  { b: 38, k: "grid", ids: ids("2", 2, 8), cols: 4, zoom: 1.34 },
  { b: 39, k: "product", id: "4-4", show: "full" },
  { b: 40, k: "grid", ids: ids("9", 2, 4), cols: 2 },
  { b: 41, k: "product", id: "7-1", show: "full" },
  { b: 42, k: "page", fromY: 1500, toY: 4500, scale: 1.02 },
  { b: 44, k: "badges", count: 5, bg: INK },
  { b: 45, k: "grid", ids: ids("5", 4, 6), cols: 3, zoom: 1.28 },
  { b: 46, k: "mascot", lines: ["SPIKE"] },

  { b: 48, k: "end" },
];

// ─── Motion ──────────────────────────────────────────────────────────────────
// One entrance, used everywhere: punch down from an over-scale. Opacity stays at
// 1 throughout, so nothing ever fades in or out — the cut does that work.

function punch(local: number, f: number, delay = 0, from = 1.16, preset: "SNAPPY" | "ELASTIC" = "SNAPPY") {
  const p = springIn(local, f, delay, preset);
  return 1 + (from - 1) * (1 - p);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ─── Shot renderers ──────────────────────────────────────────────────────────

const Field: React.FC<{ bg: string; children?: React.ReactNode }> = ({ bg, children }) => (
  <AbsoluteFill style={{ backgroundColor: bg, fontFamily: FONT, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    {children}
  </AbsoluteFill>
);

// The captured card is photo-box on top, then the site's own small name and
// price. Showing the whole tile under my own big name and price says everything
// twice, so a product shot crops to the photo box and lets the type do the
// talking. 0.55 lands just above the size chips.
const PHOTO_FRAC = 0.55;

const CardPhoto: React.FC<{ p: Prod; height: number; scale: number }> = ({ p, height, scale }) => {
  const imgH = height / PHOTO_FRAC;
  const imgW = imgH * (p.w / p.h);
  return (
    <div style={{ width: imgW, height, overflow: "hidden", transform: `scale(${scale})` }}>
      <Img src={staticFile(p.src)} style={{ width: imgW, height: imgH, display: "block" }} />
    </div>
  );
};

const ProductShot: React.FC<{ p: Prod; show: "none" | "full" | "grail"; local: number; f: number }> = ({ p, show, local, f }) => {
  const grail = show === "grail";
  const silent = show === "none";

  if (silent) {
    // Nothing else carries this shot, so the product fills the frame and bleeds.
    const showH = H / PHOTO_FRAC;
    const showW = showH * (p.w / p.h);
    return (
      <Field bg={PAPER}>
        <Img
          src={staticFile(p.src)}
          style={{
            position: "absolute", left: (W - showW) / 2, top: 0, width: showW, height: showH,
            transform: `scale(${punch(local, f, 0, 1.12)})`, transformOrigin: "50% 26%",
          }}
        />
      </Field>
    );
  }

  const photoH = grail ? 740 : 660;
  const nameDelay = grail ? b(1) : 3;
  const priceDelay = grail ? b(2) : 6;
  const pushed = grail ? interpolate(local, [0, b(6)], [1, 1.05], { extrapolateRight: "clamp" }) : 1;

  return (
    <Field bg={PAPER}>
      <div style={{ position: "absolute", top: grail ? 120 : 150 }}>
        <CardPhoto p={p} height={photoH} scale={punch(local, f, 0, grail ? 1.08 : 1.16) * pushed} />
      </div>
      <div style={{ position: "absolute", bottom: 190, left: 56, right: 56, textAlign: "center" }}>
        <div
          style={{
            fontSize: 46, fontWeight: 900, letterSpacing: -1.4, color: INK, textTransform: "uppercase",
            lineHeight: 1.05, transform: `translateY(${(1 - clamp01(springIn(local, f, nameDelay))) * 26}px)`,
          }}
        >
          {p.name}
        </div>
        <div
          style={{
            marginTop: 16, fontSize: grail ? 132 : 96, fontWeight: 900, letterSpacing: -4, color: INK,
            transform: `scale(${punch(local, f, priceDelay, 1.35, "ELASTIC")})`,
          }}
        >
          {p.price}
        </div>
      </div>
    </Field>
  );
};

const GridShot: React.FC<{ list: Prod[]; cols: number; zoom: number; local: number; f: number }> = ({ list, cols, zoom, local, f }) => {
  const pad = 46, gap = 18;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const ch = cw / 0.6366;
  const rows = Math.ceil(list.length / cols);
  const totalH = rows * ch + (rows - 1) * gap;
  return (
    <Field bg={PAPER}>
      <div style={{ position: "absolute", left: pad, top: (H - totalH) / 2, width: W - pad * 2, height: totalH, transform: `scale(${zoom})` }}>
        {list.map((p, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: c * (cw + gap), top: r * (ch + gap), width: cw, height: ch,
                transform: `scale(${punch(local, f, i * 2, 1.3)})`,
              }}
            >
              <Img src={staticFile(p.src)} style={{ width: "100%", height: "100%" }} />
            </div>
          );
        })}
      </div>
    </Field>
  );
};

const TypeShot: React.FC<{ lines: string[]; bg: string; fg: string; size: number; local: number; f: number }> = ({ lines, bg, fg, size, local, f }) => (
  <Field bg={bg}>
    <div style={{ textAlign: "center" }}>
      {lines.map((t, i) => (
        <div
          key={i}
          style={{
            fontSize: size, fontWeight: 900, letterSpacing: -size * 0.045, lineHeight: 0.94, color: fg,
            transform: `scale(${punch(local, f, i * 3, 1.22)})`,
          }}
        >
          {t}
        </div>
      ))}
    </div>
  </Field>
);

const StampShot: React.FC<{ local: number; f: number }> = ({ local, f }) => (
  <Field bg={INK}>
    <Img src={staticFile(LOGO.src)} style={{ width: 640, height: 212, transform: `scale(${punch(local, f, 0, 1.3, "ELASTIC")})` }} />
    <div style={{ marginTop: 36, fontSize: 40, fontWeight: 900, letterSpacing: 10, color: YELLOW, transform: `scale(${punch(local, f, 4, 1.2)})` }}>
      PRAHA 1
    </div>
  </Field>
);

const BadgesShot: React.FC<{ count: number; bg: string; local: number; f: number }> = ({ count, bg, local, f }) => {
  const list = BADGES.slice(0, count);
  const size = count <= 3 ? 460 : 360;
  return (
    <Field bg={bg}>
      {list.map((pic, i) => {
        const cols = count <= 3 ? 1 : 2;
        const col = i % cols, row = Math.floor(i / cols);
        const rows = Math.ceil(count / cols);
        const x = cols === 1 ? W / 2 : W / 2 + (col - 0.5) * (size * 0.92);
        const y = H / 2 + (row - (rows - 1) / 2) * (size * 0.8);
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size,
              transform: `scale(${punch(local, f, i * 3, 1.6, "ELASTIC")}) rotate(${(i % 2 ? 1 : -1) * 4}deg)`,
            }}
          >
            <Img src={staticFile(pic.src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        );
      })}
    </Field>
  );
};

const MascotShot: React.FC<{ lines?: string[]; local: number; f: number }> = ({ lines, local, f }) => (
  <Field bg={YELLOW}>
    <Img
      src={staticFile(MASCOT.src)}
      style={{ height: 1000, width: (1000 * MASCOT.w) / MASCOT.h, transform: `scale(${punch(local, f, 0, 1.25, "ELASTIC")})` }}
    />
    {lines && (
      <div style={{ position: "absolute", bottom: 130, fontSize: 120, fontWeight: 900, letterSpacing: -5, color: INK, transform: `scale(${punch(local, f, 4, 1.2)})` }}>
        {lines.join(" ")}
      </div>
    )}
  </Field>
);

const PageShot: React.FC<{ fromY: number; toY: number; scale: number; span: number; local: number }> = ({ fromY, toY, scale, span, local }) => {
  const y = interpolate(local, [0, span], [fromY, toY], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const halfH = H / 2 / scale;
  const inView = (by: number, bh: number) => by + bh > y - halfH - 700 && by < y + halfH + 700;
  return (
    <Field bg={PAPER}>
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: 0, height: 0, transformOrigin: "0 0",
          transform: `translate(${W / 2}px, ${H / 2}px) scale(${scale}) translate(${-W / 2}px, ${-y}px)`,
        }}
      >
        {inView(0, 110) && (
          <>
            <div style={{ position: "absolute", left: 0, top: 0, width: PAGE.width, height: 110, backgroundColor: PAPER }} />
            <Img src={staticFile(ANNOUNCE.src)} style={{ position: "absolute", left: 0, top: 0, width: PAGE.width, height: ANNOUNCE.h }} />
            <Img src={staticFile(LOGO.src)} style={{ position: "absolute", left: LOGO.x, top: LOGO.y, width: LOGO.w, height: LOGO.h }} />
          </>
        )}
        {SECTIONS.filter((s) => inView(s.y, s.h)).map((s) => (
          <Img key={s.slug} src={staticFile(s.src)} style={{ position: "absolute", left: 0, top: s.y, width: PAGE.width, height: s.h }} />
        ))}
      </div>
    </Field>
  );
};

const StoreShot: React.FC<{ lines?: string[]; local: number; f: number }> = ({ lines, local, f }) => {
  // Cover, don't fit -- fitting this 1080x580 capture into a 1350-tall frame
  // left black bars top and bottom and read as a letterboxed screenshot.
  const cover = Math.max(W / STORE.w, H / STORE.h) * 1.02;
  const imgW = STORE.w * cover;
  const imgH = STORE.h * cover;
  const focusX = 0.3;   // the storefront photo sits in the left third of the capture
  const scale = interpolate(local, [0, b(3)], [1.12, 1.0], { extrapolateRight: "clamp" });
  return (
    <Field bg={INK}>
      <Img src={staticFile(STORE.src)} style={{ position: "absolute", width: imgW, height: imgH, left: W / 2 - focusX * imgW, top: (H - imgH) / 2, transform: `scale(${scale})` }} />
      {lines && (
        <div style={{ position: "absolute", bottom: 150, textAlign: "center" }}>
          {lines.map((t, i) => (
            <div
              key={i}
              style={{
                fontSize: i === 0 ? 86 : 52, fontWeight: 900, letterSpacing: -2, color: PAPER, lineHeight: 1.08,
                textShadow: "0 4px 30px rgba(0,0,0,0.55)",
                transform: `scale(${punch(local, f, b(1) + i * 3, 1.25)})`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </Field>
  );
};

const EndShot: React.FC<{ local: number; f: number }> = ({ local, f }) => (
  <Field bg={PAPER}>
    <Img src={staticFile(LOGO.src)} style={{ width: 620, height: 205, transform: `scale(${punch(local, f, 0, 1.28, "ELASTIC")})` }} />
    <div style={{ marginTop: 34, fontSize: 72, fontWeight: 900, letterSpacing: -2.4, color: INK, transform: `scale(${punch(local, f, 5, 1.2)})` }}>
      spikeprague.cz
    </div>
    <div
      style={{
        marginTop: 34, backgroundColor: YELLOW, color: INK, fontSize: 30, fontWeight: 900, letterSpacing: 0.6,
        padding: "18px 34px", borderRadius: 999, transform: `scale(${punch(local, f, 10, 1.3, "ELASTIC")})`,
      }}
    >
      DOPRAVA ZDARMA NAD 5 000 KČ
    </div>
  </Field>
);

// ─── Scene ───────────────────────────────────────────────────────────────────

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps: f } = useVideoConfig();

  let i = 0;
  while (i < SHOTS.length - 1 && frame >= b(SHOTS[i + 1].b)) i++;
  const shot = SHOTS[i];
  const start = b(shot.b);
  const end = i < SHOTS.length - 1 ? b(SHOTS[i + 1].b) : durationInFrames;
  const local = frame - start;
  const span = end - start;

  switch (shot.k) {
    case "product":
      return <ProductShot p={P[shot.id]} show={shot.show ?? "full"} local={local} f={f} />;
    case "grid":
      return <GridShot list={shot.ids.map((id) => P[id]).filter(Boolean)} cols={shot.cols} zoom={shot.zoom ?? 1} local={local} f={f} />;
    case "type":
      return <TypeShot lines={shot.lines} bg={shot.bg ?? PAPER} fg={shot.fg ?? INK} size={shot.size ?? 150} local={local} f={f} />;
    case "stamp":
      return <StampShot local={local} f={f} />;
    case "badges":
      return <BadgesShot count={shot.count} bg={shot.bg ?? INK} local={local} f={f} />;
    case "mascot":
      return <MascotShot lines={shot.lines} local={local} f={f} />;
    case "page":
      return <PageShot fromY={shot.fromY} toY={shot.toY} scale={shot.scale ?? 1.05} span={span} local={local} />;
    case "store":
      return <StoreShot lines={shot.lines} local={local} f={f} />;
    default:
      return <EndShot local={local} f={f} />;
  }
};

export default Scene;
