/**
 * Editing one element of a generated scene by hand — its words, colour, fill,
 * size and position — without asking the AI.
 *
 * Works on the scene's source, token by token (sucrase's parser), on the one tag
 * a canvas pick points at (lib/scene-elements.ts). The rule that keeps it safe:
 *
 *   - a value written as a plain literal (`"#fff"`, `48`) is replaced;
 *   - a value that is a plain reference (`COLORS.text`) is replaced too — the
 *     element gets its own literal, and nothing else that uses the constant moves;
 *   - a value that is COMPUTED (`interpolate(frame, …)`, a template, maths) is
 *     left alone and reported as such: overwriting it would kill the animation,
 *     and that is a job for the AI, which can see what the maths is for;
 *   - a property that isn't there is added at the END of the style object, after
 *     any spread, so it wins.
 *
 * Every edit lands inside the element's own tag or after it, so the pick's
 * offset (its `<`) stays valid across edits.
 */
import { parse } from "sucrase/dist/esm/parser";
import { TokenType as tt } from "sucrase/dist/esm/parser/tokenizer/types";

interface Token { type: number; start: number; end: number }

export type StyleKey = "color" | "background" | "fontSize" | "translate";

export type ValueState =
  /** Written as a literal or a plain reference — safe to overwrite. */
  | { kind: "editable"; raw: string; start: number; end: number }
  /** Worked out in code (animated, maths, template) — hands off. */
  | { kind: "computed"; raw: string }
  /** Not set on this element; setting it adds it. */
  | { kind: "absent" };

export interface ElementProps {
  tag: string;
  text:
    | { kind: "editable"; value: string; start: number; end: number; quoted: boolean }
    | { kind: "computed" }
    | { kind: "none" };
  style: Record<StyleKey, ValueState>;
}

function tokensOf(code: string): Token[] | null {
  try {
    return parse(code, true, true, false).tokens as unknown as Token[];
  } catch {
    return null;
  }
}

/** Index of the token that closes the bracket opened at `i` (braces/parens/brackets). */
function matching(tokens: Token[], i: number): number {
  const open = tokens[i].type;
  const pairs: Record<number, number> = {
    [tt.braceL]: tt.braceR, [tt.parenL]: tt.parenR, [tt.bracketL]: tt.bracketR,
    [tt.dollarBraceL]: tt.braceR,
  };
  const close = pairs[open];
  let depth = 0;
  for (let j = i; j < tokens.length; j++) {
    const t = tokens[j].type;
    if (t === open || (open === tt.braceL && t === tt.dollarBraceL)) depth++;
    else if (t === close) { depth--; if (depth === 0) return j; }
  }
  return -1;
}

interface Located {
  tokens: Token[];
  start: number;       // jsxTagStart
  nameEnd: number;     // char offset right after the tag name
  openEnd: number;     // token index of the opening tag's jsxTagEnd
  selfClosing: boolean;
  closeStart: number;  // token index of the closing tag's jsxTagStart (-1 if self-closing)
}

function locate(code: string, offset: number): Located | null {
  const tokens = tokensOf(code);
  if (!tokens) return null;
  const start = tokens.findIndex((t) => t.type === tt.jsxTagStart && t.start === offset);
  if (start < 0 || tokens[start + 1]?.type !== tt.jsxName) return null;
  const tagEnd = (from: number) => {
    for (let j = from + 1; j < tokens.length; j++) {
      const t = tokens[j].type;
      if (t === tt.braceL) { j = matching(tokens, j); if (j < 0) return -1; continue; }
      if (t === tt.jsxTagEnd) return j;
    }
    return -1;
  };
  const openEnd = tagEnd(start);
  if (openEnd < 0) return null;
  const selfClosing = tokens[openEnd - 1].type === tt.slash;
  let closeStart = -1;
  if (!selfClosing) {
    let depth = 1;
    for (let j = openEnd + 1; j < tokens.length; j++) {
      const t = tokens[j].type;
      if (t === tt.braceL) { j = matching(tokens, j); if (j < 0) return null; continue; }
      if (t !== tt.jsxTagStart) continue;
      const isClose = tokens[j + 1]?.type === tt.slash;
      const end = tagEnd(j);
      if (end < 0) return null;
      if (isClose) { depth--; if (depth === 0) { closeStart = j; break; } }
      else if (tokens[end - 1].type !== tt.slash) depth++;
      j = end;
    }
    if (closeStart < 0) return null;
  }
  return { tokens, start, nameEnd: tokens[start + 1].end, openEnd, selfClosing, closeStart };
}

