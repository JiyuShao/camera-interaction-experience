import { describe, expect, it } from 'vitest';
import { StableMediaCandidate } from './StableMediaCandidate';

describe('StableMediaCandidate', () => {
  it('waits for a candidate to remain stable before selecting it', () => {
    const candidate = new StableMediaCandidate(160, 120);

    expect(candidate.update(2, 0)).toBe(-1);
    expect(candidate.update(2, 120)).toBe(-1);
    expect(candidate.update(2, 160)).toBe(2);
  });

  it('keeps the current selection through a brief challenger', () => {
    const candidate = new StableMediaCandidate(160, 120);

    candidate.update(2, 0);
    candidate.update(2, 160);

    expect(candidate.update(4, 200)).toBe(2);
    expect(candidate.update(2, 240)).toBe(2);
  });

  it('uses a short grace period before clearing a missing candidate', () => {
    const candidate = new StableMediaCandidate(160, 120);

    candidate.update(2, 0);
    candidate.update(2, 160);

    expect(candidate.update(-1, 200)).toBe(2);
    expect(candidate.update(-1, 319)).toBe(2);
    expect(candidate.update(-1, 320)).toBe(-1);
  });
});
