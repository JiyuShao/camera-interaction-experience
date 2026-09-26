export interface CameraOption {
  deviceId: string;
  label: string;
}

export function buildVideoConstraints(preferredDeviceId?: string): MediaTrackConstraints {
  const selection = preferredDeviceId
    ? { deviceId: { exact: preferredDeviceId } }
    : { facingMode: { ideal: 'user' } };

  return {
    ...selection,
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24, max: 30 },
  };
}

export function cameraOptions(devices: readonly MediaDeviceInfo[]): CameraOption[] {
  return devices
    .filter((device) => device.kind === 'videoinput' && device.deviceId)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() || `摄像头 ${index + 1}`,
    }));
}
