export function getStructuralLeafCount(particleCount: number, ratio: number): number {
  return Math.max(48, Math.round(particleCount * ratio));
}

export function estimateProjectedLeafSize(
  worldSize: number,
  viewportHeight: number,
  verticalFovDegrees: number,
  cameraDistance: number,
): number {
  const verticalFovRadians = verticalFovDegrees * Math.PI / 180;
  const visibleWorldHeight = 2 * cameraDistance * Math.tan(verticalFovRadians / 2);
  return worldSize / visibleWorldHeight * viewportHeight;
}
