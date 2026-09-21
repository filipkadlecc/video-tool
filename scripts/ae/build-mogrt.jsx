/**
 * Build the Apify short-form kit as After Effects comps and export each as a
 * .mogrt for Premiere Pro's Essential Graphics panel.
 *
 * Run: After Effects → File → Scripts → Run Script File… → this file.
 * Needs GT Walsheim (Light/Regular/Medium) installed. Writes to data/mogrt/.
 *
 * The numbers are the same ones the Remotion scenes use, which are verified
 * against Figma by scripts/figma-diff.ts. AE is a third text renderer, so
 * matching numbers is a much stronger claim than matching pixels — the boxes
 * here size themselves to whatever the editor types, which the Figma frames
 * cannot tell us anyway.
 */
(function () {
  var OUT = "~/video-tool/data/mogrt";
  var W = 1080, H = 1920, FPS = 25;

  // --- Figma tokens -------------------------------------------------------
  var C = {
    orange: [248 / 255, 102 / 255, 6 / 255],
    blue: [36 / 255, 109 / 255, 255 / 255],
    green: [32 / 255, 163 / 255, 78 / 255],
    white: [1, 1, 1],
    ink: [31 / 255, 33 / 255, 35 / 255]
  };
  var FONT = { light: "GTWalsheim-Light", regular: "GTWalsheim-Regular", medium: "GTWalsheim-Medium" };

  var log = [];
  function say(s) { log.push(String(s)); }

  function flush() {
    var f = new File("/tmp/ae-mogrt-log.txt");
    f.open("w"); f.write(log.join("\n")); f.close();
  }

  // --- helpers ------------------------------------------------------------

  function newComp(name, seconds) {
    var c = app.project.items.addComp(name, W, H, 1, seconds, FPS);
    c.bgColor = [0, 0, 0];
    return c;
  }

  /** A text layer with Figma's type values. Returns the layer. */
  function text(comp, name, str, font, size, colour, justify) {
    var layer = comp.layers.addText(str);
    layer.name = name;
    var prop = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = prop.value;
    doc.resetCharStyle();
    doc.font = font;
    doc.fontSize = size;
    doc.fillColor = colour;
    doc.applyFill = true;
    doc.applyStroke = false;
    doc.autoLeading = false;
    doc.leading = size;                       // Figma's "leading-none"
    doc.justification = justify || ParagraphJustification.LEFT_JUSTIFY;
    doc.text = str;
    prop.setValue(doc);
    return layer;
  }

  /**
   * Put a layer so its own bounding box lands at (x, y) in Figma coordinates.
   * AE measures from the centre with y up from the top-left, so this converts;
   * anchoring to the layer's own rect is what makes the box land exactly.
   */
  function placeTopLeft(layer, x, y) {
    var r = layer.sourceRectAtTime(0, false);
    layer.property("ADBE Transform Group").property("ADBE Anchor Point")
      .setValue([r.left, r.top]);
    layer.property("ADBE Transform Group").property("ADBE Position")
      .setValue([x, y]);
  }

  function placeCentre(layer, cx, cy) {
    var r = layer.sourceRectAtTime(0, false);
    layer.property("ADBE Transform Group").property("ADBE Anchor Point")
      .setValue([r.left + r.width / 2, r.top + r.height / 2]);
    layer.property("ADBE Transform Group").property("ADBE Position")
      .setValue([cx, cy]);
  }

  /**
   * A filled rectangle that sizes itself to a text layer plus padding, and
   * follows it. This is the part a rendered clip cannot give you: retype the
   * name in Premiere and the box grows with it.
   */
  function boxBehind(comp, name, textLayerName, padX, padY, colour) {
    var s = comp.layers.addShape();
    s.name = name;
    var grp = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var contents = grp.property("ADBE Vectors Group");
    var rect = contents.addProperty("ADBE Vector Shape - Rect");
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(colour.concat([1]));

    var ref = 'var t = thisComp.layer("' + textLayerName + '");\r' +
      'var r = t.sourceRectAtTime(time, false);\r';
    rect.property("ADBE Vector Rect Size").expression =
      ref + '[r.width + ' + (padX * 2) + ', r.height + ' + (padY * 2) + '];';
    rect.property("ADBE Vector Rect Position").expression =
      ref + 'var c = t.toComp([r.left + r.width/2, r.top + r.height/2]);\r' +
      'thisLayer.fromComp(c);';
    return s;
  }

  /** Left-to-right reveal, the AE equivalent of the scenes' clip reveal. */
  function reveal(layer, startSec, durSec) {
    var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Linear Wipe");
    var comp = fx.property("ADBE Linear Wipe-0001");   // Transition Completion
    fx.property("ADBE Linear Wipe-0002").setValue(-90); // Wipe Angle: left to right
    comp.setValueAtTime(startSec, 100);
    comp.setValueAtTime(startSec + durSec, 0);
    for (var i = 1; i <= comp.numKeys; i++) {
      comp.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    }
    return fx;
  }

  /** A null holding colour/checkbox controls the Essential Graphics panel shows. */
  function controls(comp) {
    var n = comp.layers.addNull();
    n.name = "Controls";
    n.enabled = false;
    return n;
  }

  function colourControl(nullLayer, name, colour) {
    var fx = nullLayer.property("ADBE Effect Parade").addProperty("ADBE Color Control");
    fx.name = name;
    fx.property(1).setValue(colour.concat([1]));
    return fx.property(1);
  }

  function expose(comp, prop, label) {
    var ok = prop.addToMotionGraphicsTemplate(comp);
    if (ok && label) {
      comp.setMotionGraphicsControllerName(comp.motionGraphicsTemplateControllerCount - 1, label);
    }
    return ok;
  }

  // --- the scenes ---------------------------------------------------------

  function lowerThirdBoxed() {
    var comp = newComp("Apify — Lower third (boxed)", 5);
    var ctrl = controls(comp);
    var accent = colourControl(ctrl, "Accent", C.green);

    // Figma 2545:571 @ (169, 929): Name / Surname in accent boxes, 106.982
    // Medium; Position in a white box, 58.295 Regular. Gap 12.
    var name = text(comp, "Name", "Name", FONT.medium, 106.982, C.white);
    var surname = text(comp, "Surname", "Surname", FONT.medium, 106.982, C.white);
    var position = text(comp, "Position", "Position", FONT.regular, 58.295, C.ink);

    var nameBox = boxBehind(comp, "Name box", "Name", 20, 0, C.green);
    var surnameBox = boxBehind(comp, "Surname box", "Surname", 20, 0, C.green);
    var positionBox = boxBehind(comp, "Position box", "Position", 20, 14, C.white);

    nameBox.property("Contents").property(1).property("Contents").property(2)
      .property("ADBE Vector Fill Color").expression =
      'thisComp.layer("Controls").effect("Accent")("Color")';
    surnameBox.property("Contents").property(1).property("Contents").property(2)
      .property("ADBE Vector Fill Color").expression =
      'thisComp.layer("Controls").effect("Accent")("Color")';

    placeTopLeft(name, 169 + 20, 929);
    placeTopLeft(surname, 169 + 20, 929 + 107 + 12);
    placeTopLeft(position, 169 + 20, 929 + 107 + 12 + 107 + 12 + 14);

    // Text above its box; boxes reveal with their text.
    name.moveToBeginning(); surname.moveToBeginning(); position.moveToBeginning();

    reveal(nameBox, 0, 0.4); reveal(name, 0, 0.4);
    reveal(surnameBox, 0.16, 0.4); reveal(surname, 0.16, 0.4);
    reveal(positionBox, 0.32, 0.4); reveal(position, 0.32, 0.4);

    comp.motionGraphicsTemplateName = "Apify — Lower third (boxed)";
    expose(comp, name.property("Source Text"), "First name");
    expose(comp, surname.property("Source Text"), "Surname");
    expose(comp, position.property("Source Text"), "Role");
    expose(comp, accent, "Box colour");
    return comp;
  }

  // --- run ----------------------------------------------------------------
  try {
    app.beginUndoGroup("Build Apify short-form mogrts");
    var folder = new Folder(OUT);
    if (!folder.exists) folder.create();
    say("out=" + folder.fsName);

    var built = [lowerThirdBoxed()];
    for (var i = 0; i < built.length; i++) {
      var c = built[i];
      var file = new File(folder.fsName + "/" + c.name.replace(/[^A-Za-z0-9]+/g, "-") + ".mogrt");
      var ok = c.exportAsMotionGraphicsTemplate(true, file.fsName);
      say(c.name + " -> " + (ok ? "exported " + file.fsName : "EXPORT FAILED"));
      say("  controllers=" + c.motionGraphicsTemplateControllerCount);
    }
    say("DONE");
  } catch (e) {
    say("THREW: " + e.toString() + (e.line ? " @line " + e.line : ""));
  } finally {
    app.endUndoGroup();
    flush();
  }
})();
