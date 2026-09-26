export interface HandLandmark {
  x: number;
  y: number;
  z?: number;
}

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface HandFrame {
  imageLandmarks: HandLandmark[];
  worldLandmarks: HandLandmark[];
  handedness: Handedness;
}

interface HandednessCategory {
  categoryName?: string;
}

export interface HandLandmarkerResultLike {
  landmarks: readonly (readonly HandLandmark[])[];
  worldLandmarks?: readonly (readonly HandLandmark[])[];
  handedness?: readonly (readonly HandednessCategory[])[];
}

export function firstHandFrame(result: HandLandmarkerResultLike): HandFrame | null {
  const imageLandmarks = result.landmarks[0];
  if (!imageLandmarks || imageLandmarks.length < 21) return null;

  const worldLandmarks = result.worldLandmarks?.[0];
  const categoryName = result.handedness?.[0]?.[0]?.categoryName;
  const handedness: Handedness = categoryName === 'Left' || categoryName === 'Right'
    ? categoryName
    : 'Unknown';

  return {
    imageLandmarks: [...imageLandmarks],
    worldLandmarks: worldLandmarks?.length === imageLandmarks.length
      ? [...worldLandmarks]
      : [...imageLandmarks],
    handedness,
  };
}

export function isHandFrame(
  input: HandFrame | readonly HandLandmark[],
): input is HandFrame {
  return !Array.isArray(input) && 'imageLandmarks' in input;
}
