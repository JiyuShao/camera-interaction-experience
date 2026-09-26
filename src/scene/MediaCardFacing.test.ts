import { Euler, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { cameraFacingLocalQuaternion } from './MediaCardFacing';

describe('cameraFacingLocalQuaternion', () => {
  it('turns every card toward the camera even under a rotated model root', () => {
    const parentWorldQuaternion = new Quaternion().setFromEuler(new Euler(0.25, 0.8, -0.1));
    const cameraPosition = new Vector3(0, 0, 4);
    const positions = [
      new Vector3(-1.2, 0.5, 0.4),
      new Vector3(0.9, -0.6, -0.7),
    ];

    const worldQuaternions = positions.map((position) => parentWorldQuaternion.clone().multiply(
      cameraFacingLocalQuaternion(
        parentWorldQuaternion,
        position,
        cameraPosition,
        new Vector3(0, 1, 0),
      ),
    ));

    worldQuaternions.forEach((quaternion, index) => {
      const cardFront = new Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();
      const towardCamera = cameraPosition.clone().sub(positions[index]).normalize();
      expect(cardFront.dot(towardCamera)).toBeGreaterThan(0.999);
    });
    expect(Math.abs(worldQuaternions[0].dot(worldQuaternions[1]))).toBeLessThan(0.999);
  });
});
