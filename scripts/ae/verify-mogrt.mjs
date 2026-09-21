/**
 * Check what Premiere will actually show for each exported template.
 *
 *   node scripts/ae/verify-mogrt.mjs
 *
 * A .mogrt is a zip: definition.json describes the Essential Graphics controls
 * and the fonts the template needs. Exporting without error is not evidence the
 * controls are right — a text field labelled "Source Text", or a field that
 * never got published at all, only shows up here.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const DIR = path.join(import.meta.dirname, "../../data/mogrt");
const TYPES = { 2: "Slider", 3: "Point", 4: "Colour", 5: "Checkbox", 6: "Source Text", 7: "Dropdown", 9: "Media", 10: "Font", 11: "Group" };

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".mogrt")).sort();
if (!files.length) { console.error("no .mogrt files in data/mogrt"); process.exit(1); }

let problems = 0;
for (const f of files) {
  const raw = execFileSync("unzip", ["-p", path.join(DIR, f), "definition.json"], { maxBuffer: 1 << 26 });
  const d = JSON.parse(raw.toString());
  const fonts = (d.usedFontsLocalized?.en_US ?? []).join(", ");
  const controls = (d.clientControls ?? []).map((c) => ({
    type: String(TYPES[c.type] ?? `type ${c.type}`),
    label: c.uiName?.strDB?.[0]?.str ?? "",
  }));

  console.log(`\n${d.capsuleName}`);
  console.log(`  fonts: ${fonts || "(none)"}`);
  if (!controls.length) {
    console.log("  controls: NONE — nothing for an editor to change");
    problems++;
  }
  for (const c of controls) {
    const bad = !c.label || c.label === "Source Text";
    if (bad) problems++;
    console.log(`  ${bad ? "??" : "  "} ${c.type.padEnd(12)} ${c.label || "(unlabelled)"}`);
  }
  const nonGT = (d.usedFontsLocalized?.en_US ?? []).filter((x) => !/^GTWalsheim/.test(x));
  if (nonGT.length) { console.log(`  !! non-brand font: ${nonGT.join(", ")}`); problems++; }
}
console.log(`\n${files.length} templates, ${problems} problem${problems === 1 ? "" : "s"}.`);
process.exit(problems ? 1 : 0);