/** The `style={…}` attribute of the opening tag: where its container and expression are. */
function styleAttr(code: string, loc: Located) {
  const { tokens } = loc;
  for (let j = loc.start + 2; j < loc.openEnd; j++) {
    const t = tokens[j];
    if (t.type === tt.braceL) { j = matching(tokens, j); continue; } // a spread or another attr's value
    if (t.type !== tt.jsxName || code.slice(t.start, t.end) !== "style") continue;
    if (tokens[j + 1]?.type !== tt.eq || tokens[j + 2]?.type !== tt.braceL) return null;
    const containerL = j + 2;
    const containerR = matching(tokens, containerL);
    const isObject = tokens[containerL + 1]?.type === tt.braceL && matching(tokens, containerL + 1) === containerR - 1;
    return { containerL, containerR, objectL: isObject ? containerL + 1 : -1, objectR: isObject ? containerR - 1 : -1 };
  }
  return null;
}

const PLAIN_REF = new Set<number>([tt.name, tt.dot]);

function classify(code: string, tokens: Token[], from: number, to: number): ValueState {
  // tokens[from..to) is the value
  const raw = code.slice(tokens[from].start, tokens[to - 1].end);
  const span = { raw, start: tokens[from].start, end: tokens[to - 1].end };
  const n = to - from;
  const t0 = tokens[from].type;
  if (n === 1 && (t0 === tt.string || t0 === tt.num)) return { kind: "editable", ...span };
  if (n === 2 && tokens[from].type === tt.minus && tokens[from + 1].type === tt.num) return { kind: "editable", ...span };
  if (tokens.slice(from, to).every((t) => PLAIN_REF.has(t.type)) && t0 === tt.name) return { kind: "editable", ...span };
  return { kind: "computed", raw };
}

