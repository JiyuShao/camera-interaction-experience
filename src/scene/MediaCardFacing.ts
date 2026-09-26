import { Matrix4, Quaternion, Vector3 } from 'three';

const facingMatrix = new Matrix4();
const worldFacingQuaternion = new Quaternion();
const rollQuaternion = new Quaternion();
const zAxis = new Vector3(0, 0, 1);

export function cameraFacingLocalQuaternion(
  parentWorldQuaternion: Quaternion,
  objectWorldPosition: Vector3,
  cameraWorldPosition: Vector3,
  cameraUp: Vector3,
  roll = 0,
  target = new Quaternion(),
): Quaternion {
  facingMatrix.lookAt(cameraWorldPosition, objectWorldPosition, cameraUp);
  worldFacingQuaternion.setFromRotationMatrix(facingMatrix);
  target.copy(parentWorldQuaternion).invert().multiply(worldFacingQuaternion);
  if (roll !== 0) {
    target.multiply(rollQuaternion.setFromAxisAngle(zAxis, roll));
  }
  return target;
}
