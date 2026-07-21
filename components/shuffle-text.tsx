import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, type AnimationPlaybackControls } from "framer-motion";
import { addPropertyControls, ControlType } from "framer";

type FontStyle = React.CSSProperties & {
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  letterSpacing?: number | string;
  lineHeight?: number | string;
};

type ShuffleDirection = "left" | "right" | "up" | "down";
type AnimationMode = "evenodd" | "random";

type Props = {
  text?: string;
  font?: FontStyle;
  color?: string;
  shuffleDirection?: ShuffleDirection;
  animationMode?: AnimationMode;
  duration?: number;
  stagger?: number;
  copies?: number;
  style?: React.CSSProperties;
};

type StripHandle = {
  wrap: HTMLSpanElement;
  strip: HTMLSpanElement;
  glyphs: HTMLSpanElement[];
  index: number;
  step: number;
};

const DEFAULT_FONT: FontStyle = {
  fontSize: "80px",
  letterSpacing: "0.08em",
  lineHeight: "1em",
  textAlign: "center",
};

const CHAR_COPIES = 3;

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const isSpace = (char: string): boolean =>
  char === " " || char === "\n" || char === "\t";

const isHorizontal = (dir: ShuffleDirection): boolean =>
  dir === "left" || dir === "right";

type ShuffleCharProps = {
  char: string;
  index: number;
  color: string;
  copies: number;
  horizontal: boolean;
  registerStrip: (index: number, handle: StripHandle | null) => void;
};

const ShuffleChar = ({
  char,
  index,
  color,
  copies,
  horizontal,
  registerStrip,
}: ShuffleCharProps) => {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const stripRef = useRef<HTMLSpanElement>(null);
  const glyphRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const glyphs = useMemo(
    () => Array.from({ length: copies }, () => char),
    [char, copies],
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const strip = stripRef.current;
    if (!wrap || !strip) return;

    const glyphNodes = glyphRefs.current.filter(
      (n): n is HTMLSpanElement => n != null,
    );
    const last = glyphNodes[glyphNodes.length - 1];
    if (!last) return;

    const step = horizontal ? last.offsetWidth : last.offsetHeight;

    glyphNodes.forEach((g) => {
      if (horizontal) {
        g.style.width = `${step}px`;
      } else {
        g.style.height = `${step}px`;
      }
    });

    wrap.style.width = `${last.offsetWidth}px`;
    wrap.style.height = `${last.offsetHeight}px`;

    registerStrip(index, {
      wrap,
      strip,
      glyphs: glyphNodes,
      index,
      step,
    });

    return () => registerStrip(index, null);
  }, [glyphs, horizontal, index, registerStrip]);

  return (
    <span
      ref={wrapRef}
      aria-hidden="true"
      style={{
        display: "inline-block",
        overflow: "hidden",
        verticalAlign: "baseline",
        position: "relative",
      }}
    >
      <span
        ref={stripRef}
        style={{
          display: "inline-flex",
          flexDirection: horizontal ? "row" : "column",
          willChange: "transform",
        }}
      >
        {glyphs.map((g, gi) => (
          <span
            key={`${g}-${gi}`}
            ref={(node) => {
              glyphRefs.current[gi] = node;
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              color,
              flexShrink: 0,
            }}
          >
            {g}
          </span>
        ))}
      </span>
    </span>
  );
};

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 520
 * @framerIntrinsicHeight 160
 */
