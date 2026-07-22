# Text Sphere Technical Reference

## Runtime

- Next.js `16.2.10`
- React `19.2.4`
- TypeScript
- Tailwind CSS `4`
- Native Canvas 2D API
- No rendering or 3D dependency is used by the text sphere.

The implementation is in [`components/text-sphere.tsx`](components/text-sphere.tsx). The standalone development route is [`app/text-sphere/page.tsx`](app/text-sphere/page.tsx) and is available at `/text-sphere`.

## Component API

```tsx
type TextSphereProps = {
  word?: string;
  duration?: number;
  className?: string;
};
```

| Prop | Type | Default | Behavior |
| --- | --- | --- | --- |
| `word` | `string` | `"dream"` | Source characters repeated across every meridian. An empty string falls back to `"dream"`. |
| `duration` | `number` | `6.28` | Seconds per complete horizontal revolution. Values below `0.1` seconds are clamped to `0.1`. |
| `className` | `string` | `""` | Additional classes applied to the root container. |

```tsx
import TextSphere from "@/components/text-sphere";

export default function Page() {
  return <TextSphere word="dream" duration={6.28} className="size-full" />;
}
```

The component and canvas use `size-full`; the parent must provide a measurable width and height.

## Reference Preset

```ts
const REFERENCE_PRESET = {
  topBumpAmount: 900,
  bottomBumpAmount: 300,
  topBumpPosition: 35,
  bottomBumpPosition: 64,
  width: 100,
  smoothness: 4,
  lineGapWeight: 1,
  customGapWeight: 3,
  sectionGapDegrees: 2.5,
  denseBulge: 0,
  sparseBulge: 0,
};
```

## Geometry Model

### Meridian topology

The sphere contains two longitudinal faces:

- Dense face: 17 meridians and 333 characters.
- Sparse face: 9 meridians and 127 characters.
- Total: 26 meridians and 460 characters.

Each meridian has its own sample count. Samples are distributed from the north pole to the south pole with normalized progress `p` in `[0, 1]`:

```ts
polarAngle = p * Math.PI;
ringRadius = Math.sin(polarAngle);

x = ringRadius * Math.cos(longitude);
y = Math.cos(polarAngle);
z = ringRadius * Math.sin(longitude);
```

All meridians converge naturally because `ringRadius` is zero at both poles. Characters remain camera-facing because they are drawn as upright Canvas 2D glyphs after projection instead of being rotated as 3D geometry.

Characters are assigned sequentially from `word`. Size and opacity variation are deterministic functions of the point index, so the distribution is organic but stable across renders:

```ts
sizeVariation = 0.9 ... 1.1;
opacityVariation = 0.86 ... 1.0;
```

### Dense and sparse face spacing

Each face occupies a nominal longitude span of `π` radians. `sectionGapDegrees` removes the same angular amount from each face span and applies half of that amount as padding at each face boundary:

```ts
sectionGap = clamp(sectionGapDegrees, 0, 100) * Math.PI / 180;
facePadding = sectionGap / 2;
availableSpan = Math.PI - sectionGap;
```

Track positions are calculated from cumulative interval weights:

```ts
longitude =
  faceStart +
  facePadding +
  (travelledWeight / totalWeight) * availableSpan;
```

`lineGapWeight` is assigned to normal intervals. `customGapWeight` is assigned only to these intervals:

| Face | Custom interval locations |
| --- | --- |
| Dense | Between meridians 4–5 and 13–14 |
| Sparse | Between meridians 2–3 and 6–7 |

The weights are relative. With line gap `1` and custom gap `3`, a custom interval receives three times the angular space of a normal interval. A value of `0` collapses that interval.

If both interval weights are `0`, all tracks in a face collapse to a shared boundary longitude. This special case avoids division by zero and preserves true zero-gap behavior.

## Surface-Attached S-Curve

The curve is applied to longitude before horizontal rotation and perspective projection. It is therefore attached to the spherical surface and rotates with the dense and sparse faces.

### Influence envelope

Top and bottom bumps use independent vertical centers but share width and smoothness. For each bump:

```ts
halfWidth = Math.max(width / 400, 0.025);
bumpStart = Math.max(0, bumpCenter - halfWidth);
bumpEnd = Math.min(1, bumpCenter + halfWidth);
```

Influence is zero outside `[bumpStart, bumpEnd]`. Inside the interval, progress rises from `0` to `1` at the center and falls back to `0`. Smoothness changes the envelope exponent:

```ts
normalizedSmoothness = (clamp(smoothness, 1, 8) - 1) / 7;
shapeExponent = 2.6 - normalizedSmoothness * 1.8;
shapedProgress = clamp(sideProgress, 0, 1) ** shapeExponent;
influence = shapedProgress ** 2 * (3 - 2 * shapedProgress);
```

The final expression is cubic smoothstep. Its derivative is zero at the straight sections and at the peak, preventing corners or visible kinks. Influence is explicitly zero at `p = 0` and `p = 1`, so pole positions remain fixed.

### Independent twist amounts

The numeric top and bottom inputs are unbounded, but their angular output is smoothly limited:

```ts
twistRadians(amount) = 0.5 * Math.tanh(amount / 180);
```

This maps any finite input into `(-0.5, 0.5)` radians. Large values approach the limit without clipping or discontinuities.

The two lobes are combined with opposite signs:

```ts
surfaceTwist =
  twistRadians(topBumpAmount) * topInfluence -
  twistRadians(bottomBumpAmount) * bottomInfluence;
```

Positive top values twist the upper lobe right. Positive bottom values twist the lower lobe left. Negative values reverse the direction of the corresponding lobe.

### Per-face bulge

Dense and sparse faces can also receive independent meridian-wide offsets:

