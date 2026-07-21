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

    blur: number
    staggerFrom: StaggerFrom

    transition: TransitionValue
}

const START_SCALE = 1.45

const mapEase = (ease: TransitionValue["ease"]): string => {
    if (typeof ease !== "string") return "power2.out"

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
    }

    return easeMap[ease] ?? ease
}

export default function SpotlightReveal({
    text,
    font,
    color,

    blur,
    staggerFrom,

    transition,
}: Props) {
    const containerRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const chars = containerRef.current.querySelectorAll(".char")

        gsap.killTweensOf(chars)

        gsap.set(chars, {
            clearProps: "transform,opacity,filter",
        })

        gsap.from(chars, {
            opacity: 0,
            scale: START_SCALE,
            filter: `blur(${blur}px)`,

            duration: transition.duration ?? 0.4,
            delay: transition.delay ?? 0,
            stagger: {
                each: transition.staggerChildren ?? 0.06,
                from: staggerFrom,
            },
            ease: mapEase(transition.ease),
        })
    }, [text, blur, staggerFrom, transition])

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

SpotlightReveal.defaultProps = {
    text: "Spotlight Reveal",

    font: {
        fontSize: "80px",
        letterSpacing: "0em",
        lineHeight: "1.1em",
        variant: "Medium",
    },
    color: "#111111",

    blur: 20,
    staggerFrom: "center",

    transition: {
        type: "tween",
        duration: 0.4,
        delay: 0,
        ease: "easeOut",
        staggerChildren: 0.06,
    },
}

addPropertyControls(SpotlightReveal, {
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

    blur: {
        type: ControlType.Number,
        title: "Blur",
        min: 15,
        max: 50,
        step: 1,
        unit: "px",
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
            ease: "easeOut",
            staggerChildren: 0.06,
        },
    },
})
