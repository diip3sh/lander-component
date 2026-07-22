"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
    duration?: number
    delay?: number
    ease?: string | number[]
    staggerChildren?: number
}

type Props = {
    prefix?: string
    texts?: string[]
    font?: FontStyle
    color?: string
    prefixColor?: string
    cursorColor?: string
    cursorBorderColor?: string
    cursorWidth?: number
    cursorHeight?: number
    deletingSpeed?: number
    soundEnabled?: boolean
    transition?: TransitionValue
    style?: React.CSSProperties
}

const DEFAULT_TEXTS = [
    "money machines.",
    "revenue engines.",
    "growth systems.",
    "scale machines.",
]

/** Embedded typewriter click — works on paste into Framer with no upload */
const EMBEDDED_SOUND =
    "data:audio/mpeg;base64,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kpyZ/iDhGo5Q8CexyCTIIK8YoF4yTLqKBe/4ZFIqUiBh6otAyghdATkKiZJoosXjI+TJih/8iQsknyQIE4hUhBGwhQaI4w1SVCfNklstSSSJSMnUk///GOJ40TPG6j6Czyc+c/CaZ0taoACAAAA1soNCDi9rMP84swMHTRgHLy/5ox0ZWOrMYl/gYnjykQ3Aw4A6wA3VIKTJQ4GZYGQIGkQbSTxeIaSniCoGAJGjfDLJkXiii3wvUHIh1BRiWFBrWxkkv8LKQ+ExEKBgEGwEXRxJZSMj5M/wbrESFOGAIOIEO4aIfsigXjJMuoqS/4WdHMNSGCTByAtobKT4ccIFrUkiUikViAkyh/8bQuU3IiZHwyKQgYmDGpQFnhbyNgc8+pbLYySWqiUjI///xNxBjRM8X1Hy4s8Zz6Df/mK4VieVieRMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//vSZAAP8AAAaQcAAAgAAA0g4AABAAABpAAAACAAADSAAAAETEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo="

/** Embedded backspace click — lower pitch than type sound */
const EMBEDDED_DELETE_SOUND =
    "data:audio/mpeg;base64,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nIkZOzTiRJKq9USJJUcSJEZmfWsShYEoGJHWVDLNgoJxhShgoND/2WyxWfKi7ioeCIWHBdnZ/0VhYOiIgcUf///oi92NWWBHivm15PFgyQ2RpVJlDdEWGkStUOcWNf/7skSgjOQEWrqBiTJSeMtXQDEmTEx1IJhhlfVJxiiRyGYbyX/6tXGcSySZxn/FZBJKYqhEg1VUqKIlt+iomzFMSzlHqCgUQgk+b/3f7/+0zRooWMHEWzfuVJISBkE87P3fKlrUkaaZaqmpprz92dmkqEvUGxNEIFRpHAtoo8hYb2y0yLpUIwklYrDyQiuWEbl6Zrbjf/u3/80c8XFokhJMJBiYYKBQImnPqTiyi6qv5XVMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7smQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ=="

const DEFAULT_FONT: FontStyle = {
    fontSize: "48px",
    letterSpacing: "-0.04em",
    lineHeight: "1.15em",
    textAlign: "left",
}

const DEFAULT_TRANSITION: TransitionValue = {
    type: "tween",
    duration: 0.055,
    delay: 1.8,
    ease: "linear",
}

const SOUND_VOLUME = 0.45

const prefersReducedMotion = (): boolean => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

type Phase = "typing" | "holding" | "deleting"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 120
 */
