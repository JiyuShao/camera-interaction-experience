import { describe, expect, it } from 'vitest';
import { classifyHand, type HandLandmark } from './GestureClassifier';

describe('classifyHand', () => {
  it('recognizes an open palm using a three-of-four finger vote', () => {
    const landmarks = openHand();
    landmarks[20] = { x: 0.68, y: 0.62 };
    expect(classifyHand(landmarks)?.gesture).toBe('open-palm');
    expect(classifyHand(landmarks)?.extendedFingers).toBe(3);
  });

  it('recognizes a fist when fingertips fold back toward their knuckles', () => {
    expect(classifyHand(fistHand())?.gesture).toBe('fist');
  });

  it('gives pinch priority over an otherwise open hand', () => {
    const landmarks = openHand();
    landmarks[4] = { x: landmarks[8].x + 0.01, y: landmarks[8].y + 0.01 };
    expect(classifyHand(landmarks)?.gesture).toBe('pinch');
  });

  it('recognizes a natural bent-finger pinch instead of treating it as an open palm', () => {
    const landmarks = openHand();
    landmarks[4] = point(0.39, 0.65);
    landmarks[8] = point(0.38, 0.64);
    expect(classifyHand(landmarks)?.gesture).toBe('pinch');
  });

  it('does not mistake an open palm with a nearby thumb for a pinch', () => {
    const landmarks = openHand();
    landmarks[4] = point(0.44, 0.16);

    expect(classifyHand(landmarks)?.gesture).toBe('open-palm');
  });

  it('recognizes a finger heart when thumb and index meet above three curled fingers', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.4, 0.63, -0.02);
    landmarks[8] = point(0.39, 0.64, -0.1);

    expect(classifyHand(landmarks)?.gesture).toBe('finger-heart');
  });

  it('recognizes a roomy Korean finger heart instead of falling through to fist', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.43, 0.61, -0.02);
    landmarks[8] = point(0.39, 0.65, -0.1);

    expect(classifyHand(landmarks)?.gesture).toBe('finger-heart');
  });

  it('recognizes a tracked Korean heart even when landmark segments narrowly miss crossing', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.38, 0.62, -0.02);
    landmarks[8] = point(0.4, 0.64, -0.1);

    expect(classifyHand(landmarks)?.gesture).toBe('finger-heart');
  });

  it('treats close, clearly crossed thumb and index segments as a finger heart without depth help', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.43, 0.65);
    landmarks[8] = point(0.38, 0.64);

    expect(classifyHand(landmarks)?.gesture).toBe('finger-heart');
  });

  it('recognizes an upward-pointing thumb/index cross even when tracked segments narrowly miss', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.39, 0.38);
    landmarks[8] = point(0.37, 0.48);

    expect(classifyHand(landmarks)?.gesture).toBe('finger-heart');
  });

  it('rejects a heart-like pose when the thumb, rather than index finger, is nearer the camera', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.38, 0.62, -0.12);
    landmarks[8] = point(0.4, 0.64, -0.02);

    expect(classifyHand(landmarks)?.gesture).not.toBe('finger-heart');
  });

  it('recognizes a clearly crossed heart when palm orientation reverses depth', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.43, 0.65, -0.12);
    landmarks[8] = point(0.38, 0.64, -0.02);

    expect(classifyHand(landmarks)?.gesture).toBe('finger-heart');
  });

  it('does not turn a curled-finger heart candidate into a pinch without index-forward depth', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.38, 0.6, -0.03);
    landmarks[8] = point(0.39, 0.59, -0.03);

    expect(classifyHand(landmarks)?.gesture).toBe('fist');
  });

  it('keeps a closed fist with the thumb resting on the index finger classified as a fist', () => {
    const landmarks = fistHand();
    landmarks[4] = point(0.4, 0.63);
    landmarks[8] = point(0.42, 0.66);

    expect(classifyHand(landmarks)?.gesture).toBe('fist');
  });

  it('rejects incomplete landmark sets', () => {
    expect(classifyHand(openHand().slice(0, 10))).toBeNull();
  });

  it('uses metric world landmarks rather than the perspective-sensitive image pose', () => {
    const result = classifyHand({
      handedness: 'Right',
      imageLandmarks: fistHand(),
      worldLandmarks: pinchHand(),
    } as never);

    expect(result?.gesture).toBe('pinch');
  });

  it('keeps a mixed-support close-tip pose uncertain instead of forcing pinch', () => {
    const landmarks = pinchHand();
    landmarks[14] = point(0.59, 0.55);
    landmarks[16] = point(0.58, 0.66);

    expect(classifyHand(landmarks)?.gesture).toBe('neutral');
  });
});

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

function fistHand(): HandLandmark[] {
  const landmarks = openHand();
  landmarks[6] = point(0.4, 0.56);
  landmarks[8] = point(0.42, 0.66);
  landmarks[10] = point(0.49, 0.53);
  landmarks[12] = point(0.5, 0.64);
  landmarks[14] = point(0.59, 0.55);
  landmarks[16] = point(0.58, 0.66);
  landmarks[18] = point(0.68, 0.59);
  landmarks[20] = point(0.65, 0.7);
  landmarks[4] = point(0.34, 0.63);
  return landmarks;
}

function pinchHand(): HandLandmark[] {
  const landmarks = openHand();
  landmarks[4] = point(0.39, 0.65);
  landmarks[8] = point(0.38, 0.64);
  return landmarks;
}

function point(x: number, y: number, z = 0): HandLandmark {
  return { x, y, z };
}
