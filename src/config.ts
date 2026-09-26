import rawConfig from '../experience.config.json';

export interface MediaItem {
  kind: 'image' | 'video';
  src: string;
  thumbnail?: string;
  poster?: string;
  alt: string;
  caption?: string;
  sceneFeatured?: boolean;
}

export interface MediaGalleryConfig {
  title: string;
  autoTour: {
    rotationSpeedRadPerSecond: number;
    focusMs: number;
    restMs: number;
  };
  sceneCards: {
    size: [number, number];
    opacity: number;
  };
  items: MediaItem[];
}

export interface AudioConfig {
  enabled: boolean;
  src: string;
  title: string;
  volume: number;
  loop: boolean;
  autoplay: boolean;
}

export interface PresentationConfig {
  title: string;
  welcomeEyebrow: string;
  welcomeLines: [string, string];
  sceneEyebrow: string;
  loadingMessage: string;
  aboutEyebrow: string;
  aboutDescription: string;
}

export interface CreatorConfig {
  name: string;
  role: string;
  url?: string;
}

export interface ExperienceConfig {
  identity: {
    name: string;
    headline: string;
    date: string;
    detail: string;
  };
  presentation: PresentationConfig;
  creator: CreatorConfig;
  audio: AudioConfig;
  media: MediaGalleryConfig;
  model: {
    sourcePath: string;
    pointsUrl: string;
    sampleCount: number;
    rotation: [number, number, number];
    scale: number;
    offset: [number, number, number];
    credit: {
      title: string;
      author: string;
      sourceUrl: string;
      license: string;
      licenseUrl: string;
    };
  };
  particles: {
    leafRatio: number;
    dustRatio: number;
    starRatio: number;
    leafSize: [number, number];
    structuralLeafRatio: number;
    structuralLeafSize: [number, number];
    foregroundLeafCount: number;
    foregroundLeafSize: [number, number];
    leafFlutterStrength: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    gatherDurationMs: number;
    scatterDurationMs: number;
  };
  gestures: {
    inferenceFps: number;
    confirmationMs: number;
    heartConfirmationMs: number;
    evidenceFrames: number;
    pinchReleaseMs: number;
    lossGraceMs: number;
    filterMinCutoff: number;
    filterBeta: number;
    filterDerivativeCutoff: number;
    motion: {
      horizontalDeadZone: number;
      verticalDeadZone: number;
      maxYawSpeedRadPerSecond: number;
      maxPitchSpeedRadPerSecond: number;
      responseExponent: number;
    };
  };
}

export const experienceConfig = rawConfig as unknown as ExperienceConfig;

const ratioTotal =
  experienceConfig.particles.leafRatio +
  experienceConfig.particles.dustRatio +
  experienceConfig.particles.starRatio;

if (Math.abs(ratioTotal - 1) > 0.0001) {
  throw new Error('Particle ratios in experience.config.json must add up to 1.');
}

if (
  experienceConfig.particles.structuralLeafRatio < 0
  || experienceConfig.particles.structuralLeafRatio > 0.1
) {
  throw new Error('structuralLeafRatio in experience.config.json must be between 0 and 0.1.');
}

if (experienceConfig.audio.volume < 0 || experienceConfig.audio.volume > 1) {
  throw new Error('audio.volume in experience.config.json must be between 0 and 1.');
}
