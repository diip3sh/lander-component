import * as React from "react"
import { memo, useCallback, useEffect, useMemo, useRef } from "react"
import { useAnimate } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type FontStyle = React.CSSProperties & {
    fontFamily?: string
    fontWeight?: number | string
    fontSize?: number | string
    letterSpacing?: number | string
    lineHeight?: number | string
}

type StaggerFrom = "first" | "last" | "center" | "random"
type RotateDirection = "top" | "right" | "bottom" | "left"

type TransitionValue = {
    type?: string
    duration?: number
    delay?: number
    ease?: string | number[]
    damping?: number
    stiffness?: number
    mass?: number
    bounce?: number
}

type Props = {
    text: string
    font: FontStyle
    color: string
    flipColor: string
    staggerDuration: number
    staggerFrom: StaggerFrom
    rotateDirection: RotateDirection
    transition: TransitionValue
}

type WordPart = {
    characters: string[]
    needsSpace: boolean
}

const HAS_SEGMENTER = typeof Intl !== "undefined" && "Segmenter" in Intl

const splitIntoCharacters = (text: string): string[] => {
    if (HAS_SEGMENTER) {
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
        return Array.from(segmenter.segment(text), ({ segment }) => segment)
    }
    return Array.from(text)
}

const ROTATION_MAP = {
    top: "rotateX(90deg)",
    right: "rotateY(90deg)",
    bottom: "rotateX(-90deg)",
    left: "rotateY(-90deg)",
} as const

const SECOND_FACE_TRANSFORMS = {
    top: "rotateX(-90deg) translateZ(0.5em)",
    right:
        "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(-50%) rotateY(-90deg) translateX(50%)",
    bottom: "rotateX(90deg) translateZ(0.5em)",
    left: "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(50%) rotateY(-90deg) translateX(50%)",
} as const

const FRONT_FACE_TRANSFORMS = {
    top: "translateZ(0.5em)",
    bottom: "translateZ(0.5em)",
    left: "rotateY(90deg) translateX(50%) rotateY(-90deg)",
    right: "rotateY(-90deg) translateX(50%) rotateY(90deg)",
} as const

const CONTAINER_TRANSFORMS = {
    top: "translateZ(-0.5em)",
    bottom: "translateZ(-0.5em)",
    left: "rotateY(90deg) translateX(50%) rotateY(-90deg)",
    right: "rotateY(90deg) translateX(50%) rotateY(-90deg)",
} as const

const mapTransition = (transition: TransitionValue) => {
    const type = transition.type === "spring" ? "spring" : "tween"

    if (type === "spring") {
        return {
            type: "spring" as const,
            damping: transition.damping ?? 30,
            stiffness: transition.stiffness ?? 300,
            mass: transition.mass,
            bounce: transition.bounce,
            delay: transition.delay ?? 0,
        }
    }

    return {
        type: "tween" as const,
        duration: transition.duration ?? 0.45,
        delay: transition.delay ?? 0,
        ease: (typeof transition.ease === "string"
            ? transition.ease
            : "easeOut") as "easeOut" | "linear" | "easeIn" | "easeInOut",
    }
}

type CharBoxProps = {
    char: string
    color: string
    flipColor: string
    rotateDirection: RotateDirection
}

const CharBox = memo(
    ({ char, color, flipColor, rotateDirection }: CharBoxProps) => (
        <span
            className="text-3d-flip-char"
            style={{
                display: "inline-block",
                transformStyle: "preserve-3d",
                transform: CONTAINER_TRANSFORMS[rotateDirection],
                WebkitTransform: CONTAINER_TRANSFORMS[rotateDirection],
            }}
        >
            <span
                style={{
                    position: "relative",
                    display: "block",
                    height: "1em",
                    lineHeight: 1,
                    color,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: FRONT_FACE_TRANSFORMS[rotateDirection],
                    WebkitTransform: FRONT_FACE_TRANSFORMS[rotateDirection],
                }}
            >
                {char === " " ? "\u00A0" : char}
            </span>
            <span
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    height: "1em",
                    lineHeight: 1,
                    color: flipColor,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: SECOND_FACE_TRANSFORMS[rotateDirection],
                    WebkitTransform: SECOND_FACE_TRANSFORMS[rotateDirection],
                }}
            >
                {char === " " ? "\u00A0" : char}
            </span>
        </span>
    ),
)

CharBox.displayName = "CharBox"

