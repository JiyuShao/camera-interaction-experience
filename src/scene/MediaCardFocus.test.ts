import { Group, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { calculateMediaFocusTarget } from './MediaCardFocus';

describe('calculateMediaFocusTarget', () => {
  it('moves the focused card to screen center with a prominent bounded size', () => {
    const root = new Group();
    root.rotation.set(0.2, 0.8, Math.PI / 2);
    root.scale.setScalar(0.7);
    const cards = new Group();
    root.add(cards);
    const camera = new PerspectiveCamera(35, 390 / 844, 0.1, 50);
    camera.position.z = 4.45;
    root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const target = calculateMediaFocusTarget(cards, camera, 0.12, 0.2, 390);
    const projected = cards.localToWorld(target.position.clone()).project(camera);
    const parentScale = cards.getWorldScale(new Vector3()).x;
    const viewHeight = 2 * Math.tan(camera.fov * Math.PI / 360) * target.distance;
    const screenHeightFraction = 0.2 * target.scale * parentScale / viewHeight;

    expect(projected.x).toBeCloseTo(0, 5);
    expect(projected.y).toBeCloseTo(0, 5);
    expect(screenHeightFraction).toBeGreaterThanOrEqual(0.54);
    expect(screenHeightFraction).toBeLessThanOrEqual(0.59);
  });
});
