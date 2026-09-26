export class MediaGalleryState {
  private currentIndex = 0;

  constructor(private readonly itemCount: number) {
    if (!Number.isInteger(itemCount) || itemCount < 0) {
      throw new Error('Media item count must be a non-negative integer.');
    }
  }

  get index(): number {
    return this.currentIndex;
  }

  get count(): number {
    return this.itemCount;
  }

  select(index: number): number {
    if (this.itemCount === 0) return this.currentIndex;
    this.currentIndex = wrap(index, this.itemCount);
    return this.currentIndex;
  }

  move(offset: number): number {
    return this.select(this.currentIndex + offset);
  }
}

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}
