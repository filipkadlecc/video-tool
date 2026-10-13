import { findItem, retimeSceneCode, updateItem, type EditorDoc, type SceneItem } from "@/lib/editor-doc";
import { sceneFramesAtFps, sceneMeta } from "@/lib/scene-eval";
import { SNIPPET_SCHEMAS } from "@/lib/snippet-schemas";
import { renderSnippet } from "@/lib/snippet-template";

/**
 * Write a library block's parameters back into its code.
 *
 * A snippet's texts live as top-of-file consts in `item.code`; `renderSnippet`
 * rewrites those consts over the block's CURRENT code (line-anchored and
 * idempotent), so any other edit to the file survives.
 *
 * The block's length follows the code only when the change moved the length
 * the code itself declares — PromptBox's typing and hold seconds, AiChat's logo
 * outro. A text edit leaves the length alone, so a block the user resized keeps
 * the size they gave it. (Re-deriving the length on every save threw a manual
 * resize away, and in a 30fps document shrank AiChat by 75 frames.)
 */
export function applySnippetValues(
  doc: EditorDoc,
  itemId: string,
  values: Record<string, unknown>,
): EditorDoc {
  const found = findItem(doc, itemId);
  if (!found || found.item.type !== "scene") return doc;
  const item = found.item as SceneItem;
  const schema = item.snippet ? SNIPPET_SCHEMAS[item.snippet.id] : undefined;
  if (!item.snippet || !schema) return doc;

  const fps = doc.size.fps;
  const nextCode = renderSnippet(item.code, schema, values);
  const declared = (code: string) => sceneFramesAtFps(sceneMeta(code, fps), fps);
  const durationInFrames = declared(nextCode) !== declared(item.code)
    ? declared(nextCode)
    : item.durationInFrames;

  return updateItem<SceneItem>(doc, itemId, {
    code: retimeSceneCode(nextCode, durationInFrames, fps),
    durationInFrames,
    snippet: { id: item.snippet.id, values },
  });
}
