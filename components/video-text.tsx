import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

type FontStyle = React.CSSProperties & {
    fontFamily?: string
    fontWeight?: number | string
    fontSize?: number | string
    textAlign?: React.CSSProperties["textAlign"]
}

type Preload = "auto" | "metadata" | "none"

type Props = {
    text: string
    src: string
    font: FontStyle

    autoPlay: boolean
    muted: boolean
    loop: boolean
    preload: Preload
}

const escapeXml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")

const parseFontSize = (fontSize: FontStyle["fontSize"]): string => {
    if (typeof fontSize === "number") return `${fontSize}px`
    if (typeof fontSize === "string" && fontSize.length > 0) return fontSize
    return "120px"
}

const parseFontWeight = (fontWeight: FontStyle["fontWeight"]): string => {
    if (typeof fontWeight === "number") return String(fontWeight)
    if (typeof fontWeight === "string" && fontWeight.length > 0) return fontWeight
    return "bold"
}

const parseFontFamily = (fontFamily: FontStyle["fontFamily"]): string => {
    if (typeof fontFamily === "string" && fontFamily.length > 0) {
        return fontFamily.split(",")[0]?.trim().replace(/['"]/g, "") || "sans-serif"
    }
    return "sans-serif"
}

const mapTextAnchor = (
    textAlign: FontStyle["textAlign"],
): "start" | "middle" | "end" => {
    if (textAlign === "right" || textAlign === "end") return "end"
    if (textAlign === "left" || textAlign === "start") return "start"
    return "middle"
}

const mapTextX = (textAlign: FontStyle["textAlign"]): string => {
    if (textAlign === "right" || textAlign === "end") return "100%"
    if (textAlign === "left" || textAlign === "start") return "0%"
    return "50%"
}

export default function VideoText({
    text,
    src,
    font,

    autoPlay,
    muted,
    loop,
    preload,
}: Props) {
    const content = text || "VIDEO"
    const [svgMask, setSvgMask] = useState("")

    const fontSize = parseFontSize(font.fontSize)
    const fontWeight = parseFontWeight(font.fontWeight)
    const fontFamily = parseFontFamily(font.fontFamily)
    const textAnchor = mapTextAnchor(font.textAlign)
    const textX = mapTextX(font.textAlign)

    useEffect(() => {
        const buildMask = () => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><text x='${textX}' y='50%' font-size='${fontSize}' font-weight='${fontWeight}' text-anchor='${textAnchor}' dominant-baseline='middle' font-family='${escapeXml(fontFamily)}'>${escapeXml(content)}</text></svg>`
            setSvgMask(svg)
        }

        buildMask()
        window.addEventListener("resize", buildMask)
        return () => window.removeEventListener("resize", buildMask)
    }, [content, fontSize, fontWeight, fontFamily, textAnchor, textX])

    const dataUrlMask = useMemo(() => {
        if (!svgMask) return undefined
        return `url("data:image/svg+xml,${encodeURIComponent(svgMask)}")`
    }, [svgMask])

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    maskImage: dataUrlMask,
                    WebkitMaskImage: dataUrlMask,
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                }}
            >
                {src ? (
                    <video
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                        autoPlay={autoPlay}
                        muted={muted}
                        loop={loop}
                        preload={preload}
                        playsInline
                    >
                        <source src={src} />
                    </video>
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
    src: "https://cdn.magicui.design/ocean-small.webm",
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

    src: {
        type: ControlType.File,
        title: "Video",
        allowedFileTypes: ["mp4", "webm", "mov"],
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
