import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  delayRender,
  continueRender,
} from "remotion";

// ============================================================================
// Continuous-scroll recreation of a Claude chat: config message → 30-row
// "Real Estate Agencies in Miami" table → pitch-tips section. Recreated 1:1
// (Inter, pills, blue links, ⭐ emoji ratings) at the reference's native 2004px
// width, scaled to fill 4K, and revealed via a single "frontier" that drives:
//   • Message A typewriter        (0:00 → 0:02:15  = frames 0–65)
//   • table rows one at a time + scroll (0:02:16 → 0:05:20 = frames 66–145)
//   • pitch-tips typewriter + scroll   (0:05:20 → 0:08:03 = frames 145–203)
//   • then a 5s freeze                  (frames 203–328)
// No cursor. Notes honoured: # column shows digits side-by-side; the scroll
// chevron is omitted.
// ============================================================================

export const fps = 25;
export const durationInFrames = 328; // 203 + 125 (5s freeze)

// ---- native document geometry (measured from the reference) ----
const DOC_W = 2004;
const DOC_H = 8183;
const TABLE_TOP = 690;
const ROW_TOPS = [
  835, 1030, 1225, 1420, 1615, 1810, 2005, 2200, 2395, 2590, 2785, 2980, 3175,
  3370, 3565, 3760, 3955, 4150, 4345, 4540, 4735, 4930, 5175, 5370, 5565, 5760,
  5955, 6150, 6345, 6540,
];

// frontier(frame) → native document y-coordinate of the reveal edge
const FA: [number, number][] = [
  [0, 0],
  [65, 460],
  [145, 6785],
  [203, 8183],
];
function frontierY(f: number): number {
  if (f <= 0) return 0;
  if (f >= 203) return 8183;
  for (let i = 0; i < FA.length - 1; i++) {
    const [f0, y0] = FA[i];
    const [f1, y1] = FA[i + 1];
    if (f <= f1) {
      const t = (f - f0) / (f1 - f0);
      // Phase 1 (typewriter) is linear/steady; the two scroll phases use
      // smoothstep so the camera eases in, hands off smoothly at frame 145,
      // and settles gently into the freeze at 203.
      const te = i === 0 ? t : t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * te;
    }
  }
  return 8183;
}

const CAM_OFFSET = 700; // keep the frontier ~62% down the viewport
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---- colours ----
const C = {
  bg: "#161718",
  fg: "#F4F4F5",
  link: "#7B9DF9",
  border: "#3E3F43",
  pillBg: "31, 33, 35",
  pillBorder: "62, 63, 67",
};

const FONT_FACE_CSS = `
@font-face{font-family:'CTWInter';src:url('/fonts/Inter-Variable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:block;}
@font-face{font-family:'CTWMono';src:url('/fonts/RobotoMono-Variable.woff2') format('woff2');font-weight:100 700;font-style:normal;font-display:block;}
.doc{width:${DOC_W}px;padding:40px 37px 40px 49px;box-sizing:border-box;font-family:'CTWInter',sans-serif;color:${C.fg};font-size:35px;line-height:50px;font-weight:400;-webkit-font-smoothing:antialiased;}
.doc p{font-size:35px;line-height:50px;margin:0 0 40px 0;}
.doc .gotall{margin:0 0 34px 0;}
.doc b{font-weight:700;}
.doc code{font-family:'CTWMono',monospace;font-size:31px;background:rgba(${C.pillBg},1);border:1px solid ${C.border};border-radius:13px;padding:2px 9px;line-height:1;white-space:nowrap;}
.doc ul{list-style:none;margin:0 0 40px 0;padding:0 0 0 90px;}
.doc li{position:relative;font-size:35px;line-height:50px;margin-bottom:10px;}
.doc li:last-child{margin-bottom:0;}
.doc h1{font-size:64px;line-height:76px;font-weight:700;margin:0 0 40px 0;letter-spacing:-0.5px;}
.doc table{border-collapse:separate;border-spacing:0;width:1918px;table-layout:fixed;margin:0 0 46px 0;}
.doc th,.doc td{border-right:1px solid ${C.border};border-bottom:1px solid ${C.border};padding:22px 30px;vertical-align:middle;font-size:35px;line-height:50px;color:${C.fg};font-weight:400;overflow-wrap:break-word;word-break:break-word;}
.doc th{border-top:1px solid ${C.border};font-weight:700;text-align:left;}
.doc th:first-child,.doc td:first-child{border-left:1px solid ${C.border};}
.doc td.num{text-align:center;white-space:nowrap;padding-left:10px;padding-right:10px;}
.doc td.agency{font-weight:700;}
.doc a.lnk{color:${C.link};text-decoration:none;word-break:break-all;}
.doc .pitch{margin:0 0 40px 0;}
`;

