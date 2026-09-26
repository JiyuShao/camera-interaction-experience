import type { MediaItem } from '../config';

export interface MediaFocusCaptionState {
  text: string;
  visible: boolean;
}

export function mediaFocusCaptionState(
  item: MediaItem | null,
): MediaFocusCaptionState {
  if (!item) return { text: '', visible: false };
  return {
    text: item.caption?.trim() || item.alt,
    visible: true,
  };
}