export default function Text3DFlip({
    text,
    font,
    color,
    flipColor,
    staggerDuration = 0.05,
    staggerFrom = "first",
    rotateDirection = "right",
    transition,
}: Props) {
    const content = text || "Hover me"
    const isAnimatingRef = useRef(false)
    const isMountedRef = useRef(false)
    const [scope, animate] = useAnimate()

    const rotationTransform = ROTATION_MAP[rotateDirection]

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            isAnimatingRef.current = false
        }
    }, [])

    const characters = useMemo((): WordPart[] => {
        const words = content.split(" ")
        return words.map((word, i) => ({
            characters: splitIntoCharacters(word),
            needsSpace: i !== words.length - 1,
        }))
    }, [content])

    const charOffsets = useMemo(() => {
        const offsets = [0]
        for (const word of characters) {
            offsets.push(offsets[offsets.length - 1]! + word.characters.length)
        }
        return offsets
    }, [characters])

    const getStaggerDelay = useCallback(
        (index: number, totalChars: number) => {
            if (staggerFrom === "first") return index * staggerDuration
            if (staggerFrom === "last") {
                return (totalChars - 1 - index) * staggerDuration
            }
            if (staggerFrom === "center") {
                const center = Math.floor(totalChars / 2)
                return Math.abs(center - index) * staggerDuration
            }
            const randomIndex = Math.floor(Math.random() * totalChars)
            return Math.abs(randomIndex - index) * staggerDuration
        },
        [staggerFrom, staggerDuration],
    )

    const handlePointerEnter = useCallback(async () => {
        if (isAnimatingRef.current) return
        isAnimatingRef.current = true

        try {
            const totalChars = characters.reduce(
                (sum, word) => sum + word.characters.length,
                0,
            )

            const delays = Array.from({ length: totalChars }, (_, i) =>
                getStaggerDelay(i, totalChars),
            )

            const mapped = mapTransition(transition)

            await animate(
                ".text-3d-flip-char",
                { transform: rotationTransform },
                {
                    ...mapped,
                    delay: (i: number) => delays[i] ?? 0,
                },
            )

            if (!isMountedRef.current) return

            await animate(
                ".text-3d-flip-char",
                { transform: "rotateX(0deg) rotateY(0deg)" },
                { duration: 0 },
            )
        } finally {
            if (isMountedRef.current) {
                isAnimatingRef.current = false
            }
        }
    }, [
        characters,
        transition,
        getStaggerDelay,
        rotationTransform,
        animate,
    ])

    const textAlign =
        (font.textAlign as React.CSSProperties["textAlign"]) ?? "left"
    const justifyContent =
        textAlign === "center"
            ? "center"
            : textAlign === "right" || textAlign === "end"
              ? "flex-end"
              : "flex-start"

    return (
        <p
            ref={scope}
            onPointerEnter={handlePointerEnter}
            style={{
                ...font,
                margin: 0,
                width: "100%",
                display: "flex",
                flexWrap: "wrap",
                justifyContent,
                perspective: 800,
                perspectiveOrigin: "center center",
                cursor: "pointer",
                userSelect: "none",
                touchAction: "manipulation",
                color,
            }}
        >
            <span
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    borderWidth: 0,
                }}
            >
                {content}
            </span>

            {characters.map((wordObj, wordIndex) => (
                <span
                    key={wordIndex}
                    aria-hidden="true"
                    style={{ display: "inline-flex" }}
                >
                    {wordObj.characters.map((char, charIndex) => (
                        <CharBox
                            key={charOffsets[wordIndex]! + charIndex}
                            char={char}
                            color={color}
                            flipColor={flipColor}
                            rotateDirection={rotateDirection}
                        />
                    ))}
                    {wordObj.needsSpace ? (
                        <span style={{ whiteSpace: "pre" }}> </span>
                    ) : null}
                </span>
            ))}
        </p>
    )
}

Text3DFlip.defaultProps = {
    text: "Hover me",
    font: {
        fontSize: "64px",
        letterSpacing: "-0.02em",
        lineHeight: "1em",
        variant: "Bold",
        textAlign: "left",
    },
    color: "#FFFFFF",
    flipColor: "#A78BFA",
    staggerDuration: 0.05,
    staggerFrom: "first",
    rotateDirection: "right",
    transition: {
        type: "spring",
        damping: 30,
        stiffness: 300,
        delay: 0,
    },
}

addPropertyControls(Text3DFlip, {
    text: {
        type: ControlType.String,
        title: "Text",
        placeholder: "Hover me",
    },

    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        displayFontSize: true,
        displayTextAlignment: true,
        defaultValue: {
            fontSize: "64px",
            letterSpacing: "-0.02em",
            lineHeight: "1em",
            variant: "Bold",
            textAlign: "left",
        },
    },

    color: {
        type: ControlType.Color,
        title: "Color",
    },

    flipColor: {
        type: ControlType.Color,
        title: "Flip Color",
    },

    rotateDirection: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["top", "right", "bottom", "left"],
        optionTitles: ["Top", "Right", "Bottom", "Left"],
        displaySegmentedControl: true,
    },

    staggerFrom: {
        type: ControlType.Enum,
        title: "Stagger From",
        options: ["first", "last", "center", "random"],
        optionTitles: ["First", "Last", "Center", "Random"],
    },

    staggerDuration: {
        type: ControlType.Number,
        title: "Stagger",
        min: 0,
        max: 0.5,
        step: 0.01,
        unit: "s",
    },

    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: {
            type: "spring",
            damping: 30,
            stiffness: 300,
            delay: 0,
        },
    },
})
