export interface OneEuroFilterOptions {
  minCutoff: number;
  beta: number;
  derivativeCutoff: number;
}

export class OneEuroFilter {
  private previousRaw: number | null = null;
  private previousFiltered: number | null = null;
  private previousDerivative = 0;
  private previousTimestamp: number | null = null;

  constructor(private readonly options: OneEuroFilterOptions) {}

  filter(value: number, timestamp: number): number {
    if (
      this.previousRaw === null
      || this.previousFiltered === null
      || this.previousTimestamp === null
    ) {
      this.previousRaw = value;
      this.previousFiltered = value;
      this.previousTimestamp = timestamp;
      return value;
    }

    const elapsedSeconds = Math.max((timestamp - this.previousTimestamp) / 1000, 1 / 240);
    const derivative = (value - this.previousRaw) / elapsedSeconds;
    const filteredDerivative = lowPass(
      derivative,
      this.previousDerivative,
      smoothingAlpha(this.options.derivativeCutoff, elapsedSeconds),
    );
    const cutoff = this.options.minCutoff + this.options.beta * Math.abs(filteredDerivative);
    const filtered = lowPass(
      value,
      this.previousFiltered,
      smoothingAlpha(cutoff, elapsedSeconds),
    );

    this.previousRaw = value;
    this.previousFiltered = filtered;
    this.previousDerivative = filteredDerivative;
    this.previousTimestamp = timestamp;
    return filtered;
  }

  reset(): void {
    this.previousRaw = null;
    this.previousFiltered = null;
    this.previousDerivative = 0;
    this.previousTimestamp = null;
  }
}

function smoothingAlpha(cutoff: number, elapsedSeconds: number): number {
  const safeCutoff = Math.max(cutoff, Number.EPSILON);
  const timeConstant = 1 / (2 * Math.PI * safeCutoff);
  return 1 / (1 + timeConstant / elapsedSeconds);
}

function lowPass(value: number, previous: number, alpha: number): number {
  return alpha * value + (1 - alpha) * previous;
}
