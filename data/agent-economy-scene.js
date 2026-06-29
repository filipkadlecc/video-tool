/* ============================================================================
   AGENT ECONOMY — per-beat SHOT SEQUENCE (full-frame B-roll)
   4K · 25fps · ~2:50. ~25 distinct animated shots, one per script beat, cut
   together and FRAME-SYNCED to the VO (each shot's `start` is its exact 25fps
   frame). Literal explainer: code, counters, cards, numbers. Built once;
   render() mutates only transform/opacity (+ counter textContent). Deterministic.
   ========================================================================== */

function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerp(a,b,t){ return a + (b - a) * t; }
function smooth(v){ v = clamp01(v); return v * v * (3 - 2 * v); }
function fix2(n){ return (Math.round(n*100)/100).toFixed(2); }
function human(n){ n = Math.round(n); if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return ''+n; }
function blink(lf){ return (Math.floor(lf/8) % 2) ? 0.95 : 0.18; }

var MONO = 'ui-monospace, Menlo, monospace';
var FH = F.marketing;
var OR = C.orange, TX = C.text, MU = C.textMuted, SUB = C.textSubtle, CARD = C.card, BD = C.border;
var bw = base * 0.0014;     // hairline border width
var rad = base * 0.014;     // card radius

// ---- element helpers -------------------------------------------------------
function E(css, parent){ var d = document.createElement('div'); d.style.cssText = css; (parent || stage).appendChild(d); return d; }
function T(parent, css, str){ var d = E(css, parent); if (str != null) d.textContent = str; return d; }
function HEAD(parent, px, str, color, css){ return T(parent, 'font-family:' + FH + '; font-weight:600; font-size:' + px + 'px; letter-spacing:-0.02em; line-height:1.06; color:' + (color || TX) + ';' + (css || ''), str); }
function M(parent, px, str, color, css){ return T(parent, 'font-family:' + MONO + '; font-size:' + px + 'px; letter-spacing:0.02em; color:' + (color || MU) + ';' + (css || ''), str); }
function LBL(parent, px, str, color){ return T(parent, 'font-family:' + MONO + '; font-weight:600; font-size:' + px + 'px; letter-spacing:0.3em; text-transform:uppercase; color:' + (color || SUB) + ';', str); }
function panel(parent, css){ return E('background:' + CARD + '; border:' + bw + 'px solid ' + BD + '; border-radius:' + rad + 'px; box-shadow:0 ' + (base*0.014) + 'px ' + (base*0.045) + 'px rgba(0,0,0,0.5);' + (css || ''), parent); }
function stack(root, gap, topPct){ return E('position:absolute; left:50%; top:' + (topPct || 46) + '%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:' + gap + 'px;', root); }
function row(parent, gap, css){ return E('display:flex; flex-direction:row; align-items:center; gap:' + gap + 'px;' + (css || ''), parent); }
function icon(parent, sz, svg, color){ var d = E('width:' + sz + 'px; height:' + sz + 'px; color:' + (color || TX) + ';', parent); d.innerHTML = svg; return d; }

// entrance helpers (operate on flex children — no layout transform conflict)
function enter(el, p, dy, ds){ if (dy == null) dy = base*0.035; if (ds == null) ds = 0.96; var c = clamp01(p); el.style.opacity = c; el.style.transform = 'translateY(' + ((1-c)*dy) + 'px) scale(' + lerp(ds,1,c) + ')'; }
function enterX(el, p){ var c = clamp01(p); el.style.opacity = c; el.style.transform = 'translateX(' + ((1-c)*base*0.02) + 'px)'; }
function reveal(els, lf, start, per){ for (var i=0;i<els.length;i++) enter(els[i], clamp01((lf - (start + i*per))/12)); }
function pop(lf, at, dur){ if (lf < at || lf > at+dur) return 0; return Math.sin(((lf-at)/dur)*Math.PI); }

