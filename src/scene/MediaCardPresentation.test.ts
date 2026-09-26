import { describe, expect, it } from 'vitest';
import { mediaVisibilityForScatter } from './MediaCardPresentation';

describe('mediaVisibilityForScatter', () => {
  it('fully hides cards in the gathered baby state and reveals them while scattering', () => {
    expect(mediaVisibilityForScatter(0)).toBe(0);
    expect(mediaVisibilityForScatter(0.25)).toBe(0);
    expect(mediaVisibilityForScatter(0.7)).toBeGreaterThan(0);
    expect(mediaVisibilityForScatter(1)).toBe(1);
  });
});
