import fs from "fs";
import path from "path";

// Few-shot snippet sources injected into the system prompt. Read once at module
// init (server-only). The list is deliberately small — full source for IntroCard,
// StatCallout, ListReveal, PathReveal — to anchor the LLM on the style without
// blowing the token budget.

const FEW_SHOT_IDS = ["IntroCard", "StatCallout", "ListReveal", "PathReveal"];

let cached: string | null = null;

export function getSnippetFewShots(): string {
  if (cached !== null) return cached;

  try {
    const dir = path.join(process.cwd(), "remotion", "scenes", "branded");
    const blocks: string[] = [];
    for (const id of FEW_SHOT_IDS) {
      const file = path.join(dir, `${id}.tsx`);
      if (!fs.existsSync(file)) continue;
      const code = fs.readFileSync(file, "utf-8");
      blocks.push(`### ${id} — full source\n\n\`\`\`tsx\n${code}\n\`\`\``);
    }
    cached = blocks.join("\n\n");
  } catch {
    cached = "";
  }
  return cached;
}

// One-liner inventory of all 11 snippets. The LLM uses this to decide which
// patterns to adapt, even when the full source isn't embedded.
export const SNIPPET_INVENTORY = `
- **IntroCard** — Logo + title hero, ELASTIC logo pop, SNAPPY title, GENTLE subtitle. Start most videos here.
- **LowerThird** — Dual name cards with logo + green accent rule. Slides in LIQUID; inner elements pop SNAPPY/ELASTIC.
- **EndCard** — Centered CTA + URL closer with ELASTIC logo + noise-driven breathing.
- **StatCallout** — Big number count-up driven by a LIQUID spring + GENTLE label.
- **QuoteCard** — Pull-quote with ELASTIC quotemark, LIQUID quote body, GENTLE attribution.
- **LogoBumper** — Short Apify symbol reveal with expanding ring (SNAPPY).
- **CalloutBanner** — Top-banner title + subtitle with vertical bar accent. SNAPPY bar/title, GENTLE sub.
- **ListReveal** — Staggered bullet list with ELASTIC dot pops at \`TIMING.staggerItem\` cadence.
- **CodeSnippet** — Editor-style code card with LIQUID card slide and SNAPPY per-line typing.
- **SymbolBug** — Corner watermark using \`<Circle/>\` from \`@remotion/shapes\`. Noise-driven breath.
- **PathReveal** — Title + hand-drawn underline using \`evolvePath()\` from \`@remotion/paths\`.
`.trim();
