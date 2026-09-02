import { NextResponse } from "next/server";

// Server-side lookup of Apify Store Actors, mirroring the Figma "Apify plugin".
// The plugin (and this route) do NOT use the Apify API or any token — they query
// Apify Store's PUBLIC Algolia index, the same one that powers Store search.
// Doing it here (rather than the browser) keeps the request off CORS, and lets
// us fetch the icon/author images and inline them as base64 data-URIs so the
// generated scene stays self-contained (no remote <Img> src, no URL expiry).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALGOLIA_URL =
  "https://ow0o5i3qo7-dsn.algolia.net/1/indexes/prod_PUBLIC_STORE/query" +
  "?x-algolia-api-key=0ecccd09f50396a4dbbe5dbfb17f4525" +
  "&x-algolia-application-id=OW0O5I3QO7";

// userFullName / userPictureUrl only come back when explicitly requested.
const ATTRS = [
  "title",
  "name",
  "username",
  "userFullName",
  "userPictureUrl",
  "pictureUrl",
  "description",
  "stats",
];

interface Hit {
  title?: string;
  name?: string;
  username?: string;
  userFullName?: string;
  userPictureUrl?: string;
  pictureUrl?: string;
  description?: string;
  stats?: {
    actorReviewRating?: number;
    actorReviewCount?: number;
    totalUsers?: number;
  };
}

async function algolia(query: string, hitsPerPage: number): Promise<Hit[]> {
  const res = await fetch(ALGOLIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, page: 0, hitsPerPage, attributesToRetrieve: ATTRS }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Algolia ${res.status}`);
  const data = (await res.json()) as { hits?: Hit[] };
  return data.hits ?? [];
}

// Accept a raw term, a "username/name" or "username~name" slug, or a Store URL
// (apify.com/store/<u>/<n>, apify.com/<u>/<n>, console.apify.com/actors/... slug).
function parseSlug(input: string): { username: string; name: string } | null {
  const s = input.trim();
  if (!s) return null;
  if (/apify\.com/i.test(s) || /^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s.startsWith("http") ? s : "https://" + s);
      const parts = u.pathname.split("/").filter(Boolean);
      const cleaned = parts[0] === "store" ? parts.slice(1) : parts;
      if (cleaned.length >= 2 && cleaned[0] !== "actors") {
        return { username: cleaned[0], name: cleaned[1] };
      }
    } catch {
      /* fall through */
    }
  }
  const m = s.match(/^([a-z0-9_.-]+)[/~]([a-z0-9_.-]+)$/i);
  if (m) return { username: m[1], name: m[2] };
  return null;
}

async function resolveHit(username: string, name: string): Promise<Hit | null> {
  const hits = await algolia(name, 20);
  const lc = (v?: string) => (v ?? "").toLowerCase();
  return (
    hits.find((h) => lc(h.username) === username.toLowerCase() && lc(h.name) === name.toLowerCase()) ??
    hits.find((h) => lc(h.name) === name.toLowerCase()) ??
    hits[0] ??
    null
  );
}

function handleOf(h: Hit): string {
  return `${h.username ?? ""}/${h.name ?? ""}`;
}

function formatCompact(n?: number): string {
  if (!n || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return (k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k).toString()) + "k";
  }
  const m = n / 1_000_000;
  return (m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m).toString()) + "M";
}

async function fetchDataUri(url?: string): Promise<string> {
  if (!url) return "";
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return "";
    const buf = Buffer.from(await r.arrayBuffer());
    let ct = r.headers.get("content-type") || "";
    if (!ct || ct === "application/octet-stream") {
      if (/\.svg(\?|$)/i.test(url)) ct = "image/svg+xml";
      else if (/\.png(\?|$)/i.test(url)) ct = "image/png";
      else if (/\.jpe?g(\?|$)/i.test(url)) ct = "image/jpeg";
      else ct = "image/png";
    }
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

// Normalized card the ActorLookup form maps straight onto the snippet's consts.
async function toCard(h: Hit) {
  const [iconDataUri, avatarDataUri] = await Promise.all([
    fetchDataUri(h.pictureUrl),
    fetchDataUri(h.userPictureUrl),
  ]);
  const stats = h.stats ?? {};
  const reviewCount = stats.actorReviewCount ?? 0;
  const hasRating = reviewCount > 0 && typeof stats.actorReviewRating === "number";
  return {
    title: h.title || h.name || "",
    handle: handleOf(h),
    description: h.description || "",
    authorName: h.userFullName || h.username || "",
    ratingValue: hasRating ? stats.actorReviewRating!.toFixed(1) : "",
    reviewCount: hasRating ? `(${formatCompact(reviewCount)})` : "",
    usersLabel: formatCompact(stats.totalUsers),
    iconDataUri,
    avatarDataUri,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolve = searchParams.get("resolve");
  const q = (searchParams.get("q") || "").trim();

  try {
    // 1) Explicit resolve (a picked candidate, or a pasted slug/URL).
    const slug = resolve ? parseSlug(resolve) || parseSlug(`x/${resolve}`) : parseSlug(q);
    if (resolve || slug) {
      const target = slug ?? (resolve ? { username: "", name: resolve } : null);
      if (!target) return NextResponse.json({ error: "Bad actor reference" }, { status: 400 });
      const hit = await resolveHit(target.username, target.name);
      if (!hit) return NextResponse.json({ error: "Actor not found" }, { status: 404 });
      return NextResponse.json(await toCard(hit));
    }

    // 2) Free-text search → light candidate list for the picker.
    if (!q) return NextResponse.json({ results: [] });
    const hits = await algolia(q, 6);
    const results = hits.map((h) => ({
      title: h.title || h.name || "",
      handle: handleOf(h),
      username: h.username || "",
      name: h.name || "",
      iconUrl: h.pictureUrl || "",
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 502 },
    );
  }
}
