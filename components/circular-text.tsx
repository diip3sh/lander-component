import * as React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
    motion,
    useAnimation,
    useMotionValue,
    type MotionValue,
    type Transition,
} from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type FontStyle = React.CSSProperties & {
    fontFamily?: string
    fontWeight?: number | string
    fontSize?: number | string
    letterSpacing?: number | string
}

type HoverEffect = "slowDown" | "speedUp" | "pause" | "scale"

type TransitionValue = {
    type?: string
    duration?: number
    delay?: number
    ease?: string | number[]
}

type Props = {
    words: string[]
    separator: string
    font: FontStyle
    color: string
    onHover: HoverEffect
    hoverScale: number
    transition: TransitionValue
}

const MAX_WORDS = 10
const DEFAULT_WORDS = ["CIRCULAR", "TEXT"]
const DEFAULT_SEPARATOR = "⁕"
const DEFAULT_TRANSITION: TransitionValue = {
    type: "tween",
    duration: 20,
    delay: 0,
    ease: "linear",
}

const buildCircularContent = (
    words: string[] | undefined,
    separator: string | undefined,
): string => {
    const glyph = (separator && separator.length > 0 ? separator : DEFAULT_SEPARATOR).trim() || DEFAULT_SEPARATOR
    const cleaned = (words ?? [])
        .map((word) => word.trim())
        .filter(Boolean)
        .slice(0, MAX_WORDS)

    const list = cleaned.length > 0 ? cleaned : DEFAULT_WORDS
    return `${list.join(` ${glyph} `)} ${glyph} `
}

type Size = { width: number; height: number }

const getRotationTransition = (
    duration: number,
    from: number,
    delay: number = 0,
    loop: boolean = true,
) => ({
    from,
    to: from + 360,
    ease: "linear" as const,
    duration,
    delay,
    type: "tween" as const,
    repeat: loop ? Infinity : 0,
})

const getTransition = (duration: number, from: number, delay: number = 0) => ({
    rotate: getRotationTransition(duration, from, delay),
    scale: {
        type: "spring" as const,
        damping: 20,
        stiffness: 300,
    },
})

const resolveSpinDuration = (transition: TransitionValue | undefined): number => {
    const duration = transition?.duration ?? DEFAULT_TRANSITION.duration ?? 20
    return Number.isFinite(duration) && duration > 0 ? duration : 0
}

const resolveSpinDelay = (transition: TransitionValue | undefined): number => {
    const delay = transition?.delay ?? 0
    return Number.isFinite(delay) && delay > 0 ? delay : 0
}

const prefersReducedMotion = (): boolean => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

const parseFontSizePx = (fontSize: FontStyle["fontSize"]): number => {
    if (typeof fontSize === "number") return fontSize
    if (typeof fontSize === "string" && fontSize.length > 0) {
        const parsed = Number.parseFloat(fontSize)
        if (Number.isFinite(parsed)) return parsed
    }
    return 24
}

const parseLetterSpacingPx = (
    letterSpacing: FontStyle["letterSpacing"],
    fontSizePx: number,
): number => {
    if (typeof letterSpacing === "number") return letterSpacing
    if (typeof letterSpacing !== "string" || letterSpacing.length === 0) return 0

    if (letterSpacing.endsWith("em")) {
        const em = Number.parseFloat(letterSpacing)
        return Number.isFinite(em) ? em * fontSizePx : 0
    }

    const parsed = Number.parseFloat(letterSpacing)
    return Number.isFinite(parsed) ? parsed : 0
}

const parseFontWeight = (fontWeight: FontStyle["fontWeight"]): string => {
    if (typeof fontWeight === "number") return String(fontWeight)
    if (typeof fontWeight === "string" && fontWeight.length > 0) return fontWeight
    return "900"
}