// ---- inline SVG icons (stroke = currentColor) ------------------------------
function sv(inner, sw){ return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="' + (sw||2) + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
var IC = {
  terminal: sv('<path d="M4 5 L10 12 L4 19"/><path d="M12.5 19 H20"/>', 2.2),
  code: sv('<path d="M8 6 L3 12 L8 18"/><path d="M16 6 L21 12 L16 18"/>', 2),
  api: sv('<path d="M7 4 a4 8 0 0 0 0 16"/><path d="M17 4 a4 8 0 0 1 0 16"/><path d="M9 12 H15"/>', 2),
  globe: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12 H21"/><path d="M12 3 a14 14 0 0 1 0 18 a14 14 0 0 1 0 -18"/>', 1.8),
  lock: sv('<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5 V7.6 a4 4 0 0 1 8 0 V10.5"/>', 2.2),
  check: sv('<path d="M5 13 l4.2 4.2 L19 6.5"/>', 2.6),
  x: sv('<path d="M6 6 L18 18"/><path d="M18 6 L6 18"/>', 2.6),
  wallet: sv('<rect x="3" y="6" width="18" height="13" rx="2.4"/><path d="M3 9 H21"/><circle cx="17" cy="14" r="1.3" fill="currentColor" stroke="none"/>', 2),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/>', 2.1),
  flag: sv('<path d="M6 21 V4"/><path d="M6 4 H18 l-3 4 3 4 H6"/>', 2),
  chart: sv('<path d="M4 20 H20"/><rect x="6" y="11" width="3" height="6"/><rect x="11" y="7" width="3" height="10"/><rect x="16" y="13" width="3" height="4"/>', 2),
  server: sv('<rect x="3.5" y="4" width="17" height="6" rx="1.6"/><rect x="3.5" y="13" width="17" height="6" rx="1.6"/><circle cx="7" cy="7" r="0.9" fill="currentColor" stroke="none"/><circle cx="7" cy="16" r="0.9" fill="currentColor" stroke="none"/>', 2),
  branch: sv('<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M8.4 6 H13 a3 3 0 0 1 3 3 V9.6"/><path d="M8.4 18 H13 a3 3 0 0 0 3 -3 V14.4"/>', 2),
  doc: sv('<path d="M7 3 H14 L19 8 V21 H7 Z"/><path d="M14 3 V8 H19"/><path d="M10 13 H16"/><path d="M10 16.5 H16"/>', 1.9),
  coin: sv('<ellipse cx="12" cy="6.5" rx="8" ry="3"/><path d="M4 6.5 V17.5 a8 3 0 0 0 16 0 V6.5"/>', 1.9),
  bolt: sv('<path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z"/>', 1.8)
};

// ---- mini node mark (reused agent / server) --------------------------------
function mark(parent, cx, cy, r, glyph, accent){
  var w = E('position:absolute; left:' + (cx-r) + 'px; top:' + (cy-r) + 'px; width:' + (2*r) + 'px; height:' + (2*r) + 'px; transform-origin:50% 50%;', parent);
  E('position:absolute; left:50%; top:50%; width:' + (r*3.2) + 'px; height:' + (r*3.2) + 'px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, rgba(248,120,40,0.22), rgba(248,102,6,0) 62%); opacity:' + (accent?1:0.5) + ';', w);
  E('position:absolute; inset:0; border-radius:50%; border:' + bw + 'px solid ' + BD + ';', w);
  E('position:absolute; inset:' + (r*0.16) + 'px; border-radius:50%; background:' + CARD + '; border:' + bw + 'px solid ' + (accent?OR:BD) + ';', w);
  var ig = E('position:absolute; left:50%; top:50%; width:' + (r*0.92) + 'px; height:' + (r*0.92) + 'px; transform:translate(-50%,-50%); color:' + (accent?OR:TX) + ';', w); ig.innerHTML = glyph;
  return w;
}

// ============================================================================
//  SHOT REGISTRY
// ============================================================================
var DUR = 4255;
var bg = E('position:absolute; inset:0; background:radial-gradient(120% 110% at 50% 42%, #1e2024 0%, ' + C.bg + ' 66%);', stage);
var gridStep = base * 0.05;
var grid = E('position:absolute; inset:-6%; opacity:0.5; background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px); background-size:' + gridStep + 'px ' + gridStep + 'px,' + gridStep + 'px ' + gridStep + 'px;', stage);
var shotLayer = E('position:absolute; inset:0;', stage);

var defs = [];
function S(start, fn){ defs.push({ start: start, fn: fn }); }

// ---- SHOT 1 · capabilities — ONE icon morphs through plan->code->api->globe -
S(0, function(root){
  var slot = E('position:absolute; left:50%; top:46%; transform:translate(-50%,-50%); width:' + (base*0.2) + 'px; height:' + (base*0.2) + 'px;', root);
  var glow = E('position:absolute; left:50%; top:50%; width:' + (base*0.34) + 'px; height:' + (base*0.34) + 'px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, rgba(248,120,40,0.24), rgba(248,102,6,0) 64%);', slot);
  var seq = [IC.branch, IC.code, IC.api, IC.globe];   // plan -> write code -> call API -> live web data
  var cols = [TX, TX, TX, OR];
  var els = seq.map(function(g, i){ var e = E('position:absolute; left:50%; top:50%; width:' + (base*0.15) + 'px; height:' + (base*0.15) + 'px; transform:translate(-50%,-50%); color:' + cols[i] + ';', slot); e.innerHTML = g; return e; });
  var SEG = 26, last = els.length - 1;
  return function(lf){
    for (var i = 0; i < els.length; i++) {
      var s0 = i * SEG;
      var inP = smooth(clamp01((lf - s0) / 13));
      var outP = (i === last) ? 0 : smooth(clamp01((lf - (s0 + SEG)) / 13));
      var op = inP * (1 - outP);
      var sc = lerp(0.55, 1, inP) * lerp(1, 1.55, outP);     // incoming grows in, outgoing grows out + fades = morph
      var rot = (1 - inP) * -10 + outP * 10;
      els[i].style.opacity = op;
      els[i].style.transform = 'translate(-50%,-50%) scale(' + sc + ') rotate(' + rot + 'deg)';
    }
    var merge = pop(lf, SEG, 22) + pop(lf, SEG*2, 22) + pop(lf, SEG*3, 24);
    glow.style.opacity = clamp01(0.35 * clamp01(lf/12) + merge * 0.6);
    glow.style.transform = 'translate(-50%,-50%) scale(' + (1 + merge * 0.18) + ')';
  };
});

// ---- SHOT 2 · it just fails / can't pay ------------------------------------
S(113, function(root){
  var st = stack(root, base*0.022, 46);
  var card = panel(st, 'width:' + (W*0.34) + 'px; padding:' + (base*0.034) + 'px; position:relative;');
  LBL(card, base*0.018, 'SIGN UP TO CONTINUE', SUB);
  var f1 = E('margin-top:' + (base*0.022) + 'px; height:' + (base*0.05) + 'px; border-radius:' + (base*0.008) + 'px; background:#26282c; border:' + bw + 'px solid ' + BD + ';', card);
  var f2 = E('margin-top:' + (base*0.016) + 'px; height:' + (base*0.05) + 'px; border-radius:' + (base*0.008) + 'px; background:#26282c; border:' + bw + 'px solid ' + BD + ';', card);
  var cc = M(card, base*0.026, '****  ****  ****  ****', SUB, 'margin-top:' + (base*0.02) + 'px; letter-spacing:0.2em;');
  var stamp = E('position:absolute; left:50%; top:50%; width:' + (base*0.14) + 'px; height:' + (base*0.14) + 'px; transform:translate(-50%,-50%) rotate(-12deg); color:' + OR + ';', card); stamp.innerHTML = IC.x;
  var lab = LBL(st, base*0.022, 'PAYMENT BLOCKED', OR);
  return function(lf){
    enter(card, clamp01(lf/14));
    var sp = clamp01(springIn(lf, FPS, 26, 'SNAPPY')); stamp.style.opacity = sp; stamp.style.transform = 'translate(-50%,-50%) rotate(-12deg) scale(' + lerp(1.6,1,sp) + ')';
    enter(lab, clamp01((lf-40)/12));
    var shake = (lf>26 && lf<46) ? Math.sin(lf*2.4)*base*0.004 : 0;       // brief shake on block
    var dimQuit = interpolate(lf, [110, 150], [1, 0.5], { extrapolateLeft:'clamp', extrapolateRight:'clamp' }); // "that's where it quits"
    card.style.opacity = clamp01(lf/14) * dimQuit;
    card.style.marginLeft = shake + 'px';
  };
});

// ---- SHOT 3 · the turn: "but from today it doesn't" ------------------------
S(263, function(root){
  var st = stack(root, base*0.018, 46);
  var big = HEAD(st, base*0.16, 'x402', OR, 'letter-spacing:-0.04em; font-weight:700;');
  var line = E('width:' + (base*0.34) + 'px; height:' + (base*0.006) + 'px; background:' + OR + '; border-radius:99px; transform-origin:left center;', st);
  var sub = HEAD(st, base*0.034, 'payments for AI agents', MU);
  var flash = E('position:absolute; inset:0; background:radial-gradient(circle at 50% 46%, rgba(255,180,110,0.5), rgba(255,180,110,0) 40%);', root);
  return function(lf){
    var p = clamp01(springIn(lf, FPS, 4, 'SNAPPY')); big.style.opacity = clamp01(lf/6); big.style.transform = 'scale(' + lerp(0.7,1,p) + ')';
    line.style.opacity = 1; line.style.transform = 'scaleX(' + clamp01((lf-12)/16) + ')';
    enter(sub, clamp01((lf-22)/14));
    flash.style.opacity = pop(lf, 0, 26) * 0.9;
  };
});

// ---- SHOT 4 · intro / brand interstitial -----------------------------------
S(371, function(root){
  var ax = W*0.33, sx = W*0.67, cy = H*0.44;
  var a = mark(root, ax, cy, base*0.06, IC.terminal, false);
  var s = mark(root, sx, cy, base*0.06, IC.server, true);
  var wire = E('position:absolute; left:' + (ax+base*0.07) + 'px; top:' + (cy-base*0.0012) + 'px; width:' + (sx-ax-base*0.14) + 'px; height:' + (base*0.0024) + 'px; background:' + OR + '; transform-origin:left center; border-radius:99px;', root);
  var law = E('position:absolute; left:' + ax + 'px; top:' + (cy+base*0.085) + 'px; transform:translateX(-50%);', root); LBL(law, base*0.018, 'AGENT', SUB);
  var lsw = E('position:absolute; left:' + sx + 'px; top:' + (cy+base*0.085) + 'px; transform:translateX(-50%);', root); LBL(lsw, base*0.018, 'APIFY', SUB);
  var capw = E('position:absolute; left:50%; top:' + (cy+base*0.16) + 'px; transform:translateX(-50%); text-align:center;', root); var cap = HEAD(capw, base*0.03, 'an agent that can pay', MU);
  return function(lf){
    var pa = clamp01(springIn(lf, FPS, 2, 'SNAPPY')); a.style.opacity = pa; a.style.transform = 'scale(' + pa + ')';
    var ps = clamp01(springIn(lf, FPS, 14, 'SNAPPY')); s.style.opacity = ps; s.style.transform = 'scale(' + ps + ')';
    wire.style.transform = 'scaleX(' + clamp01((lf-22)/22) + ')';
    law.style.opacity = clamp01((lf-8)/12); lsw.style.opacity = clamp01((lf-20)/12);
    enter(cap, clamp01((lf-40)/14));
  };
});

// ---- SHOT 5 · pay-as-you-go ------------------------------------------------
S(556, function(root){
  var st = stack(root, base*0.026, 46);
  LBL(st, base*0.02, 'PAY-AS-YOU-GO', OR);
  var num = HEAD(st, base*0.13, '$0.00', TX, 'font-family:' + MONO + '; font-weight:700;');
  var card = panel(st, 'width:' + (W*0.32) + 'px; padding:' + (base*0.022) + 'px;');
  var track = E('height:' + (base*0.016) + 'px; border-radius:99px; background:#26282c; overflow:hidden;', card);
  var fill = E('height:100%; width:100%; transform-origin:left center; background:linear-gradient(90deg,' + OR + ',' + C.orangeDeep + ');', track);
  var foot = M(card, base*0.02, 'you only pay for what the run consumes', SUB, 'margin-top:' + (base*0.016) + 'px;');
  return function(lf){
    reveal([st.children[0], num, card], lf, 4, 12);
    var p = smooth(clamp01((lf-20)/90));
    num.textContent = '$' + fix2(lerp(0, 0.05, p));
    fill.style.transform = 'scaleX(' + (0.04 + p*0.34) + ')';
    enter(foot, clamp01((lf-30)/14));
  };
});

// ---- SHOT 6 · x402 protocol / open standard --------------------------------
S(718, function(root){
  var st = stack(root, base*0.02, 46);
  var card = panel(st, 'width:' + (W*0.4) + 'px; padding:' + (base*0.036) + 'px;');
  var hr = row(card, base*0.016);
  icon(hr, base*0.05, IC.bolt, OR); HEAD(hr, base*0.06, 'x402', TX, 'font-family:' + MONO + '; font-weight:700; letter-spacing:0;');
  var rows = [
    mkrow(card, 'HTTP 402', 'Payment Required'),
    mkrow(card, 'TYPE', 'Open payment protocol'),
    mkrow(card, 'GOVERNANCE', 'Linux Foundation')
  ];
  function mkrow(p, k, v){ var r = row(p, base*0.02, 'justify-content:space-between; width:100%; margin-top:' + (base*0.018) + 'px; border-top:' + bw + 'px solid ' + BD + '; padding-top:' + (base*0.016) + 'px;'); LBL(r, base*0.018, k, SUB); M(r, base*0.024, v, MU); return r; }
  return function(lf){ enter(card, clamp01(lf/14)); reveal([hr].concat(rows), lf, 8, 12); };
});

// ---- SHOT 7 · HTTP request to actor API ------------------------------------
S(840, function(root){
  var cy = H*0.44, ax = W*0.22, sx = W*0.78;
  var a = mark(root, ax, cy, base*0.055, IC.terminal, false);
  var s = mark(root, sx, cy, base*0.055, IC.server, false);
  var wire = E('position:absolute; left:' + (ax+base*0.065) + 'px; top:' + (cy-base*0.0011) + 'px; width:' + (sx-ax-base*0.13) + 'px; height:' + (base*0.0022) + 'px; background:' + BD + '; border-radius:99px;', root);
  var chip = panel(root, 'position:absolute; top:' + (cy-base*0.085) + 'px; left:0; padding:' + (base*0.012) + 'px ' + (base*0.018) + 'px; white-space:nowrap;');
  M(chip, base*0.022, 'GET /v2/acts/clockworks~tiktok-scraper', OR, 'font-weight:600;');
  var cw = W*0.30;
  var labrw = E('position:absolute; left:50%; top:' + (cy+base*0.1) + 'px; transform:translateX(-50%);', root); LBL(labrw, base*0.02, 'HTTP REQUEST', SUB);
  return function(lf){
    a.style.opacity = clamp01(springIn(lf,FPS,0,'SNAPPY')); s.style.opacity = clamp01(springIn(lf,FPS,6,'SNAPPY'));
    a.style.transform = 'scale(1)'; s.style.transform = 'scale(1)';
    var p = clamp01((lf-14)/56);
    chip.style.opacity = lf>10 ? Math.sin(clamp01((lf-10)/70)*Math.PI)*0.5 + 0.5 : 0;
    chip.style.left = lerp(ax+base*0.07, sx-base*0.07-cw, smooth(p)) + 'px';
    labrw.style.opacity = clamp01((lf-16)/14);
  };
});

// ---- SHOT 8 · 402 PAYMENT REQUIRED -----------------------------------------
S(928, function(root){
  var st = stack(root, base*0.016, 46);
  var tag = M(st, base*0.024, 'HTTP/1.1', SUB);
  var big = HEAD(st, base*0.2, '402', OR, 'font-family:' + MONO + '; font-weight:700; letter-spacing:0;');
  var sub = LBL(st, base*0.034, 'PAYMENT REQUIRED', TX);
  var ring = E('position:absolute; left:50%; top:46%; width:' + (base*0.3) + 'px; height:' + (base*0.3) + 'px; margin-left:' + (-base*0.15) + 'px; margin-top:' + (-base*0.15) + 'px; border-radius:50%; border:' + (base*0.002) + 'px solid ' + OR + '; transform-origin:50% 50%;', root);
  return function(lf){
    enter(tag, clamp01((lf-2)/10));
    var p = clamp01(springIn(lf, FPS, 4, 'SNAPPY')); big.style.opacity = clamp01(lf/6); big.style.transform = 'scale(' + lerp(0.6,1,p) + ')';
    enter(sub, clamp01((lf-16)/12));
    var rp = pop(lf, 2, 40); ring.style.opacity = rp*0.7; ring.style.transform = 'scale(' + (1 + rp*2.2) + ')';
  };
});

// ---- SHOT 9 · authorize transaction ----------------------------------------
S(1035, function(root){
  var st = stack(root, base*0.022, 46);
  var hr = row(st, base*0.016); var lk = icon(hr, base*0.05, IC.lock, OR); LBL(hr, base*0.024, 'AUTHORIZE', TX);
  var card = panel(st, 'width:' + (W*0.34) + 'px; padding:' + (base*0.03) + 'px; text-align:left;');
  var rows = [mk('amount', '0.02 USDC'), mk('asset', 'USDC'), mk('to', 'apify · x402')];
  function mk(k,v){ var r = row(card, base*0.02, 'justify-content:space-between; width:100%; padding:' + (base*0.01) + 'px 0;'); M(r, base*0.022, k, SUB); M(r, base*0.022, v, MU); return r; }
  var ok = row(st, base*0.012); var ck = icon(ok, base*0.034, IC.check, OR); LBL(ok, base*0.022, 'SIGNED', OR);
  return function(lf){
    reveal([hr, card], lf, 4, 12); reveal(rows, lf, 18, 9);
    var s = clamp01((lf-50)/14); enter(ok, s);
    ck.style.opacity = s;
  };
});

// ---- SHOT 10 · allowance / pay-per-use -------------------------------------
S(1130, function(root){
  var st = stack(root, base*0.024, 46);
  LBL(st, base*0.02, 'ALLOWANCE', SUB);
  var num = HEAD(st, base*0.12, '$5.00', TX, 'font-family:' + MONO + '; font-weight:700;');
  var card = panel(st, 'width:' + (W*0.32) + 'px; padding:' + (base*0.022) + 'px;');
  var track = E('height:' + (base*0.016) + 'px; border-radius:99px; background:#26282c; overflow:hidden;', card);
  var fill = E('height:100%; width:100%; transform-origin:left center; background:linear-gradient(90deg,' + OR + ',' + C.orangeDeep + ');', track);
  var foot = M(card, base*0.02, 'pay only for what the run consumes', SUB, 'margin-top:' + (base*0.016) + 'px;');
  return function(lf){ reveal([st.children[0], num, card], lf, 4, 12); fill.style.transform = 'scaleX(' + (0.06 + smooth(clamp01((lf-20)/70))*0.14) + ')'; enter(foot, clamp01((lf-30)/14)); };
});

// ---- SHOT 11 · demo prompt typing ------------------------------------------
S(1233, function(root){
  var st = stack(root, base*0.02, 46);
  LBL(st, base*0.018, 'DROID AGENT', SUB);
  var p = panel(st, 'width:' + (W*0.5) + 'px; padding:' + (base*0.03) + 'px ' + (base*0.034) + 'px; text-align:left;');
  var lines = [['$ droid', SUB], ['> scrape 100 TikTok posts for #ai', MU], ['  and summarize the top creators', MU]];
  var rows = lines.map(function(l){ return M(p, base*0.026, l[0], l[1], 'white-space:pre; line-height:1.8;'); });
  var caret = E('display:inline-block; width:' + (base*0.014) + 'px; height:' + (base*0.03) + 'px; background:' + OR + '; margin-top:' + (base*0.008) + 'px;', p);
  return function(lf){ enter(st.children[0], clamp01(lf/12)); enter(p, clamp01((lf-6)/12)); reveal(rows, lf, 20, 28); caret.style.opacity = blink(lf); };
});

// ---- SHOT 12 · MCP CLI client ----------------------------------------------
S(1459, function(root){
  var st = stack(root, base*0.022, 46);
  var card = panel(st, 'width:' + (W*0.42) + 'px; padding:' + (base*0.032) + 'px; text-align:left;');
  var hr = row(card, base*0.016, 'width:100%; justify-content:space-between;');
  var left = row(hr, base*0.014); icon(left, base*0.04, IC.terminal, OR); HEAD(left, base*0.032, 'apify-mcp', TX, 'font-family:' + MONO + ';');
  var badge = panel(hr, 'padding:' + (base*0.008) + 'px ' + (base*0.016) + 'px; border-color:' + OR + ';'); M(badge, base*0.02, 'MCP', OR, 'font-weight:700; letter-spacing:0.1em;');
  var rows = [mk('client', 'custom MCP CLI'), mk('mcp support', 'built-in'), mk('status', 'installed ✓')];
  function mk(k,v){ var r = row(card, base*0.02, 'justify-content:space-between; width:100%; margin-top:' + (base*0.016) + 'px; border-top:' + bw + 'px solid ' + BD + '; padding-top:' + (base*0.014) + 'px;'); M(r, base*0.022, k, SUB); M(r, base*0.022, v, MU); return r; }
  return function(lf){ enter(card, clamp01(lf/14)); reveal([hr].concat(rows), lf, 8, 11); };
});

// ---- SHOT 13 · balance & connect -------------------------------------------
S(1677, function(root){
  var st = stack(root, base*0.02, 46);
  var s1 = row(st, base*0.014); var i1 = icon(s1, base*0.036, IC.wallet, OR); M(s1, base*0.026, 'checking balance…', MU);
  var s2 = row(st, base*0.014); var i2 = icon(s2, base*0.036, IC.server, OR); M(s2, base*0.026, 'connecting to Apify server…', MU);
  var s3 = row(st, base*0.012); var ck = icon(s3, base*0.034, IC.check, OR); LBL(s3, base*0.022, 'CONNECTED', OR);
  return function(lf){ enter(s1, clamp01(lf/14)); enter(s2, clamp01((lf-70)/14)); enter(s3, clamp01((lf-150)/14)); };
});

// ---- SHOT 14 · $5 USDC wallet ----------------------------------------------
S(1902, function(root){
  var st = stack(root, base*0.018, 46);
  var card = panel(st, 'width:' + (W*0.36) + 'px; padding:' + (base*0.038) + 'px; text-align:center;');
  var hr = row(card, base*0.014, 'justify-content:center;'); icon(hr, base*0.042, IC.wallet, OR); LBL(hr, base*0.022, 'AGENT WALLET', SUB);
  var num = HEAD(card, base*0.13, '$0.00', TX, 'font-family:' + MONO + '; font-weight:700; margin-top:' + (base*0.02) + 'px;');
  var unit = LBL(card, base*0.026, 'USDC', OR);
  return function(lf){ enter(card, clamp01(lf/14)); var p = smooth(clamp01((lf-16)/55)); num.textContent = '$' + fix2(lerp(0,5,p)); };
});

// ---- SHOT 15 · x402 flag ---------------------------------------------------
S(2109, function(root){
  var st = stack(root, base*0.024, 46);
  var p = panel(st, 'padding:' + (base*0.026) + 'px ' + (base*0.032) + 'px;');
  var line = row(p, 0);
  M(line, base*0.034, 'apify-mcp connect ', MU, 'font-weight:500;');
  var flag = M(line, base*0.034, '--x402', OR, 'font-weight:700;');
  var lab = LBL(st, base*0.022, 'x402 PAYMENTS ENABLED', OR);
  return function(lf){ enter(p, clamp01(lf/14)); flag.style.textShadow = '0 0 ' + (base*0.02*(0.5+0.5*Math.sin(lf/8))) + 'px rgba(248,120,40,0.9)'; enter(lab, clamp01((lf-30)/14)); };
});

// ---- SHOT 16 · search best actor -------------------------------------------
S(2285, function(root){
  var st = stack(root, base*0.018, 46);
  var bar = panel(st, 'width:' + (W*0.44) + 'px; padding:' + (base*0.02) + 'px ' + (base*0.024) + 'px; display:flex; align-items:center; gap:' + (base*0.016) + 'px;');
  icon(bar, base*0.034, IC.search, OR); M(bar, base*0.026, 'best actor for TikTok…', MU);
  var listw = E('width:' + (W*0.44) + 'px; position:relative; margin-top:' + (base*0.01) + 'px;', st);
  var items = []; for (var i=0;i<3;i++){ var it = panel(listw, 'padding:' + (base*0.018) + 'px ' + (base*0.022) + 'px; margin-top:' + (base*0.012) + 'px; opacity:0;'); M(it, base*0.022, '…', SUB); items.push(it); }
  var scan = E('position:absolute; left:0; top:0; width:100%; height:' + (base*0.004) + 'px; background:linear-gradient(90deg,transparent,' + OR + ',transparent);', listw);
  return function(lf){ enter(bar, clamp01(lf/12)); for (var i=0;i<items.length;i++) items[i].style.opacity = clamp01((lf-14-i*8)/12)*0.5; scan.style.transform = 'translateY(' + (((lf*base*0.006)%(base*0.14))) + 'px)'; scan.style.opacity = 0.8; };
});

// ---- SHOT 17 · found scraper -----------------------------------------------
S(2364, function(root){
  var st = stack(root, base*0.018, 46);
  var card = panel(st, 'width:' + (W*0.42) + 'px; padding:' + (base*0.03) + 'px; border-color:' + OR + '; display:flex; align-items:center; gap:' + (base*0.022) + 'px;');
  var ic = E('width:' + (base*0.08) + 'px; height:' + (base*0.08) + 'px; border-radius:' + (base*0.012) + 'px; background:#26282c; border:' + bw + 'px solid ' + BD + '; color:' + OR + '; padding:' + (base*0.016) + 'px;', card); ic.innerHTML = IC.chart;
  var col = E('display:flex; flex-direction:column; gap:' + (base*0.006) + 'px;', card);
  HEAD(col, base*0.03, 'TikTok Hashtag Scraper', TX);
  M(col, base*0.022, 'clockworks · ★ 4.8', SUB);
  var ck = icon(card, base*0.04, IC.check, OR, 'margin-left:auto;');
  var lab = LBL(st, base*0.02, 'ACTOR SELECTED', OR);
  return function(lf){ var p = clamp01(springIn(lf, FPS, 2, 'SNAPPY')); card.style.opacity = clamp01(lf/8); card.style.transform = 'scale(' + lerp(0.9,1,p) + ')'; enter(lab, clamp01((lf-26)/12)); ck.style.opacity = clamp01((lf-20)/12); };
});

// ---- SHOT 18 · actor details / input schema --------------------------------
S(2440, function(root){
  var st = stack(root, base*0.016, 46);
  LBL(st, base*0.018, 'INPUT SCHEMA', SUB);
  var card = panel(st, 'width:' + (W*0.4) + 'px; padding:' + (base*0.028) + 'px; text-align:left;');
  var rows = [mk('hashtags', '["#ai"]'), mk('resultsPerPage', '100'), mk('shouldDownloadVideos', 'false')];
  function mk(k,v){ var r = row(card, base*0.02, 'justify-content:space-between; width:100%; padding:' + (base*0.011) + 'px 0;'); M(r, base*0.022, k, MU); M(r, base*0.022, v, OR); return r; }
  return function(lf){ enter(st.children[0], clamp01(lf/12)); enter(card, clamp01((lf-6)/12)); reveal(rows, lf, 16, 12); };
});

// ---- SHOT 19 · scrape 100 posts --------------------------------------------
S(2594, function(root){
  var st = stack(root, base*0.022, 44);
  var hr = row(st, base*0.018); icon(hr, base*0.04, IC.bolt, OR); LBL(hr, base*0.024, 'SCRAPING', TX);
  var num = HEAD(st, base*0.11, '0 / 100', TX, 'font-family:' + MONO + '; font-weight:700;');
  var track = E('width:' + (W*0.4) + 'px; height:' + (base*0.018) + 'px; border-radius:99px; background:#26282c; overflow:hidden;', st);
  var fill = E('height:100%; width:100%; transform-origin:left center; background:linear-gradient(90deg,' + OR + ',' + C.orangeDeep + ');', track);
  var gw = E('display:flex; flex-wrap:wrap; gap:' + (base*0.01) + 'px; width:' + (W*0.4) + 'px; margin-top:' + (base*0.01) + 'px;', st);
  var tiles = []; for (var i=0;i<20;i++){ tiles.push(E('width:' + (base*0.028) + 'px; height:' + (base*0.028) + 'px; border-radius:' + (base*0.004) + 'px; background:' + CARD + '; border:' + bw + 'px solid ' + BD + '; opacity:0;', gw)); }
  return function(lf){
    reveal([hr, num], lf, 4, 10);
    var p = smooth(clamp01((lf-16)/150)); var n = Math.round(p*100); num.textContent = n + ' / 100';
    fill.style.transform = 'scaleX(' + (0.02 + p*0.98) + ')';
    for (var i=0;i<tiles.length;i++) tiles[i].style.opacity = clamp01((p*tiles.length) - i);
  };
});

// ---- SHOT 20 · process / python --------------------------------------------
S(2791, function(root){
  var st = stack(root, base*0.018, 46);
  var save = row(st, base*0.012); var ck = icon(save, base*0.03, IC.check, OR); M(save, base*0.024, 'data saved locally · 100 posts', MU);
  var p = panel(st, 'width:' + (W*0.5) + 'px; padding:' + (base*0.028) + 'px ' + (base*0.032) + 'px; text-align:left;');
  var lines = [['import json, pandas as pd', SUB], ['data = json.load(open("posts.json"))', MU], ['df = pd.DataFrame(data)', MU], ['top = df.groupby("author").sum()', MU]];
  var rows = lines.map(function(l){ return M(p, base*0.024, l[0], l[1], 'white-space:pre; line-height:1.75;'); });
  var run = row(st, base*0.012); var rb = icon(run, base*0.03, IC.bolt, OR); M(run, base*0.024, 'analyze.py · running…', OR);
  return function(lf){ enter(save, clamp01(lf/12)); enter(p, clamp01((lf-40)/12)); reveal(rows, lf, 60, 26); enter(run, clamp01((lf-190)/14)); };
});

// ---- SHOT 21 · script finished / summarizing -------------------------------
S(3109, function(root){
  var st = stack(root, base*0.018, 46);
  var ok = row(st, base*0.014); var ck = icon(ok, base*0.04, IC.check, OR); LBL(ok, base*0.026, 'ANALYSIS COMPLETE', OR);
  var card = panel(st, 'width:' + (W*0.44) + 'px; padding:' + (base*0.028) + 'px; text-align:left;');
  var lines = ['summarizing results…', '• ranking creators by engagement', '• aggregating likes · videos · plays'];
  var rows = lines.map(function(l){ return M(card, base*0.024, l, MU, 'line-height:1.85;'); });
  return function(lf){ var s = clamp01(springIn(lf,FPS,2,'SNAPPY')); ok.style.opacity = clamp01(lf/8); ok.style.transform = 'scale(' + lerp(0.9,1,s) + ')'; enter(card, clamp01((lf-16)/12)); reveal(rows, lf, 26, 14); };
});

// ---- SHOT 22 · results dashboard -------------------------------------------
S(3218, function(root){
  var st = stack(root, base*0.024, 44);
  var hr = row(st, base*0.014); icon(hr, base*0.04, IC.chart, OR); LBL(hr, base*0.026, 'RESULTS', TX);
  var gw = E('display:flex; gap:' + (base*0.02) + 'px;', st);
  var metrics = [['CREATORS', 248, ''], ['LIKES', 4200000, ''], ['VIDEOS', 1240, ''], ['PLAYS', 18600000, '']];
  var cards = metrics.map(function(m){ var c = panel(gw, 'width:' + (W*0.15) + 'px; padding:' + (base*0.026) + 'px; text-align:center;'); var n = HEAD(c, base*0.07, '0', OR, 'font-family:' + MONO + '; font-weight:700;'); LBL(c, base*0.018, m[0], SUB); return { card:c, num:n, target:m[1] }; });
  var foot = M(st, base*0.022, 'saved locally · summarized by the agent', SUB);
  return function(lf){
    enter(hr, clamp01(lf/12));
    for (var i=0;i<cards.length;i++){ var p = clamp01((lf-10-i*10)/14); enter(cards[i].card, p); var cp = smooth(clamp01((lf-20-i*10)/90)); cards[i].num.textContent = human(cards[i].target*cp); }
    enter(foot, clamp01((lf-80)/16));
  };
});

// ---- SHOT 23 · ecosystem / thousands of tools ------------------------------
S(3677, function(root){
  var st = stack(root, base*0.026, 44);
  var head = HEAD(st, base*0.05, '1,000s of AI tools', TX);
  LBL(st, base*0.02, 'ON APIFY · ACCESSIBLE VIA x402', OR);
  var gw = E('display:flex; flex-wrap:wrap; justify-content:center; gap:' + (base*0.016) + 'px; width:' + (W*0.6) + 'px;', st);
  var cells = []; for (var i=0;i<24;i++){ var c = E('width:' + (base*0.07) + 'px; height:' + (base*0.07) + 'px; border-radius:' + (base*0.01) + 'px; background:' + CARD + '; border:' + bw + 'px solid ' + BD + '; color:' + OR + '; padding:' + (base*0.016) + 'px; opacity:0;', gw); c.innerHTML = (i%3===0)?IC.server:(i%3===1)?IC.chart:IC.globe; cells.push(c); }
  return function(lf){ reveal([head, st.children[1]], lf, 4, 12); for (var i=0;i<cells.length;i++){ var p = clamp01(springIn(lf, FPS, 16 + i*3, 'SNAPPY')); cells[i].style.opacity = p; cells[i].style.transform = 'scale(' + lerp(0.5,1,p) + ')'; } };
});

// ---- SHOT 24 · export to x402 endpoints ------------------------------------
S(3837, function(root){
  var st = stack(root, base*0.02, 46);
  LBL(st, base*0.02, 'EXPORT', SUB);
  var head = HEAD(st, base*0.044, 'any agent → x402 endpoint', TX);
  var rowc = row(st, base*0.018, 'margin-top:' + (base*0.01) + 'px;');
  var items = ['/scrape', '/enrich', '/summarize'].map(function(t){ var p = panel(rowc, 'padding:' + (base*0.016) + 'px ' + (base*0.022) + 'px; display:flex; align-items:center; gap:' + (base*0.01) + 'px; border-color:' + OR + ';'); M(p, base*0.024, t, MU, 'font-weight:600;'); var b = M(p, base*0.016, 'x402', OR, 'font-weight:700; letter-spacing:0.1em;'); return p; });
  return function(lf){ reveal([st.children[0], head], lf, 4, 12); reveal(items, lf, 20, 12); };
});

// ---- SHOT 25 · agent economy + CTA -----------------------------------------
S(4009, function(root){
  var st = stack(root, base*0.022, 46);
  var econ = HEAD(st, base*0.06, 'the agent economy', TX, 'font-weight:600;');
  var cta = HEAD(st, base*0.044, 'give your agent the power to pay', OR, 'font-weight:600;');
  var foot = M(st, base*0.024, 'apify.com/x402  ·  launch blog & docs', SUB);
  var bolt = icon(st, base*0.05, IC.bolt, OR);
  return function(lf){
    enter(econ, clamp01(lf/16));
    var fade = interpolate(lf, [95, 120], [0, 1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });    // econ -> CTA
    econ.style.opacity = clamp01(lf/16) * (1 - fade*0.55);
    enter(cta, clamp01((lf-110)/16)); enter(foot, clamp01((lf-135)/16));
    bolt.style.opacity = clamp01((lf-120)/16); bolt.style.transform = 'scale(' + (1 + pop(lf, 120, 80)*0.12) + ')';
  };
});

// ============================================================================
//  BUILD + DRIVE
// ============================================================================
var SHOTS = defs.map(function(d){
  var root = E('position:absolute; inset:0; opacity:0; transform-origin:50% 50%;', shotLayer);
  var update = d.fn(root);
  return { start: d.start, update: update, root: root };
});
for (var i = 0; i < SHOTS.length; i++) SHOTS[i].end = (i < SHOTS.length - 1) ? SHOTS[i + 1].start : DUR;

// vignette + persistent HUD (progress bar + corner tag), on top of shots
E('position:absolute; inset:0; pointer-events:none; background:radial-gradient(125% 110% at 50% 47%, transparent 52%, rgba(8,9,10,0.6) 100%);', stage);
var hudTrack = E('position:absolute; left:0; bottom:0; width:100%; height:' + (base*0.004) + 'px; background:rgba(255,255,255,0.06);', stage);
var hudFill = E('position:absolute; left:0; bottom:0; width:100%; height:' + (base*0.004) + 'px; background:' + OR + '; transform-origin:left center;', stage);
var tag = E('position:absolute; right:' + (base*0.045) + 'px; bottom:' + (base*0.04) + 'px; display:flex; align-items:center; gap:' + (base*0.012) + 'px; opacity:0.55;', stage);
icon(tag, base*0.024, IC.bolt, OR); M(tag, base*0.018, 'APIFY · x402', SUB, 'letter-spacing:0.24em;');

function render(frame){
  // subtle global drift so it never feels dead
  var camX = Math.sin(frame/420) * W * 0.002, camY = Math.cos(frame/520) * H * 0.002;
  shotLayer.style.transform = 'translate(' + camX + 'px,' + camY + 'px)';
  grid.style.transform = 'translate(' + (camX*0.4) + 'px,' + (camY*0.4) + 'px)';
  grid.style.opacity = 0.4 + 0.08 * Math.sin(frame/80);

  var IN = 12, OUT = 8;
  for (var i = 0; i < SHOTS.length; i++) {
    var s = SHOTS[i];
    var enterP = clamp01((frame - s.start) / IN);
    var exitP = (i === SHOTS.length - 1) ? 0 : clamp01((frame - s.end) / OUT);
    var vis = smooth(enterP) * (1 - smooth(exitP));
    s.root.style.opacity = vis;
    s.root.style.transform = 'scale(' + lerp(0.985, 1, smooth(enterP)) + ')';
    if (vis > 0.002) s.update(frame - s.start, s.end - s.start);
  }

  hudFill.style.transform = 'scaleX(' + clamp01(frame / DUR) + ')';
}

const durationInFrames = 4255;
const fps = 25;
