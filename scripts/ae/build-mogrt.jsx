/**
 * Build the Apify short-form kit as After Effects comps and export each as a
 * .mogrt for Premiere Pro.
 *
 * In Premiere 26.5 these land in the GRAPHICS TEMPLATES panel, and their fields
 * are edited in the PROPERTIES panel. The old "Essential Graphics" name still
 * exists in the binary but is not where the current flow sends you.
 *
 * Run: After Effects → File → Scripts → Run Script File… → this file.
 * Requires Preferences → Scripting & Expressions → "Allow Scripts to Write
 * Files and Access Network", and GT Walsheim installed. Output: data/mogrt/.
 *
 * Every size, colour and coordinate is the value the Remotion scenes use, and
 * those are checked against the Figma exports by scripts/figma-diff.ts.
 *
 * What is NOT claimed is pixel equality with the Remotion output. After Effects
 * is a third text renderer, and more to the point these boxes RESIZE to fit
 * whatever an editor types — behaviour a fixed Figma frame cannot specify. The
 * boxes keep Figma's height and grow only in width, which is how the design
 * behaves when the copy changes.
 */
(function () {
  var OUT = "/Users/filip/video-tool/data/mogrt";
  var LOCKUP = OUT + "/assets/apify-lockup@3x.png";
  var W = 1080, H = 1920, FPS = 25;
  // Everything has landed by here; used for the browse thumbnail.
  var SETTLED = 1.6;

  var C = {
    orange: [248 / 255, 102 / 255, 6 / 255],
    blue: [36 / 255, 109 / 255, 255 / 255],
    green: [32 / 255, 163 / 255, 78 / 255],
    white: [1, 1, 1],
    ink: [31 / 255, 33 / 255, 35 / 255],
    ctaBg: [2 / 255, 2 / 255, 2 / 255],
    ctaStroke: [191 / 255, 193 / 255, 197 / 255],
    ctaInk: [244 / 255, 244 / 255, 245 / 255]
  };
  var FONT = { light: "GTWalsheim-Light", regular: "GTWalsheim-Regular", medium: "GTWalsheim-Medium" };

  var log = [];
  function say(s) { log.push(String(s)); }
  function flush() {
    var f = new File("/tmp/ae-mogrt-log.txt");
    f.open("w"); f.write(log.join("\r")); f.close();
  }

  // ---- helpers -----------------------------------------------------------

  function newComp(name, seconds) {
    var c = app.project.items.addComp(name, W, H, 1, seconds, FPS);
    c.bgColor = [0, 0, 0];
    return c;
  }

  /**
   * A text layer. The LAYER NAME becomes the field label in Premiere — AE uses
   * it as the control's default name, so it is named for the editor, not for
   * the code.
   */
  function text(comp, label, str, font, size, colour, justify) {
    var layer = comp.layers.addText(str);
    layer.name = label;
    var prop = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = prop.value;
    doc.resetCharStyle();
    doc.font = font;
    doc.fontSize = size;
    doc.fillColor = colour;
    doc.applyFill = true;
    doc.applyStroke = false;
    doc.autoLeading = false;
    doc.leading = size;                      // Figma's leading-none
    doc.justification = justify || ParagraphJustification.LEFT_JUSTIFY;
    doc.text = str;
    prop.setValue(doc);
    return layer;
  }

  /**
   * Text that WRAPS inside a fixed width. AE point text runs on forever, so the
   * statement box's copy shot straight out of its box; Figma wraps it at
   * 557.806. Box text is the only thing that reflows, which is also what makes
   * the template usable when someone types a longer question.
   */
  function boxText(comp, label, str, font, size, colour, width, lineHeight) {
    var layer = comp.layers.addBoxText([width, 600], str);
    layer.name = label;
    var prop = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = prop.value;
    doc.resetCharStyle();
    doc.font = font;
    doc.fontSize = size;
    doc.fillColor = colour;
    doc.applyFill = true;
    doc.applyStroke = false;
    doc.autoLeading = false;
    doc.leading = lineHeight;
    doc.justification = ParagraphJustification.CENTER_JUSTIFY;
    doc.text = str;
    prop.setValue(doc);
    return layer;
  }

  function xf(layer, prop) {
    return layer.property("ADBE Transform Group").property(prop);
  }

  /** Anchor the layer on its own ink and put that point at (x, y). */
  function anchorAt(layer, ax, ay, x, y) {
    var r = layer.sourceRectAtTime(0, false);
    xf(layer, "ADBE Anchor Point").setValue([r.left + r.width * ax, r.top + r.height * ay]);
    xf(layer, "ADBE Position").setValue([x, y]);
  }

  /**
   * A filled box behind a text layer: Figma's height, and a width that follows
   * what is typed. `grow` is "right" for the left-aligned lower thirds and
   * "centre" for the centred titles, so the box opens the way its design does.
   */
  function box(comp, name, textName, left, top, boxH, padX, colour, grow) {
    var s = comp.layers.addShape();
    s.name = name;
    var grp = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");

    // Re-fetch after BOTH exist: adding a sibling invalidates references taken
    // earlier, and touching a stale one throws "Object is invalid".
    var contents = s.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
    var rect = contents.property("ADBE Vector Shape - Rect");
    var fill = contents.property("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(colour.concat([1]));

    var wExpr = 'thisComp.layer("' + textName + '").sourceRectAtTime(time, false).width + ' + (padX * 2);
    rect.property("ADBE Vector Rect Size").expression = '[' + wExpr + ', ' + boxH + '];';
    if (grow === "centre") {
      xf(s, "ADBE Position").setValue([left, top + boxH / 2]);   // left IS the centre here
    } else {
      xf(s, "ADBE Position").expression =
        'var w = ' + wExpr + ';\r[' + left + ' + w/2, ' + (top + boxH / 2) + '];';
    }
    return s;
  }

  /** An outlined box (the CTA button, the case-study pill). */
  function outlineBox(comp, name, left, top, w, h, stroke, strokeW, fillColour) {
    var s = comp.layers.addShape();
    s.name = name;
    var grp = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var g = grp.property("ADBE Vectors Group");
    g.addProperty("ADBE Vector Shape - Rect");
    if (fillColour) g.addProperty("ADBE Vector Graphic - Fill");
    g.addProperty("ADBE Vector Graphic - Stroke");

    var contents = s.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
    contents.property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([w, h]);
    contents.property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Roundness").setValue(4);
    if (fillColour) {
      contents.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color")
        .setValue(fillColour.concat([1]));
    }
    var st = contents.property("ADBE Vector Graphic - Stroke");
    st.property("ADBE Vector Stroke Color").setValue(stroke.concat([1]));
    st.property("ADBE Vector Stroke Width").setValue(strokeW);
    xf(s, "ADBE Position").setValue([left + w / 2, top + h / 2]);
    return s;
  }

  /** Left-to-right reveal — the AE equivalent of the scenes' clip reveal. */
  function reveal(layer, startSec, durSec) {
    var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Linear Wipe");
    fx.property("ADBE Linear Wipe-0002").setValue(-90);          // wipe angle
    fx.property("ADBE Linear Wipe-0003").setValue(0);            // feather: none
    var p = fx.property("ADBE Linear Wipe-0001");                // transition completion
    p.setValueAtTime(startSec, 100);
    p.setValueAtTime(startSec + durSec, 0);
    for (var i = 1; i <= p.numKeys; i++) {
      p.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    }
  }

  /** Scale-in, for marks that should arrive whole rather than wipe. */
  function popIn(layer, startSec, durSec) {
    var p = xf(layer, "ADBE Scale");
    var base = p.value;
    p.setValueAtTime(startSec, [base[0] * 0.94, base[1] * 0.94]);
    p.setValueAtTime(startSec + durSec, base);
    for (var i = 1; i <= p.numKeys; i++) {
      p.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    }
  }

  function controlsLayer(comp) {
    var n = comp.layers.addNull();
    n.name = "Controls";
    n.enabled = false;
    return n;
  }

  /** A colour swatch in Essential Graphics. The EFFECT name is the label. */
  function colourControl(nullLayer, label, colour) {
    var fx = nullLayer.property("ADBE Effect Parade").addProperty("ADBE Color Control");
    fx.name = label;
    fx.property(1).setValue(colour.concat([1]));
    return fx.property(1);
  }

  function fillFrom(shapeLayer, controlName) {
    shapeLayer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group")
      .property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression =
      'thisComp.layer("Controls").effect("' + controlName + '")("Color")';
  }

  /**
   * Publish a property to Essential Graphics. No renaming: AE labels each
   * control from its layer or effect name, and the rename API indexes
   * controllers in an order that does not match the order they are added —
   * using it put "Box colour" on a text field.
   */
  function expose(comp, prop) { return prop.addToMotionGraphicsTemplate(comp); }

  function importLockup() {
    var f = new File(LOCKUP);
    if (!f.exists) return null;
    var io = new ImportOptions(f);
    return app.project.importFile(io);
  }

  /** Place the lockup at Figma's box, scaled from the 3x raster. */
  function lockup(comp, footage, x, y, w) {
    if (!footage) return null;
    var l = comp.layers.add(footage);
    l.name = "Apify logo";
    var scale = (w / footage.width) * 100;
    xf(l, "ADBE Scale").setValue([scale, scale]);
    xf(l, "ADBE Position").setValue([x + w / 2, y + (w * footage.height / footage.width) / 2]);
    return l;
  }

  // ---- the scenes --------------------------------------------------------
  // Figma node ids are in the Remotion scenes; the numbers are the same.

  function lowerThirdBoxed() {
    var comp = newComp("Apify — Lower third (name, boxed)", 5);
    var ctrl = controlsLayer(comp);
    var accent = colourControl(ctrl, "Box colour", C.green);

    var X = 169, Y = 929, NH = 107, PH = 86, GAP = 12;
    var first = text(comp, "First name", "Name", FONT.medium, 106.982, C.white);
    var last = text(comp, "Surname", "Surname", FONT.medium, 106.982, C.white);
    var role = text(comp, "Role", "Position", FONT.regular, 58.295, C.ink);

    var b1 = box(comp, "First name box", "First name", X, Y, NH, 20, C.green, "right");
    var b2 = box(comp, "Surname box", "Surname", X, Y + NH + GAP, NH, 20, C.green, "right");
    var b3 = box(comp, "Role box", "Role", X, Y + 2 * (NH + GAP), PH, 20, C.white, "right");
    fillFrom(b1, "Box colour");
    fillFrom(b2, "Box colour");

    anchorAt(first, 0, 0.5, X + 20, Y + NH / 2);
    anchorAt(last, 0, 0.5, X + 20, Y + NH + GAP + NH / 2);
    anchorAt(role, 0, 0.5, X + 20, Y + 2 * (NH + GAP) + PH / 2);

    first.moveToBeginning(); last.moveToBeginning(); role.moveToBeginning();
    reveal(b1, 0, 0.4); reveal(first, 0, 0.4);
    reveal(b2, 0.16, 0.4); reveal(last, 0.16, 0.4);
    reveal(b3, 0.32, 0.4); reveal(role, 0.32, 0.4);

    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, first.property("Source Text"));
    expose(comp, last.property("Source Text"));
    expose(comp, role.property("Source Text"));
    expose(comp, accent);
    return comp;
  }

  function lowerThirdPlain() {
    var comp = newComp("Apify — Lower third (name, plain)", 5);
    var X = 187, Y = 929;
    var who = text(comp, "Name", "Name\rSurname", FONT.medium, 106.982, C.white);
    var role = text(comp, "Role", "Position", FONT.regular, 58.295, C.white);
    anchorAt(who, 0, 0, X, Y);
    anchorAt(role, 0, 0, X, Y + 214 + 24);
    reveal(who, 0, 0.4); reveal(role, 0.16, 0.4);
    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, who.property("Source Text"));
    expose(comp, role.property("Source Text"));
    return comp;
  }

  function lowerThirdPlace() {
    var comp = newComp("Apify — Lower third (place, boxed)", 5);
    var ctrl = controlsLayer(comp);
    var accent = colourControl(ctrl, "Box colour", C.blue);
    var X = 173, Y = 1169, BH = 74;
    var place = text(comp, "Place or event", "Place/event", FONT.medium, 74.283, C.white);
    var b = box(comp, "Place box", "Place or event", X, Y, BH, 13.887, C.blue, "right");
    fillFrom(b, "Box colour");
    anchorAt(place, 0, 0.5, X + 13.887, Y + BH / 2);
    place.moveToBeginning();
    reveal(b, 0, 0.4); reveal(place, 0, 0.4);
    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, place.property("Source Text"));
    expose(comp, accent);
    return comp;
  }

  function titleBoxed() {
    var comp = newComp("Apify — Title (boxed)", 5);
    var ctrl = controlsLayer(comp);
    var accent = colourControl(ctrl, "Headline colour", C.orange);

    var CX = 539.5, Y = 712, SH = 81, HH = 173, GAP = 12;
    var sub = text(comp, "Sub-headline", "Sub-headline", FONT.regular, 76.271, C.ink,
      ParagraphJustification.CENTER_JUSTIFY);
    var head = text(comp, "Headline", "Headline", FONT.medium, 143.145, C.white,
      ParagraphJustification.CENTER_JUSTIFY);

    var sb = box(comp, "Sub-headline box", "Sub-headline", CX, Y, SH, 20, C.white, "centre");
    var hb = box(comp, "Headline box", "Headline", CX, Y + SH + GAP, HH, 24, C.orange, "centre");
    fillFrom(hb, "Headline colour");

    anchorAt(sub, 0.5, 0.5, CX, Y + SH / 2);
    anchorAt(head, 0.5, 0.5, CX, Y + SH + GAP + HH / 2);

    sub.moveToBeginning(); head.moveToBeginning();
    reveal(sb, 0, 0.4); reveal(sub, 0, 0.4);
    reveal(hb, 0.16, 0.4); reveal(head, 0.16, 0.4);

    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, sub.property("Source Text"));
    expose(comp, head.property("Source Text"));
    expose(comp, accent);
    return comp;
  }

  function titlePlain() {
    var comp = newComp("Apify — Title (plain)", 5);
    var CX = 539.5, Y = 687.5;
    var sub = text(comp, "Sub-headline", "Sub-headline", FONT.regular, 76.271, C.white,
      ParagraphJustification.CENTER_JUSTIFY);
    var head = text(comp, "Headline", "Headline", FONT.medium, 155.723, C.white,
      ParagraphJustification.CENTER_JUSTIFY);
    anchorAt(sub, 0.5, 0, CX, Y);
    anchorAt(head, 0.5, 0, CX, Y + 76 + 48);
    reveal(sub, 0, 0.4); reveal(head, 0.16, 0.4);
    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, sub.property("Source Text"));
    expose(comp, head.property("Source Text"));
    return comp;
  }

  /**
   * One word of a funky title: a rotated box that grows around whatever is
   * typed. The angle and centre are fixed (Figma places each word by hand, with
   * no rule behind the angles); only the width follows the word.
   *
   * The box hides itself when its word is emptied, so one template covers a
   * title with fewer words than it has slots.
   */
  function funkyWord(comp, label, str, size, accent, cx, cy, rot) {
    var padX = size * (24 / 143.145);
    var padY = size * (15 / 143.145);
    var boxH = size + padY * 2;

    var b = comp.layers.addShape();
    b.name = label + " box";
    var grp = b.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    var contents = b.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
    contents.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color")
      .setValue(accent.concat([1]));
    contents.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression =
      'thisComp.layer("Controls").effect("Box colour")("Color")';
    contents.property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").expression =
      '[thisComp.layer("' + label + '").sourceRectAtTime(time, false).width + ' + (padX * 2) + ', ' + boxH + '];';
    xf(b, "ADBE Position").setValue([cx, cy]);
    xf(b, "ADBE Rotate Z").setValue(rot);
    xf(b, "ADBE Opacity").expression =
      'thisComp.layer("' + label + '").text.sourceText.toString().length > 0 ? 100 : 0;';

    var t = text(comp, label, str, FONT.medium, size, C.white, ParagraphJustification.CENTER_JUSTIFY);
    anchorAt(t, 0.5, 0.5, cx, cy);
    xf(t, "ADBE Rotate Z").setValue(rot);
    return { box: b, text: t };
  }

  /** The rotated word stack. Words listed top-most first, as Figma layers read. */
  function funkyTitle(name, size, accent, words) {
    var comp = newComp(name, 5);
    var ctrl = controlsLayer(comp);
    var swatch = colourControl(ctrl, "Box colour", accent);

    // Built back to front: AE puts each new layer on top, so creating the last
    // word first leaves the first word above the rest — which is the order
    // Figma's layer list has, and it decides which word wins where they overlap.
    var made = [];
    for (var i = words.length - 1; i >= 0; i--) {
      var w = words[i];
      made[i] = funkyWord(comp, w.label, w.value, size, accent, w.cx, w.cy, w.rot);
    }
    for (var j = 0; j < made.length; j++) {
      popIn(made[j].box, j * 0.12, 0.35);
      popIn(made[j].text, j * 0.12, 0.35);
    }

    comp.motionGraphicsTemplateName = comp.name;
    for (var k = 0; k < made.length; k++) expose(comp, made[k].text.property("Source Text"));
    expose(comp, swatch);
    return comp;
  }

  function statement() {
    var comp = newComp("Apify — Statement box", 5);
    var LEFT = 230, TOP = 858.5, WIDTH = 620, PAD = 31.097, TEXT_W = 557.806;
    var body = boxText(comp, "Statement",
      "Question or statement can be placed here in the box that\u2019s adjustable",
      FONT.regular, 48, C.ink, TEXT_W, 48 * 1.1);

    var s = comp.layers.addShape();
    s.name = "Box";
    var grp = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
    var contents = s.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
    contents.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color")
      .setValue(C.white.concat([1]));
    var st = contents.property("ADBE Vector Graphic - Stroke");
    st.property("ADBE Vector Stroke Color").setValue(C.orange.concat([1]));
    st.property("ADBE Vector Stroke Width").setValue(2);

    // Fixed width, height follows however many lines get typed.
    var hExpr = 'thisComp.layer("Statement").sourceRectAtTime(time, false).height + ' + (PAD * 2);
    contents.property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").expression =
      '[' + WIDTH + ', ' + hExpr + '];';
    xf(s, "ADBE Position").expression =
      'var h = ' + hExpr + ';\r[' + (LEFT + WIDTH / 2) + ', ' + TOP + ' + h/2];';

    // Centre the copy on the box, which moves as the box grows.
    var r = body.sourceRectAtTime(0, false);
    xf(body, "ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
    xf(body, "ADBE Position").expression =
      'var h = ' + hExpr + ';\r[' + (LEFT + WIDTH / 2) + ', ' + TOP + ' + h/2];';

    body.moveToBeginning();
    reveal(s, 0, 0.4); reveal(body, 0, 0.4);
    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, body.property("Source Text"));
    return comp;
  }

  function endCard(mark) {
    var comp = newComp("Apify — End card", 5);
    lockup(comp, mark, 380, 330.5, 319.294);
    var head = text(comp, "Headline", "Try Apify\rfor free", FONT.medium, 155.723, C.white,
      ParagraphJustification.CENTER_JUSTIFY);
    anchorAt(head, 0.5, 0.5, 540.5, 671.5 + 312 / 2);

    var btn = outlineBox(comp, "Button", 348, 1094.5, 384, 110.4, C.ctaStroke, 2.4, C.ctaBg);
    var label = text(comp, "Button label", "apify.com", FONT.regular, 43, C.ctaInk,
      ParagraphJustification.CENTER_JUSTIFY);
    anchorAt(label, 0.5, 0.5, 540, 1094.5 + 110.4 / 2);

    reveal(head, 0.1, 0.4);
    popIn(btn, 0.3, 0.35);
    popIn(label, 0.3, 0.35);

    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, head.property("Source Text"));
    expose(comp, label.property("Source Text"));
    return comp;
  }

  function watchFull() {
    var comp = newComp("Apify — Watch the full video", 5);
    var body = text(comp, "Message", "Watch the full video\ron our channel\rfor more context",
      FONT.light, 68.106, C.white, ParagraphJustification.CENTER_JUSTIFY);
    anchorAt(body, 0.5, 0, 540.5, 821);
    var btn = outlineBox(comp, "Button", 277, 1136, 526, 126.886, C.ctaStroke, 2.768, C.ctaBg);
    var label = text(comp, "Button label", "youtube.com/apify", FONT.regular, 50, C.ctaInk,
      ParagraphJustification.CENTER_JUSTIFY);
    anchorAt(label, 0.5, 0.5, 540, 1136 + 126.886 / 2);
    reveal(body, 0, 0.45);
    popIn(btn, 0.25, 0.35); popIn(label, 0.25, 0.35);
    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, body.property("Source Text"));
    expose(comp, label.property("Source Text"));
    return comp;
  }

  function logoOutro(mark) {
    var comp = newComp("Apify — Logo outro", 3);
    var l = lockup(comp, mark, 273.294, 886.642, 532.706);
    if (l) popIn(l, 0, 0.5);

    // A template must publish at least one control or AE refuses to export it —
    // and this one had nothing to type. The switch is the kit's own rule
    // (Figma "Tiktok audit": only the monochrome logo over a busy background),
    // so the control earns its place rather than being there to satisfy AE.
    var ctrl = controlsLayer(comp);
    var cb = ctrl.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
    cb.name = "Monochrome white";
    cb.property(1).setValue(0);
    if (l) {
      var tint = l.property("ADBE Effect Parade").addProperty("ADBE Tint");
      tint.property("ADBE Tint-0001").setValue([1, 1, 1, 1]);   // map black to white
      tint.property("ADBE Tint-0002").setValue([1, 1, 1, 1]);   // map white to white
      tint.property("ADBE Tint-0003").expression =
        'thisComp.layer("Controls").effect("Monochrome white")("Checkbox") * 100';
    }

    comp.motionGraphicsTemplateName = comp.name;
    expose(comp, cb.property(1));
    return comp;
  }

  // ---- run ---------------------------------------------------------------
  try {
    app.beginUndoGroup("Build Apify short-form mogrts");
    var folder = new Folder(OUT);
    if (!folder.exists) folder.create();

    say("lockup=" + (new File(LOCKUP).exists ? "present" : "MISSING " + LOCKUP));

    // Build and export ONE AT A TIME. exportAsMotionGraphicsTemplate
    // invalidates every CompItem reference held, not just the one exported, so
    // an array of comps built up front is stale by the second export.
    var builders = [
      function () { return titleBoxed(); },
      function () { return titlePlain(); },
      function () { return statement(); },
      function () {
        // Figma Title 4 (2546:726). Centres from get_design_context, checked
        // against the rendered frame — get_metadata's y is up to 75px out here.
        return funkyTitle("Apify — Funky title (3 words)", 143.145, C.orange, [
          { label: "Word 1", value: "More", cx: 432.2, cy: 680.1875, rot: -11.62 },
          { label: "Word 2", value: "funky", cx: 628.18, cy: 849.2085, rot: 7.88 },
          { label: "Word 3", value: "titles", cx: 520.03, cy: 1019.8125, rot: -8.26 }
        ]);
      },
      function () {
        // Figma Title 5 (2546:774) — its own layout, not the 3-word one scaled.
        return funkyTitle("Apify — Funky title (5 words)", 112.763, C.blue, [
          { label: "Word 1", value: "When", cx: 367.49, cy: 682.5015, rot: -11.62 },
          { label: "Word 2", value: "there\u2019s", cx: 655.10, cy: 777.3295, rot: 7.04 },
          { label: "Word 3", value: "lots", cx: 377.44, cy: 940.672, rot: -17.65 },
          { label: "Word 4", value: "of", cx: 546.79, cy: 993.5425, rot: 7.04 },
          { label: "Word 5", value: "text", cx: 655.01, cy: 1157.9745, rot: 7.04 }
        ]);
      },
      function () { return lowerThirdBoxed(); },
      function () { return lowerThirdPlain(); },
      function () { return lowerThirdPlace(); },
      function () { return endCard(importLockup()); },
      function () { return watchFull(); },
      function () { return logoOutro(importLockup()); }
    ];

    for (var i = 0; i < builders.length; i++) {
      var c = builders[i]();
      // The thumbnail Premiere shows in Essential Graphics is the comp's POSTER
      // frame, which defaults to 0 — where every reveal is still fully wiped.
      // Left alone, the whole kit browses as nine black rectangles.
      c.posterTime = SETTLED;
      var label = c.name;
      // Also render the settled frame. AE's own .mogrt thumbnail is not
      // reliably the poster frame, and "it exported" says nothing about whether
      // anything is actually on screen — these are the check, and they double
      // as a contact sheet of the kit.
      try {
        var pdir = new Folder(OUT + "/preview");
        if (!pdir.exists) pdir.create();
        c.saveFrameToPng(SETTLED, new File(pdir.fsName + "/" + label.replace(/[^A-Za-z0-9]+/g, "-") + ".png"));
      } catch (pe) { say("  preview failed: " + pe.toString()); }
      var controllers = c.motionGraphicsTemplateControllerCount;
      // Second argument is the destination FOLDER, not a file path — give it a
      // file path and AE creates a DIRECTORY with that name.
      var ok = c.exportAsMotionGraphicsTemplate(true, folder.fsName);
      say((ok ? "ok   " : "FAIL ") + label + "  (" + controllers + " controls)");
    }
    say("DONE " + builders.length);
  } catch (e) {
    say("THREW: " + e.toString() + (e.line ? " @line " + e.line : ""));
  } finally {
    app.endUndoGroup();
    flush();
  }
})();
