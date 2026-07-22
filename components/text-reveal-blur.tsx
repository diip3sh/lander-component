"use client";

import * as React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { addPropertyControls, ControlType } from "framer";

type FontStyle = React.CSSProperties & {
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  letterSpacing?: number | string;
  lineHeight?: number | string;
};

type TransitionValue = {
  type?: string;
  duration?: number;
  delay?: number;
  ease?: string | number[];
  staggerChildren?: number;
};

type Props = {
  prefix?: string;
  texts?: string[];
  font?: FontStyle;
  color?: string;
  prefixColor?: string;
  /** Blob color while wiping / hiding text (moves right → left) */
  wipeColor?: string;
  /** Blob color while revealing text (moves left → right) */
  revealColor?: string;
  blobSize?: number;
  /** Extra vertical offset (px). Positive lifts the blob up. */
  blobPosition?: number;
  blur?: number;
  transition?: TransitionValue;
  style?: React.CSSProperties;
};

type CharMetrics = {
  left: number;
  right: number;
  center: number;
};

type Layout = {
  chars: CharMetrics[];
  /** Rest / end of reveal — just past the last character */
  homeX: number;
  /** Start of reveal / end of wipe — just before the first character */
  leftX: number;
  nodes: HTMLSpanElement[];
};

const HAS_SEGMENTER = typeof Intl !== "undefined" && "Segmenter" in Intl;

const START_SCALE = 1.45;

