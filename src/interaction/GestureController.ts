import {
  classifyHand,
  resolveGesture,
  type GestureObservation,
  type HandFrame,
  type HandGesture,
  type HandLandmark,
} from './GestureClassifier';
import { OneEuroFilter } from './OneEuroFilter';

export interface GestureControllerOptions {
  confirmationMs: number;
  heartConfirmationMs?: number;
  evidenceFrames?: number;
  /** @deprecated Use evidenceFrames. */
  stabilityFrames?: number;
  pinchReleaseMs: number;
  lossGraceMs: number;
  filterMinCutoff?: number;
  filterBeta?: number;
  filterDerivativeCutoff?: number;
}

export interface GestureControllerCallbacks {
  onGesture(gesture: HandGesture, observation: GestureObservation | null): void;
  onCandidate?(gesture: HandGesture, progress: number, observation: GestureObservation | null): void;
  onPalmMove(x: number, y: number, timestamp: number): void;
  onTrackingChange(hasHand: boolean): void;
}

export class GestureController {
  private candidate: HandGesture = 'neutral';
  private candidateSince = 0;
  private stableGesture: HandGesture = 'neutral';
  private filteredGesture: HandGesture = 'neutral';
  private pendingGesture: HandGesture = 'neutral';
  private pendingSince = 0;
  private pendingFrames = 0;
  private lastSeenAt = Number.NEGATIVE_INFINITY;
  private tracking = false;
  private readonly pinchScoreFilter: OneEuroFilter;
  private readonly heartScoreFilter: OneEuroFilter;
  private readonly palmXFilter: OneEuroFilter;
  private readonly palmYFilter: OneEuroFilter;

  constructor(
    private readonly options: GestureControllerOptions,
    private readonly callbacks: GestureControllerCallbacks,
  ) {
    const scoreFilterOptions = {
      minCutoff: options.filterMinCutoff ?? 1.2,
      beta: options.filterBeta ?? 0.08,
      derivativeCutoff: options.filterDerivativeCutoff ?? 1,
    };
    const motionFilterOptions = { ...scoreFilterOptions, beta: Math.max(scoreFilterOptions.beta, 0.25) };
    this.pinchScoreFilter = new OneEuroFilter(scoreFilterOptions);
    this.heartScoreFilter = new OneEuroFilter(scoreFilterOptions);
    this.palmXFilter = new OneEuroFilter(motionFilterOptions);
    this.palmYFilter = new OneEuroFilter(motionFilterOptions);
  }

  process(
    frame: HandFrame | readonly HandLandmark[] | null,
    timestamp: number,
  ): void {
    const rawObservation = frame ? classifyHand(frame) : null;
    if (!rawObservation) {
      if (this.tracking && timestamp - this.lastSeenAt >= this.options.lossGraceMs) {
        this.tracking = false;
        this.callbacks.onTrackingChange(false);
        this.resetStabilizer();
        this.resetFilters();
        this.setCandidate('neutral', timestamp, null, true);
      }
      return;
    }

    const observation = this.filterObservation(rawObservation, timestamp);

    this.lastSeenAt = timestamp;
    if (!this.tracking) {
      this.tracking = true;
      this.callbacks.onTrackingChange(true);
    }
    this.callbacks.onPalmMove(observation.palmX, observation.palmY, timestamp);
    const stabilized = this.stabilizeGesture(observation.gesture, timestamp);
    this.setCandidate(
      stabilized.gesture,
      timestamp,
      observation,
      false,
      stabilized.since,
    );
  }

  reset(): void {
    this.candidate = 'neutral';
    this.candidateSince = 0;
    this.stableGesture = 'neutral';
    this.resetStabilizer();
    this.resetFilters();
    this.lastSeenAt = Number.NEGATIVE_INFINITY;
    if (this.tracking) this.callbacks.onTrackingChange(false);
    this.tracking = false;
    this.callbacks.onGesture('neutral', null);
  }

  private setCandidate(
    gesture: HandGesture,
    timestamp: number,
    observation: GestureObservation | null,
    immediately = false,
    candidateSince?: number,
  ): void {
    if (gesture !== this.candidate) {
      this.candidate = gesture;
      this.candidateSince = candidateSince ?? timestamp;
    }

    let confirmationMs = gesture === 'finger-heart'
      ? this.options.heartConfirmationMs ?? this.options.confirmationMs
      : this.options.confirmationMs;
    if (this.stableGesture === 'pinch' && gesture !== 'pinch') {
      confirmationMs = Math.max(confirmationMs, this.options.pinchReleaseMs);
    }
    const progress = immediately || confirmationMs <= 0
      ? 1
      : Math.min(1, Math.max(0, (timestamp - this.candidateSince) / confirmationMs));
    this.callbacks.onCandidate?.(gesture, progress, observation);

    if (
      gesture !== this.stableGesture &&
      progress >= 1
    ) {
      this.stableGesture = gesture;
      this.callbacks.onGesture(gesture, observation);
    }
  }

  private stabilizeGesture(
    gesture: HandGesture,
    timestamp: number,
  ): { gesture: HandGesture; since?: number } {
    const requiredFrames = Math.max(
      1,
      Math.floor(this.options.evidenceFrames ?? this.options.stabilityFrames ?? 1),
    );
    if (requiredFrames === 1) {
      this.filteredGesture = gesture;
      return { gesture, since: timestamp };
    }

    if (gesture === this.filteredGesture) {
      this.pendingGesture = this.filteredGesture;
      this.pendingFrames = 0;
      return { gesture: this.filteredGesture };
    }

    if (gesture !== this.pendingGesture) {
      this.pendingGesture = gesture;
      this.pendingSince = timestamp;
      this.pendingFrames = 1;
      return { gesture: this.filteredGesture };
    }

    this.pendingFrames += 1;
    if (this.pendingFrames >= requiredFrames) {
      const since = this.pendingSince;
      this.filteredGesture = gesture;
      this.pendingFrames = 0;
      return { gesture, since };
    }

    return { gesture: this.filteredGesture };
  }

  private resetStabilizer(): void {
    this.filteredGesture = 'neutral';
    this.pendingGesture = 'neutral';
    this.pendingSince = 0;
    this.pendingFrames = 0;
  }

  private filterObservation(
    observation: GestureObservation,
    timestamp: number,
  ): GestureObservation {
    const filtered = {
      ...observation,
      palmX: this.palmXFilter.filter(observation.palmX, timestamp),
      palmY: this.palmYFilter.filter(observation.palmY, timestamp),
      pinchScore: this.pinchScoreFilter.filter(observation.pinchScore, timestamp),
      heartScore: this.heartScoreFilter.filter(observation.heartScore, timestamp),
    };
    filtered.gesture = resolveGesture(filtered, this.filteredGesture);
    if (
      (this.stableGesture === 'pinch' && observation.pinchScore < 0.42)
      || (this.stableGesture === 'finger-heart' && observation.heartScore < 0.42)
    ) {
      // Filtering should stabilize entry, but must not postpone the beginning
      // of a deliberate release. Confirmation/evidence still reject a single
      // bad frame after this raw exit signal.
      filtered.gesture = observation.gesture;
    }
    return filtered;
  }

  private resetFilters(): void {
    this.pinchScoreFilter.reset();
    this.heartScoreFilter.reset();
    this.palmXFilter.reset();
    this.palmYFilter.reset();
  }
}
