"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Matter from "matter-js";

export type FallingTextTrigger = "auto" | "scroll" | "click" | "hover";

export interface FallingTextProps {
  text?: string;
  highlightWords?: string[];
  highlightClass?: string;
  trigger?: FallingTextTrigger;
  backgroundColor?: string;
  wireframes?: boolean;
  gravity?: number;
  mouseConstraintStiffness?: number;
  fontSize?: string;
  wordSpacing?: string;
}

type WordBody = {
  element: HTMLSpanElement;
  halfHeight: number;
  halfWidth: number;
  body: {
    angle: number;
    position: { x: number; y: number };
  };
};

type PhysicsRender = {
  canvas: HTMLCanvasElement;
  textures: Record<string, unknown>;
};

type FallingTextStyle = React.CSSProperties & {
  "--falling-font-size": string;
  "--falling-word-spacing": string;
};

const WALL_THICKNESS = 100;
const MIN_SCENE_SIZE = 2;

const getWords = (text: string): string[] =>
  text.trim().split(/\s+/).filter(Boolean);

const isHighlightedWord = (
  word: string,
  highlightWords: string[],
): boolean =>
  highlightWords.some(
    (highlightedWord) =>
      highlightedWord.length > 0 && word.startsWith(highlightedWord),
  );

const resetWordElement = (element: HTMLSpanElement) => {
  element.style.position = "";
  element.style.inset = "";
  element.style.transform = "";
  element.style.transformOrigin = "";
  element.style.willChange = "";
};

