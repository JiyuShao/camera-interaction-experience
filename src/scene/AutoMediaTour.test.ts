import { describe, expect, it } from 'vitest';
import { AutoMediaTour } from './AutoMediaTour';

describe('AutoMediaTour', () => {
  it('waits for scattered mode, then focuses every card with a rest between cards', () => {
    const tour = new AutoMediaTour({ focusMs: 2400, restMs: 700 });
    tour.start();

    expect(tour.focusIndexAt(0, 3, false)).toBeNull();
    expect(tour.focusIndexAt(1000, 3, true)).toBe(0);
    expect(tour.focusIndexAt(3300, 3, true)).toBe(0);
    expect(tour.focusIndexAt(3500, 3, true)).toBeNull();
    expect(tour.focusIndexAt(4100, 3, true)).toBe(1);
    expect(tour.focusIndexAt(7200, 3, true)).toBe(2);
    expect(tour.focusIndexAt(10300, 3, true)).toBe(0);
  });

  it('clears focus as soon as automatic mode stops', () => {
    const tour = new AutoMediaTour({ focusMs: 2400, restMs: 700 });
    tour.start();
    expect(tour.focusIndexAt(0, 2, true)).toBe(0);
    tour.stop();
    expect(tour.focusIndexAt(100, 2, true)).toBeNull();
  });
});
