import CircularText from "@/components/circular-text"

export default function CircularTextPage() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-neutral-950 p-4 sm:p-8">
      <div className="aspect-square w-full max-w-md">
        <CircularText />
      </div>
    </main>
  )
}