const splitIntoCharacters = (text: string): string[] => {
  if (HAS_SEGMENTER) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const DEFAULT_TEXTS = ["web", "Nextjs", "tailwindCSS", "Motion"];

const DEFAULT_FONT: FontStyle = {
  fontSize: "48px",
  letterSpacing: "-0.04em",
  lineHeight: "1.1em",
  textAlign: "left",
};

const DEFAULT_TRANSITION: TransitionValue = {
  type: "tween",
  duration: 0.55,
  delay: 1.2,
  ease: "easeOut",
  staggerChildren: 0.06,
};

const CHAR_REVEAL_DURATION = 0.4;
const DEFAULT_WIPE_COLOR = "#EF4444";
const DEFAULT_REVEAL_COLOR = "#F97316";
const BLOB_COLOR_DURATION = 0.28;
const BLOB_COLOR_EASE = [0.215, 0.61, 0.355, 1] as const; // ease-out-cubic

export default function TextRevealBlur({
  prefix = "Built with",
  texts = DEFAULT_TEXTS,
  font = DEFAULT_FONT,
  color = "#FFFFFF",
  prefixColor = "#FFFFFF",
  wipeColor = DEFAULT_WIPE_COLOR,
  revealColor = DEFAULT_REVEAL_COLOR,
  blobSize = 12,
  blobPosition = 0,
  blur = 20,
  transition = DEFAULT_TRANSITION,
  style,
}: Props) {
  const safeBlobSize = Math.min(Math.max(blobSize, 4), 20);
  // Larger blobs hang lower — lift by ~half the diameter, plus manual offset
  const safeBlobPosition = Math.min(Math.max(blobPosition, -12), 24);
  const blobMarginBottom = Math.round(safeBlobSize * 0.55) + safeBlobPosition;
  const safeTexts = useMemo(() => {
    const list = (texts ?? DEFAULT_TEXTS).filter((t) => t.length > 0);
    return list.length > 0 ? list : DEFAULT_TEXTS;
  }, [texts]);

  const [wordIndex, setWordIndex] = useState(0);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const charsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const wordIndexRef = useRef(0);
  const blobSizeRef = useRef(safeBlobSize);
  blobSizeRef.current = safeBlobSize;
  const wipeColorRef = useRef(wipeColor);
  const revealColorRef = useRef(revealColor);
  wipeColorRef.current = wipeColor;
  revealColorRef.current = revealColor;

  // Position via transform `x` at the blob center. Travel elongates by
  // animating width (not scale) so we get a true capsule, not an ellipse.
  const blobLeft = useMotionValue(0);
  const blobWidth = useMotionValue(safeBlobSize);
  const blobMarginLeft = useTransform(blobWidth, (w) => -w / 2);
  const blobColor = useMotionValue(wipeColor);
  const [blobReady, setBlobReady] = useState(true);

  const currentWord = safeTexts[wordIndex] ?? safeTexts[0] ?? "";
  const characters = useMemo(
    () => splitIntoCharacters(currentWord),
    [currentWord],
  );

  // Keep ref list length in sync; don't wipe entries (that races ref attach
  // and leaves measureLayout with zero nodes → blob never becomes ready).
  useLayoutEffect(() => {
    charsRef.current.length = characters.length;
  }, [characters.length, currentWord]);

  // Transition duration → wipe speed; delay → hold time between cycles
  const wipeDuration =
    transition.duration ?? DEFAULT_TRANSITION.duration ?? 0.55;
  const holdDuration = transition.delay ?? DEFAULT_TRANSITION.delay ?? 1.2;
  const staggerEach = transition.staggerChildren ?? 0.06;

  const getCharNodes = useCallback(() => {
    return charsRef.current.filter(
      (node): node is HTMLSpanElement => node != null,
    );
  }, []);

  /**
   * Prefer offsetLeft/offsetWidth (ignores CSS transforms). Fall back to
   * getBoundingClientRect relative to the wrapper when offsets aren't ready.
   */
  const measureLayout = useCallback((): Layout | null => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;

    const nodes = getCharNodes();
    if (nodes.length === 0) return null;

    const layoutWidth = wrapper.offsetWidth;
    if (layoutWidth < 1) return null;

    const size = blobSizeRef.current;
    // homeX/leftX are the blob *center*. Reserve half the diameter plus a
    // size-scaled clear gap so larger blobs never sit on the glyphs.
    const half = size / 2;
    const clearGap = Math.max(6, Math.round(size * 0.45));
    const parkInset = half + clearGap;

    let chars: CharMetrics[] = nodes.map((node) => {
      const left = node.offsetLeft;
      const width = node.offsetWidth;
      return {
        left,
        right: left + width,
        center: left + width / 2,
      };
    });

    const offsetsReady = chars.every((c) => c.right > c.left);

    if (!offsetsReady) {
      const wrapperRect = wrapper.getBoundingClientRect();
      if (wrapperRect.width < 1) return null;
      const zoom = layoutWidth / wrapperRect.width;
      if (!Number.isFinite(zoom) || zoom < 0.25 || zoom > 4) return null;

      chars = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const left = (rect.left - wrapperRect.left) * zoom;
        const width = rect.width * zoom;
        return {
          left,
          right: left + width,
          center: left + width / 2,
        };
      });
    }

    if (chars.some((c) => !Number.isFinite(c.center) || c.right <= c.left)) {
      return null;
    }

    const first = chars[0]!;
    const last = chars[chars.length - 1]!;

    const homeX = last.right + parkInset;
    const leftX = Math.max(half, first.left - parkInset);

    const maxX = layoutWidth + size + clearGap;
    const clampX = (value: number) =>
      Math.min(maxX, Math.max(-size * 0.25, value));

    return {
      chars,
      homeX: clampX(homeX),
      leftX: clampX(leftX),
      nodes,
    };
  }, [getCharNodes]);

  const measureLayoutRef = useRef(measureLayout);
  measureLayoutRef.current = measureLayout;

  const waitForLayout = useCallback(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      const layout = measureLayoutRef.current();
      if (layout && layout.nodes.length > 0) return layout;
    }
    return null;
  }, []);

  // Park the blob as soon as glyphs exist (don't wait on the async loop).
  useLayoutEffect(() => {
    const layout = measureLayout();
    if (!layout) return;
    blobLeft.set(layout.homeX);
    setBlobReady(true);
  }, [measureLayout, blobLeft, currentWord, safeBlobSize]);

  const setCharsVisible = (nodes: HTMLSpanElement[]) => {
    nodes.forEach((node) => {
      node.style.opacity = "1";
      node.style.filter = "blur(0px)";
      node.style.transform = "scale(1)";
    });
  };

  const setCharsHidden = (nodes: HTMLSpanElement[]) => {
    nodes.forEach((node) => {
      node.style.opacity = "0";
      node.style.filter = `blur(${blur}px)`;
      node.style.transform = `scale(${START_SCALE})`;
    });
  };

  useEffect(() => {
    if (safeTexts.length === 0) return;

    // Reduced motion: keep a static blob at the end of the word
    if (prefersReducedMotion()) {
      const layout = measureLayoutRef.current();
      if (layout) {
        blobLeft.set(layout.homeX);
        blobColor.set(wipeColorRef.current);
        setBlobReady(true);
        setCharsVisible(layout.nodes);
      }
      return;
    }

    let cancelled = false;
    let activeAnim: { stop: () => void } | undefined;
    let charAnim: { stop: () => void } | undefined;
    let colorAnim: { stop: () => void } | undefined;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        holdTimer = setTimeout(resolve, ms);
      });

    const setBlobColorSmooth = (next: string, instant = false) => {
      colorAnim?.stop();
      if (instant) {
        blobColor.set(next);
        return;
      }
      colorAnim = animate(blobColor, next, {
        duration: BLOB_COLOR_DURATION,
        ease: BLOB_COLOR_EASE,
      });
    };
    const blobHalf = () => blobWidth.get() / 2;

    const resetBlobScale = () => {
      blobWidth.set(blobSizeRef.current);
    };

    const setBlobDeform = (direction: "left" | "right" | "rest") => {
      const spring = {
        type: "spring" as const,
        stiffness: 420,
        damping: 18,
      };
      const size = blobSizeRef.current;

      if (direction === "rest") {
        animate(blobWidth, size, spring);
        return;
      }

      // Stadium / capsule: same height, longer width, radius = height/2
      animate(blobWidth, size * 2.4, spring);
    };

    /** Wipe L←R: hide as soon as blob’s leading (left) edge touches the glyph */
    const hideCharsWithBlob = (
      nodes: HTMLSpanElement[],
      chars: CharMetrics[],
      x: number,
    ) => {
      const half = blobHalf();
      const leadEdge = x - half;
      nodes.forEach((node, i) => {
        const metrics = chars[i];
        if (!metrics) return;
        if (leadEdge <= metrics.right) {
          node.style.opacity = "0";
          node.style.filter = `blur(${blur}px)`;
          node.style.transform = `scale(${START_SCALE})`;
        }
      });
    };

    /** Reveal L→R: show as soon as blob’s leading (right) edge touches the glyph */
    const revealWithBlob = (
      nodes: HTMLSpanElement[],
      chars: CharMetrics[],
      homeX: number,
    ) =>
      new Promise<void>((resolve) => {
        setCharsHidden(nodes);
        setBlobColorSmooth(revealColorRef.current);
        setBlobDeform("right");

        const revealed = new Set<number>();
        const charCount = Math.max(nodes.length, 1);
        const blobDuration = Math.max((charCount - 1) * staggerEach, 0.12);

        activeAnim = animate(blobLeft, homeX, {
          duration: blobDuration,
          ease: "linear",
          onUpdate: (x) => {
            const half = blobHalf();
            const leadEdge = x + half;
            nodes.forEach((node, i) => {
              if (revealed.has(i)) return;
              const metrics = chars[i];
              if (!metrics) return;

              if (leadEdge >= metrics.left) {
                revealed.add(i);
                charAnim = animate(
                  node,
                  {
                    opacity: [0, 1],
                    scale: [START_SCALE, 1],
                    filter: [`blur(${blur}px)`, "blur(0px)"],
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any,
                  {
                    duration: CHAR_REVEAL_DURATION,
                    ease: "easeOut",
                  },
                );
              }
            });
          },
          onComplete: () => {
            nodes.forEach((node, i) => {
              if (revealed.has(i)) return;
              revealed.add(i);
              animate(
                node,
                {
                  opacity: [0, 1],
                  scale: [START_SCALE, 1],
                  filter: [`blur(${blur}px)`, "blur(0px)"],
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
                { duration: CHAR_REVEAL_DURATION, ease: "easeOut" },
              );
            });

            setBlobDeform("rest");

            holdTimer = setTimeout(() => {
              setCharsVisible(nodes);
              resolve();
            }, CHAR_REVEAL_DURATION * 1000);
          },
        });
      });

    const runLoop = async () => {
      let layout = await waitForLayout();
      if (!layout || cancelled) return;

      resetBlobScale();
      setBlobColorSmooth(wipeColorRef.current, true);
      blobLeft.set(layout.homeX);
      setBlobReady(true);
      setCharsVisible(layout.nodes);

      while (!cancelled) {
        // Remeasure after any word change — bounds track this word only
        layout = await waitForLayout();
        if (!layout || cancelled) break;

        setBlobColorSmooth(wipeColorRef.current);
        blobLeft.set(layout.homeX);
        setBlobDeform("rest");
        setCharsVisible(layout.nodes);

        await wait(holdDuration * 1000);
        if (cancelled) break;

        // Measure again at rest scale so wipe distance matches visible glyphs
        setCharsVisible(layout.nodes);
        const wipeLayout = await waitForLayout();
        if (!wipeLayout || cancelled) break;

        setBlobColorSmooth(wipeColorRef.current);
        setBlobDeform("left");

        await new Promise<void>((resolve) => {
          activeAnim = animate(blobLeft, wipeLayout.leftX, {
            duration: wipeDuration,
            ease: [0.215, 0.61, 0.355, 1],
            onUpdate: (x) => {
              hideCharsWithBlob(wipeLayout.nodes, wipeLayout.chars, x);
            },
            onComplete: () => {
              setBlobDeform("rest");
              resolve();
            },
          });
        });

        if (cancelled) break;

        const nextIndex = (wordIndexRef.current + 1) % safeTexts.length;
        wordIndexRef.current = nextIndex;
        setWordIndex(nextIndex);

        // Wait for new word glyphs, measure at natural scale (hidden but scale 1 briefly)
        layout = await waitForLayout();
        if (!layout || cancelled) break;

        // Force natural metrics: measure with scale(1) even while invisible
        layout.nodes.forEach((node) => {
          node.style.transform = "scale(1)";
          node.style.opacity = "0";
          node.style.filter = `blur(${blur}px)`;
        });
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });
        const revealLayout = measureLayoutRef.current();
        if (!revealLayout || cancelled) break;

        blobLeft.set(revealLayout.leftX);
        setCharsHidden(revealLayout.nodes);

        await revealWithBlob(
          revealLayout.nodes,
          revealLayout.chars,
          revealLayout.homeX,
        );

        if (cancelled) break;

        setCharsVisible(revealLayout.nodes);
        blobLeft.set(revealLayout.homeX);
        setBlobColorSmooth(wipeColorRef.current);
      }
    };

    runLoop();

    return () => {
      cancelled = true;
      clearTimeout(holdTimer);
      activeAnim?.stop();
      charAnim?.stop();
      colorAnim?.stop();
      resetBlobScale();
    };
  }, [
    safeTexts,
    holdDuration,
    wipeDuration,
    blur,
    blobLeft,
    blobWidth,
    blobColor,
    waitForLayout,
    staggerEach,
  ]);

  // Keep parked color in sync when controls change
  useEffect(() => {
    animate(blobColor, wipeColor, {
      duration: BLOB_COLOR_DURATION,
      ease: BLOB_COLOR_EASE,
    });
  }, [wipeColor, blobColor]);
  // When blob size changes, force a true circle rest shape and snap position
  useEffect(() => {
    const size = safeBlobSize;
    blobWidth.set(size);

    const layout = measureLayoutRef.current();
    if (!layout) return;
    const current = blobLeft.get();
    const nearHome = Math.abs(current - layout.homeX) < size * 2;
    const nearLeft = Math.abs(current - layout.leftX) < size * 2;
    if (nearHome) {
      blobLeft.set(layout.homeX);
    } else if (nearLeft) {
      blobLeft.set(layout.leftX);
    }
  }, [safeBlobSize, blobLeft, blobWidth]);

  const textAlign =
    (font.textAlign as React.CSSProperties["textAlign"]) ?? "left";
  const justifyContent =
    textAlign === "center"
      ? "center"
      : textAlign === "right" || textAlign === "end"
        ? "flex-end"
        : "flex-start";

  return (
    <div
      style={{
        ...font,
        width: "100%",
        height: "100%",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent,
        gap: "0.35em",
        textAlign,
        ...style,
      }}
    >
      {prefix ? (
        <span style={{ color: prefixColor, whiteSpace: "pre" }}>{prefix}</span>
      ) : null}

      <span
        ref={wrapperRef}
        style={{
          position: "relative",
          display: "inline-block",
          color,
          letterSpacing: font.letterSpacing ?? "-0.04em",
          lineHeight: font.lineHeight ?? 1.1,
          verticalAlign: "baseline",
          // Keep room for the parked blob + clear gap (scales with size)
          paddingRight:
            Math.max(6, Math.round(safeBlobSize * 0.45)) + safeBlobSize,
        }}
      >
        <span
          aria-hidden="true"
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {characters.map((char, i) => (
            <span
              key={`${currentWord}-${i}`}
              ref={(node) => {
                charsRef.current[i] = node;
              }}
              className="char"
              style={{
                display: "inline-block",
                transformOrigin: "50% 50%",
                willChange: "transform, opacity, filter",
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </span>

        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            borderWidth: 0,
          }}
        >
          {prefix ? `${prefix} ` : ""}
          {currentWord}
        </span>

        <motion.span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "0.08em",
            left: 0,
            x: blobLeft,
            width: blobWidth,
            height: safeBlobSize,
            marginLeft: blobMarginLeft,
            marginBottom: blobMarginBottom,
            borderRadius: 9999,
            backgroundColor: blobColor,
            display: "block",
            pointerEvents: "none",
            opacity: blobReady ? 1 : 0,
            willChange: "transform, width, background-color",
          }}
        />
      </span>
    </div>
  );
}

