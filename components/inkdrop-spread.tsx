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

    staggerFrom: StaggerFrom

    transition: TransitionValue
}

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

export default function InkdropSpread({
    text,
    font,
    color,

    staggerFrom,

    transition,
}: Props) {
    const containerRef = useRef<HTMLParagraphElement>(null)
    const words = text.trim().split(/\s+/).filter(Boolean)

    useEffect(() => {
        if (!containerRef.current) return

        const wordEls = containerRef.current.querySelectorAll(".word")

        gsap.killTweensOf(wordEls)

        gsap.set(wordEls, {
            clearProps: "transform,opacity,filter",
        })

        gsap.from(wordEls, {
            opacity: 0,
            scale: 0,
            filter: "blur(4px)",

            duration: transition.duration ?? 0.5,
            delay: transition.delay ?? 0,
            stagger: {
                each: transition.staggerChildren ?? 0.03,
                from: staggerFrom,
            },
            ease: mapEase(transition.ease),
        })
    }, [text, staggerFrom, transition])

    return (
        <p
            ref={containerRef}
            style={{
                margin: 0,
                display: "inline-block",
                whiteSpace: "pre-wrap",
                color,
                ...font,
            }}
        >
            {words.map((word, index) => (
                <React.Fragment key={`${word}-${index}`}>
                    <span
                        className="word"
                        style={{
                            display: "inline-block",
                        }}
                    >
                        {word}
                    </span>
                    {index < words.length - 1 ? " " : null}
                </React.Fragment>
            ))}
        </p>
    )
}

InkdropSpread.defaultProps = {
    text: "Text bleeds outward from the center, spreading like ink on paper. Each word radiates from the middle.",

    font: {
        fontSize: "19px",
        letterSpacing: "0em",
        lineHeight: "1.9em",
        variant: "Regular",
    },
    color: "#FFFFFF",

    staggerFrom: "center",

    transition: {
        type: "tween",
        duration: 0.5,
        delay: 0,
        ease: "easeOut",
        staggerChildren: 0.03,
    },
}

addPropertyControls(InkdropSpread, {
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
            fontSize: "19px",
            letterSpacing: "0em",
            lineHeight: "1.9em",
            variant: "Regular",
            textAlign: "left",
        },
    },

    color: {
        type: ControlType.Color,
        title: "Color",
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
            duration: 0.5,
            delay: 0,
            ease: "easeOut",
            staggerChildren: 0.03,
        },
    },
})