if (typeof document !== "undefined") {
  const w = window as unknown as { __miami_fonts?: boolean };
  if (!w.__miami_fonts) {
    w.__miami_fonts = true;
    try {
      const handle = delayRender("Loading CTW fonts");
      const faces = [
        new FontFace("CTWInter", `url(${staticFile("fonts/Inter-Variable.woff2")})`, { style: "normal", weight: "100 900", display: "block" as FontDisplay }),
        new FontFace("CTWMono", `url(${staticFile("fonts/RobotoMono-Variable.woff2")})`, { style: "normal", weight: "100 700", display: "block" as FontDisplay }),
      ];
      Promise.all(faces.map((f) => f.load().then((ff) => (document.fonts as FontFaceSet).add(ff))))
        .catch(() => undefined)
        .finally(() => continueRender(handle));
    } catch {
      /* not in a render context */
    }
  }
}

// ---- content model --------------------------------------------------------
type Run = { k: "n" | "b" | "c" | "e"; t: string };

const MSG_A = {
  y0: 0,
  y1: 460,
  intro: [{ k: "n", t: "Great, I have all the details I need. Running the Actor now with:" }] as Run[],
  bullets: [
    [{ k: "b", t: "Search term:" }, { k: "n", t: " " }, { k: "c", t: "real estate agency" }],
    [{ k: "b", t: "Location:" }, { k: "n", t: " " }, { k: "c", t: "Miami, FL" }],
    [{ k: "b", t: "Max results:" }, { k: "n", t: " 10" }],
    [{ k: "b", t: "Email, phone & social enrichment" }, { k: "n", t: " enabled" }],
  ] as Run[][],
  outro: [{ k: "n", t: "The run succeeded in under 25 seconds! Let me fetch the results now." }] as Run[],
};

const INTRO_LINE = {
  y0: 490,
  y1: 545,
  runs: [{ k: "n", t: "Got all 30! Here's the full list along with tailored pitch tips " }, { k: "e", t: "👇" }] as Run[],
};

const HEADING = {
  y0: 560,
  y1: 660,
  runs: [{ k: "e", t: "🏠" }, { k: "n", t: " 30 Real Estate Agencies in Miami" }] as Run[],
};