function readStyle(code: string, loc: Located): Record<StyleKey, ValueState> {
  const out: Record<StyleKey, ValueState> = {
    color: { kind: "absent" }, background: { kind: "absent" }, fontSize: { kind: "absent" }, translate: { kind: "absent" },
  };
  const attr = styleAttr(code, loc);
  if (!attr) return out;
  if (attr.objectL < 0) {
    // style={someExpression}: we can't see inside, but we can add after it.
    return out;
  }
  const { tokens } = loc;
  let j = attr.objectL + 1;
  while (j < attr.objectR) {
    // One property: [key, colon, value…] up to a top-level comma.
    let end = j;
    while (end < attr.objectR && tokens[end].type !== tt.comma) {
      const t = tokens[end].type;
      if (t === tt.braceL || t === tt.parenL || t === tt.bracketL || t === tt.dollarBraceL) end = matching(tokens, end);
      end++;
    }
    const keyTok = tokens[j];
    if ((keyTok.type === tt.name || keyTok.type === tt.string) && tokens[j + 1]?.type === tt.colon && end > j + 2) {
      const key = code.slice(keyTok.start, keyTok.end).replace(/^['"]|['"]$/g, "");
      const k = (key === "backgroundColor" ? "background" : key) as StyleKey;
      if (k in out) out[k] = classify(code, tokens, j + 2, end);
    }
    j = end + 1;
  }
  return out;
}

function readText(code: string, loc: Located): ElementProps["text"] {
  if (loc.selfClosing) return { kind: "none" };
  const { tokens } = loc;
  const kids = tokens.slice(loc.openEnd + 1, loc.closeStart);
  if (!kids.length) return { kind: "none" };
  const bodyStart = tokens[loc.openEnd].end;
  const bodyEnd = tokens[loc.closeStart].start;
  // Only words, written straight into the tag.
  if (kids.every((t) => t.type === tt.jsxText)) {
    const body = code.slice(bodyStart, bodyEnd);
    const lead = body.length - body.trimStart().length;
    const value = body.trim();
    if (!value) return { kind: "none" };
    return { kind: "editable", value: value.replace(/\s+/g, " "), start: bodyStart + lead, end: bodyStart + lead + value.length, quoted: false };
  }
  // Or one string in braces: {"Hello"}.
  const sig = kids.filter((t) => !(t.type === tt.jsxText && !code.slice(t.start, t.end).trim()));
  if (sig.length === 3 && sig[0].type === tt.braceL && sig[1].type === tt.string && sig[2].type === tt.braceR) {
    const s = sig[1];
    let value: string;
    try { value = JSON.parse(code.slice(s.start, s.end).replace(/^'|'$/g, '"')); } catch { return { kind: "computed" }; }
    return { kind: "editable", value, start: s.start, end: s.end, quoted: true };
  }
  return { kind: "computed" };
}

/** What can be edited on the element at `offset`, and how each value is written. */
export function readElementProps(code: string, offset: number): ElementProps | null {
  const loc = locate(code, offset);
  if (!loc) return null;
  return {
    tag: code.slice(loc.tokens[loc.start + 1].start, loc.nameEnd),
    text: readText(code, loc),
    style: readStyle(code, loc),
  };
}

/**
 * Set one style property to `valueSource` (JS source, e.g. `"#F86606"` or `48`).
 * Returns the new code, or null when the value is computed and must be left to
 * the AI (or the element can't be found).
 */
export function setElementStyle(code: string, offset: number, key: StyleKey, valueSource: string): string | null {
  const loc = locate(code, offset);
  if (!loc) return null;
  const current = readStyle(code, loc)[key];
  if (current.kind === "computed") return null;
  if (current.kind === "editable") return code.slice(0, current.start) + valueSource + code.slice(current.end);

  const attr = styleAttr(code, loc);
  const prop = `${key}: ${valueSource}`;
  if (!attr) {
    return `${code.slice(0, loc.nameEnd)} style={{ ${prop} }}${code.slice(loc.nameEnd)}`;
  }
  const { tokens } = loc;
  if (attr.objectL < 0) {
    // style={expr} → style={{ ...(expr), key: value }}
    const exprStart = tokens[attr.containerL].end;
    const exprEnd = tokens[attr.containerR].start;
    return `${code.slice(0, exprStart)}{ ...(${code.slice(exprStart, exprEnd).trim()}), ${prop} }${code.slice(exprEnd)}`;
  }
  // Add at the end of the object, after any spread, so it wins.
  const close = tokens[attr.objectR];
  const last = tokens[attr.objectR - 1];
  if (attr.objectR - 1 === attr.objectL) {
    return `${code.slice(0, close.start)} ${prop} ${code.slice(close.start)}`;
  }
  const sep = last.type === tt.comma ? " " : ", ";
  return `${code.slice(0, last.end)}${sep}${prop}${code.slice(last.end)}`;
}

/** Replace the element's words. Null when its text is worked out in code. */
export function setElementText(code: string, offset: number, text: string): string | null {
  const loc = locate(code, offset);
  if (!loc) return null;
  const current = readText(code, loc);
  if (current.kind !== "editable") return null;
  const needsQuoting = current.quoted || /[{}<>]/.test(text) || text !== text.trim();
  const written = needsQuoting ? (current.quoted ? JSON.stringify(text) : `{${JSON.stringify(text)}}`) : text;
  return code.slice(0, current.start) + written + code.slice(current.end);
}

/** `"12px 0px"` / `"12px"` → [12, 0]. */
export function parseTranslate(raw: string | undefined): [number, number] {
  const m = (raw ?? "").replace(/^['"`]|['"`]$/g, "").trim().split(/\s+/);
  const n = (s?: string) => (s ? parseFloat(s) || 0 : 0);
  return [n(m[0]), n(m[1])];
}
