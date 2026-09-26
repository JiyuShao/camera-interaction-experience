import { describe, expect, it } from 'vitest';
import { experienceConfig } from '../config';
import { selectQualityProfile } from './quality';

describe('selectQualityProfile', () => {
  it('selects high quality for a capable display', () => {
    const result = selectQualityProfile(
      experienceConfig,
      { width: 1440, height: 900 },
      { hardwareConcurrency: 12, deviceMemory: 8 },
      1,
    );
    expect(result.tier).toBe('high');
    expect(result.particleCount).toBe(30000);
  });

  it('protects constrained devices', () => {
    const result = selectQualityProfile(
      experienceConfig,
      { width: 390, height: 844 },
      { hardwareConcurrency: 4, deviceMemory: 2 },
      3,
    );
    expect(result.tier).toBe('low');
    expect(result.particleCount).toBe(12000);
    expect(result.pixelRatio).toBe(1.35);
  });
});