type Row = [number, string, string, string, string | null, string | null, string, string, string | null];
const ROWS: Row[] = [
  [1, "Bayfront Realty Collective", "120 SW 5th St, Miami", "+1 305-555-0142", null, "bayfrontcollective.com", "4.8", "211", null],
  [2, "Palmetto & Vine Realty", "480 NE 2nd Ave, Miami", "+1 305-555-0173", null, "palmettovine.com", "5.0", "41", "WordPress"],
  [3, "Marco Devlin Real Estate", "1420 Brickell Ave, Miami", "+1 786-555-0119", null, "beacons.ai/marcodevlin", "4.9", "67", null],
  [4, "Adrian Foster, Realtor", "820 Brickell Ave, Miami", "+1 305-555-0188", "afoster@crestpointrealty.com", "adrianfoster.com", "5.0", "56", "Vercel"],
  [5, "Harbor Nest Group Real Estate", "1130 Brickell Bay Dr, Miami", "+1 305-555-0126", null, "facebook.com/harbornestmiami", "4.9", "67", null],
  [6, "Nadia Brooks - Realtor", "310 S Biscayne Blvd, Miami", "+1 321-555-0164", "nadiabrooksrealtor@gmail.com", "nadiabrooks.com", "4.9", "46", null],
  [7, "Cormac Reyes", "1240 Brickell Ave, Miami", "+1 708-555-0132", "cormacreyesrealty@gmail.com", "cormacreyes.com", "4.8", "44", "WordPress"],
  [8, "Delgado Skyline Group", "455 Brickell Ave, Miami", "+1 305-555-0151", "team@delgadoskyline.com", "delgadoskyline.com", "5.0", "164", "Vercel"],
  [9, "The Vantage Realty", "1215 Brickell Ave, Miami", "+1 305-555-0197", "hello@thevantagerealty.com", "thevantagerealty.com", "5.0", "32", "Vercel"],
  [10, "Casa Norte Home Team", "10420 NW 33rd St, Doral", "+1 754-555-0109", "info@casanortehome.com", "casanortehome.com", "4.9", "80", "Vercel"],
  [11, "Priya Nolan Team", "1220 Lincoln Rd, Miami Beach", "+1 305-555-0113", "priya@priyanolan.com", "priyanolanliving.com", "5.0", "206", "Cloudflare"],
  [12, "The Crescent Group", "1525 Sunset Dr, Miami", "+1 305-555-0179", "hello@crescentgroup.com", "crescentre.com", "5.0", "260", "WordPress"],
  [13, "Coastal Brokers Miami", "610 Brickell Key Dr, Miami", "+1 754-555-0148", "info@coastalbrokers.miami", "coastalbrokersmiami.com", "4.9", "51", null],
  [14, "Marsh & Co: Elena Marsh", "4020 Ponce de Leon Blvd, Coral Gables", "+1 305-555-0136", "elena@marshandco.com", "marshsellsmiami.com", "4.9", "63", null],
  [15, "Halcyon Ferrand Group", "720 NE 90th St, Miami", "+1 305-555-0158", null, "halcyonferrand.com", "4.9", "41", null],
  [16, "Talia Moreno | Azure Luxury", "815 Brickell Ave, Miami", "+1 305-555-0121", "tmoreno@azureluxury.com", "taliasellsmiami.com", "4.8", "42", "Cloudflare"],
  [17, "Skyview Properties", "640 SW 3rd St, Miami", "+1 786-555-0104", "info@skyviewproperties.com", "skyviewpropertiesmia.com", "4.7", "38", "Cloudflare"],
  [18, "Rowan Hale, Miami-Dade RE", "1685 Meridian Ave, Miami Beach", "+1 305-555-0190", "rowan@miamihomeatlas.com", "miamihomeatlas.com", "5.0", "106", "Cloudflare"],
  [19, "Uptown Miami Living", "3260 NE 1st Ave, Miami", "+1 305-555-0167", null, "uptownmiamiliving.com", "4.8", "30", null],
  [20, "Bright Bay Team, Karina Vale", "2560 SW 27th Ave, Miami", "+1 305-555-0139", null, "brightbayteam.com", "4.8", "124", null],
  [21, "Serena Vaughn PA - Meridian", "330 Crandon Blvd, Key Biscayne", "+1 786-555-0175", "serena@serenavaughn.com", "serenavaughn.com", "4.9", "66", "WordPress"],
  [22, "Downtown Realty Agency", "935 Washington Ave, Miami Beach", "+1 786-555-0182", "info@downtownrealty.agency", "downtownrealtyagency.com", "5.0", "1", null],
  [23, "Verano RE: Marco Ibarra", "1460 S Miami Ave, Miami", "+1 305-555-0117", "mibarra@veranore.com", "veranore.com", "5.0", "38", "WordPress"],
  [24, "Selina Cordova", "910 Biscayne Blvd, Miami", "+1 786-555-0153", null, "selinacordova.com", "5.0", "46", null],
  [25, "Theo & Camila Vance", "328 S Biscayne Blvd, Miami", "+1 786-555-0128", "theo@vancehomes.com", "vancehomesmiami.com", "4.9", "82", "WordPress"],
  [26, "Devon Locke - The Loft Realty Group", "2390 SW 4th St, Miami", "+1 786-555-0146", "hello@loftrealtygroup.com", "loftrealtygroup.com", "5.0", "47", null],
  [27, "Elliot Sandoval - Meridian", "1660 SW 18th St, Miami", "+1 786-555-0161", "elliot@meridianadvisors.com", "meridianadvisorsmia.com", "5.0", "53", "Cloudflare"],
  [28, "Lucas Ferreira - Avanti Homes", "448 Brickell Ave, Miami", "+1 786-555-0135", "lucasferreira.re@gmail.com", "avantihomesmia.com", "5.0", "70", "WordPress"],
  [29, "Gia Fenwick | Northline Realty", "1610 SW 1st Ave, Miami", "+1 305-555-0108", "gia@northlinerealty.com", "northlinerealty.com", "5.0", "40", "WordPress"],
  [30, "Cassidy Rowe - Luxe RE", "122 Washington Ave, Miami Beach", "+1 786-555-0193", "cassidy@luxere.com", "cassidyrowe.com", "5.0", "11", "WordPress"],
];

