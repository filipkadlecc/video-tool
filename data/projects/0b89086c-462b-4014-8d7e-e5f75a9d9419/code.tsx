import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

export const fps = 25;
export const durationInFrames = 2620;

// === THEME ===
const COLORS = {
  pink: "#FF64B8",
  lightPink: "#FEF3FF",
  mutedPurple: "#9D829F",
  darkPurple: "#694D6B",
  bg: "#12091A",
};

const TRANSITION = 15;

// === BACKGROUND ===
const Background: React.FC = () => (
  <AbsoluteFill>
    <Img
      src={staticFile("assets/backgrounds/background.png")}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </AbsoluteFill>
);

// === SCENE 1: REFRESH FREQUENCY ===
const WEEKS = [
  { label: "Week 1", bars: [80, 45, 70, 30] },
  { label: "Week 2", bars: [60, 75, 40, 55] },
  { label: "Week 3", bars: [45, 60, 85, 70] },
  { label: "Week 4", bars: [90, 35, 55, 80] },
];

const WeekCard: React.FC<{
  week: (typeof WEEKS)[number];
  index: number;
  delay: number;
}> = ({ week, index, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  const translateY = interpolate(progress, [0, 1], [60, 0]);
  const barColors = [COLORS.pink, COLORS.lightPink, COLORS.mutedPurple, COLORS.darkPurple];

  return (
    <div style={{ width: 440, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 24, border: "2px solid rgba(255,255,255,0.08)", padding: "36px 40px", opacity: progress, transform: `translateY(${translateY}px)` }}>
      <div style={{ fontSize: 28, fontWeight: 600, color: COLORS.mutedPurple, letterSpacing: "0.15em", marginBottom: 28 }}>{week.label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 120 }}>
        {week.bars.map((h, j) => {
          const barDelay = delay + 8 + j * 4;
          const barProgress = spring({ frame, fps, delay: barDelay, config: { damping: 200 } });
          return <div key={j} style={{ flex: 1, height: `${h * barProgress}%`, backgroundColor: barColors[j], borderRadius: 8, opacity: barProgress }} />;
        })}
      </div>
    </div>
  );
};

