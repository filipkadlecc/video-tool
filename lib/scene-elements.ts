/**
 * Elements inside a generated scene: how a thing you click in the preview is
 * traced back to the exact tag in the scene's code.
 *
 * Before a scene is compiled for the preview, every plain DOM tag in it
 * (`<div>`, `<span>`, `<svg>`, `<path>`…) gets a `data-vt-src` attribute holding
 * the character offset of its `<` in the ORIGINAL code. Offsets are unique and
 * never drift, so a click resolves to one precise place — two tags on the same
 * line stay distinct, which line numbers alone can't do.
 *
 * Nothing here changes the stored code; the tag is added only to the copy that
 * gets compiled. It works on every scene ever written, with no cooperation from
 * whoever (or whatever) wrote it.
 *
 * Uses sucrase's own parser, not a regex: `useState<number>` and "<div>" inside
 * a string are not tags, and only a real parser knows that.
 */
import { parse } from "sucrase/dist/esm/parser";
import { TokenType as tt } from "sucrase/dist/esm/parser/tokenizer/types";

export const SRC_ATTR = "data-vt-src";
/** Put on each scene item's wrapper in the editor composition, to scope a pick. */
export const ITEM_ATTR = "data-vt-item";

interface Token { type: number; start: number; end: number }

function tokensOf(code: string): Token[] | null {
  try {
    return parse(code, true, true, false).tokens as unknown as Token[];
  } catch {
    return null; // a scene that doesn't parse won't compile either — leave it be
  }
}

/** An opening tag for a plain DOM element: `<div`, not `<Card`, `</div` or `<motion.div`. */
function isIntrinsicOpen(code: string, tokens: Token[], i: number): boolean {
  if (tokens[i].type !== tt.jsxTagStart) return false;
  const name = tokens[i + 1];
  if (!name || name.type !== tt.jsxName) return false;
  if (!/^[a-z]/.test(code.slice(name.start, name.end))) return false;
  // `<motion.div` / `<svg:path` are member / namespaced names — leave them.
  const next = tokens[i + 2];
  if (next && (next.type === tt.dot || next.type === tt.colon)) return false;
  return true;
}

/** The scene code with every plain DOM tag stamped with its own offset. */
export function tagSceneElements(code: string): string {
  const tokens = tokensOf(code);
  if (!tokens) return code;
  const inserts: { at: number; text: string }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isIntrinsicOpen(code, tokens, i)) continue;
    inserts.push({ at: tokens[i + 1].end, text: ` ${SRC_ATTR}="${tokens[i].start}"` });
  }
  if (!inserts.length) return code;
  let out = "";
  let last = 0;
  for (const ins of inserts) {
    out += code.slice(last, ins.at) + ins.text;
    last = ins.at;
  }
  return out + code.slice(last);
}

export interface SceneElement {
  /** Offset of the element's `<` in the code — the id a pick carries. */
  offset: number;
  /** 1-based line of the opening tag. */
  line: number;
  tag: string;
  /** The opening tag as written, e.g. `<div style={{ … }}>`. */
  openTag: string;
  /** The whole element, opening tag to closing tag. */
  source: string;
  /** Where `source` ends in the code (exclusive). */
  end: number;
  /** Literal text written directly inside it, if any — what a person would call its words. */
  text: string;
}

/** Find the element whose `<` is at `offset`, and its full extent. */
export function describeElement(code: string, offset: number): SceneElement | null {
  const tokens = tokensOf(code);
  if (!tokens) return null;
  const start = tokens.findIndex((t) => t.type === tt.jsxTagStart && t.start === offset);
  if (start < 0 || !isIntrinsicOpen(code, tokens, start)) return null;

  const tagEndOf = (from: number) => {
    // The `>` that closes this tag. Braces inside attributes hold their own
    // tokens, but never a bare jsxTagEnd at this level before ours.
    let depth = 0;
    for (let j = from + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === tt.braceL || t.type === tt.dollarBraceL) depth++;
      else if (t.type === tt.braceR) depth--;
      else if (depth === 0 && t.type === tt.jsxTagEnd) return j;
    }
    return -1;
  };

  const openEnd = tagEndOf(start);
  if (openEnd < 0) return null;
  const selfClosing = tokens[openEnd - 1]?.type === tt.slash;
  const tag = code.slice(tokens[start + 1].start, tokens[start + 1].end);
  const openTag = code.slice(offset, tokens[openEnd].end);
  const line = code.slice(0, offset).split("\n").length;

  if (selfClosing) {
    return { offset, line, tag, openTag, source: openTag, end: tokens[openEnd].end, text: "" };
  }

  // Walk to the matching close, counting nested opens and closes of any tag.
  let depth = 1;
  let text = "";
  for (let j = openEnd + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.type === tt.jsxText && depth === 1) text += code.slice(t.start, t.end);
    if (t.type !== tt.jsxTagStart) continue;
    const isClose = tokens[j + 1]?.type === tt.slash;
    const end = tagEndOf(j);
    if (end < 0) return null;
    if (isClose) {
      depth--;
      if (depth === 0) {
        const stop = tokens[end].end;
        return {
          offset, line, tag, openTag,
          source: code.slice(offset, stop),
          end: stop,
          text: text.replace(/\s+/g, " ").trim(),
        };
      }
    } else if (tokens[end - 1]?.type !== tt.slash) {
      depth++;
    }
    j = end;
  }
  return null;
}

/** What to call an element in a chip: its words if it has any, else its tag and line. */
export function elementLabel(el: Pick<SceneElement, "text" | "tag" | "line">): string {
  if (el.text) return el.text.length > 28 ? `${el.text.slice(0, 27)}…` : el.text;
  return `<${el.tag}> · line ${el.line}`;
}

/**
 * The element as the scene writer should see it: where it is, and exactly what
 * it looks like, so the patch can target that tag and nothing else.
 */
export function elementBrief(el: SceneElement): string {
  const MAX = 2400;
  const src = el.source.length > MAX ? `${el.source.slice(0, MAX)}\n… (element continues)` : el.source;
  return `=== THE SELECTED ELEMENT (line ${el.line}) ===\n${src}\n=== END SELECTED ELEMENT ===`;
}

/**
 * An element picked on the canvas. `index` tells apart the copies a `.map()`
 * renders from one tag — they share an offset, and the outline must follow the
 * one that was clicked.
 */
export interface ElementPick {
  itemId: string;
  offset: number;
  index: number;
}

/** The rendered node for a pick, looked up fresh (the Player re-renders every frame). */
export function findPickedNode(pick: ElementPick, root: ParentNode = document): HTMLElement | null {
  const nodes = root.querySelectorAll<HTMLElement>(
    `[${ITEM_ATTR}="${CSS.escape(pick.itemId)}"] [${SRC_ATTR}="${pick.offset}"]`,
  );
  return nodes[pick.index] ?? nodes[0] ?? null;
}

/** Turn a rendered node into a pick, or null if it isn't inside a scene item. */
export function pickFromNode(node: Element | null): ElementPick | null {
  const el = node?.closest<HTMLElement>(`[${SRC_ATTR}]`);
  const item = el?.closest<HTMLElement>(`[${ITEM_ATTR}]`);
  if (!el || !item) return null;
  const itemId = item.getAttribute(ITEM_ATTR)!;
  const offset = Number(el.getAttribute(SRC_ATTR));
  const same = item.querySelectorAll(`[${SRC_ATTR}="${offset}"]`);
  return { itemId, offset, index: Math.max(0, Array.prototype.indexOf.call(same, el)) };
}
