"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { animate, motion, useMotionValue } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

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
  prefix?: string
  texts?: string[]
  font?: FontStyle
  color?: string
  prefixColor?: string
  blobColor?: string
  blobSize?: number
  holdDuration?: number
  wipeDuration?: number
  blur?: number
  transition?: TransitionValue
  style?: React.CSSProperties
}

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
  duration: 0.4,
  delay: 0,
  ease: "easeOut",
  staggerChildren: 0.06,
};

export default function TextRevealBlur({
  prefix = "Built with",
  texts = DEFAULT_TEXTS,
  font = DEFAULT_FONT,
  color = "#FFFFFF",
  prefixColor = "#FFFFFF",
  blobColor = "#EF4444",
  blobSize = 12,
  holdDuration = 1.2,
  wipeDuration = 0.55,
  blur = 20,
  transition = DEFAULT_TRANSITION,
  style,
}: Props) {
  const safeTexts = useMemo(() => {
    const list = (texts ?? DEFAULT_TEXTS).filter((t) => t.length > 0);
    return list.length > 0 ? list : DEFAULT_TEXTS;
  }, [texts]);

  const [wordIndex, setWordIndex] = useState(0);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const charsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const wordIndexRef = useRef(0);

  const blobX = useMotionValue(0);
  const blobScaleX = useMotionValue(1);
  const blobScaleY = useMotionValue(1);
  const [blobOrigin, setBlobOrigin] = useState("50% 50%");
  const [blobRadius, setBlobRadius] = useState("50%");

  const currentWord = safeTexts[wordIndex] ?? safeTexts[0] ?? "";
  const characters = useMemo(
    () => splitIntoCharacters(currentWord),
    [currentWord],
  );

  const duration = transition.duration ?? 0.4;
  const staggerEach = transition.staggerChildren ?? 0.06;
  const transitionDelay = transition.delay ?? 0;

  const getCharNodes = useCallback(() => {
    return charsRef.current.filter(
      (node): node is HTMLSpanElement => node != null,
    );
  }, []);

  const measureLayout = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return null

    const nodes = getCharNodes()
    if (nodes.length === 0) return null

    const wrapperRect = wrapper.getBoundingClientRect()
    // Framer canvas zoom scales getBoundingClientRect; CSS transforms use layout px
    const scaleX =
      wrapperRect.width > 0 ? wrapper.offsetWidth / wrapperRect.width : 1

    const toLocalX = (clientLeft: number, clientWidth = 0) =>
      (clientLeft - wrapperRect.left + clientWidth) * scaleX

    const centers = nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return toLocalX(rect.left, rect.width / 2)
    })

    const lastRect = nodes[nodes.length - 1]!.getBoundingClientRect()
    const firstRect = nodes[0]!.getBoundingClientRect()

    // Rest just after the last glyph (gap ≈ half blob)
    const homeX = toLocalX(lastRect.right) + blobSize * 0.35
    // Start just before the first glyph
    const leftX = Math.max(0, toLocalX(firstRect.left) - blobSize * 0.65)

    return { centers, homeX, leftX, nodes }
  }, [blobSize, getCharNodes])

  const measureLayoutRef = useRef(measureLayout);
  measureLayoutRef.current = measureLayout;

  const waitForLayout = useCallback(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      const layout = measureLayoutRef.current();
      if (layout) return layout;
    }
    return null;
  }, []);

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
    if (prefersReducedMotion() || safeTexts.length === 0) return;

    let cancelled = false;
    let activeAnim: { stop: () => void } | undefined;
    let charAnim: { stop: () => void } | undefined;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        holdTimer = setTimeout(resolve, ms);
      });

    const setBlobDeform = (direction: "left" | "right" | "rest") => {
      const spring = {
        type: "spring" as const,
        stiffness: 420,
        damping: 18,
      };

      if (direction === "rest") {
        setBlobOrigin("50% 50%");
        setBlobRadius("50%");
        animate(blobScaleX, 1, spring);
        animate(blobScaleY, 1, spring);
        return;
      }

      // Lead: fully rounded + stretch. Trail: small radius (not square, not full pill).
      // CSS order: top-left, top-right, bottom-right, bottom-left
      if (direction === "left") {
        // Moving right → left: round lead (left), small radius trail (right)
        setBlobOrigin("100% 50%");
        setBlobRadius("50% 5px 5px 50%");
        animate(blobScaleX, 1.65, spring);
        animate(blobScaleY, 0.78, spring);
        return;
      }

      // Moving left → right: round lead (right), small radius trail (left)
      setBlobOrigin("0% 50%");
      setBlobRadius("5px 50% 50% 5px");
      animate(blobScaleX, 1.65, spring);
      animate(blobScaleY, 0.78, spring);
    };

    const hideCharsWithBlob = (
      nodes: HTMLSpanElement[],
      centers: number[],
      x: number,
    ) => {
      nodes.forEach((node, i) => {
        const center = centers[i];
        if (center === undefined) return;
        if (x <= center + blobSize * 0.25) {
          node.style.opacity = "0";
          node.style.filter = `blur(${blur}px)`;
          node.style.transform = `scale(${START_SCALE})`;
        }
      });
    };

    /** Blob travel matches stagger gaps; each char spotlights as the blob hits it */
    const revealWithBlob = (
      nodes: HTMLSpanElement[],
      centers: number[],
      homeX: number,
    ) =>
      new Promise<void>((resolve) => {
        setCharsHidden(nodes);
        setBlobDeform("right");

        const revealed = new Set<number>();
        const charCount = Math.max(nodes.length, 1);

        const blobDuration = Math.max(
          transitionDelay + (charCount - 1) * staggerEach,
          0.12,
        );

        activeAnim = animate(blobX, homeX, {
          duration: blobDuration,
          ease: "linear",
          onUpdate: (x) => {
            nodes.forEach((node, i) => {
              if (revealed.has(i)) return;
              const center = centers[i];
              if (center === undefined) return;

              if (x >= center - blobSize * 0.35) {
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
                    duration,
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
                { duration, ease: "easeOut" },
              );
            });

            setBlobDeform("rest");

            holdTimer = setTimeout(() => {
              setCharsVisible(nodes);
              resolve();
            }, duration * 1000);
          },
        });
      });

    const runLoop = async () => {
      let layout = await waitForLayout();
      if (!layout || cancelled) return;

      blobX.set(layout.homeX);
      setBlobDeform("rest");
      setCharsVisible(layout.nodes);

      while (!cancelled) {
        layout = await waitForLayout();
        if (!layout || cancelled) break;

        blobX.set(layout.homeX);
        setBlobDeform("rest");
        setCharsVisible(layout.nodes);

        await wait(holdDuration * 1000);
        if (cancelled) break;

        const wipeLayout = layout;

        // Moving right → left: stretch into the left (lead), squash height
        setBlobDeform("left");

        await new Promise<void>((resolve) => {
          activeAnim = animate(blobX, wipeLayout.leftX, {
            duration: wipeDuration,
            ease: [0.215, 0.61, 0.355, 1],
            onUpdate: (x) => {
              hideCharsWithBlob(wipeLayout.nodes, wipeLayout.centers, x);
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

        layout = await waitForLayout();
        if (!layout || cancelled) break;

        blobX.set(layout.leftX);
        setCharsHidden(layout.nodes);

        await revealWithBlob(layout.nodes, layout.centers, layout.homeX);

        if (cancelled) break;

        setCharsVisible(layout.nodes);
        blobX.set(layout.homeX);
      }
    };

    runLoop();

    return () => {
      cancelled = true;
      clearTimeout(holdTimer);
      activeAnim?.stop();
      charAnim?.stop();
      // Reset squash/stretch on unmount
      blobScaleX.set(1);
      blobScaleY.set(1);
    };
  }, [
    safeTexts,
    holdDuration,
    wipeDuration,
    blur,
    blobSize,
    blobX,
    blobScaleX,
    blobScaleY,
    waitForLayout,
    duration,
    staggerEach,
    transitionDelay,
  ]);

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
                charsRef.current[i] = node
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
            // Sit on the text baseline / x-height band, not below the line box
            top: "50%",
            left: 0,
            x: blobX,
            y: "-50%",
            scaleX: blobScaleX,
            scaleY: blobScaleY,
            transformOrigin: blobOrigin,
            width: blobSize,
            height: blobSize,
            marginTop: blobSize * 0.45,
            borderRadius: blobRadius,
            backgroundColor: blobColor,
            display: "block",
            pointerEvents: "none",
            willChange: "transform, border-radius",
            transition:
              "border-radius 180ms cubic-bezier(.215, .61, .355, 1)",
          }}
        />
      </span>
    </div>
  )
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
    blobColor: "#EF4444",
    blobSize: 12,
    holdDuration: 1.2,
    wipeDuration: 0.55,
    blur: 20,
    transition: {
        type: "tween",
        duration: 0.4,
        delay: 0,
        ease: "easeOut",
        staggerChildren: 0.06,
    },
}

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

    blobColor: {
        type: ControlType.Color,
        title: "Blob Color",
    },

    blobSize: {
        type: ControlType.Number,
        title: "Blob Size",
        min: 4,
        max: 48,
        step: 1,
        unit: "px",
    },

    holdDuration: {
        type: ControlType.Number,
        title: "Hold",
        min: 0.2,
        max: 5,
        step: 0.1,
        unit: "s",
    },

    wipeDuration: {
        type: ControlType.Number,
        title: "Wipe",
        min: 0.1,
        max: 2,
        step: 0.05,
        unit: "s",
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
        defaultValue: {
            type: "tween",
            duration: 0.4,
            delay: 0,
            ease: "easeOut",
            staggerChildren: 0.06,
        },
    },
})
