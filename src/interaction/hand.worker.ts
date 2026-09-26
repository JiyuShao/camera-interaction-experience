import {
  FilesetResolver,
  HandLandmarker,
} from '@mediapipe/tasks-vision';
import { firstHandFrame, type HandFrame } from './HandFrame';

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

type WorkerMessage =
  | { type: 'initialize'; wasmBaseUrl: string; modelUrl: string }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'dispose' };

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; frame: HandFrame | null; timestamp: number }
  | { type: 'disposed' }
  | { type: 'error'; message: string };

const workerScope = self as unknown as WorkerScope;
let handLandmarker: HandLandmarker | null = null;

workerScope.onmessage = (event): void => {
  const message = event.data;
  if (message.type === 'initialize') {
    void initialize(message.wasmBaseUrl, message.modelUrl);
    return;
  }

  if (message.type === 'frame') {
    detect(message.bitmap, message.timestamp);
    return;
  }

  handLandmarker?.close();
  handLandmarker = null;
  workerScope.postMessage({ type: 'disposed' });
};

async function initialize(wasmBaseUrl: string, modelUrl: string): Promise<void> {
  try {
    const vision = await FilesetResolver.forVisionTasks(wasmBaseUrl, true);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });
    workerScope.postMessage({ type: 'ready' });
  } catch (error) {
    workerScope.postMessage({ type: 'error', message: errorMessage(error) });
  }
}

function detect(bitmap: ImageBitmap, timestamp: number): void {
  try {
    if (!handLandmarker) throw new Error('Hand Landmarker is not initialized.');
    const result = handLandmarker.detectForVideo(bitmap, timestamp);
    workerScope.postMessage({
      type: 'result',
      frame: firstHandFrame(result),
      timestamp,
    });
  } catch (error) {
    workerScope.postMessage({ type: 'error', message: errorMessage(error) });
  } finally {
    bitmap.close();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
