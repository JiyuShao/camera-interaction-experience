import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { attachMediaCardsToModel } from './MediaCardAttachment';

describe('attachMediaCardsToModel', () => {
  it('keeps scattered cards in model space so they follow every later rotation', () => {
    const root = new Group();
    const cards = new Group();
    const marker = new Group();
    marker.position.set(0.4, 0.2, 0.1);
    cards.add(marker);
    attachMediaCardsToModel(root, cards);
    root.rotation.y = Math.PI / 2;
    root.updateMatrixWorld(true);

    const world = marker.getWorldPosition(new Vector3());
    expect(cards.parent).toBe(root);
    expect(world.x).toBeCloseTo(0.1, 5);
    expect(world.z).toBeCloseTo(-0.4, 5);
  });
});
