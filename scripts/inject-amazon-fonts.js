// Reads remotion/scenes/AmazonChat.tsx (with __*_B64__ placeholders) and writes
// remotion/scenes/AmazonChat.built.tsx with fonts + logo embedded as base64.
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const inter = fs.readFileSync(path.join(root, "public/fonts/Inter-Variable.woff2")).toString("base64");
const mono = fs.readFileSync(path.join(root, "public/fonts/RobotoMono-Variable.woff2")).toString("base64");
const logo = fs.readFileSync(path.join(root, "public/assets/apify/Apify symbol colors.svg")).toString("base64");
const wordmark = fs.readFileSync(path.join(root, "public/assets/apify/Apify Logo white Wordmark.svg")).toString("base64");
let src = fs.readFileSync(path.join(root, "remotion/scenes/AmazonChat.tsx"), "utf8");
src = src
  .replace("__INTER_B64__", inter)
  .replace("__MONO_B64__", mono)
  .replace("__LOGO_B64__", logo)
  .replace("__WORDMARK_B64__", wordmark);
fs.writeFileSync(path.join(root, "remotion/scenes/AmazonChat.built.tsx"), src);
console.log("wrote AmazonChat.built.tsx", src.length, "bytes");
