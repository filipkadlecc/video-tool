import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { evalSceneCode } from "./DynamicScene";
import { SPRINGS } from "./motion";
import { animationFrames, composeEffects, itemEffects, presetStyle, visibleCharacters, wordProgress } from "../lib/editor-effects";
import type { Effect } from "../lib/editor-effects";
import { resolvedLayout, type ResolvedLayout } from "../lib/editor-keys";
import {
  captionPageAt,
  docDuration,
  getAsset,
  paginateCaptions,
  type Asset,
  type AudioItem,
  type CaptionsItem,
  type EditorDoc,
  type EditorItem,
  type GifItem,
  type ImageItem,
  type SceneItem,
  type SolidItem,
  type TextItem,
  type TextStyle,
  type VideoItem,
} from "../lib/editor-doc";

/**
 * Renders an EditorDoc. This is the ONLY place a document becomes pixels — the
 * preview player and the export both mount this component, so the preview is
 * the render rather than an approximation of it.
 *
 * Tracks stack as sibling <AbsoluteFill>s in array order, so a later track paints
 * over an earlier one. Items are positioned in time by <Sequence> and in space by
 * their layout box.
 */

/** Resolve an asset src: a project-media URL passes through, anything else is a staticFile path. */
function resolveSrc(asset: Asset): string {
  return asset.src.startsWith("/") || asset.src.startsWith("http")
    ? asset.src
    : staticFile(asset.src);
}

/**
 * A RESOLVED layout becomes CSS.
 *
 * v1 documents render pixel-identically: scale defaults to 1 so no `scale()`
 * is emitted, and anchor defaults to 0.5/0.5 — which is what transform-origin
 * already was, and is inert on an untransformed element anyway.
 */
function layoutStyle(layout: ResolvedLayout): React.CSSProperties {
  const t = [
    layout.scale !== 1 ? `scale(${layout.scale})` : null,
    layout.rotation ? `rotate(${layout.rotation}deg)` : null,
  ].filter(Boolean).join(" ");
  return {
    position: "absolute",
    left: layout.x,
    top: layout.y,
    width: layout.width,
    height: layout.height,
    opacity: layout.opacity,
    borderRadius: layout.cornerRadius ? layout.cornerRadius : undefined,
    overflow: layout.cornerRadius ? "hidden" : undefined,
    transform: t || undefined,
    // Anchor is what makes rotation AND scale mean anything; both share it.
    transformOrigin: `${layout.anchorX * 100}% ${layout.anchorY * 100}%`,
  };
}

function textStyle(style: TextStyle): React.CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight ?? 400,
    color: style.color,
    textAlign: style.align ?? "left",
    lineHeight: style.lineHeight ?? 1.2,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    background: style.backgroundColor,
    padding: style.padding,
    borderRadius: style.backgroundRadius,
  };
}

/**
 * Fade a media item in and out by frame position within its own Sequence.
 * Returns 1 when no fades are set, so the common case costs nothing.
 */
