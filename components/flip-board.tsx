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
  staggerChildren?: number;
};

type StaggerFrom = "start" | "center" | "end" | "random";

type Props = {
  text: string;
  font: FontStyle;
  color: string;

  startRotationX: number;
  startOpacity: number;
  transformOrigin: string;
  staggerFrom: StaggerFrom;

  transition: TransitionValue;
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

export default function FlipBoard({
  text,
  font,
  color,

  startRotationX,
  startOpacity,
  transformOrigin,
  staggerFrom,

  transition,
}: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chars = containerRef.current.querySelectorAll(".char");

    gsap.killTweensOf(chars);

    gsap.set(chars, {
      clearProps: "transform,opacity",
      transformOrigin,
    });

    gsap.from(chars, {
      rotationX: startRotationX,
      opacity: startOpacity,
      transformOrigin,

      duration: transition.duration ?? 0.3,
      delay: transition.delay ?? 0,
      stagger: {
        each: transition.staggerChildren ?? 0.1,
        from: staggerFrom,
      },
      ease: mapEase(transition.ease),
    });
  }, [
    text,
    startRotationX,
    startOpacity,
    transformOrigin,
    staggerFrom,
    transition,
  ]);

  return (
    <h1
      ref={containerRef}
      style={{
        margin: 0,
        display: "block",
        whiteSpace: "pre-wrap",
        perspective: 800,
        color,
        ...font,
      }}
    >
      {text.split("").map((char, index) => (
        <span
          key={index}
          className="char"
          style={{
            display: "inline-block",
            transformOrigin,
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  );
}

FlipBoard.defaultProps = {
  text: "Flip Board",

  font: {
    fontSize: "80px",
    letterSpacing: "0em",
    lineHeight: "1.1em",
    variant: "Medium",
  },
  color: "#FFFFFF",

  startRotationX: -90,
  startOpacity: 0,
  transformOrigin: "50% 0%",
  staggerFrom: "start",

  transition: {
    type: "tween",
    duration: 0.3,
    delay: 0,
    ease: "easeOut",
    staggerChildren: 0.1,
  },
};

addPropertyControls(FlipBoard, {
  text: {
    type: ControlType.String,
    title: "Text",
  },

  font: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",
    defaultFontType: "monospace",
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

  startRotationX: {
    type: ControlType.Number,
    title: "Rotation X",
    min: -360,
    max: 360,
    step: 1,
  },

  startOpacity: {
    type: ControlType.Number,
    title: "Opacity",
    min: 0,
    max: 1,
    step: 0.05,
  },

  transformOrigin: {
    type: ControlType.Enum,
    title: "Origin",
    options: [
      "50% 0%",
      "50% 50%",
      "50% 100%",
      "0% 50%",
      "100% 50%",
      "0% 0%",
      "100% 0%",
      "0% 100%",
      "100% 100%",
    ],
    optionTitles: [
      "Top",
      "Center",
      "Bottom",
      "Left",
      "Right",
      "Top Left",
      "Top Right",
      "Bottom Left",
      "Bottom Right",
    ],
  },

  staggerFrom: {
    type: ControlType.Enum,
    title: "Stagger From",
    options: ["start", "center", "end", "random"],
    optionTitles: ["Start", "Center", "End", "Random"],
  },

  transition: {
    type: ControlType.Transition,
    title: "Transition",
    defaultValue: {
      type: "tween",
      duration: 0.3,
      delay: 0,
      ease: "easeOut",
      staggerChildren: 0.1,
    },
  },
});
