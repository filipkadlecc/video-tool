// Beats 4-6 — the failures, and their reversal.
//   • sign-up window swipes in from the right, a field tries to focus, red X strikes
//   • swipe to a (fake) credit card, sheen sweep, red X strikes
//   • beat 5: everything goes cold and holds (breathing)
//   • beat 6: the card's red X retracts, a teal check draws on, the card lifts into light
//
// Local frame (Sequence from=134): 0..184.  global = local + 134.
// Phase gates (local): signup in 0-16 · X 30-46 · recoil 46-58 · swipe 60-74 ·
//   card in 60-74 · card X 88-100 · HOLD 100-129 · pivot 129-184.
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { springIn } from "../../motion";
import { C, SANS, DISPLAY, CARD, SHADOW_SOFT, SHADOW_LIFT } from "./constants";
import { ramp } from "./shared";
import { Mark } from "./Mark";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerpColor = (t: number, a: string, b: string) => (t < 0.5 ? a : b); // coarse swap is fine for the field flicker

export const FailureStage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);

  // Local frame (Sequence from=175): 0..213. global = local + 175.
  // ===================== SIGN-UP WINDOW (global 175-226) =====================
  // The sign-up window REFORMS in place from the chat-window footprint (the
  // WindowStage box reshapes to signW x signH and fades out as this fades in).
  const signW = width * 0.34, signH = height * 0.4; // must match WindowStage morph target
  const signupReform = springIn(frame, fps, 4, "SNAPPY"); // empty card fades/scales in
  const signupContentIn = ramp(frame, [12, 26], [0, 1]); // form fades in just after
  const signupScale = interpolate(signupReform, [0, 1], [0.96, 1]);
  const signupX = springIn(frame, fps, 28, "SNAPPY"); // red X draws on (global ~203)
  const signupRecoil = 1 - 0.02 * ramp(frame, [44, 47, 54], [0, 1, 0]);
  const signupShake = Math.sin((frame - 44) * 1.5) * base * 0.002 * ramp(frame, [44, 45, 52], [0, 1, 0]);
  const signupOut = ramp(frame, [51, 65], [0, 1]); // swipes out left as the card arrives (global 226)
  const signupTX = -signupOut * width * 0.7;
  const signupOpacity = signupReform * (1 - signupOut);
  const signupPunch = 1 + 0.06 * ramp(frame, [38, 42, 48], [0, 1, 0]); // strike pop
  const fieldFocus = ramp(frame, [16, 22, 28], [0, 1, 0]); // a focus/auto-fill attempt

  // ===================== CREDIT CARD (global 226-304) =====================
  const cardIn = springIn(frame, fps, 51, "SNAPPY"); // global 226
  const cardTX = interpolate(cardIn, [0, 1], [width * 0.7, 0]);
  const cardRotY = interpolate(cardIn, [0, 1], [18, 0]);
  const sheen = ramp(frame, [74, 86], [-1.3, 1.3]); // highlight sweep across the card
  const cardXraw = springIn(frame, fps, 96, "SNAPPY"); // global 271
  const cardRecoil = 1 - 0.02 * ramp(frame, [110, 113, 120], [0, 1, 0]);

  // ----- hold (global 304-339 = local 129-164): cold; warmth on pivot -----
  const sat = ramp(frame, [116, 130, 164, 181], [1, 0.82, 0.82, 1.06]);
  const bright = ramp(frame, [116, 130, 164, 181], [1, 0.92, 0.92, 1.04]);

  // ----- pivot (global 339 = local 164): X -> checkmark -----
  const compress = 1 - 0.012 * ramp(frame, [160, 163, 167], [0, 1, 0]); // anticipation inhale
  const retract = ramp(frame, [164, 178], [0, 1]);                       // X un-draws
  const cardX = cardXraw * (1 - retract);
  const check = springIn(frame, fps, 178, "SNAPPY");                     // teal check draws
  const lift = springIn(frame, fps, 188, "SNAPPY");
  const liftY = -base * 0.02 * lift;
  const liftScale = 1 + 0.05 * lift;
  // card mark pop: a punch on the X strike, and again on the check confirm
  const cardMarkPunch = 1 + 0.06 * ramp(frame, [106, 110, 116], [0, 1, 0]) + 0.09 * ramp(frame, [198, 203, 209], [0, 1, 0]);
  const stripeGlow = ramp(frame, [178, 196], [0, 1]); // orange accent brightens
  const warmGlow = ramp(frame, [164, 181, 214], [0, 0.5, 0.32]);

  const cardW = width * 0.4;
  const cardH = cardW * 0.62;

  const markSize = base * 0.27;

  return (
    <AbsoluteFill>
      {/* ---------- SIGN-UP WINDOW ---------- */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: signW,
            height: signH,
            transform: `translateX(${signupTX + signupShake}px) scale(${signupScale * signupRecoil})`,
            opacity: signupOpacity,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: base * 0.018,
            overflow: "hidden",
            boxShadow: SHADOW_SOFT,
          }}
        >
          {/* form content — fades in just after the card reforms */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: `${base * 0.034}px ${base * 0.032}px`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              opacity: signupContentIn,
            }}
          >
            <div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: base * 0.026, color: C.text }}>
                Create your account
              </div>
              <div style={{ fontFamily: SANS, fontSize: base * 0.014, color: C.textSubtle, marginTop: base * 0.008 }}>
                Start your free trial — no setup required.
              </div>
            </div>
            <div>
              <Field base={base} label="Email" focus={fieldFocus} />
              <div style={{ height: base * 0.014 }} />
              <Field base={base} label="Password" focus={0} masked />
            </div>
            <div
              style={{
                height: base * 0.05,
                borderRadius: base * 0.01,
                background: C.saas,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: base * 0.016,
                color: "#fff",
              }}
            >
              Sign up
            </div>
          </div>

          {/* X over the signup */}
          <Centered>
            <Mark size={markSize} xProgress={clamp01(signupX) * (1 - signupOut)} stroke2Lag={0.18} punch={signupPunch} />
          </Centered>
        </div>
      </AbsoluteFill>

      {/* ---------- CREDIT CARD ---------- */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", perspective: base * 2.2 }}>
        <div
          style={{
            position: "relative",
            opacity: cardIn,
            transform: `translateX(${cardTX}px) translateY(${liftY}px) scale(${liftScale * cardRecoil * compress})`,
            filter: `saturate(${sat}) brightness(${bright})`,
          }}
        >
          {/* warm orange bloom behind the card (beat 6) */}
          <div
            style={{
              position: "absolute",
              inset: `-${base * 0.06}px`,
              borderRadius: base * 0.05,
              background: `radial-gradient(closest-side, rgba(248,102,6,${0.45 * warmGlow}), rgba(248,102,6,0))`,
              filter: `blur(${base * 0.02}px)`,
              opacity: warmGlow > 0.01 ? 1 : 0,
            }}
          />
          {/* card face */}
          <div
            style={{
              position: "relative",
              width: cardW,
              height: cardH,
              borderRadius: base * 0.022,
              overflow: "hidden",
              transform: `rotateY(${cardRotY}deg)`,
              background: "linear-gradient(135deg, #2a2c2f 0%, #1b1c1e 60%, #161718 100%)",
              border: `1px solid ${C.border}`,
              boxShadow: lift > 0.02 ? SHADOW_LIFT : SHADOW_SOFT,
              padding: `${base * 0.03}px ${base * 0.034}px`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* orange accent stripe (brand punctuation) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: base * 0.012,
                height: "100%",
                background: C.orange,
                opacity: 0.55 + 0.45 * stripeGlow,
                boxShadow: stripeGlow > 0.02 ? `0 0 ${base * 0.02 * stripeGlow}px rgba(248,102,6,0.7)` : "none",
              }}
            />
            {/* top row: kind + brand mark */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: base * 0.015, color: C.textMuted, letterSpacing: "0.12em" }}>
                {CARD.kind}
              </div>
              <div style={{ display: "flex" }}>
                <div style={{ width: base * 0.03, height: base * 0.03, borderRadius: "50%", background: "rgba(248,102,6,0.85)" }} />
                <div style={{ width: base * 0.03, height: base * 0.03, borderRadius: "50%", background: "rgba(255,255,255,0.32)", marginLeft: -base * 0.012 }} />
              </div>
            </div>
            {/* chip */}
            <div style={{ width: base * 0.05, height: base * 0.038, borderRadius: base * 0.006, background: "linear-gradient(135deg,#d9b56a,#a07c33)", marginTop: -base * 0.01 }} />
            {/* number */}
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: base * 0.026, color: C.text, letterSpacing: "0.06em" }}>
              {CARD.number}
            </div>
            {/* bottom row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontFamily: SANS, fontSize: base * 0.0095, color: C.textSubtle, letterSpacing: "0.14em" }}>CARD HOLDER</div>
                <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: base * 0.015, color: C.textMuted, letterSpacing: "0.06em" }}>{CARD.name}</div>
              </div>
              <div>
                <div style={{ fontFamily: SANS, fontSize: base * 0.0095, color: C.textSubtle, letterSpacing: "0.14em" }}>EXPIRES</div>
                <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: base * 0.015, color: C.textMuted }}>{CARD.expiry}</div>
              </div>
            </div>
            {/* specular sheen sweep */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: "55%",
                transform: `translateX(${sheen * cardW}px) skewX(-18deg)`,
                background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.14), rgba(255,255,255,0))",
                opacity: sheen > -1.2 && sheen < 1.2 ? 1 : 0,
              }}
            />
          </div>

          {/* X -> check over the card */}
          <Centered>
            <Mark size={markSize} xProgress={cardX} checkProgress={check} stroke2Lag={0.18} punch={cardMarkPunch} />
          </Centered>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
    {children}
  </div>
);

const Field: React.FC<{ base: number; label: string; focus: number; masked?: boolean }> = ({ base, label, focus, masked }) => (
  <div
    style={{
      borderRadius: base * 0.009,
      border: `1.5px solid ${lerpColor(focus, C.border, C.saas)}`,
      background: C.cardHi,
      padding: `${base * 0.013}px ${base * 0.016}px`,
      boxShadow: focus > 0.05 ? `0 0 ${base * 0.012 * focus}px rgba(91,108,255,${0.5 * focus})` : "none",
    }}
  >
    <div style={{ fontFamily: SANS, fontSize: base * 0.0095, color: C.textSubtle, letterSpacing: "0.06em" }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", height: base * 0.02 }}>
      <div style={{ fontFamily: SANS, fontSize: base * 0.014, color: C.textSubtle, opacity: 0.5 }}>
        {masked ? "••••••••" : ""}
      </div>
      {/* a cursor that appears during the focus attempt, then gives up */}
      <div style={{ width: base * 0.0015, height: base * 0.018, background: C.saas, opacity: focus > 0.3 ? 0.9 : 0, marginLeft: 1 }} />
    </div>
  </div>
);
