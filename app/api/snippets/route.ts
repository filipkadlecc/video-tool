import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

interface Snippet {
  id: string;
  name: string;
  subtitle: string;
  code: string;
}

const META: Record<string, { name: string; subtitle: string }> = {
  IntroCard: { name: "Intro card", subtitle: "Wordmark + headline with highlighted phrase" },
  LowerThird: { name: "Lower third", subtitle: "Name tag with orange accent rule (single or dual)" },
  EndCard: { name: "End card", subtitle: "Outlined CTA pill + QR + promo code" },
  StatCallout: { name: "Stat callout", subtitle: "Big animated number with orange highlight" },
  QuoteCard: { name: "Quote card", subtitle: "Testimonial card with orange quotemark" },
  LogoBumper: { name: "Logo bumper", subtitle: "Apify symbol reveal — opener/closer" },
  CalloutBanner: { name: "Callout banner", subtitle: "Headline strip overlay with highlighted phrase" },
  ListReveal: { name: "List reveal", subtitle: "Checkmark feature list inside a card" },
  CodeSnippet: { name: "Code snippet", subtitle: "Editor card — monochrome orange syntax" },
  SymbolBug: { name: "Symbol bug", subtitle: "Corner watermark — overlay this on footage" },
  PathReveal: { name: "Path reveal", subtitle: "Headline with hand-drawn orange underline" },
  RisingStarsList: { name: "Rising Stars list", subtitle: "Numbered Actor cards + corner wedge" },
  LogoGridStrip: { name: "Logo grid", subtitle: '"Works with" partner-logo strip' },
  FourQuadrant: { name: "Four quadrants", subtitle: "2×2 feature-card grid with partner row" },
  BeforeAfter: { name: "Before / after", subtitle: "Stacked comparison cards" },
  EventCard: { name: "Event card", subtitle: "Event title + date + sponsor logo" },
};

export async function GET() {
  const dir = path.join(process.cwd(), "remotion", "scenes", "branded");
  const files = await fs.readdir(dir);
  const snippets: Snippet[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith(".tsx")) continue;
    const id = file.replace(".tsx", "");
    const meta = META[id];
    if (!meta) continue;
    const code = await fs.readFile(path.join(dir, file), "utf-8");
    snippets.push({ id, name: meta.name, subtitle: meta.subtitle, code });
  }
  return NextResponse.json(snippets);
}