TextRevealBlur.defaultProps = {
  prefix: "Built with",
  texts: ["web", "Nextjs", "tailwindCSS", "Motion"],
  font: {
    fontSize: "48px",
    letterSpacing: "-0.04em",
    lineHeight: "1.1em",
    variant: "Bold",
    textAlign: "left",
  },
  color: "#FFFFFF",
  prefixColor: "#FFFFFF",
  wipeColor: DEFAULT_WIPE_COLOR,
  revealColor: DEFAULT_REVEAL_COLOR,
  blobSize: 12,
  blobPosition: 0,
  blur: 20,
  transition: DEFAULT_TRANSITION,
};

addPropertyControls(TextRevealBlur, {
  prefix: {
    type: ControlType.String,
    title: "Prefix",
    placeholder: "Built with",
  },

  texts: {
    type: ControlType.Array,
    title: "Texts",
    control: {
      type: ControlType.String,
    },
    defaultValue: ["web", "Nextjs", "tailwindCSS", "Motion"],
  },

  font: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",
    defaultFontType: "sans-serif",
    displayFontSize: true,
    displayTextAlignment: true,
    defaultValue: {
      fontSize: "48px",
      letterSpacing: "-0.04em",
      lineHeight: "1.1em",
      variant: "Bold",
      textAlign: "left",
    },
  },

  prefixColor: {
    type: ControlType.Color,
    title: "Prefix Color",
  },

  color: {
    type: ControlType.Color,
    title: "Text Color",
  },

  wipeColor: {
    type: ControlType.Color,
    title: "Wipe Color",
  },

  revealColor: {
    type: ControlType.Color,
    title: "Reveal Color",
  },

  blobSize: {
    type: ControlType.Number,
    title: "Blob Size",
    min: 4,
    max: 20,
    step: 1,
    unit: "px",
  },

  blobPosition: {
    type: ControlType.Number,
    title: "Blob Position",
    min: -12,
    max: 24,
    step: 1,
    unit: "px",
    defaultValue: 0,
    // Fine-tune appears once the blob is large enough to need it
    hidden: (props: Props) => (props.blobSize ?? 12) <= 8,
  },

  blur: {
    type: ControlType.Number,
    title: "Blur",
    min: 15,
    max: 50,
    step: 1,
    unit: "px",
  },

  transition: {
    type: ControlType.Transition,
    title: "Transition",
    defaultValue: DEFAULT_TRANSITION,
  },
});
