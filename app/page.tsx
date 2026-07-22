import TextSphere from "@/components/text-sphere";

export default function Home() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-neutral-950 p-4 sm:p-8">
      <div className="aspect-[9/16] max-h-[calc(100svh-2rem)] w-full max-w-[min(720px,calc((100svh-2rem)*0.5625))] overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black sm:max-h-[calc(100svh-4rem)] sm:max-w-[min(720px,calc((100svh-4rem)*0.5625))]">
        <div className="flex size-full items-center justify-center">
          <TextSphere className="w-full" />
        </div>
      </div>
    </main>
  );
}
