import { Mesh, PlaneGeometry, type MeshBasicMaterial } from 'three';

export function createMediaCardSurface(
  material: MeshBasicMaterial,
  geometry = new PlaneGeometry(1, 1),
): Mesh<PlaneGeometry, MeshBasicMaterial> {
  return new Mesh(geometry, material);
}
