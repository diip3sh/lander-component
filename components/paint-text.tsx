import * as React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { animate } from "framer-motion";
import { addPropertyControls, ControlType } from "framer";

type FontStyle = React.CSSProperties & {
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  letterSpacing?: number | string;
  lineHeight?: number | string;
};

type Props = {
  text?: string;
  hint?: string;
  showHint?: boolean;
  font?: FontStyle;
  paintColor?: string;
  ghostColor?: string;
  hintColor?: string;
  brushRadius?: number;
  paintDuration?: number;
  /** Max stagger delay (seconds) from brush center to edge — closest paints first */
  stagger?: number;
  autoReset?: boolean;
  autoResetDelay?: number;
  style?: React.CSSProperties;
};

type CharCenter = { x: number; y: number; paintable: boolean };

const DEFAULT_FONT: FontStyle = {
  fontSize: "72px",
  letterSpacing: "-0.04em",
  lineHeight: "1.05em",
  textAlign: "center",
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const isSpace = (char: string): boolean =>
  char === " " || char === "\n" || char === "\t";

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 520
 * @framerIntrinsicHeight 160
 */
export default function PaintText(props: Props) {
  const {
    text = "paint me",
    hint = "drag your cursor to reveal the words",
    showHint = true,
    font = DEFAULT_FONT,
    paintColor = "#FFFFFF",
    ghostColor = "#525252",
    hintColor = "#737373",
    brushRadius = 56,
    paintDuration = 0.28,
    stagger = 0.14,
    autoReset = true,
    autoResetDelay = 2.8,
    style,
  } = props;

  const chars = useMemo(() => Array.from(text ?? ""), [text]);
  const autoResetMs = autoReset ? Math.max(0, autoResetDelay) * 1000 : 0;
  const staggerMs = Math.max(0, stagger) * 1000;

  const wrapperRef = useRef<HTMLParagraphElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const centersRef = useRef<CharCenter[]>([]);
  const paintedRef = useRef<Set<number>>(new Set());
  const pendingRef = useRef<Set<number>>(new Set());
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef(false);

  const applyGhostStyle = useCallback(
    (node: HTMLSpanElement) => {
      node.style.color = ghostColor;
      node.style.opacity = "1";
      node.style.webkitTextStroke = "0px transparent";
      node.style.filter = "none";
      node.style.transition = "none";
    },
    [ghostColor],
  );

  const applyPaintStyle = useCallback(
    (node: HTMLSpanElement, instant = false) => {
      const duration = instant || reducedMotionRef.current ? 0 : paintDuration;

      node.style.webkitTextStroke = "0px transparent";
      node.style.opacity = "1";

      if (duration <= 0) {
        node.style.color = paintColor;
        return;
      }

      animate(
        node,
        {
          color: [ghostColor, paintColor],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        {
          duration,
          ease: [0.215, 0.61, 0.355, 1],
        },
      );
    },
    [ghostColor, paintColor, paintDuration],
  );

  const clearStaggerTimers = useCallback(() => {
    staggerTimersRef.current.forEach((timer) => clearTimeout(timer));
    staggerTimersRef.current = [];
    pendingRef.current.clear();
  }, []);

  const measureCenters = useCallback(() => {
    centersRef.current = charRefs.current.map((node, index) => {
      if (!node || isSpace(chars[index]!)) {
        return { x: 0, y: 0, paintable: false };
      }

      const rect = node.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        paintable: true,
      };
    });
  }, [chars]);

  const resetPaint = useCallback(() => {
    clearStaggerTimers();
    paintedRef.current.clear();
    charRefs.current.forEach((node, index) => {
      if (!node || isSpace(chars[index]!)) return;
      applyGhostStyle(node);
    });
  }, [applyGhostStyle, chars, clearStaggerTimers]);

  const scheduleReset = useCallback(() => {
    if (autoResetMs <= 0) return;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetPaint();
    }, autoResetMs);
  }, [autoResetMs, resetPaint]);

  const paintNearPointer = useCallback(() => {
    rafRef.current = null;
    const pointer = pointerRef.current;
    if (!pointer) return;

    const radius = Math.max(brushRadius, 1);
    const radiusSq = radius * radius;

    type Candidate = { index: number; distance: number };
    const candidates: Candidate[] = [];

    centersRef.current.forEach((center, index) => {
      if (!center.paintable) return;
      if (paintedRef.current.has(index)) return;
      if (pendingRef.current.has(index)) return;

      const dx = center.x - pointer.x;
      const dy = center.y - pointer.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) return;

      candidates.push({ index, distance: Math.sqrt(distSq) });
    });

    if (candidates.length === 0) return;

    candidates.sort((a, b) => a.distance - b.distance);

    const useStagger = !reducedMotionRef.current && staggerMs > 0;

    candidates.forEach(({ index, distance }) => {
      const node = charRefs.current[index];
      if (!node) return;

      pendingRef.current.add(index);

      const delay = useStagger ? (distance / radius) * staggerMs : 0;

      const paint = () => {
        pendingRef.current.delete(index);
        if (paintedRef.current.has(index)) return;
        paintedRef.current.add(index);
        applyPaintStyle(node, false);
      };

      if (delay <= 0) {
        paint();
        return;
      }

      const timer = setTimeout(paint, delay);
      staggerTimersRef.current.push(timer);
    });

    scheduleReset();
  }, [applyPaintStyle, brushRadius, scheduleReset, staggerMs]);

  const queuePaint = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(paintNearPointer);
  }, [paintNearPointer]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      queuePaint();
    },
    [queuePaint],
  );

  const handlePointerEnter = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      measureCenters();
      pointerRef.current = { x: event.clientX, y: event.clientY };
      queuePaint();
    },
    [measureCenters, queuePaint],
  );

  const handlePointerLeave = useCallback(() => {
    pointerRef.current = null;
  }, []);

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();
  }, []);

  useEffect(() => {
    measureCenters();
    resetPaint();

    const onResize = () => measureCenters();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      clearStaggerTimers();
    };
  }, [
    measureCenters,
    resetPaint,
    clearStaggerTimers,
    text,
    font,
    brushRadius,
    ghostColor,
    paintColor,
  ]);

  const textAlign =
    (font.textAlign as React.CSSProperties["textAlign"]) ?? "center";
  const alignItems =
    textAlign === "left" || textAlign === "start"
      ? "flex-start"
      : textAlign === "right" || textAlign === "end"
        ? "flex-end"
        : "center";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems,
        justifyContent: "center",
        width: "100%",
        height: "100%",
        gap: "1.25rem",
        ...style,
      }}
    >
      <p
        ref={wrapperRef}
        aria-label={text}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerEnter}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        style={{
          ...font,
          margin: 0,
          textAlign,
          whiteSpace: "pre-wrap",
          cursor: "crosshair",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {chars.map((char, index) => {
          if (isSpace(char)) {
            return (
              <span key={`space-${index}`} style={{ whiteSpace: "pre" }}>
                {char === " " ? "\u00A0" : char}
              </span>
            );
          }

          return (
            <span
              key={`${char}-${index}`}
              ref={(node) => {
                charRefs.current[index] = node;
              }}
              aria-hidden="true"
              style={{
                display: "inline-block",
                color: ghostColor,
                opacity: 1,
                willChange: "color",
              }}
            >
              {char}
            </span>
          );
        })}
      </p>

      {showHint && hint ? (
        <span
          aria-hidden="true"
          style={{
            fontFamily: font.fontFamily,
            fontSize: "0.875rem",
            fontWeight: 500,
            letterSpacing: "0.01em",
            color: hintColor,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

PaintText.defaultProps = {
  text: "paint me",
  hint: "drag your cursor to reveal the words",
  showHint: true,
  font: {
    fontSize: "72px",
    letterSpacing: "-0.04em",
    lineHeight: "1.05em",
    variant: "Black",
    textAlign: "center",
  },
  paintColor: "#FFFFFF",
  ghostColor: "#525252",
  hintColor: "#737373",
  brushRadius: 56,
  paintDuration: 0.28,
  stagger: 0.14,
  autoReset: true,
  autoResetDelay: 2.8,
};

addPropertyControls(PaintText, {
  text: {
    type: ControlType.String,
    title: "Text",
    displayTextArea: true,
    placeholder: "paint me",
  },

  showHint: {
    type: ControlType.Boolean,
    title: "Hint",
    enabledTitle: "Show",
    disabledTitle: "Hide",
  },

  hint: {
    type: ControlType.String,
    title: "Hint Text",
    placeholder: "drag your cursor to reveal the words",
    hidden: (props: Props) => !props.showHint,
  },

  font: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",
    defaultFontType: "sans-serif",
    displayFontSize: true,
    displayTextAlignment: true,
    defaultValue: {
      fontSize: "72px",
      letterSpacing: "-0.04em",
      lineHeight: "1.05em",
      variant: "Black",
      textAlign: "center",
    },
  },

  ghostColor: {
    type: ControlType.Color,
    title: "Ghost",
  },

  paintColor: {
    type: ControlType.Color,
    title: "Paint",
  },

  hintColor: {
    type: ControlType.Color,
    title: "Hint Color",
    hidden: (props: Props) => !props.showHint,
  },

  brushRadius: {
    type: ControlType.Number,
    title: "Brush",
    min: 12,
    max: 200,
    step: 1,
    unit: "px",
  },

  paintDuration: {
    type: ControlType.Number,
    title: "Paint Time",
    min: 0.05,
    max: 1.5,
    step: 0.01,
    unit: "s",
  },

  stagger: {
    type: ControlType.Number,
    title: "Stagger",
    min: 0,
    max: 1,
    step: 0.01,
    unit: "s",
  },

  autoReset: {
    type: ControlType.Boolean,
    title: "Auto Reset",
    enabledTitle: "On",
    disabledTitle: "Off",
  },

  autoResetDelay: {
    type: ControlType.Number,
    title: "Reset After",
    min: 0.5,
    max: 10,
    step: 0.1,
    unit: "s",
    hidden: (props: Props) => !props.autoReset,
  },
});
