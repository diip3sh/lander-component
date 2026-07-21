import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Matter from "matter-js"
import { addPropertyControls, ControlType } from "framer"

type FontStyle = React.CSSProperties & {
    fontFamily?: string
    fontWeight?: number | string
    fontSize?: number | string
    letterSpacing?: number | string
    lineHeight?: number | string
}

type Trigger = "auto" | "scroll" | "click" | "hover"

type Props = {
    text: string
    highlightWords: string[]
    highlightColor: string
    font: FontStyle
    color: string
    trigger: Trigger
    backgroundColor: string
    wireframes: boolean
    gravity: number
    mouseConstraintStiffness: number
}

type WordBody = {
    elem: HTMLElement
    // Matter body instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any
}

const { Engine, Render, World, Bodies, Runner, Mouse, MouseConstraint, Body } =
    Matter

export default function FallingText({
    text,
    highlightWords = [],
    highlightColor,
    font,
    color,
    trigger = "auto",
    backgroundColor = "transparent",
    wireframes = false,
    gravity = 1,
    mouseConstraintStiffness = 0.2,
}: Props) {
    const content = text || "Framer Motion is a powerful animation library"
    const words = useMemo(() => content.split(" ").filter(Boolean), [content])
    const highlights = useMemo(
        () => (highlightWords ?? []).filter((word) => word.trim().length > 0),
        [highlightWords],
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLDivElement>(null)
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const [effectStarted, setEffectStarted] = useState(false)
    const [layoutReady, setLayoutReady] = useState(0)

    useEffect(() => {
        setEffectStarted(false)

        if (trigger === "auto") {
            setEffectStarted(true)
            return
        }

        if (trigger === "scroll" && containerRef.current) {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (!entry?.isIntersecting) return
                    setEffectStarted(true)
                    observer.disconnect()
                },
                { threshold: 0.1 },
            )
            observer.observe(containerRef.current)
            return () => observer.disconnect()
        }
    }, [trigger, content])

    useEffect(() => {
        const node = containerRef.current
        if (!node) return

        const observer = new ResizeObserver(() => {
            setLayoutReady((value) => value + 1)
        })
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!effectStarted) return

        const container = containerRef.current
        const canvasContainer = canvasContainerRef.current
        const textNode = textRef.current
        if (!container || !canvasContainer || !textNode) return

        const containerRect = container.getBoundingClientRect()
        const width = Math.floor(containerRect.width)
        const height = Math.floor(containerRect.height)
        if (width <= 0 || height <= 0) return

        const engine = Engine.create()
        engine.world.gravity.y = gravity

        const render = Render.create({
            element: canvasContainer,
            engine,
            options: {
                width,
                height,
                background: backgroundColor,
                wireframes,
                pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
            },
        })

        const boundaryOptions = {
            isStatic: true,
            render: { fillStyle: "transparent" },
        }

        const floor = Bodies.rectangle(
            width / 2,
            height + 25,
            width,
            50,
            boundaryOptions,
        )
        const leftWall = Bodies.rectangle(
            -25,
            height / 2,
            50,
            height,
            boundaryOptions,
        )
        const rightWall = Bodies.rectangle(
            width + 25,
            height / 2,
            50,
            height,
            boundaryOptions,
        )
        const ceiling = Bodies.rectangle(
            width / 2,
            -25,
            width,
            50,
            boundaryOptions,
        )

        const wordSpans = textNode.querySelectorAll<HTMLElement>("[data-word]")
        const wordBodies: WordBody[] = Array.from(wordSpans).map((elem) => {
            const rect = elem.getBoundingClientRect()
            const x = rect.left - containerRect.left + rect.width / 2
            const y = rect.top - containerRect.top + rect.height / 2

            const body = Bodies.rectangle(x, y, rect.width, rect.height, {
                render: { fillStyle: "transparent" },
                restitution: 0.8,
                frictionAir: 0.01,
                friction: 0.2,
            })

            Body.setVelocity(body, {
                x: (Math.random() - 0.5) * 5,
                y: 0,
            })
            Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05)

            return { elem, body }
        })

        wordBodies.forEach(({ elem, body }) => {
            elem.style.position = "absolute"
            elem.style.left = `${body.position.x}px`
            elem.style.top = `${body.position.y}px`
            elem.style.transform = "translate(-50%, -50%)"
            elem.style.margin = "0"
        })

        const mouse = Mouse.create(container)
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse,
            constraint: {
                stiffness: mouseConstraintStiffness,
                render: { visible: false },
            },
        })
        render.mouse = mouse

        World.add(engine.world, [
            floor,
            leftWall,
            rightWall,
            ceiling,
            mouseConstraint,
            ...wordBodies.map((item) => item.body),
        ])

        const runner = Runner.create()
        Runner.run(runner, engine)
        Render.run(render)

        let frameId = 0
        const updateLoop = () => {
            wordBodies.forEach(({ body, elem }) => {
                const { x, y } = body.position
                elem.style.left = `${x}px`
                elem.style.top = `${y}px`
                elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`
            })
            frameId = window.requestAnimationFrame(updateLoop)
        }
        frameId = window.requestAnimationFrame(updateLoop)

        return () => {
            window.cancelAnimationFrame(frameId)
            Render.stop(render)
            Runner.stop(runner)

            if (render.canvas?.parentNode) {
                render.canvas.parentNode.removeChild(render.canvas)
            }

            World.clear(engine.world, false)
            Engine.clear(engine)

            wordBodies.forEach(({ elem }) => {
                elem.style.position = ""
                elem.style.left = ""
                elem.style.top = ""
                elem.style.transform = ""
                elem.style.margin = ""
            })
        }
    }, [
        effectStarted,
        gravity,
        wireframes,
        backgroundColor,
        mouseConstraintStiffness,
        layoutReady,
        content,
        highlights,
        font,
        color,
        highlightColor,
    ])

    const handleTrigger = () => {
        if (effectStarted) return
        if (trigger === "click" || trigger === "hover") {
            setEffectStarted(true)
        }
    }

    return (
        <div
            ref={containerRef}
            onClick={trigger === "click" ? handleTrigger : undefined}
            onPointerEnter={trigger === "hover" ? handleTrigger : undefined}
            style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                height: "100%",
                cursor: "pointer",
                textAlign: "center",
                paddingTop: 32,
                overflow: "hidden",
                backgroundColor:
                    backgroundColor === "transparent" ? undefined : backgroundColor,
                touchAction: "manipulation",
                userSelect: "none",
            }}
        >
            <div
                ref={textRef}
                style={{
                    ...font,
                    display: effectStarted ? "block" : "inline-block",
                    position: "relative",
                    zIndex: 2,
                    color,
                    lineHeight: font.lineHeight ?? 1.4,
                }}
            >
                {words.map((word, index) => {
                    const isHighlighted = highlights.some((hw) =>
                        word.startsWith(hw),
                    )

                    return (
                        <React.Fragment key={`${word}-${index}`}>
                            <span
                                data-word=""
                                style={{
                                    display: "inline-block",
                                    marginLeft: 2,
                                    marginRight: 2,
                                    color: isHighlighted ? highlightColor : color,
                                    fontWeight: isHighlighted
                                        ? 700
                                        : font.fontWeight,
                                }}
                            >
                                {word}
                            </span>
                            {index < words.length - 1 ? " " : null}
                        </React.Fragment>
                    )
                })}
            </div>

            <div
                ref={canvasContainerRef}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

FallingText.defaultProps = {
    text: "Framer Motion is a powerful animation library for React",
    highlightWords: ["Framer", "Motion", "React"],
    highlightColor: "#22D3EE",
    font: {
        fontSize: "24px",
        letterSpacing: "0em",
        lineHeight: "1.4em",
        variant: "Medium",
        textAlign: "center",
    },
    color: "#FFFFFF",
    trigger: "auto",
    backgroundColor: "transparent",
    wireframes: false,
    gravity: 1,
    mouseConstraintStiffness: 0.2,
}

addPropertyControls(FallingText, {
    text: {
        type: ControlType.String,
        title: "Text",
        displayTextArea: true,
    },

    highlightWords: {
        type: ControlType.Array,
        title: "Highlights",
        control: {
            type: ControlType.String,
        },
        defaultValue: ["Framer", "Motion", "React"],
    },

    highlightColor: {
        type: ControlType.Color,
        title: "Highlight",
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
            letterSpacing: "0em",
            lineHeight: "1.4em",
            variant: "Medium",
            textAlign: "center",
        },
    },

    color: {
        type: ControlType.Color,
        title: "Color",
    },

    trigger: {
        type: ControlType.Enum,
        title: "Trigger",
        options: ["auto", "scroll", "click", "hover"],
        optionTitles: ["Auto", "Scroll", "Click", "Hover"],
        displaySegmentedControl: true,
    },

    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
    },

    wireframes: {
        type: ControlType.Boolean,
        title: "Wireframes",
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    gravity: {
        type: ControlType.Number,
        title: "Gravity",
        min: 0,
        max: 3,
        step: 0.1,
    },

    mouseConstraintStiffness: {
        type: ControlType.Number,
        title: "Drag Stiffness",
        min: 0,
        max: 1,
        step: 0.05,
    },
})
