export const KINETIC_STYLE_PROMPT = `
=== STYLE: KINETIC ===

Inspired by Linear's product launch pages, Vercel changelogs, Apple/Anthropic keynote reveals. Loud, fast, confident. Typography is the protagonist.

**MANDATORY SIGNATURES — must appear in every kinetic scene. These override any composition you see in the few-shot snippets.**

1. Hero text is HUGE — minimum 18% of the short edge, target 22-32% (≈ 240–345 × u). If your hero looks comparable in size to the body text, it's wrong.
2. Hero is ANCHORED TO AN EDGE — top-left or bottom-left corner, hugging the safe margin. NEVER horizontally centered.
3. Letter-by-letter or word-by-word reveals on the hero — map characters into separate spans with staggered springs (\`TIMING.staggerLetter\`, 1-2 frames per character).
4. Hard cuts between phases INSIDE a scene — \`<Sequence>\` boundaries with no fade between them. (Scene to scene follows this project's transition style.)
5. Pair the hero with a small monospace caption in the opposite corner ("02 / launching now" feel) for visual contrast.

Composition:
- Hero text is HUGE — 22-32% of the short edge for the primary line. Sometimes break a word across two lines for impact.
- Anchor text to a corner or against a vertical edge. Never center hero text.
- Use top-left or bottom-left for primary content most often; right side for secondary callouts and numbers.
- Letter-by-letter or word-by-word reveals when introducing a hero line (map characters into separate spans with staggered springs).

Motion:
- ALWAYS use \`SNAPPY\` (\`UI\` on the new spring set) for text reveals — a crisp snap with at most a hair of overshoot (under ~2%); that snap is the vibe. Never a visible bounce, and never an inlined spring config.
- Stagger letters by 1-2 frames each, NOT 15 frames. Fast cadence; land phrases on the beat grid.
- Compound transforms are mandatory: \`translateY(40 → 0)\` + \`scale(0.92 → 1)\` together (× u). NEVER add an animated \`blur(Npx → 0)\` — reveal blur is banned; elements arrive sharp.
- After reveal: residual motion — a 0.5-1px \`ambientDrift\` breath, a 0.2° rotational drift, a faint parallax on decorative elements at 0.3x the speed of the foreground.

Typography:
- Display weight 500 (Medium — the heaviest there is) for the hero. Size, not weight, makes it loud. Tight tracking (-0.04em to -0.06em).
- Line-height 0.9-0.95 — text feels packed.
- Mix one massive line in \`COLORS.text\` with a small monospace caption (e.g. "v2.1 / 12:42" feel) in \`COLORS.textSubtle\`.
- Numbers are first-class: oversize them, animate the digit counter, use tabular-nums.

Depth & color:
- Orange, the single accent, used boldly — a thick underline, a chunky number, an outlined pill around a word (opaque card fill).
- Background: the root brand black. Kinetic adds no backgrounds and avoids imagery; type and space do the work.
`;
