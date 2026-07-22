"use client"

import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react"
import { useAnimate, type AnimationOptions } from "framer-motion"
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
type TransitionValue = AnimationOptions

type Text3DFlipProps = {
    text?: string
    font?: FontStyle
    color?: string
    staggerDuration?: number
    staggerFrom?: StaggerFrom
    transition?: TransitionValue
    rotateDirection?: RotateDirection
    style?: React.CSSProperties
}

type WordPart = {
    characters: string[]
    needsSpace: boolean
}

type CharBoxProps = {
    char: string
    color: string
    flipColor: string
    rotateDirection: RotateDirection
}

const HAS_SEGMENTER = typeof Intl !== "undefined" && "Segmenter" in Intl

const splitIntoCharacters = (text: string): string[] => {
    if (HAS_SEGMENTER) {
        const segmenter = new Intl.Segmenter("en", {
            granularity: "grapheme",
        })
        return Array.from(segmenter.segment(text), ({ segment }) => segment)
    }

    return Array.from(text)
}

const SECOND_FACE_TRANSFORMS = {
    top: "rotateX(-90deg) translateZ(0.5lh)",
    right:
        "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(-50%) rotateY(-90deg) translateX(50%)",
    bottom: "rotateX(90deg) translateZ(0.5lh)",
    left: "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(50%) rotateY(-90deg) translateX(50%)",
} as const

const FRONT_FACE_TRANSFORMS = {
    top: "translateZ(0.5lh)",
    bottom: "translateZ(0.5lh)",
    left: "rotateY(90deg) translateX(50%) rotateY(-90deg)",
    right: "rotateY(-90deg) translateX(50%) rotateY(90deg)",
} as const

const CONTAINER_TRANSFORMS = {
    top: "translateZ(-0.5lh) rotateX(0deg)",
    bottom: "translateZ(-0.5lh) rotateX(0deg)",
    left: "rotateY(90deg) translateX(50%) rotateY(-90deg) rotateY(0deg)",
    right: "rotateY(90deg) translateX(50%) rotateY(-90deg) rotateY(0deg)",
} as const

const FLIPPED_TRANSFORMS = {
    top: "translateZ(-0.5lh) rotateX(90deg)",
    bottom: "translateZ(-0.5lh) rotateX(-90deg)",
    left: "rotateY(90deg) translateX(50%) rotateY(-90deg) rotateY(-90deg)",
    right: "rotateY(90deg) translateX(50%) rotateY(-90deg) rotateY(90deg)",
} as const

const DEFAULT_FONT: FontStyle = {
    fontSize: "64px",
    letterSpacing: "-0.02em",
    lineHeight: "1em",
    textAlign: "left",
}

const DEFAULT_TRANSITION: TransitionValue = {
    type: "spring",
    damping: 30,
    stiffness: 300,
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
                    height: "1lh",
                    color,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: FRONT_FACE_TRANSFORMS[rotateDirection],
                    WebkitTransform: FRONT_FACE_TRANSFORMS[rotateDirection],
                }}
            >
                {char}
            </span>
            <span
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    height: "1lh",
                    color: flipColor,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: SECOND_FACE_TRANSFORMS[rotateDirection],
                    WebkitTransform: SECOND_FACE_TRANSFORMS[rotateDirection],
                }}
            >
                {char}
            </span>
        </span>
    ),
)

CharBox.displayName = "CharBox"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 520
 * @framerIntrinsicHeight 160
 */
export default function Text3DFlip(props: Text3DFlipProps) {
    const {
        text = "Hover me",
        font = DEFAULT_FONT,
        color = "#FFFFFF",
        staggerDuration = 0.05,
        staggerFrom = "first",
        transition = DEFAULT_TRANSITION,
        rotateDirection = "top",
        style,
    } = props
    const content = text || "Hover me"
    const isAnimatingRef = useRef(false)
    const isMountedRef = useRef(false)
    const [scope, animate] = useAnimate()

    const restingTransform = CONTAINER_TRANSFORMS[rotateDirection]
    const flippedTransform = FLIPPED_TRANSFORMS[rotateDirection]

    useEffect(() => {
        isMountedRef.current = true

        return () => {
            isMountedRef.current = false
            isAnimatingRef.current = false
        }
    }, [])

    const characters = useMemo((): WordPart[] => {
        const words = content.split(" ")
        return words.map((word, index) => ({
            characters: splitIntoCharacters(word),
            needsSpace: index !== words.length - 1,
        }))
    }, [content])

    const charOffsets = useMemo(() => {
        const offsets = [0]

        for (const word of characters) {
            offsets.push(offsets.at(-1)! + word.characters.length)
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
        [staggerDuration, staggerFrom],
    )

    const handleHoverStart = useCallback(async () => {
        if (isAnimatingRef.current) return
        isAnimatingRef.current = true

        try {
            const totalChars = characters.reduce(
                (sum, word) => sum + word.characters.length,
                0,
            )
            const delays = Array.from({ length: totalChars }, (_, index) =>
                getStaggerDelay(index, totalChars),
            )

            await animate(
                ".text-3d-flip-char",
                { transform: flippedTransform },
                {
                    ...transition,
                    delay: (index: number) => delays[index] ?? 0,
                },
            )

            if (!isMountedRef.current) return

            await animate(
                ".text-3d-flip-char",
                { transform: restingTransform },
                { duration: 0, delay: 0 },
            )
        } finally {
            if (isMountedRef.current) {
                isAnimatingRef.current = false
            }
        }
    }, [
        animate,
        characters,
        flippedTransform,
        getStaggerDelay,
        restingTransform,
        transition,
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
        <div
            onPointerEnter={handleHoverStart}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...style,
            }}
        >
            <p
                ref={scope}
                aria-label={content}
                style={{
                    ...font,
                    position: "relative",
                    margin: 0,
                    width: "100%",
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent,
                    perspective: 800,
                    perspectiveOrigin: "center center",
                    cursor: "pointer",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    color,
                }}
            >
                {characters.map((wordObject, wordIndex) => (
                    <span
                        key={wordIndex}
                        aria-hidden="true"
                        style={{
                            display: "inline-flex",
                            transformStyle: "preserve-3d",
                        }}
                    >
                        {wordObject.characters.map((char, charIndex) => (
                            <CharBox
                                key={charOffsets[wordIndex]! + charIndex}
                                char={char}
                                color={color}
                                flipColor={color}
                                rotateDirection={rotateDirection}
                            />
                        ))}
                        {wordObject.needsSpace ? (
                            <span style={{ whiteSpace: "pre" }}> </span>
                        ) : null}
                    </span>
                ))}
            </p>
        </div>
    )
}

Text3DFlip.displayName = "Text3DFlip"

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
    staggerDuration: 0.05,
    staggerFrom: "first",
    rotateDirection: "top",
    transition: {
        type: "spring",
        damping: 30,
        stiffness: 300,
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
    rotateDirection: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["top", "bottom"],
        optionTitles: ["Top", "Bottom"],
        displaySegmentedControl: false,
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
        defaultValue: 0.05,
    },
    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: {
            type: "spring",
            damping: 30,
            stiffness: 300,
        },
    },
})
