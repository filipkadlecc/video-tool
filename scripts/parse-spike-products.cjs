/**
 * Read real product name / price / discount for every captured card, straight
 * from the DOM. Replaces an earlier version that parsed card innerText -- the
 * capture truncates that to 70 chars, which silently ate the price off every
 * long product name.
 *
 * Card indices MUST match the image files written by capture-spike.cjs, so the
 * section and card selection below mirrors it exactly.
 *   node scripts/parse-spike-products.cjs
 */
const fs = require("fs");
const path = require("path");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "https://spikeprague.cz/";
const DIR = path.join(__dirname, "..", "public", "assets", "spike");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--hide-scrollbars"],
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
  await sleep(800);
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 180)); }
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 500));
  });

  const rows = await page.evaluate((cardSel) => {
    const money = (s) => { const m = (s || "").match(/[\d\s.,]+/); return m ? "€" + m[0].replace(/\s/g, "").trim() : null; };
    const out = [];
    let si = -1;
    document.querySelectorAll(".shopify-section").forEach((sec) => {
      if (sec.getBoundingClientRect().height < 60) return;
      si++;
      const cards = Array.from(sec.querySelectorAll(cardSel)).filter((c) => {
        const r = c.getBoundingClientRect();
        return r.width > 80 && r.height > 80;
      });
      cards.forEach((c, ci) => {
        const titleEl = c.querySelector('[class*="product-item__title"], [class*="card__heading"], [class*="title"] a, a[class*="title"]') ||
                        Array.from(c.querySelectorAll("a")).find((a) => (a.textContent || "").trim().length > 8);
        const name = titleEl ? (titleEl.textContent || "").replace(/\s+/g, " ").trim() : null;
        const priceBox = c.querySelector('[class*="price"]');
        // Read the price box as TEXT and pull currency amounts with a strict
        // pattern. Trusting [class*="sale"] / [class*="compare"] sub-elements
        // produced "\u20ac" with no number -- the theme has empty label spans in there.
        const raw = priceBox ? (priceBox.textContent || "").replace(/\s+/g, " ").trim() : "";
        const amounts = [...raw.matchAll(/\u20ac\s?([\d.,]+)/g)].map((m) => "\u20ac" + m[1].replace(/,$|\.$/, ""));
        let was = null, now = null;
        if (amounts.length >= 2) { was = amounts[0]; now = amounts[amounts.length - 1]; }
        else if (amounts.length === 1) { now = amounts[0]; }
        const badgeTxt = (c.querySelector('[class*="badge"], [class*="label"]') || {}).textContent || "";
        const disc = (badgeTxt.match(/-\s?(\d+)\s?%/) || [])[1];
        out.push({
          id: `${si}-${ci}`, name, was: was === now ? null : was, price: now, raw,
          discount: disc ? `-${disc}%` : null, isNew: /NEW/i.test(badgeTxt),
        });
      });
    });
    return out;
  }, "[class*=product-item]");

  const els = JSON.parse(fs.readFileSync(path.join(DIR, "elements.json"), "utf8"));
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const products = [];
  for (const sec of els) {
    for (const c of sec.cards) {
      const r = byId[c.id];
      if (!r || !r.name) continue;
      products.push({ id: c.id, section: sec.slug, file: c.file, w: c.width, h: c.height,
                      name: r.name, price: r.price, was: r.was, discount: r.discount, isNew: r.isNew });
    }
  }
  fs.writeFileSync(path.join(DIR, "products.json"), JSON.stringify(products, null, 2));
  console.log(`${products.length}/${els.reduce((n, s) => n + s.cards.length, 0)} cards resolved`);
  console.log(`  ${products.filter((p) => p.price).length} priced, ${products.filter((p) => p.discount).length} discounted, ${products.filter((p) => p.isNew).length} new`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