export default function TypewriterText(props: Props) {
    const {
        prefix = "We help you build apps that\nare ",
        texts = DEFAULT_TEXTS,
        font = DEFAULT_FONT,
        color = "#FFFFFF",
        prefixColor = "#FFFFFF",
        cursorColor = "#1A1A1A",
        cursorBorderColor = "#404040",
        cursorWidth = 12,
        cursorHeight = 40,
        deletingSpeed = 32,
        soundEnabled = true,
        transition = DEFAULT_TRANSITION,
        style,
    } = props

    // Transition duration → type speed (seconds per character); delay → hold
    const typingSpeed = Math.max(
        20,
        Math.round((transition.duration ?? DEFAULT_TRANSITION.duration ?? 0.055) * 1000),
    )
    const holdDuration = transition.delay ?? DEFAULT_TRANSITION.delay ?? 1.8

    const effectiveTypingSpeed = soundEnabled
        ? Math.max(typingSpeed, 130)
        : typingSpeed
    const effectiveDeletingSpeed = soundEnabled
        ? Math.max(deletingSpeed, 55)
        : deletingSpeed

    const safeTexts = useMemo(() => {
        const list = (texts ?? DEFAULT_TEXTS)
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        return list.length > 0 ? list : DEFAULT_TEXTS
    }, [texts])

    const [textIndex, setTextIndex] = useState(0)
    const [charIndex, setCharIndex] = useState(0)
    const [phase, setPhase] = useState<Phase>("typing")
    const [cursorOn, setCursorOn] = useState(true)

    const typeAudioRef = useRef<HTMLAudioElement | null>(null)
    const deleteAudioRef = useRef<HTMLAudioElement | null>(null)
    const audioUnlockedRef = useRef(false)
    const prevCharIndexRef = useRef(0)

    const currentText = safeTexts[textIndex] ?? safeTexts[0] ?? ""
    const displayed = currentText.slice(0, charIndex)

    useEffect(() => {
        if (!soundEnabled) return

        const typeAudio = new Audio(EMBEDDED_SOUND)
        typeAudio.preload = "auto"
        typeAudio.volume = SOUND_VOLUME
        typeAudioRef.current = typeAudio

        const deleteAudio = new Audio(EMBEDDED_DELETE_SOUND)
        deleteAudio.preload = "auto"
        deleteAudio.volume = SOUND_VOLUME
        deleteAudioRef.current = deleteAudio

        const unlock = () => {
            if (audioUnlockedRef.current) return
            audioUnlockedRef.current = true

            const silence = (audio: HTMLAudioElement) =>
                audio
                    .play()
                    .then(() => {
                        audio.pause()
                        audio.currentTime = 0
                    })
                    .catch(() => {
                        audioUnlockedRef.current = false
                    })

            void silence(typeAudio)
            void silence(deleteAudio)
        }

        window.addEventListener("pointerdown", unlock, { once: true })
        window.addEventListener("keydown", unlock, { once: true })

        return () => {
            window.removeEventListener("pointerdown", unlock)
            window.removeEventListener("keydown", unlock)
            typeAudio.pause()
            deleteAudio.pause()
            typeAudioRef.current = null
            deleteAudioRef.current = null
        }
    }, [soundEnabled])

    const playTick = useCallback(
        (base: HTMLAudioElement | null) => {
            if (!soundEnabled || prefersReducedMotion() || !base) return
            const tick = base.cloneNode(true) as HTMLAudioElement
            tick.volume = base.volume
            void tick.play().catch(() => {})
        },
        [soundEnabled],
    )

    const playTypeSound = useCallback(() => {
        playTick(typeAudioRef.current)
    }, [playTick])

    const playDeleteSound = useCallback(() => {
        playTick(deleteAudioRef.current)
    }, [playTick])

    useEffect(() => {
        const prev = prevCharIndexRef.current
        prevCharIndexRef.current = charIndex

        if (charIndex === prev) return

        if (phase === "typing" && charIndex > prev) {
            playTypeSound()
            return
        }

        if (phase === "deleting" && charIndex < prev) {
            playDeleteSound()
        }
    }, [charIndex, phase, playTypeSound, playDeleteSound])

    useEffect(() => {
        setTextIndex(0)
        setCharIndex(0)
        setPhase("typing")
        setCursorOn(true)
        prevCharIndexRef.current = 0
    }, [safeTexts])

    useEffect(() => {
        if (phase !== "holding") {
            setCursorOn(true)
            return
        }

        const id = window.setInterval(() => {
            setCursorOn((prev) => !prev)
        }, 530)

        return () => window.clearInterval(id)
    }, [phase])

    useEffect(() => {
        if (prefersReducedMotion()) {
            setCharIndex(currentText.length)
            setPhase("holding")
            return
        }

        let timer: ReturnType<typeof setTimeout>
        const holdMs = holdDuration * 1000

        if (phase === "typing") {
            if (charIndex < currentText.length) {
                timer = setTimeout(() => {
                    setCharIndex((i) => i + 1)
                }, effectiveTypingSpeed)
            } else {
                timer = setTimeout(() => setPhase("holding"), 0)
            }
        } else if (phase === "holding") {
            timer = setTimeout(() => {
                setPhase("deleting")
            }, holdMs)
        } else if (phase === "deleting") {
            if (charIndex > 0) {
                timer = setTimeout(() => {
                    setCharIndex((i) => i - 1)
                }, effectiveDeletingSpeed)
            } else {
                timer = setTimeout(() => {
                    setTextIndex((i) => (i + 1) % safeTexts.length)
                    setPhase("typing")
                }, 0)
            }
        }

        return () => clearTimeout(timer)
    }, [
        phase,
        charIndex,
        currentText,
        effectiveTypingSpeed,
        effectiveDeletingSpeed,
        holdDuration,
        safeTexts.length,
    ])

    const textAlign =
        (font.textAlign as React.CSSProperties["textAlign"]) ?? "left"

    return (
        <div
            role="text"
            aria-label={`${prefix.replace(/\n/g, " ")}${currentText}`}
            style={{
                ...font,
                width: "100%",
                height: "100%",
                color,
                textAlign,
                whiteSpace: "pre-wrap",
                ...style,
            }}
        >
            {prefix ? <span style={{ color: prefixColor }}>{prefix}</span> : null}

            <span aria-hidden="true" style={{ color }}>
                {displayed}
                <span
                    aria-hidden="true"
                    style={{
                        display: "inline-block",
                        boxSizing: "border-box",
                        width: cursorWidth,
                        height: cursorHeight,
                        marginLeft: "0.08em",
                        verticalAlign: "-0.08em",
                        backgroundColor: cursorColor,
                        border: `1.5px solid ${cursorBorderColor}`,
                        borderRadius: 2,
                        opacity: cursorOn ? 1 : 0,
                        willChange: "opacity",
                    }}
                />
            </span>

            <span
                aria-live="polite"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            >
                {prefix.replace(/\n/g, " ")}
                {displayed}
            </span>
        </div>
    )
}

