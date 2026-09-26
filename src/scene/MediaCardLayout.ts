import type { MediaItem } from '../config';

export interface MediaCardPlacement {
  volume: [number, number, number];
  angle: number;
  seed: number;
  sizeFactor: number;
}

export type Position3 = readonly [number, number, number];

export interface ProjectedCardBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly depth: number;
}

export interface CenterSelectionOptions {
  readonly aimRadius?: number;
  readonly minVisibleRatio?: number;
}

export function centerMostVisibleCardIndex(
  positions: readonly Position3[],
  projectedBounds: readonly ProjectedCardBounds[],
  viewer: Position3,
  options: CenterSelectionOptions = {},
): number {
  let selectedIndex = -1;
  let smallestCenterDistance = Number.POSITIVE_INFINITY;
  let smallestViewerDistance = Number.POSITIVE_INFINITY;
  const aimRadius = options.aimRadius ?? 0.18;
  const minVisibleRatio = options.minVisibleRatio ?? 0.55;
  const safeViewportEdge = 0.92;
  const centerTieEpsilon = 1e-6;

  projectedBounds.forEach((bounds, index) => {
    const position = positions[index];
    if (!position || bounds.depth < -1 || bounds.depth > 1) return;

    const width = Math.max(1e-6, bounds.maxX - bounds.minX);
    const height = Math.max(1e-6, bounds.maxY - bounds.minY);
    const visibleWidth = Math.max(
      0,
      Math.min(bounds.maxX, safeViewportEdge)
        - Math.max(bounds.minX, -safeViewportEdge),
    );
    const visibleHeight = Math.max(
      0,
      Math.min(bounds.maxY, safeViewportEdge)
        - Math.max(bounds.minY, -safeViewportEdge),
    );
    const visibleRatio = (visibleWidth * visibleHeight) / (width * height);
    if (visibleRatio < minVisibleRatio) return;

    const distanceX = bounds.minX > 0
      ? bounds.minX
      : bounds.maxX < 0
        ? -bounds.maxX
        : 0;
    const distanceY = bounds.minY > 0
      ? bounds.minY
      : bounds.maxY < 0
        ? -bounds.maxY
        : 0;
    const centerDistance = distanceX ** 2 + distanceY ** 2;
    if (centerDistance > aimRadius ** 2) return;

    const viewerDistance =
      (position[0] - viewer[0]) ** 2
      + (position[1] - viewer[1]) ** 2
      + (position[2] - viewer[2]) ** 2;
    const moreCentered = centerDistance < smallestCenterDistance - centerTieEpsilon;
    const equallyCentered = Math.abs(centerDistance - smallestCenterDistance) <= centerTieEpsilon;
    if (moreCentered || (equallyCentered && viewerDistance < smallestViewerDistance)) {
      selectedIndex = index;
      smallestCenterDistance = centerDistance;
      smallestViewerDistance = viewerDistance;
    }
  });
  return selectedIndex;
}

export function selectSceneMediaItems(
  items: readonly MediaItem[],
): MediaItem[] {
  return items.filter((item) => Boolean(scenePreviewSource(item)));
}

export function scenePreviewSource(item: MediaItem): string | undefined {
  if (item.kind === 'image') return item.src;
  return item.poster ?? item.thumbnail;
}

export function createMediaCardPlacements(
  requestedCount: number,
  viewportAspect: number,
): MediaCardPlacement[] {
  const count = Math.max(0, Math.floor(requestedCount));
  if (count === 0) return [];

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const random = mulberry32(0x50484f54);
  return Array.from({ length: count }, (_, index) => {
    const normalizedRadius = Math.sqrt((index + 0.5) / count);
    const radial = normalizedRadius * 0.96;
    const angle = index * goldenAngle;
    const x = Math.cos(angle) * radial;
    const y = Math.sin(angle) * radial;
    const depthEnvelope = Math.sqrt(Math.max(0.08, 1 - radial * radial));
    const z = (radicalInverse(index + 1, 2) * 2 - 1) * depthEnvelope;
    const seed = random();
    return {
      volume: [x, y, z],
      angle: (random() - 0.5) * 0.16,
      seed,
      sizeFactor: 0.9 + random() * 0.2,
    };
  });
}

function radicalInverse(index: number, base: number): number {
  let fraction = 1;
  let result = 0;
  while (index > 0) {
    fraction /= base;
    result += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return result;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
