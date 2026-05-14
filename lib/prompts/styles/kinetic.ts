export const KINETIC_STYLE_PROMPT = `
=== STYLE: KINETIC ===

Inspired by Linear's product launch pages, Vercel changelogs, Apple/Anthropic keynote reveals. Loud, fast, confident. Typography is the protagonist.

Composition:
- Hero text is HUGE — 22-32% of canvas height for the primary line. Sometimes break a word across two lines for impact.
- Anchor text to a corner or against a vertical edge. Never center hero text.
- Use top-left or bottom-left for primary content most often; right side for secondary callouts and numbers.
- Letter-by-letter or word-by-word reveals when introducing a hero line (map characters into separate spans with staggered springs).

Motion:
- ALWAYS use SNAPPY springs for text reveals (mass: 0.5, damping: 14, stiffness: 220). They MUST overshoot slightly — that snap is the entire vibe.
- Stagger letters by 1-2 frames each, NOT 15 frames. Fast cadence.
- Compound transforms are mandatory: \`translateY(40 → 0)\` + \`scale(0.92 → 1)\` + \`blur(8px → 0)\` together.
- After reveal: residual motion — a 0.5-1px breath, a 0.2° rotational drift, a faint vertical parallax on background elements at 0.3x speed of foreground.
- Hard cuts between phases (sub-scenes) — use \`<Sequence>\` boundaries with no fade, just a snap.

Typography:
- Display weight 800 or 900 for the hero. Tight tracking (-0.04em to -0.06em).
- Line-height 0.9-0.95 — text feels packed.
- Mix one massive line in white with a small monospace caption (e.g. "v2.1 / 12:42" feel) in rgba(255,255,255,0.5).
- Numbers are first-class: oversize them, animate the digit counter, use tabular-nums.

Depth & color:
- Single accent color used boldly — a full pill behind a word, a thick underline, a chunky number.
- Backgrounds: deep flat color OR a subtle radial gradient. Avoid imagery.
- A soft \`mix-blend-mode: screen\` glow behind the hero text in the accent color (filter: blur(40-80px), opacity 0.5).
`;
