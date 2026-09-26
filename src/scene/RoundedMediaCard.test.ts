import { describe, expect, it } from 'vitest';
import { calculateRoundedCardMetrics } from './RoundedMediaCard';

describe('calculateRoundedCardMetrics', () => {
  it('uses one constant border width on every side', () => {
    const metrics = calculateRoundedCardMetrics(1600, 900);

    expect(metrics.leftBorder).toBe(metrics.rightBorder);
    expect(metrics.topBorder).toBe(metrics.bottomBorder);
    expect(metrics.leftBorder).toBe(metrics.topBorder);
    expect(metrics.cornerRadius).toBeGreaterThan(metrics.leftBorder);
  });

  it('preserves the image aspect ratio inside the rounded frame', () => {
    const metrics = calculateRoundedCardMetrics(900, 1600);

    expect(metrics.innerWidth / metrics.innerHeight).toBeCloseTo(900 / 1600, 2);
  });

  it('keeps enough texture detail for a focused high-DPI card', () => {
    const metrics = calculateRoundedCardMetrics(1920, 1440);

    expect(Math.max(metrics.innerWidth, metrics.innerHeight)).toBe(1024);
  });
});
