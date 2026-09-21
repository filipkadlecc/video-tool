/**
 * Capture spikeprague.cz as layered images for the Remotion site-tour scene.
 *
 *   node scripts/capture-spike.cjs --probe            # inventory the page structure
 *   node scripts/capture-spike.cjs --width 1080       # produce the real captures
 *
 * Output (capture mode) lands in public/assets/spike/:
 *   sections/NN-slug.png + sections.json   one image per page section
 *   elements/<id>.png    + elements.json   individual cards, boxes relative to their section
 *   page.json                              viewport, dpr, total height, palette
 */
const fs = require("fs");
const path = require("path");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "https://spikeprague.cz/";
const OUT = path.join(__dirname, "..", "public", "assets", "spike");

const argv = process.argv.slice(2);
const PROBE = argv.includes("--probe");
const WIDTH = Number((argv[argv.indexOf("--width") + 1] || 1080)) || 1080;
const DPR = Number((argv[argv.indexOf("--dpr") + 1] || 2)) || 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click through consent / newsletter / promo layers that sit over the page. */
async function dismissOverlays(page) {
  const clicked = await page.evaluate(() => {
    const hits = [];
    const wanted = [
      "accept", "souhlas", "rozumim", "rozumím", "prijmout", "přijmout", "povolit",
      "agree", "got it", "ok",
    ];
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    for (const el of document.querySelectorAll('button, a[role="button"], [class*="accept"], [id*="accept"]')) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || "").trim().toLowerCase();
      if (t.length < 40 && wanted.some((w) => t.includes(w))) {
        el.click();
        hits.push(t);
      }
    }
    // Close buttons on modals / newsletter popups
    for (const el of document.querySelectorAll('[class*="modal"] [class*="close"], [class*="popup"] [class*="close"], button[aria-label*="Close" i], button[aria-label*="Zav" i]')) {
      if (isVisible(el)) { el.click(); hits.push("close"); }
    }
    return hits;
  });
  if (clicked.length) await sleep(600);
  return clicked;
}

/** Scroll the whole page so lazy-loaded product images actually decode, then return to the top. */
async function primeLazyLoading(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
  });
  // Wait for every <img> that has a src to finish decoding.
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter((i) => i.src && !i.complete);
    await Promise.all(imgs.map((i) => new Promise((res) => {
      i.addEventListener("load", res, { once: true });
      i.addEventListener("error", res, { once: true });
      setTimeout(res, 3000);
    })));
  });
}

/** Sticky/fixed chrome would otherwise be burned into every section shot. */
async function hideStickyChrome(page) {
  return page.evaluate(() => {
    const hidden = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 20) continue;
      el.setAttribute("data-vt-hidden", "1");
      el.style.setProperty("visibility", "hidden", "important");
      hidden.push(el.tagName.toLowerCase() + "." + String(el.className || "").split(" ")[0]);
    }
    return hidden;
  });
}

