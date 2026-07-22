"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type TextSphereProps = {
  word?: string;
  duration?: number;
  className?: string;
};

type Track = {
  samples: number;
};

type SpherePoint = {
  character: string;
  face: "dense" | "sparse";
  opacityVariation: number;
  polarAngle: number;
  progress: number;
  sizeVariation: number;
  trackId: string;
};

type ProjectedPoint = {
  x: number;
  y: number;
  depth: number;
  scale: number;
};

type ProjectedCharacter = ProjectedPoint & {
  character: string;
  opacityVariation: number;
  sizeVariation: number;
};

type Coordinates = {
  x: number;
  y: number;
  z: number;
};

type DeformationSettings = {
  bottomBumpAmount: number;
  bottomBumpPosition: number;
  denseBulge: number;
  customGapWeight: number;
  lineGapWeight: number;
  sectionGapDegrees: number;
  smoothness: number;
  sparseBulge: number;
  topBumpAmount: number;
  topBumpPosition: number;
  width: number;
};

const VIEWBOX_SIZE = 720;
const SPHERE_RADIUS = 276;
const CAMERA_DISTANCE = 8;
const MAX_FACE_BULGE = 0.28;
const MAX_TWIST_RADIANS = 0.5;
const TWIST_INPUT_SCALE = 180;
const REFERENCE_ROTATION_DURATION = 6.28;
const BASE_FONT_SIZE = 19;
const FULL_ROTATION = Math.PI * 2;

const REFERENCE_PRESET = {
  bottomBumpAmount: 300,
  bottomBumpPosition: 64,
  customGapWeight: 3,
  denseBulge: 0,
  lineGapWeight: 1,
  sectionGapDegrees: 2.5,
  smoothness: 4,
  sparseBulge: 0,
  topBumpAmount: 900,
  topBumpPosition: 35,
  width: 100,
} satisfies DeformationSettings;

type GapKind = "custom" | "line";

const DENSE_FACE_TRACKS: Track[] = [
  { samples: 20 },
  { samples: 18 },
  { samples: 21 },
  { samples: 19 },
  { samples: 22 },
  { samples: 18 },
  { samples: 20 },
  { samples: 19 },
  { samples: 22 },
  { samples: 18 },
  { samples: 21 },
  { samples: 19 },
  { samples: 20 },
  { samples: 18 },
  { samples: 21 },
  { samples: 17 },
  { samples: 20 },
];

const SPARSE_FACE_TRACKS: Track[] = [
  { samples: 15 },
  { samples: 14 },
  { samples: 16 },
  { samples: 13 },
  { samples: 15 },
  { samples: 12 },
  { samples: 14 },
  { samples: 13 },
  { samples: 15 },
];

// The larger dense gaps sit between meridians 4/5 and 13/14. The sparse
// gaps sit between 2/3 and 6/7, matching the two reference face patterns.
const DENSE_FACE_GAPS: GapKind[] = [
  "line",
  "line",
  "line",
  "custom",
  "line",
  "line",
  "line",
  "line",
  "line",
  "line",
  "line",
  "line",
  "custom",
  "line",
  "line",
  "line",
];
const SPARSE_FACE_GAPS: GapKind[] = [
  "line",
  "custom",
  "line",
  "line",
  "line",
  "custom",
  "line",
  "line",
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const getDeterministicVariation = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;

  return value - Math.floor(value);
};

const mapTrackToSphere = (
  tracks: Track[],
  word: string,
  characterOffset: number,
  face: SpherePoint["face"],
): SpherePoint[] => {
  const characters = Array.from(word || "dream");
  let pointIndex = 0;

  return tracks.flatMap((track, trackIndex) => {
    const progresses = Array.from(
      { length: track.samples },
      (_, sampleIndex) => sampleIndex / Math.max(1, track.samples - 1),
    );

    return progresses.map((progress) => {
      const polarAngle = progress * Math.PI;
      const variationIndex = pointIndex;
      const character =
        characters[(pointIndex + characterOffset) % characters.length] ?? "d";

      pointIndex += 1;

      return {
        character,
        face,
        opacityVariation:
          0.86 + getDeterministicVariation(variationIndex, 2) * 0.14,
        polarAngle,
        progress,
        sizeVariation:
          0.9 + getDeterministicVariation(variationIndex, 1) * 0.2,
        trackId: `${face}-track-${trackIndex}`,
      };
    });
  });
};

