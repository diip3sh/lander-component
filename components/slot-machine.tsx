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
type StartFrom = "top" | "bottom";

type Props = {
  text: string;
  font: FontStyle;
  color: string;

  startFrom: StartFrom;
  staggerFrom: StaggerFrom;

  transition: TransitionValue;
};

const startYPercentMap: Record<StartFrom, number> = {
  top: -500,
  bottom: 500,
};

const mapEase = (ease: TransitionValue["ease"]): string => {
  if (typeof ease !== "string") return "power4.out";

  const easeMap: Record<string, string> = {
    linear: "none",
    easeIn: "power2.in",
    easeOut: "power4.out",
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

export default function SlotMachine({
  text,
  font,
  color,

  startFrom,
  staggerFrom,

  transition,
}: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chars = containerRef.current.querySelectorAll(".char");

    gsap.killTweensOf(chars);

    gsap.set(chars, {
      clearProps: "transform",
    });

    gsap.from(chars, {
      yPercent: startYPercentMap[startFrom],

      duration: transition.duration ?? 0.6,
      delay: transition.delay ?? 0,
      stagger: {
        each: transition.staggerChildren ?? 0.08,
        from: staggerFrom,
      },
      ease: mapEase(transition.ease),
    });
  }, [text, startFrom, staggerFrom, transition]);

  return (
    <h1
      ref={containerRef}
      style={{
        margin: 0,
        display: "-block",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
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
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  );
}

SlotMachine.defaultProps = {
  text: "Slot Machine",

  font: {
    fontSize: "80px",
    letterSpacing: "0em",
    lineHeight: "1.1em",
    variant: "Medium",
  },
  color: "#FFFFFF",

  startFrom: "top",
  staggerFrom: "start",

  transition: {
    type: "tween",
    duration: 0.6,
    delay: 0,
    ease: "easeOut",
    staggerChildren: 0.08,
  },
};

addPropertyControls(SlotMachine, {
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

  startFrom: {
    type: ControlType.Enum,
    title: "Start Y",
    options: ["top", "bottom"],
    optionTitles: ["Top", "Bottom"],
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
      duration: 0.6,
      delay: 0,
      ease: "easeOut",
      staggerChildren: 0.08,
    },
  },
});
