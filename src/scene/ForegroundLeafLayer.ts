import type { ExperienceConfig } from '../config';

export function populateForegroundLeaves(
  container: HTMLElement,
  config: ExperienceConfig['particles'],
): void {
  const random = mulberry32(0x4d4f4f4e);
  const [minimumSize, maximumSize] = config.foregroundLeafSize;

  container.replaceChildren(...Array.from({ length: config.foregroundLeafCount }, (_, index) => {
    const leaf = document.createElement('img');
    leaf.className = `foreground-leaf ${random() < 0.38 ? 'is-ivory' : 'is-gold'}`;
    leaf.src = '/assets/leaf/animal-crossing-leaf-veined.svg';
    leaf.alt = '';
    leaf.style.setProperty('--leaf-x', `${Math.round(random() * 100)}%`);
    leaf.style.setProperty('--leaf-size', `${minimumSize + random() * (maximumSize - minimumSize)}px`);
    leaf.style.setProperty('--leaf-drift', `${-70 + random() * 140}px`);
    leaf.style.setProperty('--leaf-duration', `${15 + random() * 13}s`);
    leaf.style.setProperty('--leaf-delay', `${-(index * 1.7 + random() * 8)}s`);
    const direction = random() < 0.5 ? -1 : 1;
    leaf.style.setProperty('--leaf-turn-mid', `${direction * 250}deg`);
    leaf.style.setProperty('--leaf-turn-flip', `${direction * 305}deg`);
    leaf.style.setProperty('--leaf-turn-end', `${direction * 610}deg`);
    leaf.style.setProperty('--leaf-blur', `${random() * 1.4}px`);
    return leaf;
  }));
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
