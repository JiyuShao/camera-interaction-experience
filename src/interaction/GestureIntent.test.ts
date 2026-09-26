import { describe, expect, it } from 'vitest';
import { GestureIntent, type GestureIntentAction } from './GestureIntent';

describe('GestureIntent', () => {
  it('treats pinch as a momentary photo focus and consumes its release', () => {
    const intent = new GestureIntent();

    expect(intent.resolve('pinch')).toBe<GestureIntentAction>('focus-media');
    expect(intent.resolve('open-palm')).toBe<GestureIntentAction>('release-media');
    expect(intent.isMediaFocused).toBe(false);
  });

  it('keeps normal gather and scatter gestures outside photo focus', () => {
    const intent = new GestureIntent();

    expect(intent.resolve('fist')).toBe<GestureIntentAction>('gather');
    expect(intent.resolve('open-palm')).toBe<GestureIntentAction>('scatter');
  });

  it('maps each newly confirmed finger heart to an automatic-tour toggle', () => {
    const intent = new GestureIntent();

    expect(intent.resolve('finger-heart')).toBe<GestureIntentAction>('toggle-auto-media');
    expect(intent.resolve('neutral')).toBe<GestureIntentAction>('none');
    expect(intent.resolve('finger-heart')).toBe<GestureIntentAction>('toggle-auto-media');
  });
});
