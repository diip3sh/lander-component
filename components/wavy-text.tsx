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
}

type Props = {
    text: string
    font: FontStyle
    color: string

    range: number
    stagger: number

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

export default function WavyText({
    text,
    font,
    color,

    range,
    stagger,

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

        const duration = transition.duration ?? 2
        const delay = transition.delay ?? 0
        const ease = mapEase(transition.ease)

        chars.forEach((char, index) => {
            gsap.fromTo(
                char,
                { y: -range },
                {
                    y: range,
                    duration,
                    delay: delay + index * stagger - chars.length * stagger,
                    ease,
                    repeat: -1,
                    yoyo: true,
                },
            )
        })
    }, [text, font, range, stagger, transition])

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
        textAlign: "left",
    },
    color: "#ffffff",

    range: 48,
    stagger: 0.15,

    transition: {
        type: "tween",
        duration: 2,
        delay: 0,
        ease: "easeInOut",
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

    range: {
        type: ControlType.Number,
        title: "Range",
        min: 0,
        max: 200,
        step: 1,
        unit: "px",
    },

    stagger: {
        type: ControlType.Number,
        title: "Stagger",
        min: 0.1,
        max: 0.5,
        step: 0.01,
        unit: "s",
    },

    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: {
            type: "tween",
            duration: 2,
            delay: 0,
            ease: "easeInOut",
        },
    },
})
