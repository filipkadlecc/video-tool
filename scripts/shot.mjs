/**
 * Screenshot a running dev-server page, for checking a rebuilt screen against
 * its handoff PNG at the 1600x1000 design size.
 *
 *   node scripts/shot.mjs <url> <out.png> [width] [height]
 *
 * Reports page errors too — a screen that renders but throws is not done.
 */
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const [url, out, w = "1600", h = "1000"] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <out.png> [w] [h]");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(`console: ${m.text().slice(0, 200)}`);
  });
  await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: out });
  console.log(errs.length ? errs.slice(0, 10).join("\n") : "no page errors");
} finally {
  await browser.close();
}
