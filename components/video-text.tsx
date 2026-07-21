import * as React from "react"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

type FontStyle = React.CSSProperties & {
    fontFamily?: string
    fontWeight?: number | string
    fontSize?: number | string
    letterSpacing?: number | string
    textAlign?: React.CSSProperties["textAlign"]
}

type Preload = "auto" | "metadata" | "none"
type VideoSource = "upload" | "url"

type Props = {
    text: string
    videoSource: VideoSource
    src: string
    srcUrl: string
    font: FontStyle

    autoPlay: boolean
    muted: boolean
    loop: boolean
    preload: Preload
}

type Size = {
    width: number
    height: number
}

const escapeXml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")

const parseFontSizePx = (fontSize: FontStyle["fontSize"]): number => {
    if (typeof fontSize === "number") return fontSize
    if (typeof fontSize === "string" && fontSize.length > 0) {
        const parsed = Number.parseFloat(fontSize)
        if (Number.isFinite(parsed)) return parsed
    }
    return 120
}

const parseFontWeight = (fontWeight: FontStyle["fontWeight"]): string => {
    if (typeof fontWeight === "number") return String(fontWeight)
    if (typeof fontWeight === "string" && fontWeight.length > 0) return fontWeight
    return "bold"
}

const parseFontFamily = (fontFamily: FontStyle["fontFamily"]): string => {
    if (typeof fontFamily === "string" && fontFamily.length > 0) {
        return (
            fontFamily.split(",")[0]?.trim().replace(/['"]/g, "") || "sans-serif"
        )
    }
    return "sans-serif"
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

const mapTextAnchor = (
    textAlign: FontStyle["textAlign"],
): "start" | "middle" | "end" => {
    if (textAlign === "right" || textAlign === "end") return "end"
    if (textAlign === "left" || textAlign === "start") return "start"
    return "middle"
}

const mapTextX = (textAlign: FontStyle["textAlign"], width: number): number => {
    if (textAlign === "right" || textAlign === "end") return width
    if (textAlign === "left" || textAlign === "start") return 0
    return width / 2
}

const measureTextWidth = (
    content: string,
    fontSizePx: number,
    fontWeight: string,
    fontFamily: string,
    letterSpacingPx: number,
): number => {
    if (typeof document === "undefined") {
        return content.length * fontSizePx * 0.6
    }

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) return content.length * fontSizePx * 0.6

    context.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`
    const baseWidth = context.measureText(content).width
    const tracking =
        content.length > 1 ? letterSpacingPx * (content.length - 1) : 0
    return baseWidth + tracking
}

const fitFontSize = (
    content: string,
    maxFontSize: number,
    width: number,
    height: number,
    fontWeight: string,
    fontFamily: string,
    letterSpacingRatio: number,
): number => {
    const maxByHeight = height * 0.92
    let low = 1
    let high = Math.max(1, Math.min(maxFontSize, maxByHeight))
    let best = low

    for (let i = 0; i < 16; i += 1) {
        const mid = (low + high) / 2
        const letterSpacingPx = letterSpacingRatio * mid
        const textWidth = measureTextWidth(
            content,
            mid,
            fontWeight,
            fontFamily,
            letterSpacingPx,
        )

        if (textWidth <= width * 0.96 && mid <= maxByHeight) {
            best = mid
            low = mid
        } else {
            high = mid
        }
    }

    return Math.max(1, Math.floor(best))
}

export default function VideoText({
    text,
    videoSource,
    src,
    srcUrl,
    font,

    autoPlay,
    muted,
    loop,
    preload,
}: Props) {
    const content = text || "VIDEO"
    const videoSrc =
        videoSource === "url"
            ? srcUrl?.trim() || ""
            : src?.trim() || ""
    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState<Size>({ width: 0, height: 0 })

    const maxFontSize = parseFontSizePx(font.fontSize)
    const fontWeight = parseFontWeight(font.fontWeight)
    const fontFamily = parseFontFamily(font.fontFamily)
    const letterSpacingRatio =
        parseLetterSpacingPx(font.letterSpacing, maxFontSize) / maxFontSize
    const textAnchor = mapTextAnchor(font.textAlign)

    useLayoutEffect(() => {
        const node = containerRef.current
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

    const dataUrlMask = useMemo(() => {
        if (size.width <= 0 || size.height <= 0) return undefined

        const fontSizePx = fitFontSize(
            content,
            maxFontSize,
            size.width,
            size.height,
            fontWeight,
            fontFamily,
            letterSpacingRatio,
        )
        const letterSpacingPx = letterSpacingRatio * fontSizePx
        const textX = mapTextX(font.textAlign, size.width)
        const letterSpacingAttr =
            letterSpacingPx !== 0
                ? ` letter-spacing='${letterSpacingPx}'`
                : ""

        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size.width}' height='${size.height}' viewBox='0 0 ${size.width} ${size.height}'><text x='${textX}' y='${size.height / 2}' fill='black' font-size='${fontSizePx}' font-weight='${fontWeight}' text-anchor='${textAnchor}' dominant-baseline='central' font-family='${escapeXml(fontFamily)}'${letterSpacingAttr}>${escapeXml(content)}</text></svg>`

        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    }, [
        content,
        font.textAlign,
        fontFamily,
        fontWeight,
        letterSpacingRatio,
        maxFontSize,
        size.height,
        size.width,
        textAnchor,
    ])

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                isolation: "isolate",
                clipPath: "inset(0)",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    maskImage: dataUrlMask,
                    WebkitMaskImage: dataUrlMask,
                    maskSize: "100% 100%",
                    WebkitMaskSize: "100% 100%",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                    maskMode: "alpha",
                }}
            >
                {videoSrc ? (
                    <video
                        key={videoSrc}
                        src={videoSrc}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            maxWidth: "none",
                            objectFit: "cover",
                            objectPosition: "center",
                            display: "block",
                            pointerEvents: "none",
                        }}
                        autoPlay={autoPlay}
                        muted={muted}
                        loop={loop}
                        preload={preload}
                        playsInline
                    />
                ) : null}
            </div>

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
        </div>
    )
}

