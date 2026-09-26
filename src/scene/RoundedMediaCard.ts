import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three';

export interface RoundedCardMetrics {
  canvasWidth: number;
  canvasHeight: number;
  innerWidth: number;
  innerHeight: number;
  leftBorder: number;
  rightBorder: number;
  topBorder: number;
  bottomBorder: number;
  cornerRadius: number;
}

export function calculateRoundedCardMetrics(
  sourceWidth: number,
  sourceHeight: number,
): RoundedCardMetrics {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);
  const scale = Math.min(1, 1024 / Math.max(safeWidth, safeHeight));
  const innerWidth = Math.max(1, Math.round(safeWidth * scale));
  const innerHeight = Math.max(1, Math.round(safeHeight * scale));
  const border = Math.max(7, Math.round(Math.max(innerWidth, innerHeight) * 0.028));

  return {
    canvasWidth: innerWidth + border * 2,
    canvasHeight: innerHeight + border * 2,
    innerWidth,
    innerHeight,
    leftBorder: border,
    rightBorder: border,
    topBorder: border,
    bottomBorder: border,
    cornerRadius: Math.max(border + 2, Math.round(Math.max(innerWidth, innerHeight) * 0.055)),
  };
}

export function createRoundedMediaCardTexture(source: Texture): CanvasTexture {
  const image = source.image as CanvasImageSource & {
    naturalWidth?: number;
    naturalHeight?: number;
    width: number;
    height: number;
  };
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const metrics = calculateRoundedCardMetrics(sourceWidth, sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = metrics.canvasWidth;
  canvas.height = metrics.canvasHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create media card canvas.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  roundedRectPath(
    context,
    0.5,
    0.5,
    metrics.canvasWidth - 1,
    metrics.canvasHeight - 1,
    metrics.cornerRadius,
  );
  context.fillStyle = 'rgba(241, 211, 153, 0.88)';
  context.fill();

  const innerRadius = Math.max(4, metrics.cornerRadius - metrics.leftBorder);
  context.save();
  roundedRectPath(
    context,
    metrics.leftBorder,
    metrics.topBorder,
    metrics.innerWidth,
    metrics.innerHeight,
    innerRadius,
  );
  context.clip();
  context.drawImage(
    image,
    metrics.leftBorder,
    metrics.topBorder,
    metrics.innerWidth,
    metrics.innerHeight,
  );
  context.restore();

  roundedRectPath(
    context,
    metrics.leftBorder,
    metrics.topBorder,
    metrics.innerWidth,
    metrics.innerHeight,
    innerRadius,
  );
  context.strokeStyle = 'rgba(255, 245, 218, 0.32)';
  context.lineWidth = 1;
  context.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}

export function createRoundedMediaOutlineTexture(
  sourceWidth: number,
  sourceHeight: number,
): CanvasTexture {
  const scale = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight, 1));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create media outline canvas.');

  roundedRectPath(
    context,
    0.5,
    0.5,
    width - 1,
    height - 1,
    Math.max(3, Math.round(Math.max(width, height) * 0.055)),
  );
  context.fillStyle = '#f7d79a';
  context.fill();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}
