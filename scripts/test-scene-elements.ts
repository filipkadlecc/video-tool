/**
 * Unit tests for picking elements inside a scene (lib/scene-elements.ts).
 *
 *   npx tsx scripts/test-scene-elements.ts
 *
 * Runs the tagger over every scene in the library: the tagged copy must still
 * compile, and every tag must trace back to exactly the element it came from.
 */
import fs from "fs";
import path from "path";
import { transform } from "sucrase";
import { tagSceneElements, describeElement, elementLabel, SRC_ATTR } from "../lib/scene-elements";
import { readElementProps, setElementStyle, setElementText, parseTranslate } from "../lib/scene-element-edit";

let pass = 0, fail = 0;
const a = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log("  FAIL: " + m); } };
const head = (t: string) => console.log("\n--- " + t + " ---");
const compile = (c: string) => transform(c, { transforms: ["typescript", "jsx", "imports"], jsxRuntime: "classic", production: true }).code;
const offsets = (tagged: string) => [...tagged.matchAll(new RegExp(`${SRC_ATTR}="(\\d+)"`, "g"))].map((m) => +m[1]);

head("what counts as an element");
const g = `const A = () => { const [n] = useState<number>(0); const s = "<div>"; return <div><span>a</span><b>b</b>{n<2 && <motion.div/>}<Card/><br/><></></div>; };`;
const gt = tagSceneElements(g);
const tags = offsets(gt).map((o) => g.slice(o, o + 5));
a(tags.length === 4, `div, span, b, br are tagged — got ${tags.join(" ")}`);
a(!gt.includes(`useState<number ${SRC_ATTR}`), "a TypeScript generic is not a tag");
a(gt.includes(`"<div>"`), "a string that looks like markup is left alone");
a(!gt.includes(`motion.div ${SRC_ATTR}`) && !gt.includes(`Card ${SRC_ATTR}`), "components and member tags are left alone");
a(tagSceneElements("const x = <<broken") === "const x = <<broken", "code that doesn't parse comes back unchanged");

head("describing an element");
const d = `const A = () => (\n  <div style={{ a: 1 }}>\n    <h1 className="t">Hello  world</h1>\n    <img src="x" />\n  </div>\n);`;
const [divO, h1O, imgO] = offsets(tagSceneElements(d));
const div = describeElement(d, divO)!;
const h1 = describeElement(d, h1O)!;
const img = describeElement(d, imgO)!;
a(div.tag === "div" && div.line === 2 && div.source.endsWith("</div>"), "an element runs from its opening to its matching close");
a(h1.text === "Hello world" && elementLabel(h1) === "Hello world", "its words are what it is called");
a(img.source === `<img src="x" />` && img.text === "", "a self-closing element is just its tag");
a(elementLabel(img) === "<img> · line 4", "a wordless element is named by tag and line");
a(describeElement(d, 3) === null, "an offset that isn't a tag describes nothing");

head("editing an element by hand");
const e = `const A = () => {\n  const o = interpolate(frame, [0, 10], [0, 1]);\n  return (\n    <div style={{ ...base, color: COLORS.text, opacity: o, fontSize: 48 }}>\n      <h1 style={{ color: \`rgba(0,0,0,\${o})\` }}>Ship it</h1>\n      <p>{HERO}</p>\n      <span style={box}>{"Quoted"}</span>\n      <b>plain</b>\n    </div>\n  );\n};`;
const [eDiv, eH1, eP, eSpan, eB] = offsets(tagSceneElements(e));
const pDiv = readElementProps(e, eDiv)!;
a(pDiv.style.color.kind === "editable" && pDiv.style.fontSize.kind === "editable", "a reference and a number literal are editable");
a(pDiv.style.background.kind === "absent" && pDiv.text.kind === "computed", "a missing prop is absent; mixed children are code");
const c1 = setElementStyle(e, eDiv, "color", `"#F86606"`)!;
a(c1.includes(`color: "#F86606", opacity: o`) && c1.includes("COLORS.text") === false, "a reference is replaced by the element's own literal");
const c2 = setElementStyle(e, eDiv, "background", `"#1d1e1f"`)!;
a(c2.includes(`fontSize: 48, background: "#1d1e1f" }}`), "a new prop goes at the end of the object, after the spread");
const pH1 = readElementProps(e, eH1)!;
a(pH1.style.color.kind === "computed" && setElementStyle(e, eH1, "color", `"#fff"`) === null, "an animated value is left alone");
a(pH1.text.kind === "editable" && setElementText(e, eH1, "Launch day")!.includes(">Launch day</h1>"), "plain words are replaced");
a(setElementText(e, eH1, "a {b}")!.includes(`>{"a {b}"}</h1>`), "words that look like code are quoted");
a(readElementProps(e, eP)!.text.kind === "computed" && setElementText(e, eP, "x") === null, "text from a constant is left to the AI");
a(setElementText(e, eSpan, "New")!.includes(`{"New"}`), "a quoted string child stays quoted");
a(setElementStyle(e, eSpan, "color", `"#fff"`)!.includes(`style={{ ...(box), color: "#fff" }}`), "style={expr} is wrapped so the new prop wins");
a(setElementStyle(e, eB, "translate", `"12px -4px"`)!.includes(`<b style={{ translate: "12px -4px" }}>`), "an element with no style gets one");
const c3 = setElementStyle(e, eDiv, "fontSize", "64")!;
a(describeElement(c3, eDiv)?.tag === "div" && describeElement(c3, eDiv)!.source.includes("fontSize: 64"), "the pick's offset still finds the element after an edit");
a(parseTranslate(`"12px -4px"`).join() === "12,-4" && parseTranslate(undefined).join() === "0,0", "translate reads back as x/y");
for (const c of [c1, c2, c3]) { let ok = true; try { compile(c); } catch { ok = false; } a(ok, "an edited scene still compiles"); }

head("every scene in the library");
const dir = path.join(process.cwd(), "remotion", "scenes");
let scenes = 0, elements = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
  const code = fs.readFileSync(path.join(dir, f), "utf8");
  const tagged = tagSceneElements(code);
  let compiles = true;
  try { compile(tagged); } catch { compiles = false; }
  a(compiles, `${f}: the tagged copy still compiles`);
  for (const o of offsets(tagged)) {
    const el = describeElement(code, o);
    a(!!el && el.source === code.slice(o, el.end) && el.source.startsWith(`<${el.tag}`), `${f}: tag at ${o} traces back to its element`);
    elements++;
    // Every edit on every element must leave a scene that compiles.
    for (const [k, v] of [["color", `"#F86606"`], ["fontSize", "40"], ["translate", `"8px 0px"`]] as const) {
      const out = setElementStyle(code, o, k, v);
      if (out === null) continue;
      let ok = true; try { compile(out); } catch { ok = false; }
      a(ok, `${f}: setting ${k} on the tag at ${o} still compiles`);
    }
    const t = readElementProps(code, o)?.text;
    if (t?.kind === "editable") {
      let ok = true; try { compile(setElementText(code, o, "New {words}")!); } catch { ok = false; }
      a(ok, `${f}: replacing the words at ${o} still compiles`);
    }
  }
  scenes++;
}
console.log(`  ${scenes} scenes, ${elements} elements`);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