```ts
bulgeOffset = faceBulge * Math.sin(polarAngle);
longitude = wrap(baseLongitude + bulgeOffset - surfaceTwist);
```

Multiplication by `sin(polarAngle)` keeps both poles fixed. Longitude is wrapped into `[0, 2π)` rather than clamped to a face boundary, allowing the complete curve to remain smooth.

## Rotation and Projection

The sphere rotates at constant angular velocity around the vertical axis:

```ts
angle = rotationElapsed / (duration * 1000) * Math.PI * 2;

rotatedX = x * Math.cos(angle) + z * Math.sin(angle);
rotatedY = y;
rotatedZ = -x * Math.sin(angle) + z * Math.cos(angle);
```

Perspective and normalized depth are calculated from the rotated point:

```ts
perspective = 8 / (8 - rotatedZ * 0.38);
depth = (rotatedZ + 1) / 2;

screenX = 360 + rotatedX * 276 * perspective;
screenY = 360 - rotatedY * 276 * perspective;
glyphScale = 0.45 + depth * 0.76;
```

The logical coordinate system is `720 × 720` with a sphere radius of `276`. The logical square is scaled by the smaller rendered canvas dimension and centered on the remaining axis.

## Canvas Rendering

Each animation frame performs the following operations:

1. Calculate the current horizontal rotation.
2. Recalculate dense and sparse track longitudes from the current spacing controls.
3. Apply face bulge and independent top/bottom surface twists.
4. Convert each point to spherical Cartesian coordinates.
5. Rotate and project every character.
6. Sort characters by ascending depth so rear glyphs draw first.
7. Clear the canvas and draw camera-facing glyphs.
8. Schedule the next `requestAnimationFrame` when motion is enabled and the canvas is visible.

Font size is depth-aware and rounded to half-pixel increments:

```ts
fontSize =
  19 *
  glyphScale *
  sizeVariation *
  logicalCanvasScale;
```

Opacity uses a nonlinear depth curve:

```ts
opacity = clamp(
  (0.055 + depth ** 1.5 * 0.945) * opacityVariation,
  0.04,
  1,
);
```

Rear characters are smaller and dimmer; front characters are larger and brighter. The canvas uses centered text alignment, a middle baseline, white fill, and font weight `500`.

## Rendering Lifecycle

- `requestAnimationFrame` owns continuous rotation; React state is not updated per frame.
- Mutable deformation values are stored in `deformationRef` so controls can redraw without recreating the animation effect.
- Slider state is used only to render current output labels and controlled input values.
- Top and bottom numeric bump inputs write directly to `deformationRef` and request a frame.
- `ResizeObserver` tracks CSS dimensions.
- The backing bitmap is multiplied by `devicePixelRatio`; `context.setTransform` keeps drawing coordinates in CSS pixels.
- `document.fonts.ready` requests another frame after the active font finishes loading.
- `IntersectionObserver` pauses rendering when the canvas leaves the viewport and resumes within a `100px` root margin.
- `prefers-reduced-motion: reduce` freezes the rotation at angle `0` while preserving the rendered sphere and live control updates.
- Effect cleanup disconnects observers, removes listeners, and cancels any pending animation frame.

Point generation is memoized by `word`. Per-frame projection is `O(n)` and depth sorting is `O(n log n)` for `n = 460` glyphs.

## Controls

| Control | Input | Range | Step | Default | Geometry effect |
| --- | --- | --- | --- | --- | --- |
| Top bump | Number | Any finite signed value | Any | `900` | Sets the upper lobe twist. Positive bends right; negative bends left. Output saturates toward ±`0.5` radians. |
| Bottom bump | Number | Any finite signed value | Any | `300` | Sets the lower lobe twist. Positive bends left; negative bends right. Output saturates toward ±`0.5` radians. |
| Top bump position | Range | `0–100%` | `1` | `35%` | Sets the upper influence center along north-to-south meridian progress. |
| Bottom bump position | Range | `0–100%` | `1` | `64%` | Sets the lower influence center along north-to-south meridian progress. |
| Bump width | Range | `10–100%` | `1` | `100%` | Sets the shared vertical support of both influence envelopes. `100%` occupies one half-meridian per lobe. |
| Bump smoothness | Range | `1–8` | `1` | `4` | Changes the envelope exponent. Higher values create a wider, rounder rise; lower values concentrate the bend. |
| Line gap | Range | `0–100` | `1` | `1` | Relative weight of every normal meridian interval. |
| Custom gap | Range | `0–100` | `1` | `3` | Relative weight of the four designated larger intervals. |
| Section gap | Range | `0–100°` | `0.5°` | `2.5°` | Angular separation reserved between dense and sparse faces. |
| Dense bulge | Range | `-0.28–0.28 rad` | `0.01` | `0` | Applies a shared middle-weighted longitude offset to dense meridians. |
| Sparse bulge | Range | `-0.28–0.28 rad` | `0.01` | `0` | Applies a shared middle-weighted longitude offset to sparse meridians. |

Controls redraw live. The panel is overlaid at the top-right on small viewports and positioned outside the component's right edge at the `sm` breakpoint when layout space is available.

## Accessibility

- The canvas has `role="img"`, a word-specific `aria-label`, and fallback text.
- Controls are grouped in a `fieldset` with a screen-reader legend.
- Every input has an explicit label.
- Range controls expose current semantic values through `aria-valuetext`.
- Numeric bump inputs use descriptions that state their signed direction.
- Visible keyboard focus styles are provided for all inputs.
- Reduced-motion preferences disable continuous rotation.

## Development

```bash
pnpm dev
```

Open `http://localhost:3000/text-sphere`.

## Verification

```bash
pnpm exec eslint components/text-sphere.tsx
pnpm exec tsc --noEmit
git diff --check
pnpm build
```
