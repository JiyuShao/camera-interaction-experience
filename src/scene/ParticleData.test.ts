import { describe, expect, it } from 'vitest';
import { PARTICLE_FILE_HEADER_BYTES, parseParticleData } from './ParticleData';

describe('parseParticleData', () => {
  it('reads the SBP1 particle format', () => {
    const buffer = new ArrayBuffer(PARTICLE_FILE_HEADER_BYTES + 6 * 4);
    const bytes = new Uint8Array(buffer);
    bytes.set([83, 66, 80, 49]);
    const view = new DataView(buffer);
    view.setUint32(4, 2, true);
    view.setUint32(8, 3, true);
    new Float32Array(buffer, PARTICLE_FILE_HEADER_BYTES).set([1, 2, 3, 4, 5, 6]);

    const result = parseParticleData(buffer);
    expect(result.count).toBe(2);
    expect([...result.positions]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('rejects corrupt data', () => {
    expect(() => parseParticleData(new ArrayBuffer(20))).toThrow('unsupported or corrupt');
  });
});
