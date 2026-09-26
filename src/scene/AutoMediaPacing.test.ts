import { describe, expect, it } from 'vitest';
import { experienceConfig } from '../config';

describe('automatic memory pacing', () => {
  it('uses a calm rotation and gives every memory enough reading time', () => {
    expect(experienceConfig.media.autoTour.rotationSpeedRadPerSecond).toBeLessThanOrEqual(0.08);
    expect(experienceConfig.media.autoTour.focusMs).toBeGreaterThanOrEqual(4000);
    expect(experienceConfig.media.autoTour.restMs).toBeGreaterThanOrEqual(900);
  });
});
