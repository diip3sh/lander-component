import * as React from "react"
import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { addPropertyControls, ControlType } from "framer"

gsap.registerPlugin(ScrollTrigger)

type FontStyle = React.CSSProperties

type SplitBy = "characters" | "words"

type ScrollPosition =
    | "top top"
    | "top center"
    | "top bottom"
    | "center top"
    | "center center"
    | "center bottom"
    | "bottom top"
    | "bottom center"
    | "bottom bottom"

type Props = {
    text: string
    font: FontStyle

    dimColor: string
    highlightColor: string

    splitBy: SplitBy
    scrollStart: ScrollPosition
    scrollEnd: ScrollPosition
    scrub: boolean
}

const SCROLL_POSITIONS: ScrollPosition[] = [
    "top top",
    "top center",
    "top bottom",
    "center top",
    "center center",
    "center bottom",
    "bottom top",
    "bottom center",
    "bottom bottom",
]

const SCROLL_POSITION_TITLES = [
    "Top → Top",
    "Top → Center",
    "Top → Bottom",
    "Center → Top",
    "Center → Center",
    "Center → Bottom",
    "Bottom → Top",
    "Bottom → Center",
    "Bottom → Bottom",
]

const CHAR_STAGGER = 0.03
const WORD_STAGGER = 0.1

export default function ScrollHighlight({
    text,
    font,

    dimColor,
    highlightColor,

    splitBy,
    scrollStart,
    scrollEnd,
    scrub,
}: Props) {
    const containerRef = useRef<HTMLParagraphElement>(null)
    const words = text.trim().split(/\s+/).filter(Boolean)
    const chars = Array.from(text)
    const stagger = splitBy === "characters" ? CHAR_STAGGER : WORD_STAGGER

    useEffect(() => {
        const paragraph = containerRef.current
        if (!paragraph) return

        const targets = paragraph.querySelectorAll(
            splitBy === "characters" ? ".char" : ".word",
        )

        const ctx = gsap.context(() => {
            gsap.set(targets, {
                color: dimColor,
            })

            gsap.to(targets, {
                color: highlightColor,
                stagger,
                scrollTrigger: {
                    trigger: paragraph,
                    start: scrollStart,
                    end: scrollEnd,
                    scrub,
                },
            })
        }, paragraph)

        return () => ctx.revert()
    }, [
        text,
        dimColor,
        highlightColor,
        splitBy,
        stagger,
        scrollStart,
        scrollEnd,
        scrub,
    ])

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
                {splitBy === "characters"
                    ? chars.map((char, index) => (
                          <span
                              key={`${char}-${index}`}
                              className="char"
                              style={{
                                  display: "inline-block",
                                  color: dimColor,
                              }}
                          >
                              {char === " " ? "\u00A0" : char}
                          </span>
                      ))
                    : words.map((word, index) => (
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
    )
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

    splitBy: "words",
    scrollStart: "top center",
    scrollEnd: "bottom center",
    scrub: true,
}

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

    splitBy: {
        type: ControlType.Enum,
        title: "Split By",
        options: ["characters", "words"],
        optionTitles: ["Char", "Word"],
        displaySegmentedControl: true,
    },

    scrollStart: {
        type: ControlType.Enum,
        title: "Start",
        options: SCROLL_POSITIONS,
        optionTitles: SCROLL_POSITION_TITLES,
    },

    scrollEnd: {
        type: ControlType.Enum,
        title: "End",
        options: SCROLL_POSITIONS,
        optionTitles: SCROLL_POSITION_TITLES,
    },

    scrub: {
        type: ControlType.Boolean,
        title: "Scrub",
        enabledTitle: "On",
        disabledTitle: "Off",
    },
})
