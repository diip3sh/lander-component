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

type Props = {
    text: string
    font: FontStyle
    color: string

    amplitudeRatio: number

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

const getFontSize = (font: FontStyle, element: HTMLElement): number => {
    const fromProp = font.fontSize
    if (typeof fromProp === "number") return fromProp
    if (typeof fromProp === "string") {
        const parsed = Number.parseFloat(fromProp)
        if (!Number.isNaN(parsed)) return parsed
    }
    return Number.parseFloat(getComputedStyle(element).fontSize) || 80
}

export default function WavyText({
    text,
    font,
    color,

    amplitudeRatio,

    transition,
}: Props) {
    const containerRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        const heading = containerRef.current
        if (!heading) return

        const chars = heading.querySelectorAll<HTMLElement>(".char")
        if (chars.length === 0) return

        gsap.killTweensOf(chars)

        gsap.set(chars, {
            clearProps: "transform",
        })

        const fontSize = getFontSize(font, chars[0])
        const amplitude = fontSize * amplitudeRatio
        const staggerEach = transition.staggerChildren ?? 0.15
        const duration = transition.duration ?? 2
        const delay = transition.delay ?? 0

        chars.forEach((char, index) => {
            gsap.fromTo(
                char,
                { y: -amplitude },
                {
                    y: amplitude,
                    duration,
                    delay: delay + index * staggerEach - chars.length * staggerEach,
                    ease: mapEase(transition.ease),
                    repeat: -1,
                    yoyo: true,
                },
            )
        })
    }, [text, font, amplitudeRatio, transition])

    return (
        <h1
            ref={containerRef}
            aria-label={text}
            style={{
                margin: 0,
                display: "block",
                width: "100%",
                whiteSpace: "pre-wrap",
                color,
                ...font,
            }}
        >
            {text.split("").map((char, index) => (
                <span
                    key={index}
                    className="char"
                    aria-hidden="true"
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

WavyText.defaultProps = {
    text: "waaaavy",

    font: {
        fontSize: "136px",
        letterSpacing: "-0.025em",
        lineHeight: "1.1em",
        variant: "Medium",
    },
    color: "#ffffff",

    amplitudeRatio: 0.35,

    transition: {
        type: "tween",
        duration: 2,
        delay: 0,
        ease: "easeInOut",
        staggerChildren: 0.15,
    },
}

addPropertyControls(WavyText, {
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
            fontSize: "136px",
            letterSpacing: "-0.025em",
            lineHeight: "1.1em",
            variant: "Medium",
            textAlign: "left",
        },
    },

    color: {
        type: ControlType.Color,
        title: "Color",
    },

    amplitudeRatio: {
        type: ControlType.Number,
        title: "Amplitude",
        min: 0.05,
        max: 1,
        step: 0.05,
        displayStepper: true,
    },

    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: {
            type: "tween",
            duration: 2,
            delay: 0,
            ease: "easeInOut",
            staggerChildren: 0.15,
        },
    },
})
