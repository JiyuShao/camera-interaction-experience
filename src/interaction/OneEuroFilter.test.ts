import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from './OneEuroFilter';

describe('OneEuroFilter', () => {
  it('reduces small alternating score jitter', () => {
    const filter = new OneEuroFilter({ minCutoff: 1.2, beta: 0.08, derivativeCutoff: 1 });
    const raw = [0.5, 0.58, 0.43, 0.57, 0.44, 0.55];
    const filtered = raw.map((value, index) => filter.filter(value, index * 67));

    expect(range(filtered.slice(1))).toBeLessThan(range(raw.slice(1)));
  });
});

function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}
