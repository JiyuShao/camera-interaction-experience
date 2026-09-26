import { MathUtils, Vector3, type Object3D, type PerspectiveCamera } from 'three';

export interface MediaFocusTarget {
  position: Vector3;
  scale: number;
  distance: number;
}

export function calculateMediaFocusTarget(
  container: Object3D,
  camera: PerspectiveCamera,
  cardWidth: number,
  cardHeight: number,
  viewportWidth: number,
): MediaFocusTarget {
  container.updateWorldMatrix(true, false);
  camera.updateMatrixWorld(true);

  const distance = viewportWidth < 700 ? 2.25 : 2.35;
  const cameraPosition = camera.getWorldPosition(new Vector3());
  const direction = camera.getWorldDirection(new Vector3());
  const worldCenter = cameraPosition.addScaledVector(direction, distance);
  const position = container.worldToLocal(worldCenter.clone());
  const parentScale = Math.max(0.0001, container.getWorldScale(new Vector3()).x);
  const viewHeight = 2 * Math.tan(MathUtils.degToRad(camera.fov) / 2) * distance;
  const viewWidth = viewHeight * camera.aspect;
  const widthFraction = viewportWidth < 700 ? 0.8 : 0.52;
  const heightFraction = 0.56;
  const widthScale = viewWidth * widthFraction / Math.max(0.0001, cardWidth * parentScale);
  const heightScale = viewHeight * heightFraction / Math.max(0.0001, cardHeight * parentScale);

  return {
    position,
    scale: Math.min(widthScale, heightScale),
    distance,
  };
}