export default function ShuffleText(props: Props) {
  const {
    text = "SHADCN",
    font = DEFAULT_FONT,
    color = "#FFFFFF",
    shuffleDirection = "right",
    animationMode = "evenodd",
    duration = 0.45,
    stagger = 0.04,
    copies = CHAR_COPIES,
    style,
  } = props;

  const chars = useMemo(() => Array.from(text ?? ""), [text]);
  const stripsRef = useRef<StripHandle[]>([]);
  const animControlsRef = useRef<AnimationPlaybackControls[]>([]);
  const playingRef = useRef(false);
  const [layoutTick, setLayoutTick] = useState(0);

  const horizontal = isHorizontal(shuffleDirection);
  const stripCopies = Math.max(2, Math.round(copies));

  const stopAnims = useCallback(() => {
    animControlsRef.current.forEach((c) => c.stop());
    animControlsRef.current = [];
  }, []);

  const registerStrip = useCallback(
    (index: number, handle: StripHandle | null) => {
      if (!handle) {
        stripsRef.current = stripsRef.current.filter((s) => s.index !== index);
        return;
      }
      const existing = stripsRef.current.findIndex((s) => s.index === index);
      if (existing >= 0) stripsRef.current[existing] = handle;
      else stripsRef.current.push(handle);
      stripsRef.current.sort((a, b) => a.index - b.index);
    },
    [],
  );

  const settleStrips = useCallback(() => {
    stripsRef.current.forEach(({ strip, glyphs, step }) => {
      const end = -(glyphs.length - 1) * step;
      if (horizontal) {
        animate(strip, { x: end, y: 0 }, { duration: 0 });
      } else {
        animate(strip, { x: 0, y: end }, { duration: 0 });
      }
      glyphs.forEach((g) => {
        g.style.color = color;
      });
    });
  }, [color, horizontal]);

  const play = useCallback(async () => {
    if (playingRef.current) return;

    const strips = [...stripsRef.current];
    if (strips.length === 0) return;

    if (prefersReducedMotion()) {
      settleStrips();
      return;
    }

    playingRef.current = true;
    stopAnims();

    strips.forEach(({ strip, glyphs }) => {
      const reset = animate(strip, { x: 0, y: 0 }, { duration: 0 });
      animControlsRef.current.push(reset);
      glyphs.forEach((g) => {
        g.style.color = color;
      });
    });

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const runGroup = (group: StripHandle[], startDelay: number) => {
      group.forEach((handle, i) => {
        const { strip, glyphs, step } = handle;
        const end = -(glyphs.length - 1) * step;
        const delay = startDelay + i * stagger;

        const motion = horizontal
          ? animate(
              strip,
              { x: end },
              {
                duration,
                delay,
                ease: [0.22, 1, 0.36, 1],
              },
            )
          : animate(
              strip,
              { y: end },
              {
                duration,
                delay,
                ease: [0.22, 1, 0.36, 1],
              },
            );

        animControlsRef.current.push(motion);
      });
    };

    if (animationMode === "evenodd") {
      const even = strips.filter((s) => s.index % 2 === 0);
      const odd = strips.filter((s) => s.index % 2 === 1);
      const evenTotal = duration + Math.max(0, even.length - 1) * stagger;
      const oddStart = even.length > 0 ? evenTotal * 0.7 : 0;
      runGroup(even, 0);
      runGroup(odd, oddStart);

      const totalWait =
        Math.max(
          evenTotal,
          oddStart + duration + Math.max(0, odd.length - 1) * stagger,
        ) *
          1000 +
        40;

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, totalWait);
      });
    } else {
      const shuffled = [...strips].sort(() => Math.random() - 0.5);
      runGroup(shuffled, 0);
      const totalWait =
        (duration + Math.max(0, shuffled.length - 1) * stagger) * 1000 + 40;
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, totalWait);
      });
    }

    playingRef.current = false;
  }, [
    animationMode,
    color,
    duration,
    horizontal,
    settleStrips,
    stagger,
    stopAnims,
  ]);

  const handlePointerEnter = useCallback(() => {
    void play();
  }, [play]);

  useEffect(() => {
    setLayoutTick((t) => t + 1);
  }, [text, stripCopies, shuffleDirection, font]);

  // Rest at settled position — only animate on hover
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      settleStrips();
    });
    return () => {
      cancelAnimationFrame(id);
      stopAnims();
      playingRef.current = false;
    };
  }, [layoutTick, settleStrips, stopAnims]);

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
        ...style,
      }}
    >
      <p
        aria-label={text}
        onPointerEnter={handlePointerEnter}
        style={{
          ...font,
          margin: 0,
          color,
          textAlign,
          whiteSpace: "pre",
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {chars.map((char, index) => {
          if (isSpace(char)) {
            return (
              <span key={`space-${index}`} style={{ whiteSpace: "pre" }}>
                {"\u00A0"}
              </span>
            );
          }

          return (
            <ShuffleChar
              key={`${layoutTick}-${char}-${index}`}
              char={char}
              index={index}
              color={color}
              copies={stripCopies}
              horizontal={horizontal}
              registerStrip={registerStrip}
            />
          );
        })}
      </p>
    </div>
  );
}

ShuffleText.defaultProps = {
  text: "SHADCN",
  font: {
    fontSize: "80px",
    letterSpacing: "0.08em",
    lineHeight: "1em",
    variant: "Black",
    textAlign: "center",
  },
  color: "#FFFFFF",
  shuffleDirection: "right",
  animationMode: "evenodd",
  duration: 0.45,
  stagger: 0.04,
  copies: 3,
};

addPropertyControls(ShuffleText, {
  text: {
    type: ControlType.String,
    title: "Text",
    displayTextArea: true,
    placeholder: "SHADCN",
  },

  font: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",
    defaultFontType: "sans-serif",
    displayFontSize: true,
    displayTextAlignment: true,
    defaultValue: {
      fontSize: "80px",
      letterSpacing: "0.08em",
      lineHeight: "1em",
      variant: "Black",
      textAlign: "center",
    },
  },

  color: {
    type: ControlType.Color,
    title: "Color",
  },

  shuffleDirection: {
    type: ControlType.Enum,
    title: "Direction",
    options: ["right", "left", "up", "down"],
    optionTitles: ["Right", "Left", "Up", "Down"],
    displaySegmentedControl: true,
  },

  animationMode: {
    type: ControlType.Enum,
    title: "Mode",
    options: ["evenodd", "random"],
    optionTitles: ["Even / Odd", "Random"],
    displaySegmentedControl: true,
  },

  duration: {
    type: ControlType.Number,
    title: "Duration",
    min: 0.1,
    max: 2,
    step: 0.01,
    unit: "s",
  },

  stagger: {
    type: ControlType.Number,
    title: "Stagger",
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: "s",
  },

  copies: {
    type: ControlType.Number,
    title: "Copies",
    min: 2,
    max: 8,
    step: 1,
    displayStepper: true,
  },
});
