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

    scatterX: number
    scatterY: number
    startRotation: number
    startOpacity: number

    transition: TransitionValue
}

const mapEase = (ease: TransitionValue["ease"]): string => {
    if (typeof ease !== "string") return "power3.out"

    const easeMap: Record<string, string> = {
        linear: "none",
        easeIn: "power2.in",
        easeOut: "power3.out",
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

export default function MagneticPull({
    text,
    font,
    color,

    scatterX,
    scatterY,
    startRotation,
    startOpacity,

    transition,
}: Props) {
    const containerRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const chars = containerRef.current.querySelectorAll(".char")

        gsap.killTweensOf(chars)

        gsap.set(chars, {
            clearProps: "transform,opacity",
        })

        gsap.from(chars, {
            x: () => gsap.utils.random(-scatterX, scatterX),
            y: () => gsap.utils.random(-scatterY, scatterY),
            opacity: startOpacity,
            rotation: () => gsap.utils.random(-startRotation, startRotation),

            duration: transition.duration ?? 1,
            delay: transition.delay ?? 0,
            stagger: transition.staggerChildren ?? 0.02,
            ease: mapEase(transition.ease),
        })
    }, [
        text,
        scatterX,
        scatterY,
        startRotation,
        startOpacity,
        transition,
    ])

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

MagneticPull.defaultProps = {
    text: "Magnetic Pull",

    font: {
        fontSize: "80px",
        letterSpacing: "0em",
        lineHeight: "1.1em",
        variant: "Bold",
    },
    color: "#111111",

    scatterX: 200,
    scatterY: 200,
    startRotation: 90,
    startOpacity: 0,

    transition: {
        type: "tween",
        duration: 1,
        delay: 0,
        ease: "easeOut",
        staggerChildren: 0.02,
    },
}

addPropertyControls(MagneticPull, {
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
            variant: "Bold",
            textAlign: "left",
        },
    },

    color: {
        type: ControlType.Color,
        title: "Color",
    },

    scatterX: {
        type: ControlType.Number,
        title: "Scatter X",
        min: 0,
        max: 500,
        step: 10,
    },

    scatterY: {
        type: ControlType.Number,
        title: "Scatter Y",
        min: 0,
        max: 500,
        step: 10,
    },

    startRotation: {
        type: ControlType.Number,
        title: "Rotation",
        min: 0,
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

    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: {
            type: "tween",
            duration: 1,
            delay: 0,
            ease: "easeOut",
            staggerChildren: 0.02,
        },
    },
})
