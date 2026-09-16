/**
 * Stack a handoff design screenshot above the same screen as it currently
 * renders, so the two can be compared in one image.
 *
 *   node scripts/compare.mjs <screen-id> <url> [out.png]
 *
 * e.g. node scripts/compare.mjs 4e-export http://localhost:3000/project/<id>
 *
 * This exists because "it rendered without errors" is not evidence that a
 * screen matches its design, and treating it as evidence is how a redesign gets
 * reported as finished while half of it is missing.
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = process.env.CHROME_PATH
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const HANDOFF = process.env.HANDOFF_DIR
  || "/private/tmp/claude-501/-Users-filip-video-tool/b8aa1928-9dfa-4e7e-9138-3c715cee2775/scratchpad/design/design_handoff_video_tool/screenshots";

const [screen, url, outArg] = process.argv.slice(2);
if (!screen || !url) {
  console.error("usage: node scripts/compare.mjs <screen-id> <url> [out.png]");
  console.error("screens:", fs.existsSync(HANDOFF)
    ? fs.readdirSync(HANDOFF).map((f) => f.replace(/\.png$/, "")).join(", ")
    : "(handoff dir not found)");
  process.exit(1);
}

const design = path.join(HANDOFF, `${screen}.png`);
if (!fs.existsSync(design)) {
  console.error(`no handoff screenshot named ${screen}.png in ${HANDOFF}`);
  process.exit(1);
}
const out = outArg ?? `/tmp/compare-${screen}.png`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
try {
  // 1. the app as it stands
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1800));
  const mineBuf = await page.screenshot();

  // 2. stacked, labelled, in one image
  const b64 = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
  const label = "padding:6px 12px;font:600 12px system-ui;color:#838688;background:#0A0A0B";
  const composite = await browser.newPage();
  await composite.setViewport({ width: 1600, height: 2200 });
  await composite.setContent(`<body style="margin:0;background:#0A0A0B">
    <div style="${label}">HANDOFF — ${screen}</div>
    <img src="${b64(fs.readFileSync(design))}" style="width:1600px;display:block">
    <div style="${label}">CURRENT — ${screen}</div>
    <img src="${b64(mineBuf)}" style="width:1600px;display:block">
  </body>`);
  await new Promise((r) => setTimeout(r, 400));
  await composite.screenshot({ path: out, fullPage: true });

  console.log(`wrote ${out}`);
  console.log(errs.length ? errs.slice(0, 5).join("\n") : "no page errors");
} finally {
  await browser.close();
}
