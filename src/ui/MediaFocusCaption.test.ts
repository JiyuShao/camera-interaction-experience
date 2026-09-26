import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../config';
import { mediaFocusCaptionState } from './MediaFocusCaption';

const item: MediaItem = {
  kind: 'image',
  src: '/memory.jpg',
  alt: '宝宝在毛毯上的照片',
  caption: '这是一段温柔的回忆',
};

describe('focused media caption', () => {
  it('shows the configured caption for a focused photo', () => {
    expect(mediaFocusCaptionState(item)).toEqual({
      text: '这是一段温柔的回忆',
      visible: true,
    });
  });

  it('falls back to alt text when the caption is empty', () => {
    expect(mediaFocusCaptionState({ ...item, caption: '  ' })).toEqual({
      text: '宝宝在毛毯上的照片',
      visible: true,
    });
  });

  it('hides and clears the caption when focus is released', () => {
    expect(mediaFocusCaptionState(null)).toEqual({ text: '', visible: false });
  });
});
