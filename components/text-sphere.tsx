"use client";

import { useEffect, useMemo, useRef } from "react";

type TextSphereProps = {
  word?: string;
  duration?: number;
  className?: string;
};

type Track = {
  longitude: number;
  samples: number;
};

type SpherePoint = {
  character: string;
  x: number;
  y: number;
  z: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
  depth: number;
  scale: number;
};

const VIEWBOX_SIZE = 720;
const SPHERE_RADIUS = 276;
const CAMERA_DISTANCE = 8;
const FACE_EDGE_PADDING = 0.055;

const DENSE_FACE_TRACKS: Track[] = [
  { longitude: 0.11, samples: 20 },
  { longitude: 0.25, samples: 18 },
  { longitude: 0.43, samples: 21 },
  { longitude: 0.61, samples: 19 },
  { longitude: 0.76, samples: 22 },
  { longitude: 0.94, samples: 18 },
  { longitude: 1.08, samples: 20 },
  { longitude: 1.23, samples: 19 },
  { longitude: 1.4, samples: 22 },
  { longitude: 1.57, samples: 18 },
  { longitude: 1.73, samples: 21 },
  { longitude: 1.9, samples: 19 },
  { longitude: 2.1, samples: 20 },
  { longitude: 2.31, samples: 18 },
  { longitude: 2.56, samples: 21 },
  { longitude: 2.79, samples: 17 },
  { longitude: 2.98, samples: 20 },
];

const SPARSE_FACE_TRACKS: Track[] = [
  { longitude: 3.29, samples: 15 },
  { longitude: 3.58, samples: 14 },
  { longitude: 3.92, samples: 16 },
  { longitude: 4.36, samples: 13 },
  { longitude: 4.77, samples: 15 },
  { longitude: 5.11, samples: 12 },
  { longitude: 5.48, samples: 14 },
  { longitude: 5.83, samples: 13 },
  { longitude: 6.08, samples: 15 },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const mapTrackToSphere = (
  tracks: Track[],
  word: string,
  minimumLongitude: number,
  maximumLongitude: number,
  characterOffset: number,
): SpherePoint[] => {
  const characters = Array.from(word || "dream");
  let pointIndex = 0;

  return tracks.flatMap((track) =>
    Array.from({ length: track.samples }, (_, sampleIndex) => {
      const baseProgress = sampleIndex / Math.max(1, track.samples - 1);
      const progress = baseProgress;
      const polarAngle = progress * Math.PI;
      const longitude = clamp(
        track.longitude,
        minimumLongitude + FACE_EDGE_PADDING,
        maximumLongitude - FACE_EDGE_PADDING,
      );
      const ringRadius = Math.sin(polarAngle);
      const character =
        characters[(pointIndex + characterOffset) % characters.length] ?? "d";

      pointIndex += 1;

      return {
        character,
        x: ringRadius * Math.cos(longitude),
        y: Math.cos(polarAngle),
        z: ringRadius * Math.sin(longitude),
      };
    }),
  );
};

const createSpherePoints = (word: string): SpherePoint[] => {
  const denseFacePoints = mapTrackToSphere(
    DENSE_FACE_TRACKS,
    word,
    0,
    Math.PI,
    0,
  );
  const sparseFacePoints = mapTrackToSphere(
    SPARSE_FACE_TRACKS,
    word,
    Math.PI,
    Math.PI * 2,
    denseFacePoints.length,
  );

  return [...denseFacePoints, ...sparseFacePoints];
};

const rotateHorizontally = (
  point: SpherePoint,
  angle: number,
): Pick<SpherePoint, "x" | "y" | "z"> => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
};

const projectPoint = (point: SpherePoint, angle: number): ProjectedPoint => {
  const rotatedPoint = rotateHorizontally(point, angle);
  const perspective =
    CAMERA_DISTANCE / (CAMERA_DISTANCE - rotatedPoint.z * 0.38);
  const depth = (rotatedPoint.z + 1) / 2;

  return {
    x: VIEWBOX_SIZE / 2 + rotatedPoint.x * SPHERE_RADIUS * perspective,
    y: VIEWBOX_SIZE / 2 - rotatedPoint.y * SPHERE_RADIUS * perspective,
    depth,
    scale: 0.45 + depth * 0.76,
  };
};

export default function TextSphere({
  word = "dream",
  duration = 15,
  className = "",
}: TextSphereProps) {
  const glyphRefs = useRef<Array<SVGTextElement | null>>([]);
  const animationFrameRef = useRef<number | null>(null);
  const spherePoints = useMemo(() => createSpherePoints(word), [word]);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const safeDuration = Math.max(duration, 0.1) * 1000;
    let startTime: number | null = null;

    const renderFrame = (timestamp: number) => {
      startTime ??= timestamp;
      const elapsed = timestamp - startTime;
      const angle = reducedMotionQuery.matches
        ? 0
        : (elapsed / safeDuration) * Math.PI * 2;

      spherePoints.forEach((point, pointIndex) => {
        const glyph = glyphRefs.current[pointIndex];
        if (!glyph) return;

        const projectedPoint = projectPoint(point, angle);
        const fontSize = 19 * projectedPoint.scale;
        const opacity = clamp(
          0.14 + Math.pow(projectedPoint.depth, 1.2) * 0.86,
          0.14,
          1,
        );

        glyph.setAttribute("x", projectedPoint.x.toFixed(2));
        glyph.setAttribute("y", projectedPoint.y.toFixed(2));
        glyph.setAttribute("font-size", fontSize.toFixed(2));
        glyph.setAttribute("opacity", opacity.toFixed(3));
      });

      if (reducedMotionQuery.matches) return;
      animationFrameRef.current = window.requestAnimationFrame(renderFrame);
    };

    animationFrameRef.current = window.requestAnimationFrame(renderFrame);

    return () => {
      if (animationFrameRef.current === null) return;
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [duration, spherePoints]);

  return (
    <svg
      aria-label={`A rotating sphere made from repetitions of the word ${word}`}
      className={`block size-full overflow-visible ${className}`}
      role="img"
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
    >
      <g aria-hidden="true" className="fill-white font-sans font-medium">
        {spherePoints.map((point, pointIndex) => (
          <text
            dominantBaseline="central"
            key={`track-point-${pointIndex}`}
            ref={(node) => {
              glyphRefs.current[pointIndex] = node;
            }}
            textAnchor="middle"
          >
            {point.character}
          </text>
        ))}
      </g>
    </svg>
  );
}