function useFadeVolume(item: VideoItem | AudioItem): number {
  const frame = useCurrentFrame();
  const base = item.volume ?? 1;
  const fadeIn = item.fadeInFrames ?? 0;
  const fadeOut = item.fadeOutFrames ?? 0;
  if (!fadeIn && !fadeOut) return base;
  const dur = item.durationInFrames;
  const rampIn = fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const rampOut = fadeOut
    ? interpolate(frame, [dur - fadeOut, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  return base * rampIn * rampOut;
}

/**
 * Source trims are stored in SECONDS and converted here. Remotion's
 * trimBefore/trimAfter are composition frames — they are applied as a
 * `<Sequence from={-trimBefore}>` offset and the media element seeks to
 * `frame / useVideoConfig().fps`, which never consults the file's own frame
 * rate. Converting at render time keeps the document independent of fps.
 */
function trimProps(item: VideoItem | AudioItem, fps: number) {
  return {
    trimBefore: item.sourceIn != null ? Math.round(item.sourceIn * fps) : undefined,
    trimAfter: item.sourceOut != null ? Math.round(item.sourceOut * fps) : undefined,
  };
}

const VideoLayer: React.FC<{ item: VideoItem; asset?: Asset; muted: boolean; layout: ResolvedLayout }> = ({ item, asset, muted, layout }) => {
  const { fps } = useVideoConfig();
  const volume = useFadeVolume(item);
  if (!asset) return null;
  return (
    <div style={layoutStyle(layout)}>
      <OffthreadVideo
        src={resolveSrc(asset)}
        {...trimProps(item, fps)}
        playbackRate={item.playbackRate ?? 1}
        volume={muted ? 0 : volume}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
};

const AudioLayer: React.FC<{ item: AudioItem; asset?: Asset; muted: boolean }> = ({ item, asset, muted }) => {
  const { fps } = useVideoConfig();
  const volume = useFadeVolume(item);
  if (!asset) return null;
  return (
    <Audio
      src={resolveSrc(asset)}
      {...trimProps(item, fps)}
      playbackRate={item.playbackRate ?? 1}
      volume={muted ? 0 : volume}
    />
  );
};

const ImageLayer: React.FC<{ item: ImageItem | GifItem; asset?: Asset; layout: ResolvedLayout }> = ({ item, asset, layout }) => {
  if (!asset) return null;
  return (
    <div style={layoutStyle(layout)}>
      <Img
        src={resolveSrc(asset)}
        style={{ width: "100%", height: "100%", objectFit: item.fit ?? "cover" }}
      />
    </div>
  );
};

const TextLayer: React.FC<{ item: TextItem; layout: ResolvedLayout }> = ({ item, layout }) => {
  const { inProgress } = useAnimationProgress(item);
  // Typing and the word cascade decompose the text itself, so the layer has
  // to know which entrance is active — and a bypassed one must not count.
  const preset = enabledEffects(item).find((e) => e.kind === "animateIn")?.preset;
  const body = { ...textStyle(item.style), width: "100%", whiteSpace: "pre-wrap" as const };

  // A typewriter is per-CHARACTER — never a mask sweep with a feathered edge,
  // which reads as a wipe rather than typing.
  //
  // Every character is rendered and the untyped ones are simply invisible,
  // rather than slicing the string. Slicing re-lays the text out on every frame,
  // so centred or right-aligned text grows outwards from its anchor instead of
  // typing left to right — which is not what typing looks like. Keeping the full
  // string reserves the final layout, so characters appear in reading order
  // whatever the alignment.
  if (preset === "type") {
    const typed = visibleCharacters(item.text, inProgress);
    return (
      <div style={{ ...layoutStyle(layout), display: "flex", alignItems: "center" }}>
        <div style={body}>
          {item.text.split("").map((char, i) => (
            <span key={i} style={{ opacity: i < typed ? 1 : 0 }}>
              {char}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (preset === "words") {
    // Index the words up front rather than counting while rendering — a counter
    // mutated inside map() is a render-phase side effect.
    const tokens = item.text.split(/(\s+)/);
    let seen = 0;
    const indexed = tokens.map((token) => {
      const isWord = token.trim().length > 0;
      return { token, isWord, index: isWord ? seen++ : -1 };
    });
    const wordCount = seen;

    return (
      <div style={{ ...layoutStyle(layout), display: "flex", alignItems: "center" }}>
        <div style={body}>
          {indexed.map(({ token, isWord, index }, i) => {
            if (!isWord) return <span key={i}>{token}</span>;
            const p = wordProgress(index, wordCount, inProgress);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px)`,
                }}
              >
                {token}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...layoutStyle(layout), display: "flex", alignItems: "center" }}>
      <div style={body}>{item.text}</div>
    </div>
  );
};

const SolidLayer: React.FC<{ item: SolidItem; layout: ResolvedLayout }> = ({ item, layout }) => (
  <div style={{ ...layoutStyle(layout), background: item.color }} />
);

/**
 * Captions show a page of words at a time, highlighting the one being spoken.
 *
 * `useCurrentFrame()` inside a <Sequence> is already item-relative, and caption
 * token times are item-relative too, so the two line up with no offset maths —
 * which is what keeps captions in sync when the item is dragged or trimmed.
 */
const CaptionsLayer: React.FC<{ item: CaptionsItem; layout: ResolvedLayout }> = ({ item, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages = useMemo(
    () => paginateCaptions(item.tokens, item.pageDurationMs ?? 1200, item.maxWordsPerPage ?? 6),
    [item.tokens, item.pageDurationMs, item.maxWordsPerPage],
  );
  const sec = frame / fps;
  const page = captionPageAt(pages, sec);
  if (!page) return null;
  return (
    <div style={{ ...layoutStyle(layout), display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...textStyle(item.style), textAlign: "center" }}>
        {page.tokens.map((w, i) => {
          const active = sec >= w.startSec && sec < w.endSec;
          return (
            <span
              key={i}
              style={{ color: active ? item.highlightColor ?? item.style.color : item.style.color }}
            >
              {w.text}
              {i < page.tokens.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/**
 * An AI-generated scene, placed as an item. Compiling TSX is expensive, so the
 * component is memoised on the code itself — without that, a document holding a
 * few generated scenes would recompile all of them on every frame.
 */
const SceneLayer: React.FC<{ item: SceneItem; layout: ResolvedLayout }> = ({ item, layout }) => {
  const Component = useMemo(() => evalSceneCode(item.code)?.component ?? null, [item.code]);
  if (!Component) return null;
  const offset = item.sourceOffsetFrames ?? 0;
  const scene = <Component />;
  return (
    <div style={layoutStyle(layout)}>
      {offset > 0 ? (
        // Shift the embedded composition back so this item shows the stretch
        // starting at `offset` — the same mechanism Remotion uses for trimBefore.
        // A generated edit can then be split into blocks with its animated cards
        // still rendering exactly as authored.
        <Sequence from={-offset} layout="none">
          {scene}
        </Sequence>
      ) : (
        scene
      )}
    </div>
  );
};

/**
 * Progress of an item's in and out animations at the current frame, using the
 * house springs so an editor animation matches a generated one.
 *
 * Returned as a pair because opacity takes the MINIMUM of the two — the idiom
 * the branded scenes use for an element that arrives and later leaves.
 */
/**
 * The enabled effects on an item, as the renderer sees them.
 *
 * A BYPASSED effect keeps all its values but contributes nothing — that is the
 * whole point of the switch, and it is why this filters rather than deletes.
 */
function enabledEffects(item: EditorItem): Effect[] {
  return itemEffects(item).filter((e) => e.enabled);
}

function useAnimationProgress(item: EditorItem) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const list = enabledEffects(item);
  const inFx = list.find((e) => e.kind === "animateIn");
  const outFx = list.find((e) => e.kind === "animateOut");
  const inSpec = inFx && { preset: inFx.preset, durationInFrames: inFx.durationInFrames };
  const outSpec = outFx && { preset: outFx.preset, durationInFrames: outFx.durationInFrames };
  // `durationInFrames` stretches the spring to the requested length. Driving it
  // with a plain delayed spring instead — as this first did — ignores the field
  // entirely, because a spring's length comes from its config, so changing the
  // number in Properties did nothing.
  const inProgress = inSpec && inSpec.preset !== "none"
    ? spring({
        frame,
        fps,
        config: SPRINGS.SNAPPY,
        durationInFrames: animationFrames(inSpec),
      })
    : 1;
  const outFrames = animationFrames(outSpec);
  const outProgress = outSpec && outSpec.preset !== "none"
    ? interpolate(
        frame,
        [item.durationInFrames - outFrames, item.durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;
  return { inProgress, outProgress };
}

/**
 * Wraps a layer in its in/out animation. Transform-only presets are applied
 * here; `type` and `words` decompose the text itself and are handled by the
 * text layer, so this stays neutral for them.
 */
const Animated: React.FC<{ item: EditorItem; children: React.ReactNode }> = ({ item, children }) => {
  const { inProgress, outProgress } = useAnimationProgress(item);
  const list = enabledEffects(item);
  // Keep the fast path: with nothing enabled the wrapper div does not exist at
  // all, so it only costs a node when it is earning one.
  if (list.length === 0) return <>{children}</>;

  const composed = composeEffects(
    list.map((e) => presetStyle(
      e.preset,
      e.kind === "animateIn" ? inProgress : outProgress,
      e.kind === "animateIn" ? "in" : "out",
    )),
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: composed.opacity,
        transform: composed.transform === "none" ? undefined : composed.transform,
      }}
    >
      {children}
    </div>
  );
};

const ItemLayer: React.FC<{ item: EditorItem; doc: EditorDoc; muted: boolean }> = ({ item, doc, muted }) => {
  // Inside the <Sequence> this frame is ALREADY item-relative — the same basis
  // keyframes are stored in — so there is no offset arithmetic anywhere.
  //
  // Resolved here rather than inside each layer for two reasons: one evaluation
  // per item per frame instead of one per layoutStyle call, and several layers
  // return null before they would reach a hook, which would make a hook inside
  // them conditional.
  const layout = resolvedLayout(item, useCurrentFrame());
  switch (item.type) {
    case "video":
      return <VideoLayer item={item} layout={layout} asset={getAsset(doc, item.assetId)} muted={muted} />;
    case "audio":
      return <AudioLayer item={item} asset={getAsset(doc, item.assetId)} muted={muted} />;
    case "image":
    case "gif":
      return <ImageLayer item={item} layout={layout} asset={getAsset(doc, item.assetId)} />;
    case "text":
      return <TextLayer item={item} layout={layout} />;
    case "solid":
      return <SolidLayer item={item} layout={layout} />;
    case "captions":
      return <CaptionsLayer item={item} layout={layout} />;
    case "scene":
      return <SceneLayer item={item} layout={layout} />;
  }
};

export const EditorComposition: React.FC<{ doc: EditorDoc }> = ({ doc }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {doc.tracks.map((track) =>
        track.hidden ? null : (
          <AbsoluteFill key={track.id}>
            {track.items.map((item) => (
              <Sequence
                key={item.id}
                from={item.from}
                durationInFrames={item.durationInFrames}
                layout="none"
                name={`${item.type}:${item.id}`}
              >
                  <Animated item={item}>
                  <ItemLayer item={item} doc={doc} muted={Boolean(track.muted)} />
                </Animated>
              </Sequence>
            ))}
          </AbsoluteFill>
        ),
      )}
    </AbsoluteFill>
  );
};

/** Duration helper so the Player and the render entry agree on length. */
export function editorDocDuration(doc: EditorDoc): number {
  return docDuration(doc);
}

export default EditorComposition;
