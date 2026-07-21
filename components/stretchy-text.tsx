"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    animate,
    motion,
    useSpring,
    type AnimationPlaybackControls,
    type MotionValue,
    type SpringOptions,
} from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type FontStyle = React.CSSProperties & {
    fontFamily?: string
    fontWeight?: number | string
    fontSize?: number | string
    letterSpacing?: number | string
    lineHeight?: number | string
}

type TransitionValue = {
    type?: string
    stiffness?: number
    damping?: number
    mass?: number
    duration?: number
    delay?: number
    ease?: string | number[]
    bounce?: number
}

type Props = {
    text?: string
    hint?: string
    showHint?: boolean
    font?: FontStyle
    color?: string
    hintColor?: string
    /** Geometric falloff per step (0–1). Higher = stronger neighbor pull. */
    falloff?: number
    /** Max index distance that still receives pull. */
    maxDistance?: number
    dragTransition?: TransitionValue
    releaseTransition?: TransitionValue
    style?: React.CSSProperties
}

type LetterMotion = {
    x: MotionValue<number>
    y: MotionValue<number>
}

const DEFAULT_FONT: FontStyle = {
    fontSize: "72px",
    letterSpacing: "-0.04em",
    lineHeight: "1em",
    textAlign: "center",
}

const DEFAULT_DRAG_TRANSITION: TransitionValue = {
    type: "spring",
    stiffness: 520,
    damping: 38,
    mass: 0.4,
}

const DEFAULT_RELEASE_TRANSITION: TransitionValue = {
    type: "spring",
    stiffness: 240,
    damping: 13,
    mass: 0.75,
}

const toSpringOptions = (
    transition: TransitionValue | undefined,
    fallback: TransitionValue,
): SpringOptions => {
    const t = transition ?? fallback
    return {
        stiffness: t.stiffness ?? fallback.stiffness ?? 300,
        damping: t.damping ?? fallback.damping ?? 20,
        mass: t.mass ?? fallback.mass ?? 0.5,
    }
}

const toReleaseTransition = (
    transition: TransitionValue | undefined,
): SpringOptions & { type: "spring" } => {
    const spring = toSpringOptions(transition, DEFAULT_RELEASE_TRANSITION)
    return {
        type: "spring",
        ...spring,
    }
}

const prefersReducedMotion = (): boolean => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

const isBreakpoint = (char: string): boolean =>
    char === " " || char === "\n" || char === "\t"

/** Distance along the glyph chain; null if a space/newline breaks the path. */
const getChainDistance = (
    from: number,
    to: number,
    chars: string[],
): number | null => {
    if (from === to) return 0
    if (isBreakpoint(chars[from]!) || isBreakpoint(chars[to]!)) return null

    const lo = Math.min(from, to)
    const hi = Math.max(from, to)

    for (let i = lo + 1; i < hi; i += 1) {
        if (isBreakpoint(chars[i]!)) return null
    }

    return hi - lo
}

type LetterProps = {
    char: string
    index: number
    color: string
    reducedMotion: boolean
    dragSpring: SpringOptions
    registerMotion: (index: number, pair: LetterMotion | null) => void
    onLetterPointerDown: (
        index: number,
        event: React.PointerEvent<HTMLSpanElement>,
    ) => void
}