const PITCH = {
  y0: 6820,
  y1: 8150,
  heading: [{ k: "e", t: "💡" }, { k: "n", t: " Pitch Tips for Your Web Design Studio" }] as Run[],
  paras: [
    [{ k: "e", t: "🎯" }, { k: "n", t: " " }, { k: "b", t: "Easiest wins — WordPress sites (9 agencies)" }, { k: "n", t: " Palmetto & Vine Realty, Cormac Reyes, The Crescent Group, Serena Vaughn, Verano/Marco Ibarra, Theo & Camila Vance, Lucas Ferreira, Gia Fenwick, Cassidy Rowe — all run WordPress. Pitch them a " }, { k: "b", t: "premium custom theme, speed optimization, or a full redesign" }, { k: "n", t: ". WordPress clients are familiar with paying for web services and easy to upsell on maintenance plans." }],
    [{ k: "e", t: "⚡" }, { k: "n", t: " " }, { k: "b", t: "Tech-forward clients — Vercel sites (4 agencies)" }, { k: "n", t: " Delgado Skyline Group, The Vantage Realty, Casa Norte Home Team, Adrian Foster. These are modern, developer-built sites. Pitch " }, { k: "b", t: "UI/UX redesign, conversion optimization, or a headless CMS upgrade" }, { k: "n", t: " — they'll appreciate the technical language." }],
    [{ k: "e", t: "🛡️" }, { k: "n", t: " " }, { k: "b", t: "Cloudflare-hosted sites (5 agencies)" }, { k: "n", t: " Ridgeway Properties, Priya Nolan Team, Talia Moreno, Skyview Properties, Rowan Hale, Elliot Sandoval. Cloudflare is just a CDN/proxy — their underlying CMS is unknown. These are solid mid-range prospects; pitch a " }, { k: "b", t: "website audit + redesign consultation" }, { k: "n", t: "." }],
    [{ k: "e", t: "🚨" }, { k: "n", t: " " }, { k: "b", t: "No proper website — biggest opportunity (5 agencies)" }, { k: "n", t: " Harbor Nest Group (only has a Facebook page!), Marco Devlin (using beacons.ai link-in-bio), Bayfront Realty Collective, Uptown Miami Living, Bright Bay Team — these agencies have " }, { k: "b", t: "no real web presence" }, { k: "n", t: ". This is your lowest-hanging fruit: pitch them a " }, { k: "b", t: "brand new website from scratch" }, { k: "n", t: "." }],
    [{ k: "e", t: "📧" }, { k: "n", t: " " }, { k: "b", t: "Gmail users = untapped potential (3 agencies)" }, { k: "n", t: " Nadia Brooks, Cormac Reyes, and Lucas Ferreira use Gmail for business. This signals they haven't invested in their brand yet. Lead with " }, { k: "b", t: '"your online presence doesn\'t match your 5-star reputation"' }, { k: "n", t: " — that's a compelling opener." }],
    [{ k: "e", t: "🏆" }, { k: "n", t: " " }, { k: "b", t: "High-review, established agencies" }, { k: "n", t: " The Crescent Group (260 reviews), Priya Nolan Team (206 reviews), Bayfront Realty Collective (211 reviews) are well-established. Pitch them on " }, { k: "b", t: "SEO-optimized redesigns or lead-capture features" }, { k: "n", t: " to justify ROI — they have the traffic to benefit most." }],
  ] as Run[][],
};

