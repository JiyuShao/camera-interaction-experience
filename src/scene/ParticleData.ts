export const PARTICLE_FILE_HEADER_BYTES = 16;

export interface ParticleData {
  count: number;
  positions: Float32Array;
}

export async function loadParticleData(url: string): Promise<ParticleData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load particle data (${response.status}).`);
  }
  return parseParticleData(await response.arrayBuffer());
}

export function parseParticleData(buffer: ArrayBuffer): ParticleData {
  if (buffer.byteLength < PARTICLE_FILE_HEADER_BYTES) {
    throw new Error('Particle file is too small.');
  }

  const bytes = new Uint8Array(buffer, 0, 4);
  const magic = String.fromCharCode(...bytes);
  const view = new DataView(buffer);
  const count = view.getUint32(4, true);
  const components = view.getUint32(8, true);
  const expectedBytes = PARTICLE_FILE_HEADER_BYTES + count * components * Float32Array.BYTES_PER_ELEMENT;

  if (magic !== 'SBP1' || components !== 3 || buffer.byteLength !== expectedBytes) {
    throw new Error('Particle file has an unsupported or corrupt format.');
  }

  return {
    count,
    positions: new Float32Array(buffer, PARTICLE_FILE_HEADER_BYTES, count * components),
  };
}
