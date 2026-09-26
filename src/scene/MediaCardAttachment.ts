import type { Object3D } from 'three';

export function attachMediaCardsToModel(modelRoot: Object3D, cards: Object3D): void {
  modelRoot.add(cards);
}
