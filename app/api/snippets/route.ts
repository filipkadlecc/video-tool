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
  IntroCard: { name: "Intro card", subtitle: "Logo + title hero — start your video" },
  LowerThird: { name: "Lower third", subtitle: "Dual-card name + Apify wordmark + green accent" },
  EndCard: { name: "End card", subtitle: "Logo + CTA + URL closer" },
  StatCallout: { name: "Stat callout", subtitle: "Big animated number reveal" },
  QuoteCard: { name: "Quote card", subtitle: "Pull quote with attribution" },
  LogoBumper: { name: "Logo bumper", subtitle: "Short Apify symbol reveal — opener/closer" },
  CalloutBanner: { name: "Callout banner", subtitle: "Top banner with title + subtitle" },
  ListReveal: { name: "List reveal", subtitle: "Staggered bullet list — feature highlights" },
  CodeSnippet: { name: "Code snippet", subtitle: "Syntax-highlighted code card with line reveals" },
  SymbolBug: { name: "Symbol bug", subtitle: "Corner watermark — overlay this on footage" },
  PathReveal: { name: "Path reveal", subtitle: "Animated SVG path — title with hand-drawn underline" },
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