async function main() {
  // puppeteer-core v25 is ESM-only; a .cjs script has to reach it this way.
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: WIDTH, height: 1350, deviceScaleFactor: DPR },
    args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=" + DPR, "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
  );
  console.log(`→ ${URL}  viewport ${WIDTH}px @${DPR}x`);
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(2500);

  const dismissed = await dismissOverlays(page);
  console.log("dismissed overlays:", dismissed.length ? dismissed.join(", ") : "(none found)");

  await primeLazyLoading(page);
  const hidden = await hideStickyChrome(page);
  console.log("hid sticky/fixed elements:", hidden.length);

  if (PROBE) {
    const report = await page.evaluate(() => {
      const pick = (sel) => Array.from(document.querySelectorAll(sel));
      let sections = pick(".shopify-section");
      if (!sections.length) sections = pick("main > section, main > div");
      const text = (el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 90);
      return {
        totalHeight: document.body.scrollHeight,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        sectionSelector: document.querySelectorAll(".shopify-section").length ? ".shopify-section" : "main > section|div",
        sections: sections.map((el, i) => {
          const r = el.getBoundingClientRect();
          return {
            i,
            id: el.id || null,
            cls: String(el.className || "").split(" ").slice(0, 3).join(" "),
            y: Math.round(r.top + window.scrollY),
            h: Math.round(r.height),
            text: text(el),
          };
        }).filter((s) => s.h > 60),
        cardCandidates: ["[class*=card]", ".grid__item", "[class*=product-item]", "li[class*=grid]"].map((sel) => ({
          sel,
          n: document.querySelectorAll(sel).length,
        })),
      };
    });
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    return;
  }

  // ---- Real capture -------------------------------------------------------
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "sections"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "elements"), { recursive: true });

  // The header is sticky, so grab it before hideStickyChrome() takes it away.
  await page.evaluate(() => {
    const h = document.querySelector("#shopify-section-header");
    if (h) h.setAttribute("data-vt-header", "1");
  });
  const headerEl = await page.$("#shopify-section-header");
  if (headerEl) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleepIn(page, 200);
    await headerEl.screenshot({ path: path.join(OUT, "elements", "header.png") });
    console.log("captured header");
  }

  const hidden2 = await hideStickyChrome(page);
  console.log("hid sticky/fixed elements:", hidden2.length);

  const meta = await page.evaluate((cardSel) => {
    const slugify = (t) =>
      (t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);
    const out = [];
    document.querySelectorAll(".shopify-section").forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const h = Math.round(r.height);
      if (h < 60) return;
      const heading = el.querySelector("h1, h2, h3");
      const slug =
        slugify(heading && heading.textContent) ||
        slugify((el.className || "").replace("shopify-section", "")) ||
        "section-" + i;
      el.setAttribute("data-vt-section", String(out.length));
      const cards = Array.from(el.querySelectorAll(cardSel)).filter((c) => {
        const cr = c.getBoundingClientRect();
        return cr.width > 80 && cr.height > 80;
      });
      cards.forEach((c, ci) => c.setAttribute("data-vt-card", out.length + "-" + ci));
      out.push({
        index: out.length,
        domIndex: i,
        id: el.id || null,
        slug,
        y: Math.round(r.top + window.scrollY),
        width: Math.round(r.width),
        height: h,
        heading: heading ? heading.textContent.trim().slice(0, 60) : null,
        isProductBlock: /sections-product-block/.test(el.className || ""),
        cards: cards.map((c, ci) => {
          const cr = c.getBoundingClientRect();
          return {
            id: out.length + "-" + ci,
            x: Math.round(cr.left),
            y: Math.round(cr.top + window.scrollY - (r.top + window.scrollY)),
            width: Math.round(cr.width),
            height: Math.round(cr.height),
            title: (c.innerText || "").replace(/\s+/g, " ").trim().slice(0, 70),
          };
        }),
      });
    });
    return out;
  }, "[class*=product-item]");

  console.log(`sections: ${meta.length}`);

  for (const s of meta) {
    const el = await page.$(`[data-vt-section="${s.index}"]`);
    if (!el) continue;
    const name = String(s.index).padStart(2, "0") + "-" + s.slug;
    s.file = `sections/${name}.png`;
    await el.screenshot({ path: path.join(OUT, s.file) });

    // Product blocks get a second pass with the cards hidden, so the cards can
    // be animated back in over an empty shell.
    if (s.isProductBlock && s.cards.length) {
      await page.evaluate((idx) => {
        document
          .querySelectorAll(`[data-vt-section="${idx}"] [data-vt-card]`)
          .forEach((c) => c.style.setProperty("visibility", "hidden", "important"));
      }, s.index);
      s.emptyFile = `sections/${name}--empty.png`;
      await el.screenshot({ path: path.join(OUT, s.emptyFile) });
      await page.evaluate((idx) => {
        document
          .querySelectorAll(`[data-vt-section="${idx}"] [data-vt-card]`)
          .forEach((c) => c.style.removeProperty("visibility"));
      }, s.index);

      for (const card of s.cards) {
        const ce = await page.$(`[data-vt-card="${card.id}"]`);
        if (!ce) continue;
        card.file = `elements/card-${card.id}.png`;
        await ce.screenshot({ path: path.join(OUT, card.file) });
      }
    }
    console.log(`  ${name}  ${s.width}x${s.height}  cards:${s.cards.length}`);
  }

  const palette = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const grab = (n) => cs.getPropertyValue(n).trim() || null;
    return {
      bg: getComputedStyle(document.body).backgroundColor,
      accent: grab("--color-accent") || grab("--accent") || null,
    };
  });

  const total = await page.evaluate(() => document.body.scrollHeight);
  fs.writeFileSync(
    path.join(OUT, "sections.json"),
    JSON.stringify(meta.map(({ cards, ...rest }) => ({ ...rest, cardCount: cards.length })), null, 2)
  );
  fs.writeFileSync(
    path.join(OUT, "elements.json"),
    JSON.stringify(
      meta.filter((s) => s.cards.length).map((s) => ({ section: s.index, slug: s.slug, cards: s.cards })),
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(OUT, "page.json"),
    JSON.stringify({ url: URL, viewportWidth: WIDTH, dpr: DPR, totalHeight: total, palette, capturedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`\nwrote ${OUT}`);

  await browser.close();
}

function sleepIn(_page, ms) { return sleep(ms); }

main().catch((e) => { console.error(e); process.exit(1); });
