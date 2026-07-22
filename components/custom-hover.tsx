"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

export type Target = {
  x: number
  y: number
  /** capsule width; equals `s` for a dot */
  w: number
  /** mark size: dot diameter and dash height */
  s: number
}

export type TextTargetOptions = {
  dotSize: number
  cellScale: number
  fillRatio: number
  letterGap: number
  maxWidth: number
}

type Props = {
  text?: string
  color?: string
  background?: string
  dotSize?: number
  cellScale?: number
  fillRatio?: number
  letterGap?: number
  maxWidth?: number
  style?: React.CSSProperties
}

type Size = { width: number; height: number }

/** Explicit mark — matched to the close-up reference crops. */
type Mark = {
  /** column center (may be fractional for biased dashes) */
  c: number
  /** row center */
  r: number
  kind: "dot" | "dash"
}

type Glyph = {
  /** advance width in grid columns */
  width: number
  marks: Mark[]
}

const ref = (value: number, width: number): number => value * (width / 720)

export const getTextDotSize = (width: number, value = 8.6): number =>
  ref(value, width)

const DEFAULT_TEXT_OPTIONS: TextTargetOptions = {
  dotSize: 8.6,
  cellScale: 1.65,
  fillRatio: 0.56,
  letterGap: 0.9,
  maxWidth: 0.94,
}

const dot = (c: number, r: number): Mark => ({ c, r, kind: "dot" })
const dash = (c: number, r: number): Mark => ({ c, r, kind: "dash" })

/**
 * Row map (shared baseline at row 7):
 * 0–1 ascender · 2–7 x-height · 8–9 descender
 *
 * Built mark-for-mark from the provided letter close-ups.
 */
