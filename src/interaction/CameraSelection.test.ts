import { describe, expect, it } from 'vitest';
import { buildVideoConstraints, cameraOptions } from './CameraSelection';

describe('buildVideoConstraints', () => {
  it('requests the camera explicitly selected by the visitor', () => {
    const constraints = buildVideoConstraints('camera-b');
    expect(constraints.deviceId).toEqual({ exact: 'camera-b' });
  });

  it('only treats the front camera as an ideal when no device was selected', () => {
    const constraints = buildVideoConstraints();
    expect(constraints.deviceId).toBeUndefined();
    expect(constraints.facingMode).toEqual({ ideal: 'user' });
  });

  it('maps available video inputs to labelled picker options', () => {
    const devices = [
      device('audioinput', 'mic', 'Microphone'),
      device('videoinput', 'camera-a', 'Built-in Camera'),
      device('videoinput', 'camera-b', ''),
    ];
    expect(cameraOptions(devices)).toEqual([
      { deviceId: 'camera-a', label: 'Built-in Camera' },
      { deviceId: 'camera-b', label: '摄像头 2' },
    ]);
  });
});

function device(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) };
}
