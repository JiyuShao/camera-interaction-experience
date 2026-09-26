import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Timer,
  WebGLRenderer,
} from 'three';
import type { ExperienceConfig, MediaItem } from '../config';
import { PointerControls } from '../interaction/PointerControls';
import { GestureMotionController } from '../interaction/GestureMotion';
import { BabyParticles } from './BabyParticles';
import { ModelLeaves } from './LeafEffects';
import { loadParticleData } from './ParticleData';
import { AutoMediaTour } from './AutoMediaTour';
import { attachMediaCardsToModel } from './MediaCardAttachment';
import { ModelMediaCards } from './ModelMediaCards';
import { selectQualityProfile, type QualityProfile } from './quality';

interface ScatterAnimation {
  from: number;
  to: number;
  startedAt: number;
  durationMs: number;
  onComplete: () => void;
}

interface StarlightSceneCallbacks {
  onTap(): void;
  onMediaFocusChange(item: MediaItem | null): void;
}

export class StarlightScene {
  readonly quality: QualityProfile;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(35, 1, 0.1, 50);
  private readonly renderer: WebGLRenderer;
  private readonly root = new Group();
  private readonly timer = new Timer();
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private particles: BabyParticles | null = null;
  private modelLeaves: ModelLeaves | null = null;
  private modelMediaCards: ModelMediaCards | null = null;
  private leafTexture: Texture | null = null;
  private controls: PointerControls;
  private animation: ScatterAnimation | null = null;
  private frameId = 0;
  private targetRotationX: number;
  private targetRotationY: number;
  private zoom = 1;
  private targetZoom = 1;
  private lastInteractionAt = 0;
  private mediaFocusActive = false;
  private autoMediaTourActive = false;
  private gestureSelectionActive = false;
  private autoTourFocusIndex: number | null = null;
  private readonly autoMediaTour: AutoMediaTour;
  private readonly gestureMotion: GestureMotionController;