const GLYPHS: Record<string, Glyph> = {
  " ": { width: 2, marks: [] },

  // —— c: top/bottom dashes, 4 left dots, 2 right corner dots ——
  c: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dot(0, 4),
      dot(0, 5),
      dot(0, 6),
      dot(2, 6),
      dash(1, 7),
    ],
  },

  // —— e: 3 dashes + L/R dots (1 above bar, 2 left / 1 right below) ——
  e: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dash(1, 4),
      dot(0, 5),
      dot(0, 6),
      dot(2, 6),
      dash(1, 7),
    ],
  },

  // —— l: 8 spaced vertical dots ——
  l: {
    width: 1,
    marks: [
      dot(0, 0),
      dot(0, 1),
      dot(0, 2),
      dot(0, 3),
      dot(0, 4),
      dot(0, 5),
      dot(0, 6),
      dot(0, 7),
    ],
  },

  // —— u: 5 left dots, 4 right dots, base dash, right short dash + corner ——
  u: {
    width: 3,
    marks: [
      dot(0, 2),
      dot(2, 2),
      dot(0, 3),
      dot(2, 3),
      dot(0, 4),
      dot(2, 4),
      dot(0, 5),
      dot(2, 5),
      dot(0, 6),
      dash(2, 6),
      dash(0.85, 7),
      dot(2, 7),
    ],
  },

  // —— a: 3 dashes, upper L/R dots, lower right stem, bottom dash + tail ——
  a: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dash(1, 4),
      dot(2, 5),
      dot(2, 6),
      dash(0.75, 7),
      dot(2.15, 7),
    ],
  },

  // —— r: stem dots + top arm dash (gap so they stay separate) ——
  r: {
    width: 3,
    marks: [
      dot(0, 2),
      dash(1.85, 2),
      dot(0, 3),
      dot(0, 4),
      dot(0, 5),
      dot(0, 6),
      dot(0, 7),
    ],
  },

  // —— s: 3 centered/biased dashes with corner dots ——
  s: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dash(0.65, 4),
      dash(1.35, 5),
      dot(0, 6),
      dot(2, 6),
      dash(1, 7),
    ],
  },

  // —— y: 4+4 arms, inward dots, neck dash, offset dot, bottom dash ——
  y: {
    width: 3,
    marks: [
      dot(0, 2),
      dot(2, 2),
      dot(0, 3),
      dot(2, 3),
      dot(0, 4),
      dot(2, 4),
      dot(0, 5),
      dot(2, 5),
      dot(0.55, 6),
      dot(1.45, 6),
      dash(1, 7),
      dot(1.35, 8),
      dash(0.7, 9),
    ],
  },

  // —— m: 3 stems, arch dashes on top ——
  m: {
    width: 5,
    marks: [
      dot(0, 2),
      dash(1, 2),
      dash(3, 2),
      dot(4, 2),
      dash(0, 3),
      dash(2, 3),
      dot(4, 3),
      dot(0, 4),
      dot(2, 4),
      dot(4, 4),
      dot(0, 5),
      dot(2, 5),
      dot(4, 5),
      dot(0, 6),
      dot(2, 6),
      dot(4, 6),
      dot(0, 7),
      dot(2, 7),
      dot(4, 7),
    ],
  },

  // —— b: tall stem Dot×3, Dash, Dot, Dash, Dot + bowl ——
  b: {
    width: 3,
    marks: [
      dot(0, 0),
      dot(0, 1),
      dot(0, 2),
      dash(0, 3),
      dash(1.7, 3),
      dot(0, 4),
      dot(2.4, 4),
      dash(0, 5),
      dot(2.4, 5),
      dot(0, 6),
      dot(2.4, 6),
      dash(1.7, 7),
      dot(2.4, 7),
    ],
  },

  // —— i: two tittle dashes, gap, 5-dot stem ——
  i: {
    width: 1,
    marks: [
      dash(0, 0),
      dash(0, 1),
      dot(0, 3),
      dot(0, 4),
      dot(0, 5),
      dot(0, 6),
      dot(0, 7),
    ],
  },

  // —— o: top/bottom dashes, 4+4 side dots ——
  o: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dot(0, 4),
      dot(2, 4),
      dot(0, 5),
      dot(2, 5),
      dot(0, 6),
      dot(2, 6),
      dash(1, 7),
    ],
  },

  // extras used less often — keep consistent grammar
  n: {
    width: 3,
    marks: [
      dot(0, 2),
      dash(1.7, 2),
      dot(0, 3),
      dot(2.2, 3),
      dot(0, 4),
      dot(2.2, 4),
      dot(0, 5),
      dot(2.2, 5),
      dot(0, 6),
      dot(2.2, 6),
      dot(0, 7),
      dot(2.2, 7),
    ],
  },
  h: {
    width: 3,
    marks: [
      dot(0, 0),
      dot(0, 1),
      dot(0, 2),
      dash(1.7, 2),
      dot(0, 3),
      dot(2.2, 3),
      dot(0, 4),
      dot(2.2, 4),
      dot(0, 5),
      dot(2.2, 5),
      dot(0, 6),
      dot(2.2, 6),
      dot(0, 7),
      dot(2.2, 7),
    ],
  },
  d: {
    width: 3,
    marks: [
      dot(2.2, 0),
      dot(2.2, 1),
      dash(1, 2),
      dot(0, 3),
      dot(2.2, 3),
      dot(0, 4),
      dot(2.2, 4),
      dot(0, 5),
      dot(2.2, 5),
      dot(0, 6),
      dot(2.2, 6),
      dash(1, 7),
      dot(2.2, 7),
    ],
  },
  g: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dot(0, 4),
      dot(2, 4),
      dot(0, 5),
      dot(2, 5),
      dash(1, 6),
      dot(2, 7),
      dash(1, 8),
    ],
  },
  p: {
    width: 3,
    marks: [
      dash(1, 2),
      dash(0, 2),
      dot(0, 3),
      dot(2.2, 3),
      dot(0, 4),
      dot(2.2, 4),
      dot(0, 5),
      dot(2.2, 5),
      dash(1, 6),
      dot(0, 6),
      dot(0, 7),
      dot(0, 8),
    ],
  },
  t: {
    width: 3,
    marks: [
      dot(1, 1),
      dash(1, 2),
      dot(1, 3),
      dot(1, 4),
      dot(1, 5),
      dot(1, 6),
      dash(1.5, 7),
    ],
  },
  f: {
    width: 3,
    marks: [
      dot(0, 1),
      dash(1.7, 1),
      dash(1, 2),
      dot(0, 3),
      dot(0, 4),
      dot(0, 5),
      dot(0, 6),
      dot(0, 7),
    ],
  },
  v: {
    width: 3,
    marks: [
      dot(0, 2),
      dot(2, 2),
      dot(0, 3),
      dot(2, 3),
      dot(0, 4),
      dot(2, 4),
      dot(0.5, 5),
      dot(1.5, 5),
      dot(1, 6),
    ],
  },
  w: {
    width: 5,
    marks: [
      dot(0, 2),
      dot(4, 2),
      dot(0, 3),
      dot(4, 3),
      dot(0, 4),
      dot(2, 4),
      dot(4, 4),
      dot(0, 5),
      dot(2, 5),
      dot(4, 5),
      dot(1, 6),
      dot(3, 6),
    ],
  },
  x: {
    width: 3,
    marks: [
      dot(0, 2),
      dot(2, 2),
      dot(0.5, 3),
      dot(1.5, 3),
      dot(1, 4),
      dot(0.5, 5),
      dot(1.5, 5),
      dot(0, 6),
      dot(2, 6),
    ],
  },
  z: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(2, 3),
      dash(1, 4),
      dot(0, 5),
      dash(1, 7),
    ],
  },
  k: {
    width: 3,
    marks: [
      dot(0, 0),
      dot(0, 1),
      dot(0, 2),
      dot(2, 2),
      dot(0, 3),
      dash(1.2, 3),
      dot(0, 4),
      dash(0.9, 4),
      dot(0, 5),
      dot(1.5, 5),
      dot(0, 6),
      dot(2, 6),
      dot(0, 7),
      dot(2.2, 7),
    ],
  },
  j: {
    width: 2,
    marks: [
      dash(1, 0),
      dot(1, 2),
      dot(1, 3),
      dot(1, 4),
      dot(1, 5),
      dot(1, 6),
      dot(0, 7),
      dash(0.7, 8),
    ],
  },
  q: {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dot(0, 4),
      dot(2, 4),
      dot(0, 5),
      dot(2, 5),
      dash(1, 6),
      dot(2, 7),
      dot(2, 8),
    ],
  },
  ".": { width: 1, marks: [dot(0, 7)] },
  ",": { width: 1, marks: [dot(0, 7), dot(0.3, 8)] },
  "-": { width: 2, marks: [dash(0.5, 4)] },
  "!": {
    width: 1,
    marks: [dot(0, 2), dot(0, 3), dot(0, 4), dot(0, 5), dot(0, 7)],
  },
  "?": {
    width: 3,
    marks: [
      dash(1, 2),
      dot(0, 3),
      dot(2, 3),
      dash(1.4, 4),
      dot(1, 5),
      dot(1, 7),
    ],
  },
}

