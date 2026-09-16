/**
 * Load every screen and assert it is USABLE — not merely that it rendered.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Exists because of a real failure: the new-project wizard was changed from a
 * <Modal> (which returns null when closed) to a fixed full-screen overlay, and
 * the `open` guard went with the Modal. It then covered every screen in the app,
 * permanently, with no way past it — and the check I had run only ever exercised
 * the OPEN path, so it passed. Testing that a feature works is not the same as
 * testing that it stays out of the way.
 */
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.argv[2] ?? "http://localhost:3000";

const ROUTES = [
  { path: "/", expect: "Video tool" },
  { path: "/animation", expect: "Home" },
  { path: "/video", expect: "Home" },
  { path: "/feedback", expect: null },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
});

let failures = 0;
const fail = (route, why) => { failures++; console.log(`  FAIL ${route} — ${why}`); };

try {
  // Include one project of each kind, discovered rather than hard-coded.
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(`${base}/api/projects`, { waitUntil: "networkidle2", timeout: 60000 });
  const projects = JSON.parse(await page.evaluate(() => document.body.innerText));

  // The LISTING does not carry `doc` — it is too big to send 314 times — so
  // asking `p.doc` here quietly matched nothing and the document editor, the
  // screen most of this redesign lives in, went untested while the run still
  // printed "6 usable". Ask the project endpoint instead, newest first.
  const isDoc = async (id) => {
    await page.goto(`${base}/api/projects/${id}`, { waitUntil: "networkidle2", timeout: 60000 });
    try {
      return Boolean(JSON.parse(await page.evaluate(() => document.body.innerText)).doc);
    } catch { return false; }
  };
  const recent = [...projects].sort((a, b) => (b.updatedAt ?? 0) < (a.updatedAt ?? 0) ? -1 : 1).slice(0, 40);
  let docId;
  for (const p of recent) if (await isDoc(p.id)) { docId = p.id; break; }
  if (!docId) { failures++; console.log("  FAIL /project/<doc> — no document project found to test"); }

  const pick = (fn) => projects.find(fn)?.id;
  const kinds = [
    ["doc", docId],
    ["legacy", pick((p) => p.id !== docId && p.animationType !== "terminal")],
    ["terminal", pick((p) => p.animationType === "terminal")],
  ];
  for (const [kind, id] of kinds) if (id) ROUTES.push({ path: `/project/${id}`, expect: null, kind });

  for (const route of ROUTES) {
    const p = await browser.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setViewport({ width: 1600, height: 1000 });
    try {
      await p.goto(base + route.path, { waitUntil: "networkidle2", timeout: 90000 });
      await new Promise((r) => setTimeout(r, 2200));

      // Nothing modal should be up on a fresh load. This is the check that
      // would have caught the wizard covering the app.
      const blocked = await p.evaluate(() => Boolean(document.querySelector('[role="dialog"]')));
      if (blocked) fail(route.path, "a dialog is open on a fresh load — the screen is unreachable");

      const text = await p.evaluate(() => document.body.innerText);
      if (route.expect && !text.includes(route.expect)) {
        fail(route.path, `expected to see ${JSON.stringify(route.expect)}`);
      }
      if (!text.trim()) fail(route.path, "rendered nothing");
      if (errs.length) fail(route.path, `page error: ${errs[0].slice(0, 90)}`);

      if (!blocked && (!route.expect || text.includes(route.expect)) && !errs.length) {
        console.log(`  ok   ${route.path}${route.kind ? ` (${route.kind})` : ""}`);
      }
    } catch (e) {
      fail(route.path, e.message.slice(0, 90));
    } finally {
      await p.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\n==== ${ROUTES.length - failures} usable, ${failures} broken ====`);
process.exit(failures ? 1 : 0);
