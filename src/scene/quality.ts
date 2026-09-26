import type { ExperienceConfig } from '../config';

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualityProfile {
  tier: QualityTier;
  particleCount: number;
  pixelRatio: number;
}

interface HardwareProfile {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

export function selectQualityProfile(
  config: ExperienceConfig,
  viewport = { width: window.innerWidth, height: window.innerHeight },
  navigatorInfo: HardwareProfile = navigator as HardwareProfile,
  devicePixelRatio = window.devicePixelRatio,
): QualityProfile {
  const cores = navigatorInfo.hardwareConcurrency || 4;
  const memory = navigatorInfo.deviceMemory ?? 4;
  const renderedPixels = viewport.width * viewport.height * Math.min(devicePixelRatio, 2) ** 2;

  if (cores <= 4 || memory <= 3 || renderedPixels > 7_000_000) {
    return {
      tier: 'low',
      particleCount: config.particles.lowCount,
      pixelRatio: Math.min(devicePixelRatio, 1.35),
    };
  }

  if (cores < 8 || memory < 6 || renderedPixels > 4_000_000) {
    return {
      tier: 'medium',
      particleCount: config.particles.mediumCount,
      pixelRatio: Math.min(devicePixelRatio, 1.7),
    };
  }

  return {
    tier: 'high',
    particleCount: config.particles.highCount,
    pixelRatio: Math.min(devicePixelRatio, 2),
  };
}