VideoText.defaultProps = {
    text: "VIDEO",
    videoSource: "url",
    src: "",
    srcUrl: "https://cdn.magicui.design/ocean-small.webm",
    font: {
        fontSize: "120px",
        letterSpacing: "-0.02em",
        lineHeight: "1em",
        variant: "Bold",
        textAlign: "center",
    },
    autoPlay: true,
    muted: true,
    loop: true,
    preload: "auto",
}

addPropertyControls(VideoText, {
    text: {
        type: ControlType.String,
        title: "Text",
        placeholder: "VIDEO",
    },

    videoSource: {
        type: ControlType.Enum,
        title: "Video",
        options: ["upload", "url"],
        optionTitles: ["Upload", "Link"],
        displaySegmentedControl: true,
    },

    src: {
        type: ControlType.File,
        title: "File",
        allowedFileTypes: ["mp4", "webm", "mov"],
        hidden: (props: Props) => props.videoSource !== "upload",
    },

    srcUrl: {
        type: ControlType.String,
        title: "Link",
        placeholder: "https://…",
        hidden: (props: Props) => props.videoSource !== "url",
    },

    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        displayFontSize: true,
        displayTextAlignment: true,
        defaultValue: {
            fontSize: "120px",
            letterSpacing: "-0.02em",
            lineHeight: "1em",
            variant: "Bold",
            textAlign: "center",
        },
    },

    autoPlay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    muted: {
        type: ControlType.Boolean,
        title: "Muted",
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    preload: {
        type: ControlType.Enum,
        title: "Preload",
        options: ["auto", "metadata", "none"],
        optionTitles: ["Auto", "Metadata", "None"],
    },
})