// count reveal-units in a run list (emoji & pill count per-unit like chars)
function runUnits(runs: Run[]): number {
  return runs.reduce((a, r) => a + (r.k === "e" ? 1 : [...r.t].length), 0);
}

// ---- reveal-aware rich text ------------------------------------------------
// `shown` = number of units revealed in this block; `ctr` carries the running
// unit index across a whole block (which may span multiple paragraphs).
function renderRuns(runs: Run[], shown: number, ctr: { g: number }, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  runs.forEach((r, ri) => {
    if (r.k === "e") {
      const gi = ctr.g++;
      out.push(<span key={`${key}-${ri}`} style={{ opacity: clamp01(shown - gi) }}>{r.t}</span>);
      return;
    }
    const startGi = ctr.g;
    const chars = [...r.t].map((ch, i) => {
      const gi = ctr.g++;
      return (
        <span key={`${key}-${ri}-${i}`} style={{ opacity: clamp01(shown - gi), fontWeight: r.k === "b" ? 700 : undefined }}>
          {ch}
        </span>
      );
    });
    if (r.k === "c") {
      const pillOp = clamp01(shown - startGi);
      out.push(
        <code key={`${key}-${ri}`} style={{ borderColor: `rgba(${C.pillBorder}, ${pillOp})`, background: `rgba(${C.pillBg}, ${pillOp})` }}>
          {chars}
        </code>
      );
    } else {
      out.push(<React.Fragment key={`${key}-${ri}`}>{chars}</React.Fragment>);
    }
  });
  return out;
}

// how many units of a block are shown, given the frontier
function blockShown(fy: number, y0: number, y1: number, total: number): number {
  return total * clamp01((fy - y0) / (y1 - y0));
}

const Cell: React.FC<{ v: string | null; link?: boolean; cls?: string }> = ({ v, link, cls }) => {
  if (v === null) return <td className={cls}>—</td>;
  return <td className={cls}>{link ? <a className="lnk">{v}</a> : v}</td>;
};