const SceneRefreshFrequency: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleProgress = spring({ frame, fps, delay: 5, config: { damping: 200 } });
  const counterProgress = spring({ frame, fps, delay: 145, config: { damping: 200 } });
  const counterValue = Math.round(interpolate(counterProgress, [0, 1], [0, 47]));
  const spinRotation = interpolate(frame, [145, 200], [0, 720], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      <Background />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 180 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.2em", marginBottom: 80, opacity: titleProgress, transform: `translateY(${interpolate(titleProgress, [0, 1], [-40, 0])}px)` }}>REFRESH FREQUENCY</div>
        <div style={{ display: "flex", gap: 32, marginBottom: 80 }}>
          {WEEKS.map((week, i) => <WeekCard key={i} week={week} index={i} delay={50 + i * 10} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 24, border: "2px solid rgba(255,255,255,0.08)", padding: "28px 56px", opacity: counterProgress, transform: `scale(${interpolate(counterProgress, [0, 1], [0.85, 1])})` }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${spinRotation}deg)` }}>
            <path d="M21 12a9 9 0 1 1-2.636-6.364" stroke={COLORS.pink} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M21 3v6h-6" stroke={COLORS.pink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.lightPink }}>{counterValue}</div>
          <div style={{ fontSize: 36, fontWeight: 600, color: COLORS.mutedPurple }}>creative swaps detected</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// === SCENE 2: TESTING VS WINNERS ===
const AdMockup: React.FC<{ label: string; lines: number[]; accent: string; delay: number }> = ({ label, lines, accent, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  const translateY = interpolate(progress, [0, 1], [60, 0]);
  return (
    <div style={{ width: 600, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 24, border: "2px solid rgba(255,255,255,0.08)", borderTop: `6px solid ${accent}`, padding: "44px 48px", opacity: progress, transform: `translateY(${translateY}px)` }}>
      <div style={{ fontSize: 36, fontWeight: 700, color: accent, marginBottom: 12 }}>{label}</div>
      <div style={{ width: "100%", height: 220, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, marginBottom: 28 }} />
      {lines.map((w, i) => <div key={i} style={{ width: `${w}%`, height: 16, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, marginBottom: i < lines.length - 1 ? 12 : 0 }} />)}
    </div>
  );
};

const PlatformCard: React.FC<{ platform: string; logo: string; layout: "vertical" | "horizontal"; delay: number }> = ({ platform, logo, layout, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  const translateY = interpolate(progress, [0, 1], [50, 0]);
  return (
    <div style={{ width: 680, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 24, border: "2px solid rgba(255,255,255,0.08)", padding: "44px 48px", opacity: progress, transform: `translateY(${translateY}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
        <Img src={staticFile(logo)} style={{ width: 48, height: 48, objectFit: "contain" }} />
        <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.lightPink }}>{platform}</div>
      </div>
      {layout === "vertical" ? (
        <>
          <div style={{ width: "100%", height: 280, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, marginBottom: 20 }} />
          <div style={{ width: "80%", height: 14, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 7, marginBottom: 10 }} />
          <div style={{ width: "60%", height: 14, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 7 }} />
        </>
      ) : (
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ width: 240, height: 240, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            <div style={{ width: "90%", height: 14, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 7 }} />
            <div style={{ width: "70%", height: 14, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 7 }} />
            <div style={{ width: "50%", height: 14, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 7 }} />
            <div style={{ width: 160, height: 44, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 22, marginTop: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
};

const SceneTestingWinners: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase1Opacity = interpolate(frame, [120, 145], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phase2Opacity = interpolate(frame, [145, 170], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const swapProgress = spring({ frame, fps, delay: 60, config: { damping: 200 } });
  const badgeProgress = spring({ frame, fps, delay: 85, config: { damping: 200 } });
  const neqProgress = spring({ frame: frame - 145, fps, delay: 30, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      <Background />
      <AbsoluteFill style={{ opacity: phase1Opacity }}>
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 180 }}>
          <div style={{ display: "flex", gap: 60, alignItems: "center", marginBottom: 60 }}>
            <AdMockup label="Variant A" lines={[90, 70, 50]} accent="#3B82F6" delay={10} />
            <div style={{ opacity: swapProgress, transform: `scale(${interpolate(swapProgress, [0, 1], [0.5, 1])})` }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                <path d="M7 16l-4-4 4-4" stroke={COLORS.pink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 8l4 4-4 4" stroke={COLORS.pink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 12h18" stroke={COLORS.pink} strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <AdMockup label="Variant B" lines={[75, 85, 65]} accent="#8B5CF6" delay={20} />
          </div>
          <div style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: "20px 56px", fontSize: 42, fontWeight: 700, color: "#EF4444", letterSpacing: "0.15em", opacity: badgeProgress, transform: `scale(${interpolate(badgeProgress, [0, 1], [0.85, 1])})` }}>NO WINNER YET</div>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: phase2Opacity }}>
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 60, paddingBottom: 180 }}>
          <PlatformCard platform="Facebook" logo="assets/logos/Faceebook_Logo.png" layout="horizontal" delay={0} />
          <div style={{ fontSize: 120, fontWeight: 700, color: COLORS.pink, opacity: frame > 145 ? neqProgress : 0, transform: `scale(${frame > 145 ? interpolate(neqProgress, [0, 1], [0.5, 1]) : 0})` }}>≠</div>
          <PlatformCard platform="Instagram" logo="assets/logos/Instagram_Logo.png" layout="vertical" delay={10} />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// === SCENE 3: LONG-RUNNING ADS ===
const SceneLongRunning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleProgress = spring({ frame, fps, delay: 5, config: { damping: 200 } });
  const timelineProgress = spring({ frame, fps, delay: 20, config: { damping: 200 } });
  const timelineWidth = interpolate(timelineProgress, [0, 1], [0, 100]);
  const starProgress = spring({ frame, fps, delay: 55, config: { damping: 200 } });
  const badgeProgress = spring({ frame, fps, delay: 70, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      <Background />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 180 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.2em", marginBottom: 100, opacity: titleProgress, transform: `translateY(${interpolate(titleProgress, [0, 1], [-40, 0])}px)` }}>LONG-RUNNING ADS</div>
        <div style={{ width: "75%", height: 24, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", marginBottom: 80 }}>
          <div style={{ width: `${timelineWidth}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.pink}, ${COLORS.lightPink})`, borderRadius: 12 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <svg width="72" height="72" viewBox="0 0 24 24" fill={COLORS.pink} style={{ opacity: starProgress, transform: `scale(${interpolate(starProgress, [0, 1], [0, 1])}) rotate(${interpolate(starProgress, [0, 1], [-90, 0])}deg)` }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <div style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "24px 56px", fontSize: 48, fontWeight: 700, color: COLORS.lightPink, letterSpacing: "0.12em", opacity: badgeProgress, transform: `scale(${interpolate(badgeProgress, [0, 1], [0.85, 1])})` }}>WORTH STUDYING</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// === SCENE 4: CREATIVE FORMATS ===
const FORMATS = [
  { label: "Video", ratio: 65, color: COLORS.pink },
  { label: "Image", ratio: 25, color: COLORS.lightPink },
  { label: "Carousel", ratio: 10, color: COLORS.mutedPurple },
];

const SceneCreativeFormats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleProgress = spring({ frame, fps, delay: 5, config: { damping: 200 } });
  const signalProgress = spring({ frame, fps, delay: 260, config: { damping: 200 } });
  const videoGrowProgress = spring({ frame, fps, delay: 180, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      <Background />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 140 }}>
        <div style={{ fontSize: 72, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.2em", marginBottom: 90, opacity: titleProgress, transform: `translateY(${interpolate(titleProgress, [0, 1], [-40, 0])}px)` }}>CREATIVE FORMAT ANALYSIS</div>
        <div style={{ display: "flex", gap: 64, marginBottom: 100 }}>
          {FORMATS.map((fmt, i) => {
            const cardProgress = spring({ frame, fps, delay: 30 + i * 15, config: { damping: 200 } });
            return (
              <div key={i} style={{ width: 460, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 28, border: "2px solid rgba(255,255,255,0.08)", padding: "52px 44px", textAlign: "center", opacity: cardProgress, transform: `translateY(${interpolate(cardProgress, [0, 1], [50, 0])}px)` }}>
                <div style={{ marginBottom: 24, fontSize: 56 }}>{i === 0 ? "🎬" : i === 1 ? "🖼️" : "📑"}</div>
                <div style={{ fontSize: 40, fontWeight: 600, color: fmt.color }}>{fmt.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ width: 1600, display: "flex", flexDirection: "column", gap: 36, marginBottom: 90 }}>
          {FORMATS.map((fmt, i) => {
            const barProgress = spring({ frame, fps, delay: 100 + i * 15, config: { damping: 200 } });
            const targetRatio = i === 0 ? interpolate(videoGrowProgress, [0, 1], [fmt.ratio, 85]) : fmt.ratio;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 28 }}>
                <div style={{ width: 160, fontSize: 36, fontWeight: 600, color: fmt.color, textAlign: "right" }}>{fmt.label}</div>
                <div style={{ flex: 1, height: 52, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 26, overflow: "hidden" }}>
                  <div style={{ width: `${targetRatio * barProgress}%`, height: "100%", backgroundColor: fmt.color, borderRadius: 26, opacity: 0.8 }} />
                </div>
                <div style={{ width: 100, fontSize: 36, fontWeight: 600, color: COLORS.mutedPurple }}>{Math.round(targetRatio * barProgress)}%</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, backgroundColor: "rgba(255,100,184,0.1)", border: `2px solid ${COLORS.pink}`, borderRadius: 24, padding: "32px 72px", opacity: signalProgress, transform: `scale(${interpolate(signalProgress, [0, 1], [0.85, 1])})` }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: COLORS.pink }}>3/4 COMPETITORS</div>
          <div style={{ fontSize: 56, fontWeight: 700, color: COLORS.mutedPurple }}>→</div>
          <div style={{ fontSize: 56, fontWeight: 700, color: COLORS.lightPink }}>VIDEO</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// === SCENE 5: REGIONAL MESSAGING ===
const COUNTRIES = [
  { name: "Brazil", x: "40.5%", y: "57%", accent: "#22C55E" },
  { name: "Germany", x: "51.5%", y: "35.5%", accent: "#EF4444" },
];
const FILTERS = ["Country", "Date Range", "Ad Format", "Language"];

const Pin: React.FC<{ x: string; y: string; accent: string; label: string; delay: number }> = ({ x, y, accent, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -100%) scale(${interpolate(progress, [0, 1], [0, 1])})`, opacity: progress, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ backgroundColor: accent, borderRadius: 10, padding: "8px 20px", fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 6, whiteSpace: "nowrap" }}>{label}</div>
      <svg width="24" height="32" viewBox="0 0 24 32"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill={accent} /><circle cx="12" cy="12" r="5" fill="#fff" /></svg>
    </div>
  );
};

const SceneRegionalMessaging: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mapProgress = spring({ frame, fps, delay: 5, config: { damping: 200 } });
  const filterProgress = spring({ frame, fps, delay: 25, config: { damping: 200 } });
  const splitProgress = spring({ frame, fps, delay: 160, config: { damping: 200 } });
  const insightProgress = spring({ frame, fps, delay: 320, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      <Background />
      <AbsoluteFill style={{ opacity: mapProgress * 0.12, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Img src={staticFile("assets/other/world.svg")} style={{ width: "65%", height: "auto", filter: "brightness(2)" }} />
      </AbsoluteFill>
      <AbsoluteFill>
        {COUNTRIES.map((country, i) => <Pin key={country.name} x={country.x} y={country.y} accent={country.accent} label={country.name} delay={60 + i * 20} />)}
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 280, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 24, opacity: filterProgress }}>
        {FILTERS.map((filter, i) => {
          const chipProgress = spring({ frame, fps, delay: 30 + i * 6, config: { damping: 200 } });
          const isActive = i === 0;
          return <div key={i} style={{ backgroundColor: isActive ? "rgba(255,100,184,0.15)" : "rgba(255,255,255,0.04)", border: `2px solid ${isActive ? COLORS.pink : "rgba(255,255,255,0.08)"}`, borderRadius: 40, padding: "16px 36px", fontSize: 28, fontWeight: 600, color: isActive ? COLORS.pink : COLORS.mutedPurple, opacity: chipProgress, transform: `translateY(${interpolate(chipProgress, [0, 1], [20, 0])}px)` }}>{filter}</div>;
        })}
      </div>
      <div style={{ position: "absolute", bottom: 360, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40, opacity: splitProgress }}>
        <div style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "2px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "24px 36px", textAlign: "center", transform: `translateX(${interpolate(splitProgress, [0, 1], [-40, 0])}px)` }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#22C55E", letterSpacing: "0.2em", marginBottom: 10 }}>BRAZIL</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.lightPink }}>$99.99</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#22C55E", opacity: 0.7, marginTop: 6 }}>PRICE-LED</div>
        </div>
        <div style={{ width: 3, backgroundColor: COLORS.pink, opacity: splitProgress * 0.4, margin: "12px 0" }} />
        <div style={{ backgroundColor: "rgba(239,68,68,0.07)", border: "2px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: "24px 36px", textAlign: "center", transform: `translateX(${interpolate(splitProgress, [0, 1], [40, 0])}px)` }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#EF4444", letterSpacing: "0.2em", marginBottom: 10 }}>GERMANY</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.lightPink }}>Organic</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#EF4444", opacity: 0.7, marginTop: 6 }}>INGREDIENT-LED</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 270, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: insightProgress, transform: `translateY(${interpolate(insightProgress, [0, 1], [20, 0])}px)` }}>
        <div style={{ backgroundColor: "rgba(255,100,184,0.1)", border: `2px solid ${COLORS.pink}`, borderRadius: 14, padding: "14px 40px", fontSize: 30, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.15em" }}>POSITIONING INSIGHTS</div>
      </div>
    </AbsoluteFill>
  );
};

// === SCENE 6: PRICE SCRAPING ===
const PIPELINE_NODES = [
  { label: "FB Ad Library", sublabel: "Discover ads" },
  { label: "CTA Links", sublabel: "Extract URLs" },
  { label: "Product Page", sublabel: "Scrape content" },
  { label: "Price Data", sublabel: "Compare prices" },
];
const EXTRACTED_PRICES = [
  { competitor: "Competitor A", price: "$49.99", change: "-12%", trend: "down" },
  { competitor: "Competitor B", price: "$64.50", change: "+3%", trend: "up" },
  { competitor: "Competitor C", price: "$52.00", change: "-8%", trend: "down" },
];

const PipelineNode: React.FC<{ node: (typeof PIPELINE_NODES)[number]; index: number; delay: number }> = ({ node, index, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ width: 300, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 24, border: "2px solid rgba(255,255,255,0.08)", padding: "36px 28px", textAlign: "center", opacity: progress, transform: `scale(${interpolate(progress, [0, 1], [0.85, 1])})` }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{["📋", "🔗", "🛒", "💰"][index]}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.lightPink, marginBottom: 6 }}>{node.label}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.mutedPurple }}>{node.sublabel}</div>
      </div>
      {index < PIPELINE_NODES.length - 1 && (
        <div style={{ width: 64 }}>
          <svg width="64" height="24" viewBox="0 0 64 24">
            <line x1="4" y1="12" x2={4 + 48 * progress} y2="12" stroke={COLORS.pink} strokeWidth="2" strokeLinecap="round" opacity={0.3} />
            <path d="M50 6l8 6-8 6" stroke={COLORS.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={progress * 0.5} />
          </svg>
        </div>
      )}
    </div>
  );
};

const PriceRow: React.FC<{ data: (typeof EXTRACTED_PRICES)[number]; delay: number; index: number }> = ({ data, delay, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  const priceProgress = spring({ frame, fps, delay: delay + 8, config: { damping: 200 } });
  const isDown = data.trend === "down";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 40, padding: "20px 40px", backgroundColor: index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderRadius: 12, opacity: progress, transform: `translateX(${interpolate(progress, [0, 1], [30, 0])}px)` }}>
      <div style={{ width: 220, fontSize: 26, fontWeight: 600, color: COLORS.lightPink }}>{data.competitor}</div>
      <div style={{ width: 140, fontSize: 32, fontWeight: 700, color: COLORS.lightPink, transform: `scale(${interpolate(priceProgress, [0, 1], [0.8, 1])})` }}>{data.price}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 24, fontWeight: 700, color: isDown ? "#22C55E" : "#EF4444", opacity: priceProgress }}>{data.change}</div>
    </div>
  );
};

const ScenePriceScraping: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dashboardDelay = 200;
  const dashboardProgress = spring({ frame, fps, delay: dashboardDelay, config: { damping: 200 } });
  const dashboardHeaderProgress = spring({ frame, fps, delay: dashboardDelay + 10, config: { damping: 200 } });
  const logoDelay = 340;
  const logoProgress = spring({ frame, fps, delay: logoDelay, config: { damping: 200 } });
  const lockupProgress = spring({ frame, fps, delay: logoDelay + 25, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      <Background />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 80 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 72 }}>
          {PIPELINE_NODES.map((node, i) => <PipelineNode key={i} node={node} index={i} delay={20 + i * 35} />)}
        </div>
        <div style={{ width: 800, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 24, border: "2px solid rgba(255,255,255,0.06)", padding: "28px 32px", marginBottom: 64, opacity: dashboardProgress, transform: `translateY(${interpolate(dashboardProgress, [0, 1], [40, 0])}px)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", opacity: dashboardHeaderProgress }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.1em" }}>EXTRACTED PRICES</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.mutedPurple }}>Live data</div>
          </div>
          {EXTRACTED_PRICES.map((data, i) => <PriceRow key={i} data={data} delay={dashboardDelay + 25 + i * 12} index={i} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <div style={{ opacity: logoProgress, transform: `translateY(${interpolate(logoProgress, [0, 1], [20, 0])}px)` }}>
            <Img src={staticFile("assets/logos/Apify Logo white Wordmark.svg")} style={{ height: 64 }} />
          </div>
          <div style={{ backgroundColor: "rgba(255,100,184,0.08)", border: "2px solid rgba(255,100,184,0.2)", borderRadius: 20, padding: "24px 56px", fontSize: 38, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.12em", opacity: lockupProgress, transform: `scale(${interpolate(lockupProgress, [0, 1], [0.9, 1])})` }}>E-COMMERCE INTELLIGENCE ENGINE</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// === SCENE 7: PAGE TRANSPARENCY ===
const CONTINENTS = [
  { name: "North America", x: "28%", y: "38%" },
  { name: "Europe", x: "52%", y: "35%" },
  { name: "Asia", x: "68%", y: "38%" },
];

const ContinentPin: React.FC<{ x: string; y: string; label: string; delay: number }> = ({ x, y, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${interpolate(progress, [0, 1], [0, 1])})`, opacity: progress, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: 24, border: `3px solid ${COLORS.pink}`, backgroundColor: "rgba(255,100,184,0.2)", marginBottom: 12 }} />
      <div style={{ backgroundColor: "rgba(255,100,184,0.15)", borderRadius: 10, padding: "8px 20px", fontSize: 22, fontWeight: 600, color: COLORS.pink, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
};

const ScenePageTransparency: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mapProgress = spring({ frame, fps, delay: 5, config: { damping: 200 } });
  const labelProgress = spring({ frame, fps, delay: 180, config: { damping: 200 } });
  const linesProgress = spring({ frame, fps, delay: 240, config: { damping: 200 } });
  const pinPositions = [{ x: 28, y: 38 }, { x: 52, y: 35 }, { x: 68, y: 38 }];

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      <Background />
      <AbsoluteFill style={{ opacity: mapProgress * 0.15, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Img src={staticFile("assets/other/world.svg")} style={{ width: "70%", height: "auto", filter: "brightness(2)" }} />
      </AbsoluteFill>
      <AbsoluteFill>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: linesProgress * 0.4 }}>
          {pinPositions.map((from, i) => pinPositions.map((to, j) => {
            if (j <= i) return null;
            return <line key={`${i}-${j}`} x1={from.x} y1={from.y} x2={from.x + (to.x - from.x) * linesProgress} y2={from.y + (to.y - from.y) * linesProgress} stroke={COLORS.pink} strokeWidth="0.15" strokeDasharray="0.5 0.5" />;
          }))}
        </svg>
      </AbsoluteFill>
      <AbsoluteFill>
        {CONTINENTS.map((c, i) => <ContinentPin key={c.name} x={c.x} y={c.y} label={c.name} delay={40 + i * 25} />)}
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 340, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: labelProgress, transform: `scale(${interpolate(labelProgress, [0, 1], [0.85, 1])})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: COLORS.lightPink }}>LOCAL BRAND</div>
          <div style={{ fontSize: 72, fontWeight: 700, color: COLORS.pink }}>?</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 240, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: labelProgress * 0.8 }}>
        <div style={{ fontSize: 36, fontWeight: 600, color: COLORS.mutedPurple, letterSpacing: "0.1em" }}>Admins on 3 continents</div>
      </div>
    </AbsoluteFill>
  );
};

// === MAIN COMPOSITION ===
const BlackScreen: React.FC = () => <AbsoluteFill style={{ backgroundColor: COLORS.bg }} />;

const AdIntelligence: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={20}>
        <BlackScreen />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />

      <TransitionSeries.Sequence durationInFrames={301 + TRANSITION}>
        <SceneRefreshFrequency />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />

      <TransitionSeries.Sequence durationInFrames={325 + TRANSITION}>
        <SceneTestingWinners />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />

      <TransitionSeries.Sequence durationInFrames={131 + TRANSITION}>
        <SceneLongRunning />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />

      <TransitionSeries.Sequence durationInFrames={410 + TRANSITION}>
        <SceneCreativeFormats />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />

      <TransitionSeries.Sequence durationInFrames={473 + TRANSITION}>
        <SceneRegionalMessaging />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />

      <TransitionSeries.Sequence durationInFrames={495 + TRANSITION}>
        <ScenePriceScraping />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />

      <TransitionSeries.Sequence durationInFrames={465 + TRANSITION}>
        <ScenePageTransparency />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />

      <TransitionSeries.Sequence durationInFrames={25}>
        <BlackScreen />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export default AdIntelligence;
