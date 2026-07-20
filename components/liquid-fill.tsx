import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { addPropertyControls, ControlType } from "framer";

type FontStyle = React.CSSProperties;

type TransitionValue = {
  type?: string;
  duration?: number;
  delay?: number;
  ease?: string | number[];
};

type FillDirection = "bottom" | "top" | "left" | "right";

type Props = {
  text: string;
  font: FontStyle;
  color: string;

  direction: FillDirection;

  transition: TransitionValue;
};

const fillClipPath: Record<FillDirection, string> = {
  bottom: "inset(100% 0 0 0)",
  top: "inset(0 0 100% 0)",
  left: "inset(0 100% 0 0)",
  right: "inset(0 0 0 100%)",
};

const mapEase = (ease: TransitionValue["ease"]): string => {
  if (typeof ease !== "string") return "power2.out";

  const easeMap: Record<string, string> = {
    linear: "none",
    easeIn: "power2.in",
    easeOut: "power2.out",
    easeInOut: "power2.inOut",
    circIn: "circ.in",
    circOut: "circ.out",
    circInOut: "circ.inOut",
    backIn: "back.in",
    backOut: "back.out(1.7)",
    backInOut: "back.inOut",
    anticipate: "back.out(1.7)",
  };

  return easeMap[ease] ?? ease;
};

export default function LiquidFill({
  text,
  font,
  color,

  direction,

  transition,
}: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const heading = containerRef.current;
    if (!heading) return;

    gsap.killTweensOf(heading);

    gsap.set(heading, {
      clearProps: "clipPath",
    });

    gsap.from(heading, {
      clipPath: fillClipPath[direction],
      duration: transition.duration ?? 1.5,
      delay: transition.delay ?? 0,
      ease: mapEase(transition.ease),
    });
  }, [text, direction, transition]);

  return (
    <h1
      ref={containerRef}
      style={{
        margin: 0,
        display: "block",
        whiteSpace: "pre-wrap",
        color,
        ...font,
        clipPath: "inset(0 0% 0 0)",
      }}
    >
      {text}
    </h1>
  );
}

LiquidFill.defaultProps = {
  text: "Liquid Fill",

  font: {
    fontSize: "80px",
    letterSpacing: "0em",
    lineHeight: "1.1em",
    variant: "Medium",
  },
  color: "#FFFFFF",

  direction: "bottom",

  transition: {
    type: "tween",
    duration: 1.5,
    delay: 0,
    ease: "easeOut",
  },
};

addPropertyControls(LiquidFill, {
  text: {
    type: ControlType.String,
    title: "Text",
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
      letterSpacing: "0em",
      lineHeight: "1.1em",
      variant: "Medium",
      textAlign: "left",
    },
  },

  color: {
    type: ControlType.Color,
    title: "Color",
  },

  direction: {
    type: ControlType.Enum,
    title: "Direction",
    options: ["bottom", "top", "left", "right"],
    optionTitles: ["Bottom", "Top", "Left", "Right"],
  },

  transition: {
    type: ControlType.Transition,
    title: "Transition",
    defaultValue: {
      type: "tween",
      duration: 1.5,
      delay: 0,
      ease: "easeOut",
    },
  },
});
