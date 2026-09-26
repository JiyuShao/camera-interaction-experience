import {
  DoubleSide,
  Group,
  MathUtils,
  MeshBasicMaterial,
  PlaneGeometry,
  PerspectiveCamera,
  Quaternion,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import type { ExperienceConfig, MediaItem } from '../config';
import {
  centerMostVisibleCardIndex,
  createMediaCardPlacements,
  scenePreviewSource,
  selectSceneMediaItems,
  type MediaCardPlacement,
  type Position3,
  type ProjectedCardBounds,
} from './MediaCardLayout';
import { calculateMediaFocusTarget } from './MediaCardFocus';
import { cameraFacingLocalQuaternion } from './MediaCardFacing';
import { mediaVisibilityForScatter } from './MediaCardPresentation';
import {
  createRoundedMediaCardTexture,
  createRoundedMediaOutlineTexture,
} from './RoundedMediaCard';
import { createMediaCardSurface } from './MediaCardSurface';
import { StableMediaCandidate } from './StableMediaCandidate';

interface CardEntry {
  group: Group;
  material: MeshBasicMaterial;
  outlineMaterial: MeshBasicMaterial;
  placement: MediaCardPlacement;
  item: MediaItem;
  width: number;
  height: number;
  basePosition: Vector3;
  baseQuaternion: Quaternion;
}

export class ModelMediaCards extends Group {
  private readonly entries: CardEntry[];
  private focusIndex = -1;
  private focusTarget = 0;
  private focusProgress = 0;
  private scatterVisibility = 0;
  private readonly focusedPosition = new Vector3();
  private readonly focusedQuaternion = new Quaternion();
  private readonly parentWorldQuaternion = new Quaternion();
  private readonly cameraWorldPosition = new Vector3();
  private readonly cardWorldPosition = new Vector3();
  private readonly projectedCorner = new Vector3();
  private readonly candidateTracker = new StableMediaCandidate(160, 120);
  private selectionPreviewActive = false;
  private previewIndex = -1;
  private focusedScale = 1;
  private readonly cardGeometry = new PlaneGeometry(1, 1);

  private constructor(
    textures: Texture[],
    items: MediaItem[],
    placements: MediaCardPlacement[],
    private readonly opacity: number,
    sizeRange: [number, number],
  ) {
    super();
    this.name = 'scattered-media-cards';
    this.renderOrder = 4;
    this.entries = textures.map((sourceTexture, index) => {
      const placement = placements[index];
      const texture = createRoundedMediaCardTexture(sourceTexture);
      sourceTexture.dispose();
      const canvas = texture.image as HTMLCanvasElement;
      const aspect = canvas.width / canvas.height;
      const densityScale = MathUtils.clamp(Math.sqrt(16 / textures.length), 0.62, 1.15);
      const size = mix(sizeRange[0], sizeRange[1], placement.seed)
        * placement.sizeFactor
        * densityScale;
      const width = aspect >= 1 ? size : size * aspect;
      const height = aspect >= 1 ? size / aspect : size;

      const material = new MeshBasicMaterial({
        map: texture,
        color: 0xffffff,
        opacity: 0,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
      });
      const photo = createMediaCardSurface(material, this.cardGeometry);
      photo.name = `media-card-${index + 1}-${items[index].alt}`;
      photo.scale.set(width, height, 1);
      photo.renderOrder = 4;

      const outlineMaterial = new MeshBasicMaterial({
        map: createRoundedMediaOutlineTexture(canvas.width, canvas.height),
        color: 0xffffff,
        opacity: 0,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        side: DoubleSide,
      });
      const outline = createMediaCardSurface(outlineMaterial, this.cardGeometry);
      outline.name = `media-card-${index + 1}-selection-outline`;
      outline.position.z = -0.006;
      outline.scale.set(width * 1.09, height * 1.09, 1);
      outline.renderOrder = 3;

      const group = new Group();
      group.visible = false;
      group.add(outline, photo);
      this.add(group);
      return {
        group,
        material,
        outlineMaterial,
        placement,
        item: items[index],
        width,
        height,
        basePosition: new Vector3(),
        baseQuaternion: new Quaternion(),
      };
    });
  }

  get itemCount(): number {
    return this.entries.length;
  }

  static async create(
    config: ExperienceConfig,
    viewportAspect: number,
  ): Promise<ModelMediaCards | null> {
    const sceneConfig = config.media.sceneCards;
    const items = selectSceneMediaItems(config.media.items);
    if (items.length === 0) return null;

    const loader = new TextureLoader();
    const loaded = await Promise.allSettled(
      items.map((item) => loader.loadAsync(scenePreviewSource(item)!)),
    );
    const successfulItems: MediaItem[] = [];
    const textures: Texture[] = [];
    loaded.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulItems.push(items[index]);
        textures.push(result.value);
      }
    });
    if (textures.length === 0) return null;

    const placements = createMediaCardPlacements(textures.length, viewportAspect);
    return new ModelMediaCards(
      textures,
      successfulItems,
      placements,
      sceneConfig.opacity,
      sceneConfig.size,
    );
  }

  updateViewportLayout(camera: PerspectiveCamera): void {
    camera.updateMatrixWorld(true);
    const cameraPosition = camera.getWorldPosition(new Vector3());
    const forward = camera.getWorldDirection(new Vector3());
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const distance = Math.max(1, camera.position.length() - 0.28);
    const viewHeight = 2 * Math.tan(MathUtils.degToRad(camera.fov) / 2) * distance;
    const viewWidth = viewHeight * camera.aspect;
    const center = cameraPosition.clone().addScaledVector(forward, distance);
    this.updateWorldMatrix(true, false);
    this.entries.forEach((entry, index) => {
      const [x, y, z] = entry.placement.volume;
      const depthExtent = Math.min(1.4, distance * 0.3);
      const worldPosition = center.clone()
        .addScaledVector(right, x * viewWidth * 0.49)
        .addScaledVector(up, y * viewHeight * 0.44)
        .addScaledVector(forward, z * depthExtent);
      entry.basePosition.copy(this.worldToLocal(worldPosition));
      if (this.focusIndex !== index) {
        entry.group.position.copy(entry.basePosition);
      }
    });
    this.updateCameraFacing(camera);
  }

  setPinchFocus(active: boolean, camera: PerspectiveCamera): MediaItem | undefined {
    if (!active) return this.clearFocus();
    if (this.scatterVisibility < 0.8) return undefined;
    return this.focusItem(this.previewIndex, camera);
  }

  setSelectionPreviewActive(active: boolean): void {
    if (this.selectionPreviewActive === active) return;
    this.selectionPreviewActive = active;
    if (!active) {
      this.previewIndex = -1;
      this.candidateTracker.reset();
    }
  }

  focusItem(index: number, camera: PerspectiveCamera): MediaItem | undefined {
    if (index < 0 || index >= this.entries.length || this.scatterVisibility < 0.8) {
      return undefined;
    }
    this.focusIndex = index;
    this.focusTarget = 1;
    this.refreshFocusTarget(camera);
    return this.entries[index].item;
  }

  clearFocus(): MediaItem | undefined {
    this.focusTarget = 0;
    return this.focusIndex >= 0 ? this.entries[this.focusIndex].item : undefined;
  }

  update(
    timeSeconds: number,
    scatter: number,
    deltaSeconds: number,
    camera: PerspectiveCamera,
  ): void {
    this.scatterVisibility = mediaVisibilityForScatter(scatter);
    this.updateCameraFacing(camera);
    if (this.scatterVisibility < 0.02 && this.focusTarget > 0) this.clearFocus();
    if (this.focusTarget > 0 && this.focusIndex >= 0) this.refreshFocusTarget(camera);

    const focusAmount = 1 - Math.exp(-Math.max(0, deltaSeconds) * 8.5);
    this.focusProgress = mix(this.focusProgress, this.focusTarget, focusAmount);

    this.updateSelectionPreview(timeSeconds, camera);

    this.entries.forEach((entry, index) => {
      const isFocused = index === this.focusIndex;
      const isPreviewed = index === this.previewIndex && this.focusTarget === 0;
      const entryFocus = isFocused ? this.focusProgress : 0;
      const drift = this.scatterVisibility * 0.018;
      const baseX = entry.basePosition.x
        + Math.sin(timeSeconds * 0.34 + entry.placement.seed * 21) * drift;
      const baseY = entry.basePosition.y
        + Math.cos(timeSeconds * 0.3 + entry.placement.seed * 17) * drift;
      const baseZ = entry.basePosition.z;
      entry.group.position.set(
        mix(baseX, this.focusedPosition.x, entryFocus),
        mix(baseY, this.focusedPosition.y, entryFocus),
        mix(baseZ, this.focusedPosition.z, entryFocus),
      );

      const breath = 1 + Math.sin(timeSeconds * 0.66 + entry.placement.seed * 8) * 0.018;
      const groupScale = isFocused
        ? mix(breath, this.focusedScale, this.focusProgress)
        : breath
          * mix(1, 0.8, this.focusProgress)
          * (isPreviewed ? 1.055 : 1);
      entry.group.scale.setScalar(groupScale);
      entry.material.opacity = this.scatterVisibility * (isFocused
        ? mix(this.opacity, 1, this.focusProgress)
        : this.opacity
          * mix(1, 0.5, this.focusProgress)
          * (isPreviewed ? 1.12 : 1));
      entry.outlineMaterial.opacity = isPreviewed
        ? this.scatterVisibility * (0.62 + Math.sin(timeSeconds * 3.2) * 0.12)
        : 0;
      entry.material.depthTest = !isFocused || this.focusProgress < 0.02;
      if (isFocused) {
        entry.group.quaternion.slerpQuaternions(
          entry.baseQuaternion,
          this.focusedQuaternion,
          entryFocus,
        );
      } else {
        entry.group.quaternion.copy(entry.baseQuaternion);
      }
      entry.group.visible = this.scatterVisibility > 0.01;
    });

    if (this.focusTarget === 0 && this.focusProgress < 0.002) {
      this.focusProgress = 0;
      this.focusIndex = -1;
    }
  }

  dispose(): void {
    for (const entry of this.entries) {
      entry.material.map?.dispose();
      entry.material.dispose();
      entry.outlineMaterial.map?.dispose();
      entry.outlineMaterial.dispose();
    }
    this.cardGeometry.dispose();
    this.clear();
  }

  private refreshFocusTarget(camera: PerspectiveCamera): void {
    const entry = this.entries[this.focusIndex];
    if (!entry) return;
    const focusTarget = calculateMediaFocusTarget(
      this,
      camera,
      entry.width,
      entry.height,
      window.innerWidth,
    );
    this.focusedPosition.copy(focusTarget.position);
    this.focusedScale = focusTarget.scale;
    this.focusedQuaternion.copy(this.getWorldQuaternion(new Quaternion()))
      .invert()
      .multiply(camera.getWorldQuaternion(new Quaternion()));
  }

  private updateCameraFacing(camera: PerspectiveCamera): void {
    this.updateWorldMatrix(true, false);
    camera.updateMatrixWorld(true);
    this.getWorldQuaternion(this.parentWorldQuaternion);
    camera.getWorldPosition(this.cameraWorldPosition);
    for (const entry of this.entries) {
      this.cardWorldPosition.copy(entry.basePosition);
      this.localToWorld(this.cardWorldPosition);
      cameraFacingLocalQuaternion(
        this.parentWorldQuaternion,
        this.cardWorldPosition,
        this.cameraWorldPosition,
        camera.up,
        entry.placement.angle,
        entry.baseQuaternion,
      );
    }
  }

  private updateSelectionPreview(
    timeSeconds: number,
    camera: PerspectiveCamera,
  ): void {
    if (!this.selectionPreviewActive || this.focusTarget > 0) {
      return;
    }
    if (this.scatterVisibility < 0.8) {
      this.previewIndex = -1;
      this.candidateTracker.reset();
      return;
    }

    this.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const worldPositions: Position3[] = [];
    const projectedBounds: ProjectedCardBounds[] = [];

    for (const entry of this.entries) {
      entry.group.updateWorldMatrix(true, false);
      const worldPosition = entry.group.getWorldPosition(this.cardWorldPosition);
      worldPositions.push([worldPosition.x, worldPosition.y, worldPosition.z]);

      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      const corners = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ] as const;
      for (const [cornerX, cornerY] of corners) {
        this.projectedCorner.set(
          cornerX * entry.width,
          cornerY * entry.height,
          0,
        );
        entry.group.localToWorld(this.projectedCorner);
        this.projectedCorner.project(camera);
        minX = Math.min(minX, this.projectedCorner.x);
        maxX = Math.max(maxX, this.projectedCorner.x);
        minY = Math.min(minY, this.projectedCorner.y);
        maxY = Math.max(maxY, this.projectedCorner.y);
      }
      this.projectedCorner.copy(worldPosition).project(camera);
      projectedBounds.push({
        minX,
        maxX,
        minY,
        maxY,
        depth: this.projectedCorner.z,
      });
    }

    const cameraPosition = camera.getWorldPosition(this.cameraWorldPosition);
    const rawCandidate = centerMostVisibleCardIndex(
      worldPositions,
      projectedBounds,
      [cameraPosition.x, cameraPosition.y, cameraPosition.z],
    );
    this.previewIndex = this.candidateTracker.update(rawCandidate, timeSeconds * 1000);
  }
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
