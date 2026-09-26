export class StableMediaCandidate {
  private observedIndex = -1;
  private observedSince = 0;
  private stableIndex = -1;
  private missingSince: number | undefined;

  constructor(
    private readonly stabilityMs = 160,
    private readonly lossGraceMs = 120,
  ) {}

  update(candidateIndex: number, timestampMs: number): number {
    if (candidateIndex < 0) {
      this.observedIndex = -1;
      this.observedSince = timestampMs;
      this.missingSince ??= timestampMs;

      if (
        this.stableIndex >= 0
        && timestampMs - this.missingSince >= this.lossGraceMs
      ) {
        this.stableIndex = -1;
      }

      return this.stableIndex;
    }

    this.missingSince = undefined;

    if (candidateIndex === this.stableIndex) {
      this.observedIndex = candidateIndex;
      this.observedSince = timestampMs;
      return this.stableIndex;
    }

    if (candidateIndex !== this.observedIndex) {
      this.observedIndex = candidateIndex;
      this.observedSince = timestampMs;
      return this.stableIndex;
    }

    if (timestampMs - this.observedSince >= this.stabilityMs) {
      this.stableIndex = candidateIndex;
    }

    return this.stableIndex;
  }

  reset(): void {
    this.observedIndex = -1;
    this.observedSince = 0;
    this.stableIndex = -1;
    this.missingSince = undefined;
  }
}
