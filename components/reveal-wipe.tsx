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

type WipeDirection = "left" | "right" | "top" | "bottom";

type Props = {
  text: string;
  font: FontStyle;
  color: string;

  direction: WipeDirection;

  transition: TransitionValue;
};

const wipeClipPath: Record<WipeDirection, string> = {
  left: "inset(0 100% 0 0)",
  right: "inset(0 0 0 100%)",
  top: "inset(100% 0 0 0)",
  bottom: "inset(0 0 100% 0)",
};

const mapEase = (ease: TransitionValue["ease"]): string => {
  if (typeof ease !== "string") return "power3.inOut";

  const easeMap: Record<string, string> = {
    linear: "none",
    easeIn: "power3.in",
    easeOut: "power3.out",
    easeInOut: "power3.inOut",
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

export default function RevealWipe({
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
      clipPath: wipeClipPath[direction],
      duration: transition.duration ?? 1.2,
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

RevealWipe.defaultProps = {
  text: "Reveal Wipe",

  font: {
    fontSize: "80px",
    letterSpacing: "0em",
    lineHeight: "1.1em",
    variant: "Medium",
  },
  color: "#111111",

  direction: "left",

  transition: {
    type: "tween",
    duration: 1.2,
    delay: 0,
    ease: "easeInOut",
  },
};

addPropertyControls(RevealWipe, {
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
    options: ["left", "right", "top", "bottom"],
    optionTitles: ["Left", "Right", "Top", "Bottom"],
  },

  transition: {
    type: ControlType.Transition,
    title: "Transition",
    defaultValue: {
      type: "tween",
      duration: 1.2,
      delay: 0,
      ease: "easeInOut",
    },
  },
});