const parseFontFamily = (fontFamily: FontStyle["fontFamily"]): string => {
    if (typeof fontFamily === "string" && fontFamily.length > 0) {
        return fontFamily.split(",")[0]?.trim().replace(/['"]/g, "") || "sans-serif"
    }
    return "sans-serif"
}

const measureArcLength = (
    letters: string[],
    fontSizePx: number,
    fontWeight: string,
    fontFamily: string,
    letterSpacingPx: number,
): number => {
    if (letters.length === 0) return 0

    if (typeof document === "undefined") {
        return letters.length * fontSizePx * 0.6 + letters.length * letterSpacingPx
    }

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) {
        return letters.length * fontSizePx * 0.6 + letters.length * letterSpacingPx
    }

    context.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`

    let total = 0
    for (const letter of letters) {
        const glyph = letter === " " ? "\u00A0" : letter
        total += context.measureText(glyph).width
    }

    // Include spacing between every letter around the closed circle
    total += letterSpacingPx * letters.length
    return total
}

export default function CircularText({
    words = DEFAULT_WORDS,
    separator = DEFAULT_SEPARATOR,
    font,
    color,
    onHover = "speedUp",
    hoverScale = 0.8,
    transition = DEFAULT_TRANSITION,
}: Props) {
    const content = buildCircularContent(words, separator)
    const letters = Array.from(content)
    const frameRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState<Size>({ width: 0, height: 0 })

    const controls = useAnimation()
    const rotation: MotionValue<number> = useMotionValue(0)

    const spinDuration = resolveSpinDuration(transition)
    const spinDelay = resolveSpinDelay(transition)

    const fontSizePx = parseFontSizePx(font.fontSize)
    const letterSpacingPx = parseLetterSpacingPx(font.letterSpacing, fontSizePx)
    const fontWeight = parseFontWeight(font.fontWeight)
    const fontFamily = parseFontFamily(font.fontFamily)

    useLayoutEffect(() => {
        const node = frameRef.current
        if (!node) return

        const updateSize = (width: number, height: number) => {
            const nextWidth = Math.max(0, Math.floor(width))
            const nextHeight = Math.max(0, Math.floor(height))
            setSize((prev) => {
                if (prev.width === nextWidth && prev.height === nextHeight) {
                    return prev
                }
                return { width: nextWidth, height: nextHeight }
            })
        }

        updateSize(node.clientWidth, node.clientHeight)

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            updateSize(entry.contentRect.width, entry.contentRect.height)
        })

        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    const arcLength = measureArcLength(
        letters,
        fontSizePx,
        fontWeight,
        fontFamily,
        letterSpacingPx,
    )
    // Circumference ≈ arc length → radius grows/shrinks with letter spacing
    const contentRadius = arcLength > 0 ? arcLength / (2 * Math.PI) : 0
    const naturalRingSize = contentRadius * 2 + fontSizePx * 1.4

    const maxFrameSize = Math.max(0, Math.min(size.width, size.height))
    const ringSize =
        maxFrameSize > 0
            ? Math.min(naturalRingSize, maxFrameSize)
            : naturalRingSize
    const scale =
        naturalRingSize > 0 && maxFrameSize > 0 && naturalRingSize > maxFrameSize
            ? maxFrameSize / naturalRingSize
            : 1
    const radius = contentRadius * scale

    useEffect(() => {
        if (prefersReducedMotion() || spinDuration <= 0) {
            controls.stop()
            controls.set({ rotate: rotation.get(), scale: 1 })
            return
        }

        const start = rotation.get()
        controls.start({
            rotate: start + 360,
            scale: 1,
            transition: getTransition(spinDuration, start, spinDelay),
        })
    }, [spinDuration, spinDelay, content, onHover, controls, rotation])

    const handleHoverStart = () => {
        if (prefersReducedMotion() || !onHover || spinDuration <= 0) return

        const start = rotation.get()
        let transitionConfig: ReturnType<typeof getTransition> | Transition
        let scaleVal = 1

        switch (onHover) {
            case "slowDown":
                transitionConfig = getTransition(spinDuration * 2, start)
                break
            case "speedUp":
                transitionConfig = getTransition(spinDuration / 4, start)
                break
            case "pause":
                transitionConfig = {
                    rotate: { type: "spring", damping: 20, stiffness: 300 },
                    scale: { type: "spring", damping: 20, stiffness: 300 },
                }
                break
            case "scale":
                transitionConfig = getTransition(spinDuration / 20, start)
                scaleVal = Number.isFinite(hoverScale) ? hoverScale : 0.8
                break
            default:
                transitionConfig = getTransition(spinDuration, start)
        }

        controls.start({
            rotate: start + 360,
            scale: scaleVal,
            transition: transitionConfig,
        })
    }

    const handleHoverEnd = () => {
        if (prefersReducedMotion() || spinDuration <= 0) return

        const start = rotation.get()
        controls.start({
            rotate: start + 360,
            scale: 1,
            transition: getTransition(spinDuration, start),
        })
    }

    return (
        <div
            ref={frameRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
        >
            <motion.div
                style={{
                    ...font,
                    position: "relative",
                    width: ringSize || naturalRingSize || 200,
                    height: ringSize || naturalRingSize || 200,
                    flexShrink: 0,
                    borderRadius: "50%",
                    color,
                    textAlign: "center",
                    cursor: "pointer",
                    transformOrigin: "center center",
                    userSelect: "none",
                    touchAction: "manipulation",
                    willChange: "transform",
                    rotate: rotation,
                }}
                initial={{ rotate: 0 }}
                animate={controls}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
            >
                {letters.map((letter, i) => {
                    const angle =
                        letters.length > 0 ? (360 / letters.length) * i : 0
                    const rad = (angle * Math.PI) / 180
                    const x = radius * Math.cos(rad)
                    const y = radius * Math.sin(rad)
                    const transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${angle + 90}deg)`

                    return (
                        <span
                            key={`${letter}-${i}`}
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                display: "inline-block",
                                lineHeight: 1,
                                transform,
                                WebkitTransform: transform,
                            }}
                        >
                            {letter === " " ? "\u00A0" : letter}
                        </span>
                    )
                })}

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
            </motion.div>
        </div>
    )
}

