import { describe, expect, it } from 'vitest';
import { experienceConfig } from '../config';
import { estimateProjectedLeafSize, getStructuralLeafCount } from './LeafPresentation';

describe('structural leaf presentation', () => {
  it('uses enough large leaves to visibly construct the baby on desktop and mobile', () => {
    const { particles } = experienceConfig;
    const count = getStructuralLeafCount(particles.highCount, particles.structuralLeafRatio);
    const averageSize = (particles.structuralLeafSize[0] + particles.structuralLeafSize[1]) / 2;
    const desktopPixels = estimateProjectedLeafSize(averageSize, 960, 35, 3.95);
    const mobilePixels = estimateProjectedLeafSize(averageSize, 844, 35, 4.45);

    expect(count).toBeGreaterThanOrEqual(600);
    expect(desktopPixels).toBeGreaterThanOrEqual(28);
    expect(mobilePixels).toBeGreaterThanOrEqual(22);
  });
});
