// Builds a self-contained scene per use case from _chat.template.tsx, and
// generates remotion/_gifbatch.tsx registering 16:9 + 1:1 compositions.
const fs = require("fs");
const path = require("path");
const { specs } = require("./chat-content.cjs");

const root = process.cwd();
const inter = fs.readFileSync(path.join(root, "public/fonts/Inter-Variable.woff2")).toString("base64");
const mono = fs.readFileSync(path.join(root, "public/fonts/RobotoMono-Variable.woff2")).toString("base64");
const logo = fs.readFileSync(path.join(root, "public/assets/apify/Apify symbol colors.svg")).toString("base64");
const wordmark = fs.readFileSync(path.join(root, "public/assets/apify/Apify Logo white Wordmark.svg")).toString("base64");
const template = fs.readFileSync(path.join(root, "remotion/scenes/_chat.template.tsx"), "utf8");

const genDir = path.join(root, "remotion/scenes/gen");
fs.mkdirSync(genDir, { recursive: true });

// replacement via function => no special $-handling in the replacement text
const rep = (src, token, value) => src.replace(token, () => value);

const built = {};
for (const spec of specs) {
  const content = JSON.stringify({ bubble: spec.bubble, blocks: spec.blocks, ...(spec.noOutro ? { noOutro: true } : {}) });
  let out = template;
  out = rep(out, "__CONTENT__", content);
  out = rep(out, "__INTER_B64__", inter);
  out = rep(out, "__MONO_B64__", mono);
  out = rep(out, "__LOGO_B64__", logo);
  out = rep(out, "__WORDMARK_B64__", wordmark);
  const file = path.join(genDir, `${spec.slug}.built.tsx`);
  fs.writeFileSync(file, out);
  built[spec.slug] = out;
  console.log("built", spec.slug, out.length, "bytes");
}

// generate the batch render entry
const ident = (s) => "S_" + s.replace(/[^a-zA-Z0-9]/g, "_");
const imports = specs.map((s) => `import ${ident(s.slug)} from "./scenes/gen/${s.slug}.built";`).join("\n");
const comps = specs
  .map(
    (s) => `      <Composition id="${s.slug}" component={${ident(s.slug)}} durationInFrames={375} fps={25} width={1920} height={1080} />
      <Composition id="${s.slug}-sq" component={${ident(s.slug)}} durationInFrames={375} fps={25} width={1080} height={1080} />`
  )
  .join("\n");
const batch = `import { registerRoot, Composition } from "remotion";
import React from "react";
${imports}

const Root: React.FC = () => (
  <>
${comps}
  </>
);
registerRoot(Root);
`;
fs.writeFileSync(path.join(root, "remotion/_gifbatch.tsx"), batch);
console.log("wrote remotion/_gifbatch.tsx with", specs.length, "x2 compositions");

// manifest for project creation / rendering
fs.writeFileSync(
  path.join(genDir, "manifest.json"),
  JSON.stringify(specs.map((s) => ({ slug: s.slug, name: s.name, bubble: s.bubble })), null, 2)
);
