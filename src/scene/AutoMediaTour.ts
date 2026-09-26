interface AutoMediaTourOptions {
  focusMs: number;
  restMs: number;
}

export class AutoMediaTour {
  private active = false;
  private startedAt: number | null = null;

  constructor(private readonly options: AutoMediaTourOptions) {}

  start(): void {
    this.active = true;
    this.startedAt = null;
  }

  stop(): void {
    this.active = false;
    this.startedAt = null;
  }

  focusIndexAt(now: number, itemCount: number, ready: boolean): number | null {
    if (!this.active || !ready || itemCount <= 0) {
      this.startedAt = null;
      return null;
    }
    this.startedAt ??= now;
    const cycleMs = this.options.focusMs + this.options.restMs;
    const elapsed = Math.max(0, now - this.startedAt);
    const cycleElapsed = elapsed % cycleMs;
    if (cycleElapsed >= this.options.focusMs) return null;
    return Math.floor(elapsed / cycleMs) % itemCount;
  }
}
