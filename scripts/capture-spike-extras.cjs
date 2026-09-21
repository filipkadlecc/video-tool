/**
 * Second capture pass for the pieces the main pass can't get: the sticky header's
 * wordmark and the announcement bar (both are hidden by hideStickyChrome), plus
 * the exact brand yellow.  node scripts/capture-spike-extras.cjs
 */
const fs = require("fs");
const path = require("path");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "https://spikeprague.cz/";
const OUT = path.join(__dirname, "..", "public", "assets", "spike");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 3 },
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

  // A consent/newsletter modal leaves a dimming backdrop behind, and a backdrop
  // over the page darkens everything the screenshot sees -- the first run of this
  // script captured the brand yellow as (79,71,30). Remove anything fixed that
  // covers most of the viewport before capturing.
  const killed = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const gone = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      const r = el.getBoundingClientRect();
      const coversViewport = r.width >= vw * 0.8 && r.height >= vh * 0.6;
      const looksLikeScrim =
        /overlay|backdrop|modal|popup|drawer|dimmer|mask/i.test(String(el.className || "")) ||
        (cs.backgroundColor.startsWith("rgba") && parseFloat(cs.backgroundColor.split(",")[3]) > 0.05);
      if (coversViewport && looksLikeScrim) {
        gone.push(String(el.className || el.tagName).slice(0, 40));
        el.remove();
      }
    }
    return gone;
  });
  console.log("removed scrims:", killed.length ? killed.join(" | ") : "(none)");
  await sleep(400);

  const found = await page.evaluate(() => {
    const header = document.querySelector("#shopify-section-header");
    const cands = [];
    if (header) {
      header.querySelectorAll("img, svg").forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width < 30 || r.height < 10) return;
        cands.push({
          i, tag: el.tagName.toLowerCase(),
          cls: String(el.getAttribute("class") || "").slice(0, 50),
          alt: el.getAttribute("alt") || null,
          w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left),
        });
        el.setAttribute("data-vt-hc", String(i));
      });
    }
    // Announcement bar = the yellow strip above the header
    const bar = document.querySelector('[class*="announcement"], [class*="promo-bar"], [class*="topbar"]');
    if (bar) bar.setAttribute("data-vt-bar", "1");
    const yellow = (() => {
      const probe = bar || document.querySelector('[class*="badge"], [class*="sale"]');
      return probe ? getComputedStyle(probe).backgroundColor : null;
    })();
    return { cands, hasBar: !!bar, yellow };
  });
  console.log("header image candidates:", JSON.stringify(found.cands, null, 1));
  console.log("announcement bar:", found.hasBar, "bg:", found.yellow);

  // The wordmark identifies itself by class/alt; position varies with the layout.
  const logo =
    found.cands.find((c) => /heading-logo|logo/i.test(c.cls) || /^spike$/i.test(c.alt || "")) ||
    found.cands.sort((a, b) => b.w - a.w)[0];
  if (logo) {
    const el = await page.$(`[data-vt-hc="${logo.i}"]`);
    if (el) {
      await el.screenshot({ path: path.join(OUT, "elements", "logo.png"), omitBackground: true });
      console.log(`wrote elements/logo.png  (${logo.w}x${logo.h} css @3x)`);
    }
  }
  if (found.hasBar) {
    const el = await page.$('[data-vt-bar="1"]');
    if (el) { await el.screenshot({ path: path.join(OUT, "elements", "announce.png") }); console.log("wrote elements/announce.png"); }
  }

  // Sample the real brand yellow off a discount badge pixel.
  const swatch = await page.evaluate(() => {
    const out = {};
    const badge = Array.from(document.querySelectorAll("*")).find((el) =>
      /^-\d+\s?%$/.test((el.textContent || "").trim()) && el.children.length === 0);
    if (badge) out.badge = getComputedStyle(badge).backgroundColor || getComputedStyle(badge.parentElement).backgroundColor;
    const btn = document.querySelector('button[type="submit"], [class*="subscribe"]');
    if (btn) out.button = getComputedStyle(btn).backgroundColor;
    return out;
  });
  console.log("swatches:", JSON.stringify(swatch));
  fs.writeFileSync(path.join(OUT, "brand.json"), JSON.stringify({ ...swatch, announcement: found.yellow }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
