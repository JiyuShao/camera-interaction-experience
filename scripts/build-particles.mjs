import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(
  await readFile(resolve(projectRoot, 'experience.config.json'), 'utf8'),
);
const sourcePath = resolve(projectRoot, config.model.sourcePath);
const outputPath = resolve(
  projectRoot,
  'public',
  config.model.pointsUrl.replace(/^\//, ''),
);
const sampleCount = config.model.sampleCount;

const document = await new NodeIO().read(sourcePath);
const triangles = [];
let totalArea = 0;

for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;

  const matrix = node.getWorldMatrix();
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION');
    if (!position) continue;

    const positions = position.getArray();
    const indices = primitive.getIndices()?.getArray();
    const vertexCount = position.getCount();
    const indexCount = indices?.length ?? vertexCount;

    for (let i = 0; i + 2 < indexCount; i += 3) {
      const ia = indices ? Number(indices[i]) : i;
      const ib = indices ? Number(indices[i + 1]) : i + 1;
      const ic = indices ? Number(indices[i + 2]) : i + 2;
      const a = transformPoint(positions, ia, matrix);
      const b = transformPoint(positions, ib, matrix);
      const c = transformPoint(positions, ic, matrix);
      const area = triangleArea(a, b, c);
      if (area <= 1e-10) continue;
      totalArea += area;
      triangles.push({ a, b, c, cumulativeArea: totalArea });
    }
  }
}

if (!triangles.length || totalArea <= 0) {
  throw new Error(`No sampleable triangles found in ${sourcePath}`);
}

const random = mulberry32(0x4c454146);
const samples = new Float32Array(sampleCount * 3);
const boundsMin = [Infinity, Infinity, Infinity];
const boundsMax = [-Infinity, -Infinity, -Infinity];

for (let i = 0; i < sampleCount; i += 1) {
  const triangle = triangles[findTriangle(triangles, random() * totalArea)];
  const r1 = Math.sqrt(random());
  const r2 = random();
  const wa = 1 - r1;
  const wb = r1 * (1 - r2);
  const wc = r1 * r2;
  const point = [
    triangle.a[0] * wa + triangle.b[0] * wb + triangle.c[0] * wc,
    triangle.a[1] * wa + triangle.b[1] * wb + triangle.c[1] * wc,
    triangle.a[2] * wa + triangle.b[2] * wb + triangle.c[2] * wc,
  ];
  for (let axis = 0; axis < 3; axis += 1) {
    samples[i * 3 + axis] = point[axis];
    boundsMin[axis] = Math.min(boundsMin[axis], point[axis]);
    boundsMax[axis] = Math.max(boundsMax[axis], point[axis]);
  }
}

const center = boundsMin.map((value, axis) => (value + boundsMax[axis]) / 2);
const largestDimension = Math.max(
  ...boundsMax.map((value, axis) => value - boundsMin[axis]),
);
const normalizationScale = 2 / largestDimension;

for (let i = 0; i < samples.length; i += 3) {
  samples[i] = (samples[i] - center[0]) * normalizationScale;
  samples[i + 1] = (samples[i + 1] - center[1]) * normalizationScale;
  samples[i + 2] = (samples[i + 2] - center[2]) * normalizationScale;
}

const headerBytes = 16;
const output = Buffer.allocUnsafe(headerBytes + samples.byteLength);
output.write('SBP1', 0, 4, 'ascii');
output.writeUInt32LE(sampleCount, 4);
output.writeUInt32LE(3, 8);
output.writeUInt32LE(0, 12);
Buffer.from(samples.buffer).copy(output, headerBytes);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);

console.log(
  JSON.stringify(
    {
      source: sourcePath,
      output: outputPath,
      triangles: triangles.length,
      samples: sampleCount,
      outputBytes: output.byteLength,
      sourceBounds: { min: boundsMin, max: boundsMax },
    },
    null,
    2,
  ),
);

function transformPoint(array, index, matrix) {
  const offset = index * 3;
  const x = Number(array[offset]);
  const y = Number(array[offset + 1]);
  const z = Number(array[offset + 2]);
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
  ];
}

function triangleArea(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  return Math.hypot(...cross) * 0.5;
}

function findTriangle(items, target) {
  let low = 0;
  let high = items.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (items[middle].cumulativeArea < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
