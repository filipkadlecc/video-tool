/**
 * Give the category sticker badges a real alpha channel.
 *
 * They capture with an opaque white background (the section behind them is
 * white), which is invisible on a white frame and a white BOX on a black or
 * yellow one. A naive white-key is wrong -- every badge has white LETTERING
 * inside a black pill -- so this floods inward from the border and only clears
 * white that is connected to the outside.
 *
 *   node scripts/key-spike-badges.cjs
 */
const { execFileSync } = require("child_process");
const path = require("path");
const DIR = path.join(__dirname, "..", "public", "assets", "spike", "elements");

execFileSync("python3", ["-c", `
import glob, os
from collections import deque
from PIL import Image

THRESH = 232        # "near enough to white to be background"
EDGE_SOFTEN = 205   # light boundary pixels get partial alpha, killing the halo

for fp in sorted(glob.glob(os.path.join(${JSON.stringify(DIR)}, "badge-*.png"))):
    im = Image.open(fp).convert("RGBA")
    w, h = im.size
    px = im.load()
    outside = bytearray(w * h)
    q = deque()
    def near_white(p):
        return p[0] >= THRESH and p[1] >= THRESH and p[2] >= THRESH
    for x in range(w):
        for y in (0, h - 1):
            if not outside[y*w+x] and near_white(px[x, y]):
                outside[y*w+x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not outside[y*w+x] and near_white(px[x, y]):
                outside[y*w+x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and not outside[ny*w+nx] and near_white(px[nx, ny]):
                outside[ny*w+nx] = 1; q.append((nx, ny))
    cleared = 0
    for y in range(h):
        for x in range(w):
            if outside[y*w+x]:
                r, g, b, _ = px[x, y]; px[x, y] = (r, g, b, 0); cleared += 1
    # soften the 1px rim the hard threshold leaves behind
    for y in range(h):
        for x in range(w):
            if outside[y*w+x]: continue
            r, g, b, a = px[x, y]
            if min(r, g, b) < EDGE_SOFTEN: continue
            if any(0 <= x+dx < w and 0 <= y+dy < h and outside[(y+dy)*w+(x+dx)]
                   for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                px[x, y] = (r, g, b, 90)
    out = fp.replace(".png", ".webp")
    im.save(out, "WEBP", quality=94, method=6)
    os.remove(fp)
    print(f"  {os.path.basename(out)}  {cleared*100//(w*h)}% cleared to alpha")
`], { stdio: "inherit" });