const createSpherePoints = (word: string): SpherePoint[] => {
  const denseFacePoints = mapTrackToSphere(DENSE_FACE_TRACKS, word, 0, "dense");
  const sparseFacePoints = mapTrackToSphere(
    SPARSE_FACE_TRACKS,
    word,
    denseFacePoints.length,
    "sparse",
  );

  return [...denseFacePoints, ...sparseFacePoints];
};

const getFaceTrackLongitudes = (
  faceStart: number,
  face: SpherePoint["face"],
  gapPattern: GapKind[],
  deformation: DeformationSettings,
) => {
  const sectionGap =
    (clamp(deformation.sectionGapDegrees, 0, 100) * Math.PI) / 180;
  const facePadding = sectionGap / 2;
  const availableSpan = Math.max(Math.PI - sectionGap, 0.001);
  const intervalWeights = gapPattern.map((gapKind) =>
    gapKind === "custom"
      ? Math.max(deformation.customGapWeight, 0)
      : Math.max(deformation.lineGapWeight, 0),
  );
  const totalWeight = intervalWeights.reduce(
    (total, intervalWeight) => total + intervalWeight,
    0,
  );

  if (totalWeight === 0) {
    const collapsedLongitude =
      face === "dense" ? Math.PI - facePadding : Math.PI + facePadding;

    return Array.from({ length: gapPattern.length + 1 }, (_, trackIndex) =>
      [`${face}-track-${trackIndex}`, collapsedLongitude] as const,
    );
  }

  let travelledWeight = 0;

  return Array.from({ length: gapPattern.length + 1 }, (_, trackIndex) => {
    if (trackIndex > 0) {
      travelledWeight += intervalWeights[trackIndex - 1] ?? 0;
    }

    const longitude =
      faceStart + facePadding + (travelledWeight / totalWeight) * availableSpan;

    return [`${face}-track-${trackIndex}`, longitude] as const;
  });
};

const getTrackLongitudes = (deformation: DeformationSettings) =>
  new Map<string, number>([
    ...getFaceTrackLongitudes(0, "dense", DENSE_FACE_GAPS, deformation),
    ...getFaceTrackLongitudes(
      Math.PI,
      "sparse",
      SPARSE_FACE_GAPS,
      deformation,
    ),
  ]);

const rotateHorizontally = (point: Coordinates, angle: number): Coordinates => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
};

const getSingleBumpInfluence = (
  progress: number,
  bumpCenter: number,
  width: number,
  smoothness: number,
) => {
  if (progress <= 0 || progress >= 1) return 0;

  // Width is shared by two separate lobes, so 100% occupies one half of the
  // meridian rather than merging the top and bottom curves into one bump.
  const halfWidth = Math.max(width / 400, 0.025);
  const bumpStart = Math.max(0, bumpCenter - halfWidth);
  const bumpEnd = Math.min(1, bumpCenter + halfWidth);

  if (progress <= bumpStart || progress >= bumpEnd) return 0;

  const rising = progress <= bumpCenter;
  const sideProgress = rising
    ? (progress - bumpStart) / Math.max(bumpCenter - bumpStart, 0.001)
    : (bumpEnd - progress) / Math.max(bumpEnd - bumpCenter, 0.001);
  const normalizedSmoothness = (clamp(smoothness, 1, 8) - 1) / 7;
  const shapeExponent = 2.6 - normalizedSmoothness * 1.8;
  const shapedProgress = Math.pow(clamp(sideProgress, 0, 1), shapeExponent);

  // This is the x component of a cubic Bezier whose horizontal handles sit
  // on the start and end positions. Its derivative is zero at the straight
  // sections and at the peak, so there are no visible corners or kinks.
  return shapedProgress ** 2 * (3 - 2 * shapedProgress);
};

const getBumpInfluences = (
  progress: number,
  topBumpPosition: number,
  bottomBumpPosition: number,
  width: number,
  smoothness: number,
) => {
  const topCenter = clamp(topBumpPosition / 100, 0, 1);
  const bottomCenter = clamp(bottomBumpPosition / 100, 0, 1);
  const topInfluence = getSingleBumpInfluence(
    progress,
    topCenter,
    width,
    smoothness,
  );
  const bottomInfluence = getSingleBumpInfluence(
    progress,
    bottomCenter,
    width,
    smoothness,
  );

  return { bottomInfluence, topInfluence };
};

