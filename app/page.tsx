import TypewriterText from "@/components/typewritter-text";

export default function Home() {
  return (
    <main className="flex flex-1 w-full items-center justify-center bg-black px-6 text-white">
      <TypewriterText soundEnabled={false} />
    </main>
  );
}