  constructor(
    private readonly container: HTMLElement,
    private readonly config: ExperienceConfig,
    private readonly callbacks: StarlightSceneCallbacks,
  ) {
    this.quality = selectQualityProfile(config);
    this.renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor(new Color(0x000000), 0);
    this.renderer.domElement.className = 'scene-canvas';
    this.renderer.domElement.setAttribute('aria-label', '叶光汇聚成的熟睡宝宝互动场景');
    container.append(this.renderer.domElement);

    this.camera.position.set(0, 0, 4.25);
    this.root.rotation.set(...config.model.rotation);
    this.root.position.set(...config.model.offset);
    this.root.scale.setScalar(config.model.scale);
    this.targetRotationX = config.model.rotation[0];
    this.targetRotationY = config.model.rotation[1];
    this.autoMediaTour = new AutoMediaTour(config.media.autoTour);
    this.gestureMotion = new GestureMotionController(config.gestures.motion);
    this.scene.add(this.root);
    this.scene.add(createAmbientStars());
    this.timer.connect(document);

    this.controls = new PointerControls(this.renderer.domElement, {
      onRotate: (deltaX, deltaY) => {
        if (this.mediaFocusActive || this.autoMediaTourActive) return;
        this.targetRotationY += deltaX * 0.006;
        this.targetRotationX = clamp(this.targetRotationX + deltaY * 0.004, -0.72, 0.72);
      },
      onZoom: (delta) => {
        if (this.mediaFocusActive || this.autoMediaTourActive) return;
        this.targetZoom = clamp(this.targetZoom + delta, 0.72, 1.7);
      },
      onInteract: () => {
        this.lastInteractionAt = performance.now();
      },
      onTap: callbacks.onTap,
    });

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  async initialize(): Promise<void> {
    const [particleData, leafTexture] = await Promise.all([
      loadParticleData(this.config.model.pointsUrl),
      new TextureLoader().loadAsync('/assets/leaf/animal-crossing-leaf-veined.png'),
    ]);
    const count = Math.min(this.quality.particleCount, particleData.count);
    this.leafTexture = leafTexture;
    this.particles = new BabyParticles(
      particleData.positions,
      count,
      leafTexture,
      this.config,
      this.quality.pixelRatio,
    );
    this.modelLeaves = new ModelLeaves(
      particleData.positions,
      count,
      leafTexture,
      this.config,
    );
    this.modelMediaCards = await ModelMediaCards.create(this.config, this.camera.aspect);
    this.root.add(this.particles);
    this.root.add(this.modelLeaves);
    if (this.modelMediaCards) {
      attachMediaCardsToModel(this.root, this.modelMediaCards);
      this.modelMediaCards.updateViewportLayout(this.camera);
      this.modelMediaCards.setSelectionPreviewActive(this.gestureSelectionActive);
    }
    this.frameId = requestAnimationFrame(this.render);
  }

  gather(durationMs: number, onComplete: () => void): void {
    this.animateScatter(0, durationMs, onComplete);
  }

  scatter(durationMs: number, onComplete: () => void): void {
    this.root.updateWorldMatrix(true, true);
    this.modelMediaCards?.updateViewportLayout(this.camera);
    this.animateScatter(1, durationMs, onComplete);
  }

  resetView(): void {
    this.targetRotationX = this.config.model.rotation[0];
    this.targetRotationY = this.config.model.rotation[1];
    this.targetZoom = 1;
    this.lastInteractionAt = performance.now();
  }

  setGesturePose(x: number, y: number, timestamp: number): void {
    if (this.mediaFocusActive || this.autoMediaTourActive) return;
    const target = this.gestureMotion.update(
      x,
      y,
      this.targetRotationX,
      this.targetRotationY,
      timestamp,
    );
    this.targetRotationX = target.rotationX;
    this.targetRotationY = target.rotationY;
    this.lastInteractionAt = performance.now();
  }

  endGesturePose(): void {
    this.gestureMotion.end();
  }

  setMediaFocus(active: boolean): string | undefined {
    if (active && this.autoMediaTourActive) return undefined;
    this.lastInteractionAt = performance.now();
    if (active) {
      const focusedItem = this.modelMediaCards?.setPinchFocus(true, this.camera);
      if (!focusedItem) {
        this.mediaFocusActive = false;
        this.callbacks.onMediaFocusChange(null);
        return undefined;
      }
      this.mediaFocusActive = true;
      this.gestureMotion.end();
      this.targetRotationX = this.root.rotation.x;
      this.targetRotationY = this.root.rotation.y;
      this.callbacks.onMediaFocusChange(focusedItem);
      return focusedItem.alt;
    }
    this.mediaFocusActive = false;
    const releasedItem = this.modelMediaCards?.setPinchFocus(false, this.camera);
    this.callbacks.onMediaFocusChange(null);
    return releasedItem?.alt;
  }

  setGestureSelectionActive(active: boolean): void {
    this.gestureSelectionActive = active;
    this.modelMediaCards?.setSelectionPreviewActive(
      active && !this.autoMediaTourActive,
    );
  }

  setAutoMediaTour(active: boolean): void {
    this.autoMediaTourActive = active;
    this.mediaFocusActive = false;
    this.autoTourFocusIndex = null;
    this.gestureMotion.end();
    this.lastInteractionAt = performance.now();
    if (active) {
      this.modelMediaCards?.setSelectionPreviewActive(false);
      this.autoMediaTour.start();
    } else {
      this.autoMediaTour.stop();
      this.modelMediaCards?.clearFocus();
      this.modelMediaCards?.setSelectionPreviewActive(this.gestureSelectionActive);
      this.callbacks.onMediaFocusChange(null);
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.timer.dispose();
    this.particles?.dispose();
    this.modelLeaves?.dispose();
    this.modelMediaCards?.dispose();
    this.leafTexture?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private animateScatter(target: number, durationMs: number, onComplete: () => void): void {
    if (!this.particles) return;
    const distance = Math.abs(target - this.particles.scatter);
    this.animation = {
      from: this.particles.scatter,
      to: target,
      startedAt: performance.now(),
      durationMs: this.reducedMotion ? 500 : Math.max(500, durationMs * distance),
      onComplete,
    };
  }

  private readonly resize = (): void => {
    const { clientWidth: width, clientHeight: height } = this.container;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.position.z = width < 700 ? 4.45 : width < 1100 ? 4.2 : 3.95;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.modelMediaCards?.updateViewportLayout(this.camera);
  };

  private readonly render = (now: number): void => {
    this.timer.update(now);
    const delta = this.timer.getDelta();
    const elapsed = this.timer.getElapsed();
    if (this.particles) {
      if (this.animation) {
        const progress = clamp((now - this.animation.startedAt) / this.animation.durationMs, 0, 1);
        const eased = easeInOutCubic(progress);
        this.particles.scatter = this.animation.from + (this.animation.to - this.animation.from) * eased;
        if (progress === 1) {
          const completed = this.animation;
          this.animation = null;
          completed.onComplete();
        }
      }

      if (!this.reducedMotion && this.autoMediaTourActive) {
        this.targetRotationY += delta * this.config.media.autoTour.rotationSpeedRadPerSecond;
      } else if (!this.reducedMotion && !this.mediaFocusActive && now - this.lastInteractionAt > 2200) {
        this.targetRotationY += delta * 0.033;
      }

      this.root.rotation.x = MathUtils.damp(this.root.rotation.x, this.targetRotationX, 5, delta);
      this.root.rotation.y = MathUtils.damp(this.root.rotation.y, this.targetRotationY, 5, delta);
      this.zoom = MathUtils.damp(this.zoom, this.targetZoom, 5.4, delta);
      const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
      const responsiveScale = this.container.clientWidth < 520
        ? 0.7
        : aspect < 0.76
          ? 0.86
          : aspect < 0.95
            ? 0.94
            : 1;
      const stateAwareZoom = this.zoom + (1 - this.zoom) * this.particles.scatter;
      this.root.scale.setScalar(this.config.model.scale * stateAwareZoom * responsiveScale);
      const effectTime = this.reducedMotion ? 0 : elapsed;
      this.particles.update(effectTime, this.quality.pixelRatio);
      if (this.modelLeaves) {
        this.modelLeaves.scatter = this.particles.scatter;
        this.modelLeaves.update(effectTime);
      }
      if (this.modelMediaCards && this.autoMediaTourActive) {
        const nextFocusIndex = this.autoMediaTour.focusIndexAt(
          now,
          this.modelMediaCards.itemCount,
          this.particles.scatter > 0.96,
        );
        if (nextFocusIndex !== this.autoTourFocusIndex) {
          this.autoTourFocusIndex = nextFocusIndex;
          if (nextFocusIndex === null) {
            this.modelMediaCards.clearFocus();
            this.callbacks.onMediaFocusChange(null);
          } else {
            const focusedItem = this.modelMediaCards.focusItem(nextFocusIndex, this.camera);
            this.callbacks.onMediaFocusChange(focusedItem ?? null);
          }
        }
      }
      this.modelMediaCards?.update(effectTime, this.particles.scatter, delta, this.camera);
    }

    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.render);
  };
}

function createAmbientStars(): Points<BufferGeometry, PointsMaterial> {
  const count = 850;
  const positions = new Float32Array(count * 3);
  const random = mulberry32(0x4d4f4f4e);
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 2.1 + random() * 5.7;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = (random() - 0.5) * 7;
    positions[index * 3 + 2] = -1.5 - random() * 5;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0xffe4a3,
    size: 0.018,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return new Points(geometry, material);
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
