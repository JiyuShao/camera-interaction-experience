import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NoColorSpace,
  Points,
  ShaderMaterial,
  Texture,
} from 'three';
import type { ExperienceConfig } from '../config';
import { createParticleAppearance } from './ParticleAppearance';
import vertexShader from '../shaders/baby.vert.glsl?raw';
import fragmentShader from '../shaders/baby.frag.glsl?raw';

export class BabyParticles extends Points<BufferGeometry, ShaderMaterial> {
  constructor(
    allPositions: Float32Array,
    count: number,
    leafTexture: Texture,
    config: ExperienceConfig,
    pixelRatio: number,
  ) {
    const positions = allPositions.slice(0, count * 3);
    const scatter = new Float32Array(count * 3);
    const randomValues = new Float32Array(count);
    const sizes = new Float32Array(count);
    const kinds = new Float32Array(count);
    const angles = new Float32Array(count);
    const tones = new Float32Array(count);
    const random = mulberry32(0x53544152);

    for (let index = 0; index < count; index += 1) {
      const value = random();
      const angle = random() * Math.PI * 2;
      const radius = 1.05 + random() ** 0.62 * 2.5;
      scatter[index * 3] = Math.cos(angle) * radius * 0.86 + (random() - 0.5) * 0.45;
      scatter[index * 3 + 1] = (random() - 0.5) * 3.7 + Math.sin(angle * 2) * 0.26;
      scatter[index * 3 + 2] = Math.sin(angle) * radius * 0.52 + (random() - 0.5) * 0.9;
      randomValues[index] = value;
      angles[index] = random() * Math.PI * 2;
      tones[index] = random();

      const appearance = createParticleAppearance(value, random(), config.particles);
      kinds[index] = appearance.kind;
      sizes[index] = appearance.size;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aScatter', new BufferAttribute(scatter, 3));
    geometry.setAttribute('aRandom', new BufferAttribute(randomValues, 1));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aKind', new BufferAttribute(kinds, 1));
    geometry.setAttribute('aAngle', new BufferAttribute(angles, 1));
    geometry.setAttribute('aTone', new BufferAttribute(tones, 1));

    leafTexture.colorSpace = NoColorSpace;
    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScatter: { value: 1 },
        uPixelRatio: { value: pixelRatio },
        uLeafMap: { value: leafTexture },
        uOpacity: { value: 0.62 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    super(geometry, material);
    this.frustumCulled = false;
  }

  get scatter(): number {
    return this.material.uniforms.uScatter.value as number;
  }

  set scatter(value: number) {
    this.material.uniforms.uScatter.value = value;
  }

  update(timeSeconds: number, pixelRatio: number): void {
    this.material.uniforms.uTime.value = timeSeconds;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
