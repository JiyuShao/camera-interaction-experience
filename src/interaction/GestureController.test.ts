import { describe, expect, it, vi } from 'vitest';
import { experienceConfig } from '../config';
import { GestureController, type GestureControllerCallbacks } from './GestureController';
import type { HandLandmark } from './GestureClassifier';

describe('GestureController', () => {
  it('requires a gesture to remain stable before emitting it', () => {
    const onGesture = vi.fn();
    const controller = createController(onGesture);
    const hand = openHand();

    controller.process(hand, 0);
    controller.process(hand, 180);
    expect(onGesture).not.toHaveBeenCalled();
    controller.process(hand, 260);
    expect(onGesture).toHaveBeenCalledWith('open-palm', expect.any(Object));
  });

  it('keeps tracking through a brief landmark loss', () => {
    const onTrackingChange = vi.fn();
    const controller = createController(vi.fn(), onTrackingChange);
    controller.process(openHand(), 0);
    controller.process(null, 400);
    expect(onTrackingChange).toHaveBeenCalledTimes(1);
    controller.process(null, 801);
    expect(onTrackingChange).toHaveBeenLastCalledWith(false);
  });

  it('reports progress while a pinch is being held for confirmation', () => {
    const onCandidate = vi.fn();
    const controller = new GestureController(
      { confirmationMs: 240, pinchReleaseMs: 420, lossGraceMs: 800 },
      {
        onGesture: vi.fn(),
        onPalmMove: vi.fn(),
        onTrackingChange: vi.fn(),
        onCandidate,
      },
    );

    controller.process(pinchHand(), 0);
    controller.process(pinchHand(), 120);

    expect(onCandidate).toHaveBeenLastCalledWith('pinch', 0.5, expect.any(Object));
  });

  it('uses a longer release hold before changing a stable pinch into an open palm', () => {
    const onGesture = vi.fn();
    const controller = new GestureController(
      { confirmationMs: 240, pinchReleaseMs: 420, lossGraceMs: 800 },
      {
        onGesture,
        onPalmMove: vi.fn(),
        onTrackingChange: vi.fn(),
      },
    );

    controller.process(pinchHand(), 0);
    controller.process(pinchHand(), 240);
    onGesture.mockClear();
    controller.process(openHand(), 300);
    controller.process(openHand(), 560);
    expect(onGesture).not.toHaveBeenCalled();
    controller.process(openHand(), 720);
    expect(onGesture).toHaveBeenCalledWith('open-palm', expect.any(Object));
  });

  it('emits a fist after finger-heart has toggled automatic mode off', () => {
    const onGesture = vi.fn();
    const controller = createController(onGesture);

    controller.process(fingerHeartHand(), 0);
    controller.process(fingerHeartHand(), 240);
    controller.process(null, 1100);
    controller.process(fingerHeartHand(), 1200);
    controller.process(fingerHeartHand(), 1440);
    controller.process(restingThumbFistHand(), 1500);
    controller.process(restingThumbFistHand(), 1740);

    expect(onGesture.mock.calls.map(([gesture]) => gesture)).toEqual([
      'finger-heart',
      'neutral',
      'finger-heart',
      'fist',
    ]);
  });

  it('ignores one noisy pinch frame while a finger heart is being confirmed', () => {
    const onGesture = vi.fn();
    const controller = new GestureController(
      {
        confirmationMs: 240,
        heartConfirmationMs: 240,
        pinchReleaseMs: 420,
        lossGraceMs: 800,
        stabilityFrames: 2,
      },
      { onGesture, onTrackingChange: vi.fn(), onPalmMove: vi.fn() },
    );

    controller.process(fingerHeartHand(), 0);
    controller.process(fingerHeartHand(), 80);
    controller.process(pinchHand(), 140);
    controller.process(fingerHeartHand(), 220);
    controller.process(fingerHeartHand(), 260);

    expect(onGesture).toHaveBeenCalledWith('finger-heart', expect.any(Object));
  });

  it('requires three consecutive evidence frames before a gesture can trigger', () => {
    const onGesture = vi.fn();
    const controller = new GestureController(
      {
        confirmationMs: 0,
        evidenceFrames: 3,
        pinchReleaseMs: 420,
        lossGraceMs: 800,
      } as never,
      { onGesture, onTrackingChange: vi.fn(), onPalmMove: vi.fn() },
    );

    controller.process(pinchHand(), 0);
    controller.process(pinchHand(), 120);
    expect(onGesture).not.toHaveBeenCalled();

    controller.process(pinchHand(), 240);
    expect(onGesture).toHaveBeenCalledWith('pinch', expect.any(Object));
  });

  it('confirms a finger heart within 335 ms at the configured inference rate', () => {
    const onGesture = vi.fn();
    const controller = configuredController(onGesture);

    for (const timestamp of [0, 67, 134, 201, 268, 335]) {
      controller.process(fingerHeartHand(), timestamp);
    }

    expect(onGesture).toHaveBeenCalledWith('finger-heart', expect.any(Object));
  });

  it('confirms a pinch within 201 ms at the configured inference rate', () => {
    const onGesture = vi.fn();
    const controller = configuredController(onGesture);

    for (const timestamp of [0, 67, 134, 201]) {
      controller.process(pinchHand(), timestamp);
    }

    expect(onGesture).toHaveBeenCalledWith('pinch', expect.any(Object));
  });

  it('does not trigger a finger heart from one crossed frame surrounded by fists', () => {
    const onGesture = vi.fn();
    const controller = configuredController(onGesture);

    controller.process(restingThumbFistHand(), 0);
    controller.process(crossedFingerHeartHand(), 67);
    controller.process(restingThumbFistHand(), 134);
    controller.process(restingThumbFistHand(), 201);
    controller.process(restingThumbFistHand(), 268);

    expect(onGesture).not.toHaveBeenCalledWith('finger-heart', expect.any(Object));
  });
});

