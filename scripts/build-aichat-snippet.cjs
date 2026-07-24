// Embeds fonts + logos into scripts/aichat-template.tsx and writes the branded
// snippet remotion/scenes/branded/AiChat.tsx.
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const inter = fs.readFileSync(path.join(root, "public/fonts/Inter-Variable.woff2")).toString("base64");
const mono = fs.readFileSync(path.join(root, "public/fonts/RobotoMono-Variable.woff2")).toString("base64");
const logo = fs.readFileSync(path.join(root, "public/assets/apify/Apify symbol colors.svg")).toString("base64");
const wordmark = fs.readFileSync(path.join(root, "public/assets/apify/Apify Logo white Wordmark.svg")).toString("base64");
let src = fs.readFileSync(path.join(root, "scripts/aichat-template.tsx"), "utf8");
const rep = (s, tok, val) => s.replace(tok, () => val);
src = rep(src, "__INTER_B64__", inter);
src = rep(src, "__MONO_B64__", mono);
src = rep(src, "__LOGO_B64__", logo);
src = rep(src, "__WORDMARK_B64__", wordmark);
fs.writeFileSync(path.join(root, "remotion/scenes/branded/AiChat.tsx"), src);
console.log("wrote remotion/scenes/branded/AiChat.tsx", src.length, "bytes");