const ElasticLetter = ({
    char,
    index,
    color,
    reducedMotion,
    dragSpring,
    registerMotion,
    onLetterPointerDown,
}: LetterProps) => {
    const x = useSpring(0, dragSpring)
    const y = useSpring(0, dragSpring)

    useEffect(() => {
        if (isBreakpoint(char)) {
            registerMotion(index, null)
            return
        }

        registerMotion(index, { x, y })
        return () => registerMotion(index, null)
    }, [char, index, registerMotion, x, y])

    if (isBreakpoint(char)) {
        return (
            <span aria-hidden="true" style={{ whiteSpace: "pre" }}>
                {char === " " ? "\u00A0" : char}
            </span>
        )
    }

    return (
        <motion.span
            aria-hidden="true"
            onPointerDown={(event) => onLetterPointerDown(index, event)}
            style={{
                x: reducedMotion ? 0 : x,
                y: reducedMotion ? 0 : y,
                display: "inline-block",
                color,
                cursor: reducedMotion ? "default" : "grab",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                willChange: "transform",
            }}
        >
            {char}
        </motion.span>
    )
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 520
 * @framerIntrinsicHeight 160
 */
export default function StretchyText(props: Props) {
    const {
        text = "STRETCHY",
        hint = "drag any letter",
        showHint = true,
        font = DEFAULT_FONT,
        color = "#FFFFFF",
        hintColor = "#A3A3A3",
        falloff = 0.58,
        maxDistance = 8,
        dragTransition = DEFAULT_DRAG_TRANSITION,
        releaseTransition = DEFAULT_RELEASE_TRANSITION,
        style,
    } = props

    const dragSpring = useMemo(
        () => toSpringOptions(dragTransition, DEFAULT_DRAG_TRANSITION),
        [dragTransition],
    )
    const releaseSpring = useMemo(
        () => toReleaseTransition(releaseTransition),
        [releaseTransition],
    )

    const chars = useMemo(() => Array.from(text || "STRETCHY"), [text])
    const motionsRef = useRef<(LetterMotion | null)[]>([])
    const animControlsRef = useRef<AnimationPlaybackControls[]>([])
    const activeIndexRef = useRef<number | null>(null)
    const originRef = useRef({ x: 0, y: 0 })
    const draggingRef = useRef(false)

    const [dragging, setDragging] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        setReducedMotion(prefersReducedMotion())
    }, [])

    const registerMotion = useCallback(
        (index: number, pair: LetterMotion | null) => {
            motionsRef.current[index] = pair
        },
        [],
    )

    const stopAnims = useCallback(() => {
        animControlsRef.current.forEach((control) => control.stop())
        animControlsRef.current = []
    }, [])

    const handlePointerMove = useCallback(
        (event: PointerEvent) => {
            if (!draggingRef.current || activeIndexRef.current == null) return

            const active = activeIndexRef.current
            const deltaX = event.clientX - originRef.current.x
            const deltaY = event.clientY - originRef.current.y

            chars.forEach((char, index) => {
                const pair = motionsRef.current[index]
                if (!pair || isBreakpoint(char)) return

                const distance = getChainDistance(active, index, chars)
                if (distance == null || distance > maxDistance) {
                    pair.x.set(0)
                    pair.y.set(0)
                    return
                }

                if (distance === 0) {
                    if (typeof pair.x.jump === "function") {
                        pair.x.jump(deltaX)
                        pair.y.jump(deltaY)
                    } else {
                        pair.x.set(deltaX)
                        pair.y.set(deltaY)
                    }
                    return
                }

                const strength = Math.pow(falloff, distance)
                pair.x.set(deltaX * strength)
                pair.y.set(deltaY * strength)
            })
        },
        [chars, falloff, maxDistance],
    )

    const handlePointerUp = useCallback(() => {
        if (!draggingRef.current) return

        draggingRef.current = false
        activeIndexRef.current = null
        setDragging(false)

        stopAnims()
        motionsRef.current.forEach((pair) => {
            if (!pair) return
            animControlsRef.current.push(
                animate(pair.x, 0, releaseSpring),
                animate(pair.y, 0, releaseSpring),
            )
        })

        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
        window.removeEventListener("pointercancel", handlePointerUp)
    }, [handlePointerMove, releaseSpring, stopAnims])

    const handleLetterPointerDown = useCallback(
        (index: number, event: React.PointerEvent<HTMLSpanElement>) => {
            if (reducedMotion) return
            if (event.button !== 0) return

            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)

            stopAnims()
            draggingRef.current = true
            activeIndexRef.current = index
            originRef.current = { x: event.clientX, y: event.clientY }
            setDragging(true)

            window.addEventListener("pointermove", handlePointerMove)
            window.addEventListener("pointerup", handlePointerUp)
            window.addEventListener("pointercancel", handlePointerUp)
        },
        [reducedMotion, stopAnims, handlePointerMove, handlePointerUp],
    )

    useEffect(() => {
        return () => {
            stopAnims()
            window.removeEventListener("pointermove", handlePointerMove)
            window.removeEventListener("pointerup", handlePointerUp)
            window.removeEventListener("pointercancel", handlePointerUp)
        }
    }, [handlePointerMove, handlePointerUp, stopAnims])

    const textAlign =
        (font.textAlign as React.CSSProperties["textAlign"]) ?? "center"
    const alignItems =
        textAlign === "left" || textAlign === "start"
            ? "flex-start"
            : textAlign === "right" || textAlign === "end"
              ? "flex-end"
              : "center"

    const springKey = `${dragSpring.stiffness}-${dragSpring.damping}-${dragSpring.mass}`

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems,
                justifyContent: "center",
                width: "100%",
                height: "100%",
                gap: "1.25rem",
                ...style,
            }}
        >
            <p
                aria-label={text}
                style={{
                    ...font,
                    margin: 0,
                    color,
                    textAlign,
                    whiteSpace: "pre-wrap",
                }}
            >
                {chars.map((char, index) => (
                    <ElasticLetter
                        key={`${char}-${index}-${springKey}`}
                        char={char}
                        index={index}
                        color={color}
                        reducedMotion={reducedMotion}
                        dragSpring={dragSpring}
                        registerMotion={registerMotion}
                        onLetterPointerDown={handleLetterPointerDown}
                    />
                ))}
            </p>

            {showHint && hint ? (
                <span
                    aria-hidden="true"
                    style={{
                        fontFamily: font.fontFamily,
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                        color: hintColor,
                        opacity: dragging ? 0 : 1,
                        transition: "opacity 200ms ease",
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                >
                    {hint}
                </span>
            ) : null}
        </div>
    )
}