const DocBody: React.FC<{ fy: number }> = ({ fy }) => {
  const msgIntro = runUnits(MSG_A.intro);
  const msgBullets = MSG_A.bullets.map(runUnits);
  const msgOutro = runUnits(MSG_A.outro);
  const msgTotal = msgIntro + msgBullets.reduce((a, b) => a + b, 0) + msgOutro;
  const msgShown = blockShown(fy, MSG_A.y0, MSG_A.y1, msgTotal);
  const msgCtr = { g: 0 };

  const introShown = blockShown(fy, INTRO_LINE.y0, INTRO_LINE.y1, runUnits(INTRO_LINE.runs));
  const introCtr = { g: 0 };

  const headShown = blockShown(fy, HEADING.y0, HEADING.y1, runUnits(HEADING.runs));
  const headCtr = { g: 0 };

  const pitchTotal = runUnits(PITCH.heading) + PITCH.paras.reduce((a, p) => a + runUnits(p), 0);
  const pitchShown = blockShown(fy, PITCH.y0, PITCH.y1, pitchTotal);
  const pitchCtr = { g: 0 };

  const headerOp = clamp01((fy - (TABLE_TOP - 140)) / 90);

  return (
    <div className="doc">
      {/* ---- Message A (typewriter) ---- */}
      <p>{renderRuns(MSG_A.intro, msgShown, msgCtr, "mi")}</p>
      <ul>
        {MSG_A.bullets.map((b, i) => (
          <li key={i} style={{ opacity: undefined }}>
            <span style={{ position: "absolute", left: -35, top: 19.5, width: 11, height: 11, borderRadius: "50%", background: C.fg, opacity: clamp01(msgShown - msgCtr.g) }} />
            {renderRuns(b, msgShown, msgCtr, `mb-${i}`)}
          </li>
        ))}
      </ul>
      <p>{renderRuns(MSG_A.outro, msgShown, msgCtr, "mo")}</p>

      {/* ---- results intro + heading ---- */}
      <p className="gotall">{renderRuns(INTRO_LINE.runs, introShown, introCtr, "intro")}</p>
      <h1>{renderRuns(HEADING.runs, headShown, headCtr, "head")}</h1>

      {/* ---- table (row-by-row reveal) ---- */}
      <table>
        <colgroup>
          <col style={{ width: 112 }} />
          <col style={{ width: 315 }} />
          <col style={{ width: 321 }} />
          <col style={{ width: 196 }} />
          <col style={{ width: 297 }} />
          <col style={{ width: 344 }} />
          <col style={{ width: 171 }} />
          <col style={{ width: 162 }} />
        </colgroup>
        <thead>
          <tr style={{ opacity: headerOp }}>
            <th>#</th><th>Agency</th><th>Address</th><th>Phone</th><th>Email</th><th>Website</th><th>Rating</th><th>Platform</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => {
            const [n, agency, addr, phone, email, web, rat, cnt, plat] = row;
            const op = clamp01((fy - (ROW_TOPS[i] - 150)) / 90);
            return (
              <tr key={n} style={{ opacity: op }}>
                <td className="num">{n}</td>
                <td className="agency">{agency}</td>
                <td>{addr}</td>
                <td>{phone}</td>
                <Cell v={email} link />
                <Cell v={web} link />
                <td className="rating">
                  <div>⭐</div>
                  <div>{rat}</div>
                  <div>({cnt})</div>
                </td>
                <Cell v={plat} />
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ---- pitch tips (typewriter) ---- */}
      <h1>{renderRuns(PITCH.heading, pitchShown, pitchCtr, "ph")}</h1>
      {PITCH.paras.map((p, i) => (
        <p className="pitch" key={i}>{renderRuns(p, pitchShown, pitchCtr, `pp-${i}`)}</p>
      ))}
    </div>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const S = width / DOC_W;
  const vpNative = height / S;
  const maxScroll = Math.max(0, DOC_H - vpNative);

  const fy = frontierY(frame);
  const cameraY = clamp(fy - CAM_OFFSET, 0, maxScroll);

  return (
    <AbsoluteFill style={{ background: "transparent", overflow: "hidden" }}>
      <style>{FONT_FACE_CSS}</style>
      <div style={{ position: "absolute", left: 0, top: 0, width: DOC_W, transform: `scale(${S})`, transformOrigin: "top left" }}>
        <div style={{ transform: `translateY(${-cameraY}px)` }}>
          <DocBody fy={fy} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Full-document static render at native scale, for layout measurement only.
export const MeasureDoc: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <style>{FONT_FACE_CSS}</style>
    <DocBody fy={1e9} />
  </AbsoluteFill>
);

export default Scene;
