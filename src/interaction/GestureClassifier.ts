import {
  isHandFrame,
  type HandFrame,
  type HandLandmark,
} from './HandFrame';

export type { HandFrame, HandLandmark } from './HandFrame';

export type HandGesture = 'neutral' | 'open-palm' | 'fist' | 'pinch' | 'finger-heart';

export interface GestureObservation {
  gesture: HandGesture;
  palmX: number;
  palmY: number;
  palmSize: number;
  extendedFingers: number;
  pinchRatio: number;
  pinchScore: number;
  heartScore: number;
  contactScore: number;
  openScore: number;
  fistScore: number;
}

const fingerJoints = [
  { mcp: 5, pip: 6, tip: 8 },
  { mcp: 9, pip: 10, tip: 12 },
  { mcp: 13, pip: 14, tip: 16 },
  { mcp: 17, pip: 18, tip: 20 },
] as const;

const palmIndices = [0, 5, 9, 13, 17] as const;
const ENTER_SCORE = 0.68;
const EXIT_SCORE = 0.42;
const SCORE_MARGIN = 0.12;

export function classifyHand(
  input: HandFrame | readonly HandLandmark[],
  activeGesture: HandGesture = 'neutral',
): GestureObservation | null {
  const imageLandmarks = isHandFrame(input) ? input.imageLandmarks : input;
  const worldLandmarks = isHandFrame(input) && input.worldLandmarks.length >= 21
    ? input.worldLandmarks
    : imageLandmarks;
  if (imageLandmarks.length < 21 || worldLandmarks.length < 21) return null;

  const imagePalmSize = distance2d(imageLandmarks[0], imageLandmarks[9]);
  const worldPalmSize = (
    distance3d(worldLandmarks[0], worldLandmarks[9])
    + distance3d(worldLandmarks[5], worldLandmarks[17])
  ) / 2;
  if (
    !Number.isFinite(imagePalmSize)
    || !Number.isFinite(worldPalmSize)
    || imagePalmSize < 0.015
    || worldPalmSize < Number.EPSILON
  ) return null;

  const extensionScores = fingerJoints.map(({ mcp, pip, tip }) => fingerExtension(
    worldLandmarks[mcp],
    worldLandmarks[pip],
    worldLandmarks[tip],
  ));
  const extendedFingers = extensionScores.filter((score) => score >= 0.68).length;
  const supportExtension = average(extensionScores.slice(1));
  const supportCurl = 1 - supportExtension;
  const openScore = average(extensionScores);
  const fistScore = average(extensionScores.map((score) => 1 - score));

  const pinchRatio = distance3d(worldLandmarks[4], worldLandmarks[8]) / worldPalmSize;
  const contactScore = 1 - smoothstep(0.18, 0.42, pinchRatio);
  const indexReach = distance3d(worldLandmarks[8], worldLandmarks[0]) / worldPalmSize;
  const reachScore = smoothstep(0.74, 0.98, indexReach);
  const pinchSupportScore = smoothstep(0.55, 0.9, supportExtension);
  const pinchScore = contactScore * reachScore * pinchSupportScore;

  const palmAxis = normalizedDirection(imageLandmarks[0], imageLandmarks[9]);
  const heartTipReach = (
    projectionFromWrist(imageLandmarks[4], imageLandmarks[0], palmAxis)
    + projectionFromWrist(imageLandmarks[8], imageLandmarks[0], palmAxis)
  ) / (2 * imagePalmSize);
  const supportingTipReach = [12, 16, 20].reduce(
    (total, index) => total
      + projectionFromWrist(imageLandmarks[index], imageLandmarks[0], palmAxis),
    0,
  ) / (3 * imagePalmSize);
  const heartTipsLift = heartTipReach - supportingTipReach;
  const indexForwardDepth = (
    finiteZ(worldLandmarks[4]) - finiteZ(worldLandmarks[8])
  ) / worldPalmSize;
  const thumbAndIndexCross = segmentsIntersect(
    imageLandmarks[3],
    imageLandmarks[4],
    imageLandmarks[6],
    imageLandmarks[8],
  );
  const imagePinchRatio = distance2d(imageLandmarks[4], imageLandmarks[8]) / imagePalmSize;
  const lateralAxis = { x: -palmAxis.y, y: palmAxis.x };
  const baseLateralOrder = projectionFromWrist(
    imageLandmarks[3],
    imageLandmarks[6],
    lateralAxis,
  );
  const tipLateralOrder = projectionFromWrist(
    imageLandmarks[4],
    imageLandmarks[8],
    lateralAxis,
  );
  const reversesLateralOrder = baseLateralOrder * tipLateralOrder <= 0;
  const thumbUpwardReach = projectionFromWrist(
    imageLandmarks[4],
    imageLandmarks[3],
    palmAxis,
  ) / imagePalmSize;
  const indexUpwardReach = projectionFromWrist(
    imageLandmarks[8],
    imageLandmarks[6],
    palmAxis,
  ) / imagePalmSize;
  const hasUpwardOrderedCross = imagePinchRatio < 0.42
    && reversesLateralOrder
    && thumbUpwardReach > 0.14
    && indexUpwardReach > 0.14;
  const hasClearCloseCross = (thumbAndIndexCross && imagePinchRatio < 0.32)
    || hasUpwardOrderedCross;
  const heartContactScore = Math.max(
    1 - smoothstep(0.3, 0.54, pinchRatio),
    hasClearCloseCross ? 0.92 : 0,
  );
  const depthAndLiftEvidence = smoothstep(0.08, 0.14, heartTipsLift)
    * smoothstep(0.06, 0.16, indexForwardDepth);
  // A clear crossed shape must be invariant to palm/front-back orientation.
  // MediaPipe depth becomes noisy when thumb and index occlude one another,
  // so depth remains auxiliary only for poses without a reliable 2D cross.
  const crossingEvidence = hasClearCloseCross ? 0.95 : 0;
  const heartScore = heartContactScore
    * smoothstep(0.58, 0.88, supportCurl)
    * Math.max(depthAndLiftEvidence, crossingEvidence);

  const center = averageLandmarks(palmIndices.map((index) => imageLandmarks[index]));
  const observation: GestureObservation = {
    gesture: 'neutral',
    palmX: center.x,
    palmY: center.y,
    palmSize: imagePalmSize,
    extendedFingers,
    pinchRatio,
    pinchScore,
    heartScore,
    contactScore,
    openScore,
    fistScore,
  };
  observation.gesture = resolveGesture(observation, activeGesture);
  return observation;
}