StretchyText.defaultProps = {
    text: "STRETCHY",
    hint: "drag any letter",
    showHint: true,
    font: {
        fontSize: "72px",
        letterSpacing: "-0.04em",
        lineHeight: "1em",
        variant: "Black",
        textAlign: "center",
    },
    color: "#FFFFFF",
    hintColor: "#A3A3A3",
    falloff: 0.58,
    maxDistance: 8,
    dragTransition: DEFAULT_DRAG_TRANSITION,
    releaseTransition: DEFAULT_RELEASE_TRANSITION,
}

addPropertyControls(StretchyText, {
    text: {
        type: ControlType.String,
        title: "Text",
        placeholder: "STRETCHY",
    },

    showHint: {
        type: ControlType.Boolean,
        title: "Hint",
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },

    hint: {
        type: ControlType.String,
        title: "Hint Text",
        placeholder: "drag any letter",
        hidden: (props: Props) => !props.showHint,
    },

    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        displayFontSize: true,
        displayTextAlignment: true,
        defaultValue: {
            fontSize: "72px",
            letterSpacing: "-0.04em",
            lineHeight: "1em",
            variant: "Black",
            textAlign: "center",
        },
    },

    color: {
        type: ControlType.Color,
        title: "Color",
    },

    hintColor: {
        type: ControlType.Color,
        title: "Hint Color",
        hidden: (props: Props) => !props.showHint,
    },

    falloff: {
        type: ControlType.Number,
        title: "Falloff",
        min: 0.15,
        max: 0.95,
        step: 0.01,
        description: "How strongly neighbors follow the dragged letter",
    },

    maxDistance: {
        type: ControlType.Number,
        title: "Reach",
        min: 1,
        max: 20,
        step: 1,
        displayStepper: true,
        description: "How many letters away the pull still reaches",
    },

    dragTransition: {
        type: ControlType.Transition,
        title: "Drag Spring",
        defaultValue: DEFAULT_DRAG_TRANSITION,
    },

    releaseTransition: {
        type: ControlType.Transition,
        title: "Release Spring",
        defaultValue: DEFAULT_RELEASE_TRANSITION,
    },
})
