import { MeshBasicMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createMediaCardSurface } from './MediaCardSurface';

describe('createMediaCardSurface', () => {
  it('uses a real plane mesh instead of a camera-facing sprite', () => {
    const surface = createMediaCardSurface(
      new MeshBasicMaterial({ map: new Texture() }),
    );

    expect(surface.isMesh).toBe(true);
    expect(surface.type).toBe('Mesh');
  });
});
