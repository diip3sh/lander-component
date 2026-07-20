import * as React from "react"
import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { addPropertyControls, ControlType } from "framer"

type FontStyle = React.CSSProperties

type TransitionValue = {
    type?: string
    duration?: number
    delay?: number
    ease?: string | number[]
    staggerChildren?: number
}

type StaggerFrom = "start" | "center" | "end" | "random"

type Props = {
    text: string
    font: FontStyle
    color: string

    amplitude: number
    staggerFrom: StaggerFrom

    transition: TransitionValue
}

const mapEase = (ease: TransitionValue["ease"]): string => {
    if (typeof ease !== "string") return "sine.inOut"

    const easeMap: Record<string, string> = {
        linear: "none",
        easeIn: "sine.in",
        easeOut: "sine.out",
        easeInOut: "sine.inOut",
        circIn: "circ.in",
        circOut: "circ.out",
        circInOut: "circ.inOut",
        backIn: "back.in",
        backOut: "back.out(1.7)",
        backInOut: "back.inOut",
        anticipate: "back.out(1.7)",
    }

    return easeMap[ease] ?? ease
}

export default function WavyBaseline({
    text,
    font,
    color,

    amplitude,
    staggerFrom,

    transition,
}: Props) {
    const containerRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const chars = containerRef.current.querySelectorAll(".char")

        gsap.killTweensOf(chars)

        gsap.set(chars, {
            clearProps: "transform",
        })

        gsap.to(chars, {
            y: -amplitude,

            duration: transition.duration ?? 0.4,
            delay: transition.delay ?? 0,
            stagger: {
                each: transition.staggerChildren ?? 0.06,
                from: staggerFrom,
                repeat: -1,
                yoyo: true,
            },
            ease: mapEase(transition.ease),
        })
    }, [text, amplitude, staggerFrom, transition])

    return (
        <h1
            ref={containerRef}
            style={{
                margin: 0,
                display: "inline-block",
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
    )
}

WavyBaseline.defaultProps = {
    text: "Wavy Baseline",

    font: {
        fontSize: "80px",
        letterSpacing: "0em",
        lineHeight: "1.1em",
        variant: "Medium",
    },
    color: "#111111",

    amplitude: 20,
    staggerFrom: "start",

    transition: {
        type: "tween",
        duration: 0.4,
        delay: 0,
        ease: "easeInOut",
        staggerChildren: 0.06,
    },
}

addPropertyControls(WavyBaseline, {
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

    amplitude: {
        type: ControlType.Number,
        title: "Amplitude",
        min: 0,
        max: 100,
        step: 1,
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
            duration: 0.4,
            delay: 0,
            ease: "easeInOut",
            staggerChildren: 0.06,
        },
    },
})