const FALLBACK_GLYPH: Glyph = {
  width: 3,
  marks: [
    dash(1, 2),
    dot(2, 3),
    dash(1, 4),
    dot(1, 6),
  ],
}

const markToTarget = (
  mark: Mark,
  originX: number,
  originY: number,
  cellSize: number,
  dotSize: number,
): Target => {
  const x = originX + mark.c * cellSize
  const y = originY + mark.r * cellSize
  if (mark.kind === "dot") {
    return { x, y, w: dotSize, s: dotSize }
  }
  // Reference dashes are ~2–2.5× the dot diameter.
  return { x, y, w: dotSize * 2.25, s: dotSize }
}

export const generateTextTargets = (
  word: string,
  width: number,
  height: number,
  options: Partial<TextTargetOptions> = {},
): Target[] => {
  if (!word) return []

  const config = { ...DEFAULT_TEXT_OPTIONS, ...options }
  const characters = [...word.toLowerCase()]
  const glyphs = characters.map((ch) => GLYPHS[ch] ?? FALLBACK_GLYPH)

  const rawDotSize = getTextDotSize(width, config.dotSize)
  const totalColumns = glyphs.reduce((sum, glyph, index) => {
    return (
      sum +
      glyph.width +
      (index === glyphs.length - 1 ? 0 : config.letterGap)
    )
  }, 0)

  // 10 rows in the shared grid (0..9)
  const totalRows = 10
  const maxTextWidth = width * config.maxWidth
  const maxTextHeight = height * 0.72

  const cellFromWidth = maxTextWidth / Math.max(1, totalColumns)
  const cellFromHeight = maxTextHeight / totalRows
  const cellSize = Math.min(
    rawDotSize * config.cellScale,
    cellFromWidth,
    cellFromHeight,
  )

  const fillRatio = Math.min(0.72, Math.max(0.28, config.fillRatio))
  const dotSize = Math.max(
    ref(4.4, width),
    Math.min(rawDotSize, cellSize * fillRatio),
  )

  const targets: Target[] = []
  let cursorColumn = 0

  for (const glyph of glyphs) {
    for (const mark of glyph.marks) {
      targets.push(
        markToTarget(mark, cursorColumn * cellSize, 0, cellSize, dotSize),
      )
    }
    cursorColumn += glyph.width + config.letterGap
  }

  if (targets.length === 0) return []

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const t of targets) {
    minX = Math.min(minX, t.x - t.w / 2)
    maxX = Math.max(maxX, t.x + t.w / 2)
    minY = Math.min(minY, t.y - t.s / 2)
    maxY = Math.max(maxY, t.y + t.s / 2)
  }

  const textCx = (minX + maxX) / 2
  const textCy = (minY + maxY) / 2

  return targets.map((t) => ({
    x: t.x - textCx + width / 2,
    y: t.y - textCy + height / 2,
    w: t.w,
    s: t.s,
  }))
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 720
 * @framerIntrinsicHeight 405
 */