function configuredController(
  onGesture: GestureControllerCallbacks['onGesture'],
): GestureController {
  return new GestureController(
    {
      confirmationMs: experienceConfig.gestures.confirmationMs,
      heartConfirmationMs: experienceConfig.gestures.heartConfirmationMs,
      evidenceFrames: experienceConfig.gestures.evidenceFrames,
      pinchReleaseMs: experienceConfig.gestures.pinchReleaseMs,
      lossGraceMs: experienceConfig.gestures.lossGraceMs,
      filterMinCutoff: experienceConfig.gestures.filterMinCutoff,
      filterBeta: experienceConfig.gestures.filterBeta,
      filterDerivativeCutoff: experienceConfig.gestures.filterDerivativeCutoff,
    },
    { onGesture, onTrackingChange: vi.fn(), onPalmMove: vi.fn() },
  );
}

function createController(
  onGesture: GestureControllerCallbacks['onGesture'],
  onTrackingChange: GestureControllerCallbacks['onTrackingChange'] = vi.fn(),
): GestureController {
  return new GestureController(
    { confirmationMs: 240, pinchReleaseMs: 420, lossGraceMs: 800 },
    { onGesture, onTrackingChange, onPalmMove: vi.fn() },
  );
}

function openHand(): HandLandmark[] {
  return [
    point(0.5, 0.9),
    point(0.4, 0.78), point(0.33, 0.67), point(0.27, 0.57), point(0.2, 0.48),
    point(0.39, 0.65), point(0.37, 0.47), point(0.36, 0.3), point(0.35, 0.12),
    point(0.49, 0.61), point(0.49, 0.4), point(0.49, 0.23), point(0.49, 0.07),
    point(0.58, 0.64), point(0.6, 0.45), point(0.61, 0.3), point(0.62, 0.15),
    point(0.67, 0.7), point(0.7, 0.53), point(0.72, 0.4), point(0.74, 0.27),
  ];
}

function pinchHand(): HandLandmark[] {
  const landmarks = openHand();
  landmarks[4] = point(0.39, 0.65);
  landmarks[8] = point(0.38, 0.64);
  return landmarks;
}

function fingerHeartHand(): HandLandmark[] {
  const landmarks = restingThumbFistHand();
  landmarks[4] = point(0.38, 0.62, -0.02);
  landmarks[8] = point(0.4, 0.64, -0.1);
  return landmarks;
}

function crossedFingerHeartHand(): HandLandmark[] {
  const landmarks = restingThumbFistHand();
  landmarks[4] = point(0.43, 0.65);
  landmarks[8] = point(0.38, 0.64);
  return landmarks;
}

function restingThumbFistHand(): HandLandmark[] {
  const landmarks = openHand();
  landmarks[6] = point(0.4, 0.56);
  landmarks[8] = point(0.42, 0.66);
  landmarks[10] = point(0.49, 0.53);
  landmarks[12] = point(0.5, 0.64);
  landmarks[14] = point(0.59, 0.55);
  landmarks[16] = point(0.58, 0.66);
  landmarks[18] = point(0.68, 0.59);
  landmarks[20] = point(0.65, 0.7);
  landmarks[4] = point(0.4, 0.63);
  return landmarks;
}

function point(x: number, y: number, z = 0): HandLandmark {
  return { x, y, z };
}
