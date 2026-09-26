import { describe, expect, it } from 'vitest';
import { firstHandFrame, type HandLandmark } from './HandFrame';

describe('firstHandFrame', () => {
  it('keeps image landmarks, metric world landmarks, and handedness together', () => {
    const imageLandmarks = points(0.4);
    const worldLandmarks = points(0.02);
    worldLandmarks[8] = { x: 0.01, y: -0.04, z: -0.08 };

    const frame = firstHandFrame({
      landmarks: [imageLandmarks],
      worldLandmarks: [worldLandmarks],
      handedness: [[{ categoryName: 'Right' }]],
    });

    expect(frame).toEqual({ imageLandmarks, worldLandmarks, handedness: 'Right' });
  });

  it('falls back to image landmarks when world landmarks are unavailable', () => {
    const imageLandmarks = points(0.4);
    expect(firstHandFrame({ landmarks: [imageLandmarks] })?.worldLandmarks).toEqual(imageLandmarks);
  });
});

function points(scale: number): HandLandmark[] {
  return Array.from({ length: 21 }, (_, index) => ({
    x: index * scale,
    y: index * scale * 0.5,
    z: index * scale * -0.1,
  }));
}