TypewriterText.defaultProps = {
    prefix: "We help you build apps that\nare ",
    texts: DEFAULT_TEXTS,
    font: {
        fontSize: "48px",
        letterSpacing: "-0.04em",
        lineHeight: "1.15em",
        variant: "Bold",
        textAlign: "left",
    },
    color: "#FFFFFF",
    prefixColor: "#FFFFFF",
    cursorColor: "#1A1A1A",
    cursorBorderColor: "#404040",
    cursorWidth: 12,
    cursorHeight: 40,
    deletingSpeed: 32,
    soundEnabled: true,
    transition: DEFAULT_TRANSITION,
}

addPropertyControls(TypewriterText, {
    prefix: {
        type: ControlType.String,
        title: "Prefix",
        displayTextArea: true,
        placeholder: "We help you build apps that\\nare ",
    },

    texts: {
        type: ControlType.Array,
        title: "Texts",
        control: {
            type: ControlType.String,
        },
        defaultValue: DEFAULT_TEXTS,
    },

    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        displayFontSize: true,
        displayTextAlignment: true,
        defaultValue: {
            fontSize: "48px",
            letterSpacing: "-0.04em",
            lineHeight: "1.15em",
            variant: "Bold",
            textAlign: "left",
        },
    },

    prefixColor: {
        type: ControlType.Color,
        title: "Prefix Color",
    },

    color: {
        type: ControlType.Color,
        title: "Text Color",
    },

    cursorColor: {
        type: ControlType.Color,
        title: "Cursor Fill",
    },

    cursorBorderColor: {
        type: ControlType.Color,
        title: "Cursor Border",
    },

    cursorWidth: {
        type: ControlType.Number,
        title: "Cursor Width",
        min: 2,
        max: 40,
        step: 1,
        unit: "px",
    },

    cursorHeight: {
        type: ControlType.Number,
        title: "Cursor Height",
        min: 8,
        max: 80,
        step: 1,
        unit: "px",
    },

    deletingSpeed: {
        type: ControlType.Number,
        title: "Delete Speed",
        min: 10,
        max: 200,
        step: 5,
        unit: "ms",
    },

    soundEnabled: {
        type: ControlType.Boolean,
        title: "Sound",
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: DEFAULT_TRANSITION,
    },
})
