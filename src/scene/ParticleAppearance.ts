import type { ExperienceConfig } from '../config';

export interface ParticleAppearance {
  kind: 0 | 1 | 2;
  size: number;
}

export function createParticleAppearance(
  kindValue: number,
  sizeValue: number,
  config: ExperienceConfig['particles'],
): ParticleAppearance {
  if (kindValue < config.leafRatio) {
    return {
      kind: 0,
      size: mix(config.leafSize[0], config.leafSize[1], sizeValue),
    };
  }

  if (kindValue < config.leafRatio + config.dustRatio) {
    return {
      kind: 1,
      size: mix(1.7, 4.5, sizeValue),
    };
  }

  return {
    kind: 2,
    size: mix(3.4, 8, sizeValue),
  };
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
