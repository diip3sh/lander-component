"use client"

import { useState } from "react"
import CustomHover, { type ScatterMode } from "@/components/custom-hover"

export default function CustomHoverPage() {
  const [variant, setVariant] = useState<ScatterMode>("word")

  const handleSelectWord = () => {
    setVariant("word")
  }

  const handleSelectCursorRadius = () => {
    setVariant("cursorRadius")
  }

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-neutral-950 p-4 sm:p-8">
      <fieldset className="flex items-center gap-6 text-sm text-neutral-200">
        <legend className="sr-only">Variant</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2">
          <input
            checked={variant === "word"}
            className="size-4 accent-white"
            name="variant"
            onChange={handleSelectWord}
            type="checkbox"
          />
          Word
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2">
          <input
            checked={variant === "cursorRadius"}
            className="size-4 accent-white"
            name="variant"
            onChange={handleSelectCursorRadius}
            type="checkbox"
          />
          Cursor radius
        </label>
      </fieldset>

      <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl shadow-black">
        <CustomHover variant={variant} />
      </div>
    </main>
  )
}
