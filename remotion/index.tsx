// CLI / Studio entry point for the static compositions registered in Root.tsx.
// The Next.js app previews scenes via @remotion/player and renders via
// lib/render-queue.ts, so this file is the missing piece that lets you also
// run `npx remotion studio remotion/index.tsx` or render a registered
// composition (e.g. BaguetteIndex) from the CLI. Fonts are loaded behind
// delayRender exactly like the render queue so exports match the preview.
import {
  registerRoot,
  delayRender,
  continueRender,
  staticFile,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { RemotionRoot } from "./Root";

loadInter("normal", { weights: ["400", "500", "600", "700", "900"] });

const gtWeights: { weight: string; file: string }[] = [
  { weight: "400", file: "GT-Walsheim-Regular.ttf" },
  { weight: "500", file: "GT-Walsheim-Medium.ttf" },
  { weight: "700", file: "GT-Walsheim-Bold.ttf" },
  { weight: "900", file: "GT-Walsheim-Black.ttf" },
];
const gtHandle = delayRender("Loading GT Walsheim");
Promise.all(
  gtWeights.map(async ({ weight, file }) => {
    const f = new FontFace("GT Walsheim", `url(${staticFile("fonts/" + file)})`, {
      weight,
      style: "normal",
      display: "block" as FontDisplay,
    });
    await f.load();
    (document.fonts as FontFaceSet).add(f);
  }),
).finally(() => continueRender(gtHandle));

registerRoot(RemotionRoot);