export function resolveGesture(
  observation: GestureObservation,
  activeGesture: HandGesture = 'neutral',
): HandGesture {
  const { heartScore, pinchScore } = observation;
  if (
    activeGesture === 'finger-heart'
    && heartScore >= EXIT_SCORE
    && heartScore >= pinchScore - SCORE_MARGIN
  ) return 'finger-heart';
  if (
    activeGesture === 'pinch'
    && pinchScore >= EXIT_SCORE
    && pinchScore >= heartScore - SCORE_MARGIN
  ) return 'pinch';

  if (heartScore >= ENTER_SCORE && heartScore - pinchScore >= SCORE_MARGIN) {
    return 'finger-heart';
  }
  if (pinchScore >= ENTER_SCORE && pinchScore - heartScore >= SCORE_MARGIN) {
    return 'pinch';
  }

  // Keep close-tip poses with mixed support fingers in an uncertainty band.
  // This prevents a half fist from being forced into pinch or finger-heart.
  if (
    heartScore >= 0.1
    || (observation.pinchRatio < 0.3 && pinchScore >= 0.1)
  ) {
    return 'neutral';
  }
  if (observation.extendedFingers >= 3 && observation.openScore >= 0.68) return 'open-palm';
  if (observation.fistScore >= 0.72 && observation.extendedFingers <= 1) return 'fist';
  return 'neutral';
}

function fingerExtension(
  mcp: HandLandmark,
  pip: HandLandmark,
  tip: HandLandmark,
): number {
  return smoothstep(1.65, 2.72, jointAngle(mcp, pip, tip));
}

function jointAngle(first: HandLandmark, joint: HandLandmark, last: HandLandmark): number {
  const firstVector = subtract3d(first, joint);
  const lastVector = subtract3d(last, joint);
  const denominator = Math.max(vectorLength(firstVector) * vectorLength(lastVector), Number.EPSILON);
  return Math.acos(clamp(dot(firstVector, lastVector) / denominator, -1, 1));
}

function distance2d(first: HandLandmark, second: HandLandmark): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function distance3d(first: HandLandmark, second: HandLandmark): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    finiteZ(first) - finiteZ(second),
  );
}

function finiteZ(point: HandLandmark): number {
  return typeof point.z === 'number' && Number.isFinite(point.z) ? point.z : 0;
}

function subtract3d(first: HandLandmark, second: HandLandmark): [number, number, number] {
  return [first.x - second.x, first.y - second.y, finiteZ(first) - finiteZ(second)];
}

function dot(first: [number, number, number], second: [number, number, number]): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function vectorLength(vector: [number, number, number]): number {
  return Math.hypot(...vector);
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function averageLandmarks(landmarks: readonly HandLandmark[]): HandLandmark {
  const total = landmarks.reduce(
    (sum, landmark) => ({ x: sum.x + landmark.x, y: sum.y + landmark.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / landmarks.length, y: total.y / landmarks.length };
}

function normalizedDirection(start: HandLandmark, end: HandLandmark): HandLandmark {
  const length = Math.max(distance2d(start, end), Number.EPSILON);
  return { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
}

function projectionFromWrist(
  point: HandLandmark,
  wrist: HandLandmark,
  direction: HandLandmark,
): number {
  return (point.x - wrist.x) * direction.x + (point.y - wrist.y) * direction.y;
}

function segmentsIntersect(
  firstStart: HandLandmark,
  firstEnd: HandLandmark,
  secondStart: HandLandmark,
  secondEnd: HandLandmark,
): boolean {
  const firstSideStart = cross(firstStart, firstEnd, secondStart);
  const firstSideEnd = cross(firstStart, firstEnd, secondEnd);
  const secondSideStart = cross(secondStart, secondEnd, firstStart);
  const secondSideEnd = cross(secondStart, secondEnd, firstEnd);
  return firstSideStart * firstSideEnd <= 0 && secondSideStart * secondSideEnd <= 0;
}

function cross(origin: HandLandmark, end: HandLandmark, point: HandLandmark): number {
  return (end.x - origin.x) * (point.y - origin.y)
    - (end.y - origin.y) * (point.x - origin.x);
}
