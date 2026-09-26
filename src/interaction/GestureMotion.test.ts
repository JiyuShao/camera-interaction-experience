import { describe, expect, it } from 'vitest';
import { GestureMotionController } from './GestureMotion';

const options = {
  horizontalDeadZone: 0.08,
  verticalDeadZone: 0.08,
  maxYawSpeedRadPerSecond: 1.5,
  maxPitchSpeedRadPerSecond: 1.2,
  responseExponent: 1.35,
};

describe('GestureMotionController', () => {
  it('keeps rotating while the palm remains to one side', () => {
    const motion = new GestureMotionController(options);
    let rotationX = 0;
    let rotationY = 0;

    for (let frame = 0; frame <= 30; frame += 1) {
      const target = motion.update(0.85, 0.5, rotationX, rotationY, frame * (1000 / 15));
      rotationX = target.rotationX;
      rotationY = target.rotationY;
    }

    expect(rotationY).toBeGreaterThan(0.9);
  });

  it('keeps rotating vertically while the palm remains away from center', () => {
    const motion = new GestureMotionController(options);
    let rotationX = 0;
    let rotationY = 0;

    for (let frame = 0; frame <= 30; frame += 1) {
      const target = motion.update(0.5, 0.85, rotationX, rotationY, frame * (1000 / 15));
      rotationX = target.rotationX;
      rotationY = target.rotationY;
    }

    expect(rotationX).toBeGreaterThan(0.9);
  });

  it('does not drift when the palm stays inside the horizontal dead zone', () => {
    const motion = new GestureMotionController(options);
    const target = motion.update(0.53, 0.5, 0.4, 1.2, 1000);
    expect(target.rotationX).toBe(0.4);
    expect(target.rotationY).toBe(1.2);
  });

  it('does not drift when the palm stays inside the vertical dead zone', () => {
    const motion = new GestureMotionController(options);
    const target = motion.update(0.5, 0.54, 0.4, 1.2, 1000);
    expect(target.rotationX).toBe(0.4);
    expect(target.rotationY).toBe(1.2);
  });

  it('rotates vertically in opposite directions above and below center', () => {
    const upward = simulateVerticalRotation(15, 0.15);
    const downward = simulateVerticalRotation(15, 0.85);
    expect(upward).toBeLessThan(0);
    expect(downward).toBeGreaterThan(0);
    expect(upward).toBeCloseTo(-downward, 5);
  });

  it('does not jump after tracking is lost and later resumes', () => {
    const motion = new GestureMotionController(options);
    motion.update(0.9, 0.5, 0, 0.4, 0);
    const beforeLoss = motion.update(0.9, 0.5, 0, 0.4, 100).rotationY;
    motion.end();

    const afterResume = motion.update(0.9, 0.5, 0, beforeLoss, 10_000).rotationY;
    expect(afterResume).toBe(beforeLoss);
  });

  it('covers the same rotation at different tracking frame rates', () => {
    expect(simulateRotation(15)).toBeCloseTo(simulateRotation(30), 5);
  });
});

function simulateRotation(fps: number): number {
  const motion = new GestureMotionController(options);
  let rotationX = 0;
  let rotationY = 0;
  for (let frame = 0; frame <= fps * 2; frame += 1) {
    const target = motion.update(0.85, 0.5, rotationX, rotationY, frame * (1000 / fps));
    rotationX = target.rotationX;
    rotationY = target.rotationY;
  }
  return rotationY;
}

function simulateVerticalRotation(fps: number, palmY: number): number {
  const motion = new GestureMotionController(options);
  let rotationX = 0;
  let rotationY = 0;
  for (let frame = 0; frame <= fps * 2; frame += 1) {
    const target = motion.update(0.5, palmY, rotationX, rotationY, frame * (1000 / fps));
    rotationX = target.rotationX;
    rotationY = target.rotationY;
  }
  return rotationX;
}
