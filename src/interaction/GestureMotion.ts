export interface GestureMotionOptions {
  horizontalDeadZone: number;
  verticalDeadZone: number;
  maxYawSpeedRadPerSecond: number;
  maxPitchSpeedRadPerSecond: number;
  responseExponent: number;
}

export interface GestureMotionTarget {
  rotationX: number;
  rotationY: number;
}

export class GestureMotionController {
  private lastTimestamp: number | null = null;

  constructor(private readonly options: GestureMotionOptions) {}

  update(
    palmX: number,
    palmY: number,
    currentRotationX: number,
    currentRotationY: number,
    timestamp: number,
  ): GestureMotionTarget {
    const deltaSeconds = this.lastTimestamp === null
      ? 0
      : clamp((timestamp - this.lastTimestamp) / 1000, 0, 0.15);
    this.lastTimestamp = timestamp;

    const yawVelocity = axisVelocity(
      palmX - 0.5,
      this.options.horizontalDeadZone,
      this.options.maxYawSpeedRadPerSecond,
      this.options.responseExponent,
    );
    const pitchVelocity = axisVelocity(
      palmY - 0.5,
      this.options.verticalDeadZone,
      this.options.maxPitchSpeedRadPerSecond,
      this.options.responseExponent,
    );

    return {
      rotationX: currentRotationX + pitchVelocity * deltaSeconds,
      rotationY: currentRotationY + yawVelocity * deltaSeconds,
    };
  }

  end(): void {
    this.lastTimestamp = null;
  }
}

function axisVelocity(
  offset: number,
  deadZone: number,
  maxSpeed: number,
  responseExponent: number,
): number {
  const offsetMagnitude = Math.abs(offset);
  if (offsetMagnitude <= deadZone) return 0;

  const activeRange = Math.max(0.001, 0.5 - deadZone);
  const normalizedSpeed = clamp((offsetMagnitude - deadZone) / activeRange, 0, 1);
  return Math.sign(offset) * normalizedSpeed ** responseExponent * maxSpeed;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
