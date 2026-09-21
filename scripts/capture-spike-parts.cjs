/**
 * Third capture pass: the brand's own graphic furniture, which the section
 * screenshots flatten into a passing blur -- the category sticker badges and the
 * Google-reviews block -- plus the SALE mascot pulled from the recon assets.
 *   node scripts/capture-spike-parts.cjs
 */
const fs = require("fs");
const path = require("path");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "https://spikeprague.cz/";
const OUT = path.join(__dirname, "..", "public", "assets", "spike");
const RECON = "/private/tmp/claude-501/-Users-filip-video-tool/9f87b67e-87e3-4add-aa80-0312aa9446fd/scratchpad/spike-recon/assets";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 2 },
    args: ["--no-sandbox", "--hide-scrollbars", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(2500);
  await page.evaluate(() => {
    document.querySelectorAll('button, [class*="close"]').forEach((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      if (t.length < 30 && /accept|souhlas|rozum|ok|zav/.test(t)) el.click();
    });
  });
  await sleep(900);
  await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      const r = el.getBoundingClientRect();
      if (r.width >= vw * 0.8 && r.height >= vh * 0.6 &&
          (/overlay|backdrop|modal|popup|drawer|mask/i.test(String(el.className || "")) ||
           (cs.backgroundColor.startsWith("rgba") && parseFloat(cs.backgroundColor.split(",")[3]) > 0.05))) el.remove();
    }
  });
  // lazy images
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 200)); }
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 600));
  });

  const found = await page.evaluate(() => {
    const out = { badges: [], reviews: null };
    const spot = document.querySelector(".sections-spotlight-block");
    if (spot) {
      let items = Array.from(spot.querySelectorAll("a, li, .swiper-slide")).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 90 && r.height > 90 && el.querySelector("img");
      });
      // keep only the outermost of any nested matches
      items = items.filter((el) => !items.some((o) => o !== el && o.contains(el)));
      items.forEach((el, i) => {
        el.setAttribute("data-vt-badge", String(i));
        const r = el.getBoundingClientRect();
        const img = el.querySelector("img");
        out.badges.push({ i, w: Math.round(r.width), h: Math.round(r.height),
          alt: (img && img.getAttribute("alt")) || (el.textContent || "").trim().slice(0, 30) });
      });
    }
    const rev = document.querySelector('[class*="google-review"], [class*="reviews"]');
    if (rev) {
      const card = Array.from(rev.querySelectorAll("*")).find((el) => /^4[,.]\d/.test((el.textContent || "").trim()) && el.getBoundingClientRect().width > 150);
      const target = card ? card.closest("div") : null;
      if (target) { target.setAttribute("data-vt-rev", "1"); const r = target.getBoundingClientRect(); out.reviews = { w: Math.round(r.width), h: Math.round(r.height) }; }
    }
    return out;
  });
  console.log("badges found:", found.badges.length, found.badges.map((b) => b.alt).join(" | "));
  console.log("reviews block:", found.reviews);

  const manifest = { badges: [], reviews: null };
  for (const b of found.badges) {
    const el = await page.$(`[data-vt-badge="${b.i}"]`);
    if (!el) continue;
    const file = `elements/badge-${b.i}.png`;
    await el.screenshot({ path: path.join(OUT, file), omitBackground: true });
    manifest.badges.push({ ...b, file });
  }
  if (found.reviews) {
    const el = await page.$('[data-vt-rev="1"]');
    if (el) { await el.screenshot({ path: path.join(OUT, "elements/reviews.png") }); manifest.reviews = { ...found.reviews, file: "elements/reviews.png" }; }
  }
  const mascot = path.join(RECON, "spike-sale-mascot-3.webp");
  if (fs.existsSync(mascot)) { fs.copyFileSync(mascot, path.join(OUT, "elements/mascot.webp")); manifest.mascot = "elements/mascot.webp"; }
  fs.writeFileSync(path.join(OUT, "parts.json"), JSON.stringify(manifest, null, 2));
  console.log(`wrote ${manifest.badges.length} badges, reviews=${!!manifest.reviews}, mascot=${!!manifest.mascot}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
