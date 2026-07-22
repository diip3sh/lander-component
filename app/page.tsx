import AsciiFire from "@/components/ascii-fire";
import FallingText, { FallingDemo } from "@/components/falling-text";
import Text3DFlip from "@/components/text-3d-flip";

export default function Home() {
  return (
    <main className="h-svh w-full overflow-hidden bg-neutral-950">
      <Text3DFlip
        text="Hello"
        font={{ fontSize: "72px" }}
        color="white"
        staggerDuration={0.05}
        staggerFrom="first"
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        rotateDirection="top"
      />
    </main>
  );
}