export default function CustomHover(props: Props) {
  const {
    text = "cellular symbiosis",
    color = "#FFFFFF",
    background = "transparent",
    dotSize = 8.6,
    cellScale = 1.65,
    fillRatio = 0.56,
    letterGap = 0.9,
    maxWidth = 0.94,
    style,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 720, height: 405 })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const nextWidth = Math.max(1, element.clientWidth)
      const nextHeight = Math.max(1, element.clientHeight)
      setSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev
        return { width: nextWidth, height: nextHeight }
      })
    }

    updateSize()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize)
      return () => window.removeEventListener("resize", updateSize)
    }

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const targets = useMemo(
    () =>
      generateTextTargets(text, size.width, size.height, {
        dotSize,
        cellScale,
        fillRatio,
        letterGap,
        maxWidth,
      }),
    [
      text,
      size.width,
      size.height,
      dotSize,
      cellScale,
      fillRatio,
      letterGap,
      maxWidth,
    ],
  )

  return (
    <div
      ref={containerRef}
      aria-label={text}
      className="relative isolate h-full min-h-[200px] w-full overflow-hidden"
      role="img"
      style={{
        background,
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        width={size.width}
      >
        {targets.map((target, index) => {
          const isDot = target.w <= target.s * 1.15
          const radius = target.s / 2

          return (
            <rect
              key={`${index}-${target.x.toFixed(2)}-${target.y.toFixed(2)}`}
              fill={color}
              height={target.s}
              rx={radius}
              ry={radius}
              width={isDot ? target.s : target.w}
              x={target.x - (isDot ? target.s : target.w) / 2}
              y={target.y - target.s / 2}
            />
          )
        })}
      </svg>
    </div>
  )
}

addPropertyControls(CustomHover, {
  text: {
    type: ControlType.String,
    title: "Text",
    displayTextArea: true,
    placeholder: "cellular symbiosis",
  },
  color: {
    type: ControlType.Color,
    title: "Color",
  },
  background: {
    type: ControlType.Color,
    title: "Background",
  },
  dotSize: {
    type: ControlType.Number,
    title: "Dot Size",
    min: 4,
    max: 16,
    step: 0.1,
  },
  cellScale: {
    type: ControlType.Number,
    title: "Cell Scale",
    min: 1,
    max: 3.5,
    step: 0.01,
  },
  fillRatio: {
    type: ControlType.Number,
    title: "Fill Ratio",
    min: 0.28,
    max: 0.72,
    step: 0.01,
  },
  letterGap: {
    type: ControlType.Number,
    title: "Letter Gap",
    min: 0,
    max: 4,
    step: 0.05,
  },
  maxWidth: {
    type: ControlType.Number,
    title: "Max Width",
    min: 0.4,
    max: 1,
    step: 0.01,
  },
})
