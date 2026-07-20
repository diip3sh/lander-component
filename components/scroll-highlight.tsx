import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { addPropertyControls, ControlType } from "framer";

gsap.registerPlugin(ScrollTrigger);

type FontStyle = React.CSSProperties;

type Props = {
  text: string;
  font: FontStyle;

  dimColor: string;
  highlightColor: string;

  stagger: number;
  scrollStart: string;
  scrollEnd: string;
  scrub: boolean;
};

export default function ScrollHighlight({
  text,
  font,

  dimColor,
  highlightColor,

  stagger,
  scrollStart,
  scrollEnd,
  scrub,
}: Props) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const words = text.trim().split(/\s+/).filter(Boolean);

  useEffect(() => {
    const paragraph = containerRef.current;
    if (!paragraph) return;

    const wordEls = paragraph.querySelectorAll(".word");

    const ctx = gsap.context(() => {
      gsap.set(wordEls, {
        color: dimColor,
      });

      gsap.to(wordEls, {
        color: highlightColor,
        stagger,
        scrollTrigger: {
          trigger: paragraph,
          start: scrollStart,
          end: scrollEnd,
          scrub,
        },
      });
    }, paragraph);

    return () => ctx.revert();
  }, [text, dimColor, highlightColor, stagger, scrollStart, scrollEnd, scrub]);

  return (
    <div className="py-[100dvh]">
      <p
        ref={containerRef}
        style={{
          margin: 0,
          display: "inline-block",
          whiteSpace: "pre-wrap",
          color: dimColor,
          ...font,
        }}
      >
        {words.map((word, index) => (
          <React.Fragment key={`${word}-${index}`}>
            <span
              className="word"
              style={{
                display: "inline-block",
                color: dimColor,
              }}
            >
              {word}
            </span>
            {index < words.length - 1 ? " " : null}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

ScrollHighlight.defaultProps = {
  text: "Every word in this paragraph will light up as you scroll through it.",

  font: {
    fontSize: "21px",
    letterSpacing: "0em",
    lineHeight: "2em",
    variant: "Regular",
  },

  dimColor: "rgba(255, 255, 255, 0.15)",
  highlightColor: "#FFFFFF",

  stagger: 0.1,
  scrollStart: "top center",
  scrollEnd: "bottom center",
  scrub: true,
};

addPropertyControls(ScrollHighlight, {
  text: {
    type: ControlType.String,
    title: "Text",
    displayTextArea: true,
  },

  font: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",
    defaultFontType: "sans-serif",
    displayFontSize: true,
    displayTextAlignment: true,
    defaultValue: {
      fontSize: "21px",
      letterSpacing: "0em",
      lineHeight: "2em",
      variant: "Regular",
      textAlign: "left",
    },
  },

  dimColor: {
    type: ControlType.Color,
    title: "Dim Color",
  },

  highlightColor: {
    type: ControlType.Color,
    title: "Highlight",
  },

  stagger: {
    type: ControlType.Number,
    title: "Stagger",
    min: 0,
    max: 1,
    step: 0.01,
  },

  scrollStart: {
    type: ControlType.String,
    title: "Start",
  },

  scrollEnd: {
    type: ControlType.String,
    title: "End",
  },

  scrub: {
    type: ControlType.Boolean,
    title: "Scrub",
    enabledTitle: "On",
    disabledTitle: "Off",
  },
});
