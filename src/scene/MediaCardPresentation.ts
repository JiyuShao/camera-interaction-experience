export function mediaVisibilityForScatter(scatter: number): number {
  const amount = Math.min(1, Math.max(0, (scatter - 0.32) / 0.53));
  return amount * amount * (3 - 2 * amount);
}