CircularText.defaultProps = {
    words: DEFAULT_WORDS,
    separator: DEFAULT_SEPARATOR,
    font: {
        fontSize: "24px",
        letterSpacing: "0.02em",
        lineHeight: "1em",
        variant: "Black",
        textAlign: "center",
    },
    color: "#FFFFFF",
    onHover: "speedUp",
    hoverScale: 0.8,
    transition: DEFAULT_TRANSITION,
}

addPropertyControls(CircularText, {
    words: {
        type: ControlType.Array,
        title: "Words",
        maxCount: MAX_WORDS,
        control: {
            type: ControlType.String,
            placeholder: "Word",
        },
        defaultValue: DEFAULT_WORDS,
    },

    separator: {
        type: ControlType.String,
        title: "Separator",
        placeholder: DEFAULT_SEPARATOR,
        defaultValue: DEFAULT_SEPARATOR,
    },

    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        displayFontSize: true,
        displayTextAlignment: true,
        defaultValue: {
            fontSize: "24px",
            letterSpacing: "0.02em",
            lineHeight: "1em",
            variant: "Black",
            textAlign: "center",
        },
    },

    color: {
        type: ControlType.Color,
        title: "Color",
    },

    onHover: {
        type: ControlType.Enum,
        title: "On Hover",
        options: ["slowDown", "speedUp", "pause", "scale"],
        optionTitles: ["Slow Down", "Speed Up", "Pause", "Scale"],
    },

    hoverScale: {
        type: ControlType.Number,
        title: "Scale",
        min: 0,
        max: 2,
        step: 0.1,
        displayStepper: false,
        hidden: (props: Props) => props.onHover !== "scale",
    },

    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: DEFAULT_TRANSITION,
    },
})
