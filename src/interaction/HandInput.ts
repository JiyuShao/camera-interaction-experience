import type { HandFrame } from './HandFrame';
import { buildVideoConstraints, cameraOptions, type CameraOption } from './CameraSelection';

export type HandInputStatus = 'idle' | 'requesting' | 'loading' | 'active' | 'error' | 'unsupported';

export interface HandInputCallbacks {
  onStatus(status: HandInputStatus, message: string): void;
  onFrame(frame: HandFrame | null, timestamp: number): void;
  onCameras(cameras: CameraOption[], activeDeviceId: string): void;
}

interface HandWorkerResult {
  type: 'ready' | 'result' | 'disposed' | 'error';
  frame?: HandFrame | null;
  timestamp?: number;
  message?: string;
}

export class HandInput {
  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private frameId = 0;
  private lastInferenceAt = Number.NEGATIVE_INFINITY;
  private frameInFlight = false;
  private session = 0;
  private cameraSwitch = 0;
  private currentStatus: HandInputStatus = 'idle';

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly inferenceIntervalMs: number,
    private readonly callbacks: HandInputCallbacks,
  ) {
    navigator.mediaDevices?.addEventListener('devicechange', this.onDeviceChange);
  }

  get status(): HandInputStatus {
    return this.currentStatus;
  }

  async start(preferredDeviceId?: string): Promise<void> {
    if (['requesting', 'loading', 'active'].includes(this.currentStatus)) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !('createImageBitmap' in window)) {
      this.updateStatus('unsupported', '当前环境不支持摄像头手势，请继续使用触控或鼠标');
      return;
    }

    const session = ++this.session;
    this.updateStatus('requesting', '等待摄像头授权');

    try {
      const stream = await this.openCamera(preferredDeviceId);
      if (session !== this.session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      await this.useStream(stream);
      this.updateStatus('loading', '正在加载本地手势模型');
      await this.initializeWorker(session);
      if (session !== this.session) return;

      this.updateStatus('active', '请将一只手放入画面');
      await this.publishCameras();
      this.frameId = requestAnimationFrame(this.captureFrame);
    } catch (error) {
      if (session !== this.session) return;
      this.cleanup();
      this.updateStatus('error', cameraErrorMessage(error));
    }
  }

  stop(): void {
    this.session += 1;
    this.cleanup();
    this.callbacks.onFrame(null, performance.now());
    this.updateStatus('idle', '摄像头未启用');
  }

  dispose(): void {
    this.stop();
    navigator.mediaDevices?.removeEventListener('devicechange', this.onDeviceChange);
  }

  async selectCamera(deviceId: string): Promise<void> {
    if (!deviceId || this.currentStatus !== 'active') return;
    const currentDeviceId = this.activeDeviceId();
    if (deviceId === currentDeviceId) return;

    const cameraSwitch = ++this.cameraSwitch;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.updateStatus('loading', '正在切换摄像头');

    // Some mobile platforms cannot hold two camera streams at once.
    this.stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(deviceId),
      });
      if (cameraSwitch !== this.cameraSwitch) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      await this.useStream(stream);
      this.updateStatus('active', '请将一只手放入画面');
      await this.publishCameras();
      this.frameId = requestAnimationFrame(this.captureFrame);
    } catch (error) {
      if (cameraSwitch !== this.cameraSwitch) return;
      try {
        const fallback = await this.openCamera(currentDeviceId || undefined);
        if (cameraSwitch !== this.cameraSwitch) {
          fallback.getTracks().forEach((track) => track.stop());
          return;
        }
        await this.useStream(fallback);
        this.updateStatus('active', '摄像头切换失败，已恢复原摄像头');
        await this.publishCameras();
        this.frameId = requestAnimationFrame(this.captureFrame);
      } catch {
        this.cleanup();
        this.updateStatus('error', cameraErrorMessage(error));
      }
    }
  }

  private initializeWorker(session: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./hand.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      let initialized = false;
      const timeout = window.setTimeout(() => reject(new Error('手势模型加载超时')), 20_000);

      worker.onmessage = (event: MessageEvent<HandWorkerResult>) => {
        if (session !== this.session) return;
        const message = event.data;
        if (message.type === 'ready') {
          window.clearTimeout(timeout);
          initialized = true;
          resolve();
          return;
        }
        if (message.type === 'result') {
          this.frameInFlight = false;
          this.callbacks.onFrame(message.frame ?? null, message.timestamp ?? performance.now());
          return;
        }
        if (message.type === 'error') {
          this.frameInFlight = false;
          window.clearTimeout(timeout);
          const error = new Error(message.message ?? '手势识别失败');
          if (!initialized) {
            reject(error);
          } else {
            this.cleanup();
            this.updateStatus('error', '手势识别已停止，请重试');
            console.error(error);
          }
        }
      };
      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        const error = new Error(event.message || '手势识别线程启动失败');
        if (!initialized) {
          reject(error);
        } else {
          this.cleanup();
          this.updateStatus('error', '手势识别线程已停止，请重试');
          console.error(error);
        }
      };

      const baseUrl = import.meta.env.BASE_URL;
      const assetUrl = (path: string): string =>
        new URL(`${baseUrl}${path}`, window.location.origin).href;
      worker.postMessage({
        type: 'initialize',
        wasmBaseUrl: assetUrl('assets/mediapipe/wasm'),
        modelUrl: assetUrl('assets/mediapipe/models/hand_landmarker.task'),
      });
    });
  }

  private async openCamera(preferredDeviceId?: string): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(preferredDeviceId),
      });
    } catch (error) {
      if (!preferredDeviceId || !isUnavailableDeviceError(error)) throw error;
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(),
      });
    }
  }

  private async useStream(stream: MediaStream): Promise<void> {
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    this.frameInFlight = false;
    this.lastInferenceAt = Number.NEGATIVE_INFINITY;
  }

  private activeDeviceId(): string {
    return this.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? '';
  }

  private async publishCameras(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.callbacks.onCameras(cameraOptions(devices), this.activeDeviceId());
    } catch (error) {
      console.warn('Unable to enumerate camera devices.', error);
      this.callbacks.onCameras([], this.activeDeviceId());
    }
  }

  private readonly onDeviceChange = (): void => {
    if (this.currentStatus === 'active') void this.publishCameras();
  };

  private readonly captureFrame = (timestamp: number): void => {
    if (this.currentStatus !== 'active') return;
    this.frameId = requestAnimationFrame(this.captureFrame);
    if (
      this.frameInFlight ||
      this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      timestamp - this.lastInferenceAt < this.inferenceIntervalMs
    ) return;

    this.frameInFlight = true;
    this.lastInferenceAt = timestamp;
    void createImageBitmap(this.video)
      .then((bitmap) => {
        if (!this.worker || this.currentStatus !== 'active') {
          bitmap.close();
          this.frameInFlight = false;
          return;
        }
        this.worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
      })
      .catch((error) => {
        this.frameInFlight = false;
        console.warn('Unable to capture a camera frame for hand tracking.', error);
      });
  };

  private cleanup(): void {
    this.cameraSwitch += 1;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.frameInFlight = false;
    this.lastInferenceAt = Number.NEGATIVE_INFINITY;

    if (this.worker) {
      const worker = this.worker;
      worker.postMessage({ type: 'dispose' });
      window.setTimeout(() => worker.terminate(), 100);
      this.worker = null;
    }

    this.stopStream();
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
  }

  private updateStatus(status: HandInputStatus, message: string): void {
    this.currentStatus = status;
    this.callbacks.onStatus(status, message);
  }
}

function isUnavailableDeviceError(error: unknown): boolean {
  return error instanceof DOMException &&
    ['NotFoundError', 'OverconstrainedError', 'DevicesNotFoundError'].includes(error.name);
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return '摄像头权限未开启，可在浏览器设置中允许后重试';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return '没有找到可用摄像头';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return '摄像头正被其他应用占用';
    }
  }
  return error instanceof Error ? error.message : '摄像头手势启动失败';
}
