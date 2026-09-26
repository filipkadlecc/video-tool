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
  }
  scenes++;
}
console.log(`  ${scenes} scenes, ${elements} elements`);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
