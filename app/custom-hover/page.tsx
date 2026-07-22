import CustomHover from "@/components/custom-hover"

export default function CustomHoverPage() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-neutral-950 p-4 sm:p-8">
      <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl shadow-black">
        <CustomHover />
      </div>
    </main>
  )
}
