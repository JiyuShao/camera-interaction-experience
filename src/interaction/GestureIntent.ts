import type { HandGesture } from './GestureClassifier';

export type GestureIntentAction =
  | 'none'
  | 'gather'
  | 'scatter'
  | 'focus-media'
  | 'release-media'
  | 'toggle-auto-media';

export class GestureIntent {
  private mediaFocused = false;

  get isMediaFocused(): boolean {
    return this.mediaFocused;
  }

  resolve(gesture: HandGesture): GestureIntentAction {
    if (gesture === 'finger-heart') {
      this.mediaFocused = false;
      return 'toggle-auto-media';
    }

    if (gesture === 'pinch') {
      this.mediaFocused = true;
      return 'focus-media';
    }

    if (this.mediaFocused) {
      this.mediaFocused = false;
      return 'release-media';
    }

    if (gesture === 'fist') return 'gather';
    if (gesture === 'open-palm') return 'scatter';
    return 'none';
  }
}
