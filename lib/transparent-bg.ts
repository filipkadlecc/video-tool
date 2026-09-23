import type { EditorDoc } from "./editor-doc";

export function stripBackgroundsForTransparency(code: string): string {
  let result = code.replace(/<Background\s*\/>/g, "{/* transparent */}");
  result = result.replace(/<SceneBg\s*\/>/g, "{/* transparent */}");

  result = result.replace(
    /const\s+(BlackScreen|Background|SceneBg)\s*[=:][^;{]*\{[\s\S]*?backgroundColor:\s*(?:COLORS\.bg|["']#[0-9a-fA-F]{3,8}["'])/g,
    (match) => match.replace(/backgroundColor:\s*(?:COLORS\.bg|["']#[0-9a-fA-F]{3,8}["'])/, 'backgroundColor: "transparent"'),
  );

  result = result.replace(
    /(return\s*\(\s*\n?\s*<AbsoluteFill[^>]*style=\{\{[^}]*?)backgroundColor:\s*COLORS\.bg/g,
    '$1backgroundColor: "transparent"',
  );
  result = result.replace(
    /(return\s*\(\s*\n?\s*<AbsoluteFill[^>]*style=\{\{[^}]*?)backgroundColor:\s*["']#[0-9a-fA-F]{3,8}["']/g,
    '$1backgroundColor: "transparent"',
  );

  return result;
}

/**
 * The document form of `stripBackgroundsForTransparency`.
 *
 * A document paints two opaque things the string pass above cannot reach. The
 * document's own background is drawn by `EditorComposition`, a project source
 * file no export ever rewrites; and each scene block's code is a JSON string by
 * the time `sceneCodeFromDoc` has generated the export module, so none of the
 * source patterns match it any more. Both are handled here instead, on the
 * document, before it is serialised — so an alpha export of a document carries
 * alpha for the same reason a code project's does.
 *
 * Returns a copy: the stored document keeps its background, and the editor goes
 * on previewing against it.
 */
export function docForTransparency(doc: EditorDoc): EditorDoc {
  return {
    ...doc,
    background: "transparent",
    tracks: doc.tracks.map((track) => ({
      ...track,
      items: track.items.map((item) =>
        item.type === "scene" ? { ...item, code: stripBackgroundsForTransparency(item.code) } : item,
      ),
    })),
  };
}
