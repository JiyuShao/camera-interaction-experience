import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../config';
import {
  centerMostVisibleCardIndex,
  createMediaCardPlacements,
  scenePreviewSource,
  selectSceneMediaItems,
} from './MediaCardLayout';

describe('selectSceneMediaItems', () => {
  it('keeps every previewable memory in source order for the scattered scene', () => {
    const items = Array.from({ length: 16 }, (_, index): MediaItem => ({
      kind: 'image',
      src: `/memory-${index + 1}.jpg`,
      thumbnail: `/memory-${index + 1}-thumb.jpg`,
      alt: `memory ${index + 1}`,
      sceneFeatured: [0, 2, 4, 6, 9, 15].includes(index),
    }));

    expect(selectSceneMediaItems(items).map((item) => item.src)).toEqual(
      items.map((item) => item.src),
    );
  });

  it('evenly distributes every memory inside a narrow mobile viewport', () => {
    const placements = createMediaCardPlacements(16, 390 / 844);

    const distances = placements.flatMap((placement, index) =>
      placements.slice(index + 1).map((other) => Math.hypot(
        placement.volume[0] - other.volume[0],
        placement.volume[1] - other.volume[1],
        placement.volume[2] - other.volume[2],
      )),
    );
    const depths = placements.map(({ volume }) => volume[2]);
    const horizontal = placements.map(({ volume }) => volume[0]);
    const vertical = placements.map(({ volume }) => volume[1]);

    expect(placements).toHaveLength(16);
    expect(placements.every(({ volume: [x, y, z] }) => (
      Math.abs(x) <= 0.98 && Math.abs(y) <= 0.98 && Math.abs(z) <= 1
    ))).toBe(true);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(1.1);
    expect(Math.max(...horizontal) - Math.min(...horizontal)).toBeGreaterThan(1.5);
    expect(Math.max(...vertical) - Math.min(...vertical)).toBeGreaterThan(1.5);
    expect(new Set(depths.map((depth) => depth.toFixed(2))).size).toBeGreaterThan(8);
    expect(Math.min(...distances)).toBeGreaterThan(0.2);
  });

  it('recomputes the volume from the current material count', () => {
    const five = createMediaCardPlacements(5, 390 / 844);
    const sixteen = createMediaCardPlacements(16, 390 / 844);

    expect(five).toHaveLength(5);
    expect(sixteen).toHaveLength(16);
    expect(five.map(({ volume }) => volume)).not.toEqual(sixteen.slice(0, 5).map(({ volume }) => volume));
  });

  it('uses full-resolution image sources and the best available video cover', () => {
    expect(scenePreviewSource({
      kind: 'image',
      src: '/full.jpg',
      thumbnail: '/thumb.jpg',
      alt: 'full image',
    })).toBe('/full.jpg');
    expect(scenePreviewSource({
      kind: 'video',
      src: '/clip.mp4',
      thumbnail: '/thumb.jpg',
      poster: '/poster.jpg',
      alt: 'video',
    })).toBe('/poster.jpg');
  });

  it('selects the visible card closest to the camera view center', () => {
    expect(centerMostVisibleCardIndex(
      [[0, 0, 3.5], [0, 0, 2], [0, 0, 1]],
      [
        { minX: 1.1, maxX: 1.3, minY: -0.1, maxY: 0.1, depth: 0 },
        { minX: 0.48, maxX: 0.62, minY: -0.28, maxY: -0.12, depth: 0 },
        { minX: -0.14, maxX: -0.02, minY: -0.04, maxY: 0.12, depth: 0 },
      ],
      [0, 0, 4],
    )).toBe(2);
  });

  it('uses camera distance only to break a near-equal center tie', () => {
    expect(centerMostVisibleCardIndex(
      [[0, 0, 2], [0, 0, 3.5]],
      [
        { minX: 0.1, maxX: 0.2, minY: 0.1, maxY: 0.2, depth: 0 },
        { minX: -0.2, maxX: -0.1, minY: -0.2, maxY: -0.1, depth: 0 },
      ],
      [0, 0, 4],
    )).toBe(1);
  });

  it('uses the closest visible card edge rather than only its center', () => {
    expect(centerMostVisibleCardIndex(
      [[0, 0, 3], [0, 0, 3]],
      [
        { minX: -0.03, maxX: 0.47, minY: -0.08, maxY: 0.08, depth: 0.3 },
        { minX: -0.16, maxX: -0.08, minY: -0.08, maxY: 0.08, depth: 0.3 },
      ],
      [0, 0, 0],
    )).toBe(0);
  });

  it('does not select cards outside the central aim zone', () => {
    expect(centerMostVisibleCardIndex(
      [[0, 0, 3]],
      [{ minX: 0.48, maxX: 0.62, minY: -0.08, maxY: 0.08, depth: 0.3 }],
      [0, 0, 0],
    )).toBe(-1);
  });
});
