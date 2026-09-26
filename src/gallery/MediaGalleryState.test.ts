import { describe, expect, it } from 'vitest';
import { MediaGalleryState } from './MediaGalleryState';

describe('MediaGalleryState', () => {
  it('wraps forwards and backwards across any number of media items', () => {
    const state = new MediaGalleryState(7);
    expect(state.move(-1)).toBe(6);
    expect(state.move(1)).toBe(0);
    expect(state.select(9)).toBe(2);
  });

  it('stays stable when the gallery has no configured media', () => {
    const state = new MediaGalleryState(0);
    expect(state.move(1)).toBe(0);
    expect(state.select(12)).toBe(0);
  });

  it('rejects invalid media counts', () => {
    expect(() => new MediaGalleryState(-1)).toThrow('non-negative integer');
    expect(() => new MediaGalleryState(1.5)).toThrow('non-negative integer');
  });
});