const wrapLongitude = (longitude: number) =>
  ((longitude % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;

const getTwistRadians = (amount: number) =>
  MAX_TWIST_RADIANS * Math.tanh(amount / TWIST_INPUT_SCALE);

const getDeformedLongitude = (
  point: SpherePoint,
  faceBulge: number,
  baseLongitude: number,
  deformation: DeformationSettings,
) => {
  const bulgeOffset = faceBulge * Math.sin(point.polarAngle);
  const { bottomInfluence, topInfluence } = getBumpInfluences(
    point.progress,
    deformation.topBumpPosition,
    deformation.bottomBumpPosition,
    deformation.width,
    deformation.smoothness,
  );
  const surfaceTwist =
    getTwistRadians(deformation.topBumpAmount) * topInfluence -
    getTwistRadians(deformation.bottomBumpAmount) * bottomInfluence;

  return wrapLongitude(baseLongitude + bulgeOffset - surfaceTwist);
};

const projectPoint = (
  point: SpherePoint,
  angle: number,
  faceBulge: number,
  deformation: DeformationSettings,
  baseLongitude: number,
): ProjectedPoint => {
  const longitude = getDeformedLongitude(
    point,
    faceBulge,
    baseLongitude,
    deformation,
  );
  const ringRadius = Math.sin(point.polarAngle);
  const rotatedPoint = rotateHorizontally(
    {
      x: ringRadius * Math.cos(longitude),
      y: Math.cos(point.polarAngle),
      z: ringRadius * Math.sin(longitude),
    },
    angle,
  );
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
  duration = REFERENCE_ROTATION_DURATION,
  className = "",
}: TextSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const requestRenderRef = useRef<() => void>(() => undefined);
  const deformationRef = useRef<DeformationSettings>({ ...REFERENCE_PRESET });
  const [topBumpPosition, setTopBumpPosition] = useState(
    REFERENCE_PRESET.topBumpPosition,
  );
  const [bottomBumpPosition, setBottomBumpPosition] = useState(
    REFERENCE_PRESET.bottomBumpPosition,
  );
  const [bumpWidth, setBumpWidth] = useState(REFERENCE_PRESET.width);
  const [bumpSmoothness, setBumpSmoothness] = useState(
    REFERENCE_PRESET.smoothness,
  );
  const [lineGapWeight, setLineGapWeight] = useState(
    REFERENCE_PRESET.lineGapWeight,
  );
  const [customGapWeight, setCustomGapWeight] = useState(
    REFERENCE_PRESET.customGapWeight,
  );
  const [sectionGapDegrees, setSectionGapDegrees] = useState(
    REFERENCE_PRESET.sectionGapDegrees,
  );
  const [denseBulge, setDenseBulge] = useState(REFERENCE_PRESET.denseBulge);
  const [sparseBulge, setSparseBulge] = useState(REFERENCE_PRESET.sparseBulge);
  const spherePoints = useMemo(() => createSpherePoints(word), [word]);

  const handleTopBumpAmountChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextInput = event.currentTarget.value;

    if (nextInput.trim() === "") return;

    const nextAmount = Number(nextInput);
    if (!Number.isFinite(nextAmount)) return;

    deformationRef.current.topBumpAmount = nextAmount;
    requestRenderRef.current();
  };

  const handleBottomBumpAmountChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextInput = event.currentTarget.value;

    if (nextInput.trim() === "") return;

    const nextAmount = Number(nextInput);
    if (!Number.isFinite(nextAmount)) return;

    deformationRef.current.bottomBumpAmount = nextAmount;
    requestRenderRef.current();
  };

  const handleTopBumpPositionChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextPosition = Number(event.currentTarget.value);
    deformationRef.current.topBumpPosition = nextPosition;
    setTopBumpPosition(nextPosition);
    requestRenderRef.current();
  };

  const handleBottomBumpPositionChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextPosition = Number(event.currentTarget.value);
    deformationRef.current.bottomBumpPosition = nextPosition;
    setBottomBumpPosition(nextPosition);
    requestRenderRef.current();
  };

  const handleBumpWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextWidth = Number(event.currentTarget.value);
    deformationRef.current.width = nextWidth;
    setBumpWidth(nextWidth);
    requestRenderRef.current();
  };

  const handleBumpSmoothnessChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextSmoothness = Number(event.currentTarget.value);
    deformationRef.current.smoothness = nextSmoothness;
    setBumpSmoothness(nextSmoothness);
    requestRenderRef.current();
  };

  const handleLineGapChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextLineGapWeight = Number(event.currentTarget.value);
    deformationRef.current.lineGapWeight = nextLineGapWeight;
    setLineGapWeight(nextLineGapWeight);
    requestRenderRef.current();
  };

  const handleCustomGapChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextCustomGapWeight = Number(event.currentTarget.value);
    deformationRef.current.customGapWeight = nextCustomGapWeight;
    setCustomGapWeight(nextCustomGapWeight);
    requestRenderRef.current();
  };

  const handleSectionGapChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextSectionGapDegrees = Number(event.currentTarget.value);
    deformationRef.current.sectionGapDegrees = nextSectionGapDegrees;
    setSectionGapDegrees(nextSectionGapDegrees);
    requestRenderRef.current();
  };

  const handleDenseBulgeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextBulge = Number(event.currentTarget.value);
    deformationRef.current.denseBulge = nextBulge;
    setDenseBulge(nextBulge);
    requestRenderRef.current();
  };

  const handleSparseBulgeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextBulge = Number(event.currentTarget.value);
    deformationRef.current.sparseBulge = nextBulge;
    setSparseBulge(nextBulge);
    requestRenderRef.current();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const safeDuration = Math.max(duration, 0.1) * 1000;
    let canvasFontFamily = "Arial, Helvetica, sans-serif";
    let canvasHeight = 0;
    let canvasWidth = 0;
    let disposed = false;
    let frameScheduled = false;
    let isVisible = true;
    let previousTimestamp: number | null = null;
    let rotationElapsed = 0;

    const renderFrame = (timestamp: number) => {
      frameScheduled = false;
      if (disposed || !isVisible || canvasWidth === 0 || canvasHeight === 0) {
        return;
      }

      if (previousTimestamp !== null && !reducedMotionQuery.matches) {
        rotationElapsed += timestamp - previousTimestamp;
      }
      previousTimestamp = timestamp;

      const angle = reducedMotionQuery.matches
        ? 0
        : (rotationElapsed / safeDuration) * FULL_ROTATION;
      const deformation = deformationRef.current;
      const trackLongitudes = getTrackLongitudes(deformation);
      const projectedCharacters: ProjectedCharacter[] = spherePoints.map(
        (point) => {
          const faceBulge =
            point.face === "dense"
              ? deformation.denseBulge
              : deformation.sparseBulge;
          const projectedPoint = projectPoint(
            point,
            angle,
            faceBulge,
            deformation,
            trackLongitudes.get(point.trackId) ?? 0,
          );

          return {
            ...projectedPoint,
            character: point.character,
            opacityVariation: point.opacityVariation,
            sizeVariation: point.sizeVariation,
          };
        },
      );

      projectedCharacters.sort(
        (firstCharacter, secondCharacter) =>
          firstCharacter.depth - secondCharacter.depth,
      );

      const logicalScale =
        Math.min(canvasWidth, canvasHeight) / VIEWBOX_SIZE;
      const horizontalOffset =
        (canvasWidth - VIEWBOX_SIZE * logicalScale) / 2;
      const verticalOffset =
        (canvasHeight - VIEWBOX_SIZE * logicalScale) / 2;

      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      let activeFont = "";

      projectedCharacters.forEach((projectedCharacter) => {
        const rawFontSize =
          BASE_FONT_SIZE *
            projectedCharacter.scale *
            projectedCharacter.sizeVariation *
          logicalScale;
        const fontSize = Math.max(1, Math.round(rawFontSize * 2) / 2);
        const opacity = clamp(
          (0.055 + Math.pow(projectedCharacter.depth, 1.5) * 0.945) *
            projectedCharacter.opacityVariation,
          0.04,
          1,
        );

        context.globalAlpha = opacity;
        const nextFont = `500 ${fontSize.toFixed(1)}px ${canvasFontFamily}`;
        if (nextFont !== activeFont) {
          activeFont = nextFont;
          context.font = nextFont;
        }
        context.fillText(
          projectedCharacter.character,
          horizontalOffset + projectedCharacter.x * logicalScale,
          verticalOffset + projectedCharacter.y * logicalScale,
        );
      });

      context.globalAlpha = 1;

      if (reducedMotionQuery.matches || disposed || !isVisible) return;
      frameScheduled = true;
      animationFrameRef.current = window.requestAnimationFrame(renderFrame);
    };

    const scheduleFrame = () => {
      if (disposed || frameScheduled || !isVisible) return;

      frameScheduled = true;
      animationFrameRef.current = window.requestAnimationFrame(renderFrame);
    };

    const syncCanvasSize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
      canvasFontFamily = window.getComputedStyle(canvas).fontFamily;
      canvasWidth = bounds.width;
      canvasHeight = bounds.height;

      const pixelWidth = Math.round(canvasWidth * pixelRatio);
      const pixelHeight = Math.round(canvasHeight * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      scheduleFrame();
    };

    const handleReducedMotionChange = () => {
      previousTimestamp = null;
      scheduleFrame();
    };
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const nextVisibility = entry?.isIntersecting ?? true;
        if (nextVisibility === isVisible) return;

        isVisible = nextVisibility;
        previousTimestamp = null;

        if (!isVisible && animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
          frameScheduled = false;
          return;
        }

        scheduleFrame();
      },
      { rootMargin: "100px" },
    );

    requestRenderRef.current = scheduleFrame;
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    syncCanvasSize();

    void document.fonts.ready.then(() => {
      if (disposed) return;
      scheduleFrame();
    });

    return () => {
      disposed = true;
      requestRenderRef.current = () => undefined;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotionQuery.removeEventListener(
        "change",
        handleReducedMotionChange,
      );

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
    };
  }, [duration, spherePoints]);

  return (
    <div className={`relative size-full ${className}`}>
      <canvas
        aria-label={`A rotating sphere made from repetitions of the word ${word}`}
        className="block size-full font-sans"
        ref={canvasRef}
        role="img"
      >
        A rotating text sphere made from repetitions of the word {word}.
      </canvas>

      <fieldset className="absolute right-3 top-3 z-10 w-52 rounded-xl border border-white/15 bg-black/75 p-3 text-white shadow-lg shadow-black/30 backdrop-blur-sm sm:left-[calc(100%+1rem)] sm:right-auto sm:top-1/2 sm:max-h-[calc(100svh-4rem)] sm:-translate-y-1/2 sm:overflow-y-auto">
        <legend className="sr-only">Sphere bulge controls</legend>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-xs font-medium"
                htmlFor="top-bump-amount"
              >
                Top bump
              </label>
              <span className="text-[10px] text-white/45">No limit</span>
            </div>
            <input
              aria-describedby="top-bump-amount-description"
              className="block h-9 w-full rounded-md border border-white/20 bg-white/10 px-2.5 font-mono text-sm text-white outline-none placeholder:text-white/30 focus:border-white/60 focus-visible:ring-2 focus-visible:ring-white/70"
              defaultValue={REFERENCE_PRESET.topBumpAmount}
              id="top-bump-amount"
              inputMode="decimal"
              onChange={handleTopBumpAmountChange}
              placeholder="0"
              step="any"
              type="number"
            />
            <p
              className="text-[10px] leading-4 text-white/45"
              id="top-bump-amount-description"
            >
              Positive twists the top right; negative twists it left.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-xs font-medium"
                htmlFor="bottom-bump-amount"
              >
                Bottom bump
              </label>
              <span className="text-[10px] text-white/45">No limit</span>
            </div>
            <input
              aria-describedby="bottom-bump-amount-description"
              className="block h-9 w-full rounded-md border border-white/20 bg-white/10 px-2.5 font-mono text-sm text-white outline-none placeholder:text-white/30 focus:border-white/60 focus-visible:ring-2 focus-visible:ring-white/70"
              defaultValue={REFERENCE_PRESET.bottomBumpAmount}
              id="bottom-bump-amount"
              inputMode="decimal"
              onChange={handleBottomBumpAmountChange}
              placeholder="0"
              step="any"
              type="number"
            />
            <p
              className="text-[10px] leading-4 text-white/45"
              id="bottom-bump-amount-description"
            >
              Positive twists the bottom left; negative twists it right.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-xs font-medium"
                htmlFor="top-bump-position"
              >
                Top bump position
              </label>
              <output
                className="font-mono text-[10px] text-white/60"
                htmlFor="top-bump-position"
              >
                {topBumpPosition}%
              </output>
            </div>
            <input
              aria-valuetext={`Top bump at ${topBumpPosition} percent`}
              className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              id="top-bump-position"
              max="100"
              min="0"
              onChange={handleTopBumpPositionChange}
              step="1"
              type="range"
              value={topBumpPosition}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-xs font-medium"
                htmlFor="bottom-bump-position"
              >
                Bottom bump position
              </label>
              <output
                className="font-mono text-[10px] text-white/60"
                htmlFor="bottom-bump-position"
              >
                {bottomBumpPosition}%
              </output>
            </div>
            <input
              aria-valuetext={`Bottom bump at ${bottomBumpPosition} percent`}
              className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              id="bottom-bump-position"
              max="100"
              min="0"
              onChange={handleBottomBumpPositionChange}
              step="1"
              type="range"
              value={bottomBumpPosition}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium" htmlFor="bump-width">
                Bump width
              </label>
              <output
                className="font-mono text-[10px] text-white/60"
                htmlFor="bump-width"
              >
                {bumpWidth}%
              </output>
            </div>
            <input
              aria-valuetext={`${bumpWidth} percent`}
              className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              id="bump-width"
              max="100"
              min="10"
              onChange={handleBumpWidthChange}
              step="1"
              type="range"
              value={bumpWidth}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium" htmlFor="bump-smoothness">
                Bump smoothness
              </label>
              <output
                className="font-mono text-[10px] text-white/60"
                htmlFor="bump-smoothness"
              >
                {bumpSmoothness}
              </output>
            </div>
            <input
              aria-valuetext={`${bumpSmoothness} of 8`}
              className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              id="bump-smoothness"
              max="8"
              min="1"
              onChange={handleBumpSmoothnessChange}
              step="1"
              type="range"
              value={bumpSmoothness}
            />
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
              Meridian spacing
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium" htmlFor="line-gap">
                    Line gap
                  </label>
                  <output
                    className="font-mono text-[10px] text-white/60"
                    htmlFor="line-gap"
                  >
                    {lineGapWeight.toFixed(0)}
                  </output>
                </div>
                <input
                  aria-valuetext={`${lineGapWeight.toFixed(0)} of 100 line gap`}
                  className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  id="line-gap"
                  max="100"
                  min="0"
                  onChange={handleLineGapChange}
                  step="1"
                  type="range"
                  value={lineGapWeight}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium" htmlFor="custom-gap">
                    Custom gap
                  </label>
                  <output
                    className="font-mono text-[10px] text-white/60"
                    htmlFor="custom-gap"
                  >
                    {customGapWeight.toFixed(0)}
                  </output>
                </div>
                <input
                  aria-valuetext={`${customGapWeight.toFixed(0)} of 100 custom gap`}
                  className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  id="custom-gap"
                  max="100"
                  min="0"
                  onChange={handleCustomGapChange}
                  step="1"
                  type="range"
                  value={customGapWeight}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium" htmlFor="section-gap">
                    Section gap
                  </label>
                  <output
                    className="font-mono text-[10px] text-white/60"
                    htmlFor="section-gap"
                  >
                    {sectionGapDegrees.toFixed(1)}°
                  </output>
                </div>
                <input
                  aria-valuetext={`${sectionGapDegrees.toFixed(1)} degrees between dense and sparse sections`}
                  className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  id="section-gap"
                  max="100"
                  min="0"
                  onChange={handleSectionGapChange}
                  step="0.5"
                  type="range"
                  value={sectionGapDegrees}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium" htmlFor="dense-bulge">
                Dense bulge
              </label>
              <output
                className="font-mono text-[10px] text-white/60"
                htmlFor="dense-bulge"
              >
                {denseBulge.toFixed(2)}
              </output>
            </div>
            <input
              aria-valuetext={`${denseBulge.toFixed(2)} radians`}
              className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              id="dense-bulge"
              max={MAX_FACE_BULGE}
              min={-MAX_FACE_BULGE}
              onChange={handleDenseBulgeChange}
              step="0.01"
              type="range"
              value={denseBulge}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium" htmlFor="sparse-bulge">
                Sparse bulge
              </label>
              <output
                className="font-mono text-[10px] text-white/60"
                htmlFor="sparse-bulge"
              >
                {sparseBulge.toFixed(2)}
              </output>
            </div>
            <input
              aria-valuetext={`${sparseBulge.toFixed(2)} radians`}
              className="block h-5 w-full cursor-pointer accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              id="sparse-bulge"
              max={MAX_FACE_BULGE}
              min={-MAX_FACE_BULGE}
              onChange={handleSparseBulgeChange}
              step="0.01"
              type="range"
              value={sparseBulge}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