const FallingText = ({
  text = "",
  highlightWords = [],
  highlightClass = "font-bold text-cyan-500",
  trigger = "auto",
  backgroundColor = "transparent",
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.2,
  fontSize = "1rem",
  wordSpacing = "0.3em",
}: FallingTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [hasTriggered, setHasTriggered] = useState(false);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const words = useMemo(() => getWords(text), [text]);
  const highlightWordsKey = highlightWords.join("\u0000");
  const effectStarted = trigger === "auto" || hasTriggered;

  useEffect(() => {
    if (trigger !== "scroll" || hasTriggered || shouldReduceMotion) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHasTriggered(true);
        observer.disconnect();
      },
      { threshold: 0.15 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [hasTriggered, shouldReduceMotion, trigger]);

  useEffect(() => {
    if (!effectStarted || shouldReduceMotion) return;

    const container = containerRef.current;
    const textContainer = textRef.current;
    const canvasContainer = canvasContainerRef.current;
    if (!container || !textContainer || !canvasContainer) return;

    let sceneCleanup: (() => void) | undefined;
    let resizeFrame: number | undefined;

    const createScene = () => {
      sceneCleanup?.();

      const wordElements = Array.from(
        textContainer.querySelectorAll<HTMLSpanElement>("[data-falling-word]"),
      );
      wordElements.forEach(resetWordElement);

      const containerRect = container.getBoundingClientRect();
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width < MIN_SCENE_SIZE || height < MIN_SCENE_SIZE) return;

      // Framer and other design canvases scale component ancestors for zoom.
      // DOM rects are screen-space values, while Matter and CSS transforms use
      // the component's local CSS pixels, so convert every measurement back.
      const scaleX = containerRect.width / width || 1;
      const scaleY = containerRect.height / height || 1;

      const {
        Bodies,
        Body,
        Composite,
        Engine,
        Events,
        Mouse,
        MouseConstraint,
        Render,
        Runner,
      } = Matter;

      const engine = Engine.create({ enableSleeping: true });
      engine.gravity.y = gravity;

      const boundaryOptions = {
        isStatic: true,
        restitution: 0.4,
        friction: 0.35,
        render: { fillStyle: "transparent" },
      };
      const halfWall = WALL_THICKNESS / 2;
      const boundaries = [
        Bodies.rectangle(
          width / 2,
          height + halfWall,
          width + WALL_THICKNESS * 2,
          WALL_THICKNESS,
          boundaryOptions,
        ),
        Bodies.rectangle(
          -halfWall,
          height / 2,
          WALL_THICKNESS,
          height + WALL_THICKNESS * 2,
          boundaryOptions,
        ),
        Bodies.rectangle(
          width + halfWall,
          height / 2,
          WALL_THICKNESS,
          height + WALL_THICKNESS * 2,
          boundaryOptions,
        ),
        Bodies.rectangle(
          width / 2,
          -halfWall,
          width + WALL_THICKNESS * 2,
          WALL_THICKNESS,
          boundaryOptions,
        ),
      ];

      const wordBodies: WordBody[] = wordElements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const wordWidth = rect.width / scaleX;
        const wordHeight = rect.height / scaleY;
        const wordCenterX =
          (rect.left - containerRect.left + rect.width / 2) / scaleX;
        const wordCenterY =
          (rect.top - containerRect.top + rect.height / 2) / scaleY;
        const body = Bodies.rectangle(
          wordCenterX,
          wordCenterY,
          Math.max(1, wordWidth),
          Math.max(1, wordHeight),
          {
            label: `falling-word-${index}`,
            restitution: 0.64,
            friction: 0.24,
            frictionAir: 0.012,
            density: 0.0015,
            chamfer: { radius: Math.min(6, wordHeight * 0.18) },
            render: {
              fillStyle: "rgba(34, 211, 238, 0.12)",
              strokeStyle: "rgba(34, 211, 238, 0.65)",
              lineWidth: 1,
            },
          },
        );

        Body.setVelocity(body, {
          x: ((index % 5) - 2) * 0.22,
          y: 0,
        });
        Body.setAngularVelocity(body, ((index % 7) - 3) * 0.0025);

        element.style.position = "absolute";
        element.style.inset = "0 auto auto 0";
        element.style.transformOrigin = "center";
        element.style.willChange = "transform";

        return {
          element,
          halfHeight: wordHeight / 2,
          halfWidth: wordWidth / 2,
          body,
        };
      });

      const mouse = Mouse.create(container);
      Mouse.setScale(mouse, {
        x: 1 / scaleX,
        y: 1 / scaleY,
      });
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: {
          stiffness: Math.max(0.01, mouseConstraintStiffness),
          damping: 0.12,
          render: { visible: false },
        },
      });

      const handleDragStart = () => {
        container.dataset.dragging = "true";
      };
      const handleDragEnd = () => {
        delete container.dataset.dragging;
      };

      Events.on(mouseConstraint, "startdrag", handleDragStart);
      Events.on(mouseConstraint, "enddrag", handleDragEnd);
      Composite.add(engine.world, [
        ...boundaries,
        ...wordBodies.map(({ body }) => body),
        mouseConstraint,
      ]);

      const handleAfterUpdate = () => {
        wordBodies.forEach(({ body, element, halfHeight, halfWidth }) => {
          const x = body.position.x - halfWidth;
          const y = body.position.y - halfHeight;
          element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${body.angle}rad)`;
        });
      };

      Events.on(engine, "afterUpdate", handleAfterUpdate);
      handleAfterUpdate();

      const runner = Runner.create();
      Runner.run(runner, engine);

      let render: PhysicsRender | undefined;
      if (wireframes) {
        const createdRender: PhysicsRender = Render.create({
          element: canvasContainer,
          engine,
          options: {
            width,
            height,
            background: "transparent",
            wireframes: true,
            pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          },
        });
        createdRender.canvas.className =
          "pointer-events-none absolute inset-0 size-full";
        Render.run(createdRender);
        render = createdRender;
      }

      sceneCleanup = () => {
        Events.off(engine, "afterUpdate", handleAfterUpdate);
        Events.off(mouseConstraint, "startdrag", handleDragStart);
        Events.off(mouseConstraint, "enddrag", handleDragEnd);
        Runner.stop(runner);
        Mouse.clearSourceEvents(mouse);

        if (render) {
          Render.stop(render);
          render.canvas.remove();
          render.textures = {};
        }

        delete container.dataset.dragging;
        Composite.clear(engine.world, false, true);
        Engine.clear(engine);
        wordElements.forEach(resetWordElement);
      };
    };

    const handleResize = () => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(createScene);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      sceneCleanup?.();
    };
  }, [
    backgroundColor,
    effectStarted,
    fontSize,
    gravity,
    highlightClass,
    highlightWordsKey,
    mouseConstraintStiffness,
    shouldReduceMotion,
    text,
    wireframes,
    wordSpacing,
  ]);

  const handleTrigger = () => {
    if (effectStarted || shouldReduceMotion) return;
    if (trigger !== "click" && trigger !== "hover") return;
    setHasTriggered(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (trigger !== "click") return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleTrigger();
  };

  const componentStyle: FallingTextStyle = {
    "--falling-font-size": fontSize,
    "--falling-word-spacing": wordSpacing,
    backgroundColor,
  };

  return (
    <div
      ref={containerRef}
      aria-label={text}
      className="relative isolate size-full touch-none overflow-hidden cursor-grab select-none [&[data-dragging=true]]:cursor-grabbing"
      onClick={trigger === "click" ? handleTrigger : undefined}
      onKeyDown={trigger === "click" ? handleKeyDown : undefined}
      onPointerEnter={trigger === "hover" ? handleTrigger : undefined}
      role="group"
      style={componentStyle}
      tabIndex={trigger === "click" ? 0 : undefined}
    >
      <div
        ref={canvasContainerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 size-full"
      />

      <div
        ref={textRef}
        aria-hidden="true"
        className="absolute inset-0 z-10 flex size-full flex-wrap content-center items-center justify-center gap-y-[0.2em] text-center text-[length:var(--falling-font-size)] leading-[1.2]"
      >
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            className={`pointer-events-none inline-block whitespace-nowrap pe-[var(--falling-word-spacing)] last:pe-0 ${
              isHighlightedWord(word, highlightWords) ? highlightClass : ""
            }`}
            data-falling-word
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
};

export default FallingText;

export const FallingDemo = () => (
  <FallingText
    backgroundColor="transparent"
    fontSize="2rem"
    gravity={0.56}
    highlightWords={["React", "Bits", "animated", "components", "simplify"]}
    mouseConstraintStiffness={0.9}
    text="React Bits is a library of animated and interactive React components designed to streamline UI development and simplify your workflow."
    trigger="hover"
    wireframes={false}
  />
);
