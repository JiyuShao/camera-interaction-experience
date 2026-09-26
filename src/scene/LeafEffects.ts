import {
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NoColorSpace,
  NormalBlending,
  ShaderMaterial,
  Texture,
} from 'three';
import type { ExperienceConfig } from '../config';
import leafFragmentShader from '../shaders/leaf.frag.glsl?raw';
import modelVertexShader from '../shaders/model-leaf.vert.glsl?raw';
import { getStructuralLeafCount } from './LeafPresentation';

export class ModelLeaves extends Mesh<InstancedBufferGeometry, ShaderMaterial> {
  constructor(
    allPositions: Float32Array,
    particleCount: number,
    leafTexture: Texture,
    config: ExperienceConfig,
  ) {
    const count = getStructuralLeafCount(particleCount, config.particles.structuralLeafRatio);
    const geometry = createModelLeafGeometry(allPositions, particleCount, count, config);
    const material = createLeafMaterial(leafTexture, config.particles.leafFlutterStrength);
    super(geometry, material);
    this.frustumCulled = false;
    this.renderOrder = 2;
  }

  set scatter(value: number) {
    this.material.uniforms.uScatter.value = value;
  }

  update(timeSeconds: number): void {
    this.material.uniforms.uTime.value = timeSeconds;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function createModelLeafGeometry(
  allPositions: Float32Array,
  particleCount: number,
  count: number,
  config: ExperienceConfig,
): InstancedBufferGeometry {
  const babyPositions = new Float32Array(count * 3);
  const scatterPositions = new Float32Array(count * 3);
  const randomValues = new Float32Array(count);
  const sizes = new Float32Array(count);
  const angles = new Float32Array(count);
  const tones = new Float32Array(count);
  const random = mulberry32(0x4c454146);
  const stride = particleCount / count;
  const [minimumSize, maximumSize] = config.particles.structuralLeafSize;

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.min(particleCount - 1, Math.floor((index + 0.5) * stride));
    babyPositions[index * 3] = allPositions[sourceIndex * 3];
    babyPositions[index * 3 + 1] = allPositions[sourceIndex * 3 + 1];
    babyPositions[index * 3 + 2] = allPositions[sourceIndex * 3 + 2];

    const seed = random();
    const angle = random() * Math.PI * 2;
    const radius = 1.15 + random() ** 0.58 * 2.7;
    scatterPositions[index * 3] = Math.cos(angle) * radius * 0.9 + (random() - 0.5) * 0.5;
    scatterPositions[index * 3 + 1] = (random() - 0.5) * 3.9 + Math.sin(angle * 2) * 0.32;
    scatterPositions[index * 3 + 2] = Math.sin(angle) * radius * 0.56 + (random() - 0.5) * 0.94;
    randomValues[index] = seed;
    sizes[index] = minimumSize + random() * (maximumSize - minimumSize);
    angles[index] = random() * Math.PI * 2;
    tones[index] = random();
  }

  const geometry = new InstancedBufferGeometry();
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('position', new Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0.5, 0.5, 0,
    -0.5, 0.5, 0,
  ], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ], 2));
  geometry.setAttribute('aBabyPosition', new InstancedBufferAttribute(babyPositions, 3));
  geometry.setAttribute('aScatterPosition', new InstancedBufferAttribute(scatterPositions, 3));
  geometry.setAttribute('aRandom', new InstancedBufferAttribute(randomValues, 1));
  geometry.setAttribute('aSize', new InstancedBufferAttribute(sizes, 1));
  geometry.setAttribute('aAngle', new InstancedBufferAttribute(angles, 1));
  geometry.setAttribute('aTone', new InstancedBufferAttribute(tones, 1));
  geometry.instanceCount = count;
  return geometry;
}

function createLeafMaterial(
  leafTexture: Texture,
  flutterStrength: number,
): ShaderMaterial {
  leafTexture.colorSpace = NoColorSpace;
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScatter: { value: 1 },
      uLeafMap: { value: leafTexture },
      uOpacity: { value: 0.52 },
      uFlutterStrength: { value: flutterStrength },
    },
    vertexShader: modelVertexShader,
    fragmentShader: leafFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    side: DoubleSide,
  });
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
