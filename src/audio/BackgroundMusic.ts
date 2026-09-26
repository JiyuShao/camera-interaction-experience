import type { AudioConfig } from '../config';

export type BackgroundMusicState = 'disabled' | 'paused' | 'playing';

interface AudioElementLike {
  src: string;
  preload: string;
  loop: boolean;
  volume: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

type AudioFactory = (src: string) => AudioElementLike;

export class BackgroundMusic {
  private readonly audio?: AudioElementLike;
  private state: BackgroundMusicState;
  private userPaused = false;
  private disposed = false;

  constructor(
    private readonly config: AudioConfig,
    private readonly onStateChange: (state: BackgroundMusicState) => void,
    audioFactory: AudioFactory = (src) => new Audio(src),
  ) {
    this.state = config.enabled ? 'paused' : 'disabled';
    if (config.enabled) {
      this.audio = audioFactory(config.src);
      this.audio.preload = 'metadata';
      this.audio.loop = config.loop;
      this.audio.volume = Math.min(1, Math.max(0, config.volume));
      this.audio.addEventListener('play', this.handlePlay);
      this.audio.addEventListener('pause', this.handlePause);
      this.audio.addEventListener('ended', this.handlePause);
      this.audio.addEventListener('error', this.handlePause);
    }
    this.onStateChange(this.state);
  }

  get isEnabled(): boolean {
    return Boolean(this.audio);
  }

  get playbackState(): BackgroundMusicState {
    return this.state;
  }

  async playOnStart(): Promise<void> {
    if (!this.config.autoplay || this.userPaused) return;
    await this.play();
  }

  async toggle(): Promise<void> {
    if (!this.audio) return;
    if (!this.audio.paused || this.state === 'playing') {
      this.userPaused = true;
      this.audio.pause();
      this.setState('paused');
      return;
    }
    this.userPaused = false;
    await this.play();
  }

  dispose(): void {
    if (!this.audio || this.disposed) return;
    this.disposed = true;
    this.audio.removeEventListener('play', this.handlePlay);
    this.audio.removeEventListener('pause', this.handlePause);
    this.audio.removeEventListener('ended', this.handlePause);
    this.audio.removeEventListener('error', this.handlePause);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private async play(): Promise<void> {
    if (!this.audio || this.disposed) return;
    try {
      await this.audio.play();
      this.setState('playing');
    } catch {
      this.setState('paused');
    }
  }

  private readonly handlePlay = (): void => {
    this.setState('playing');
  };

  private readonly handlePause = (): void => {
    this.setState('paused');
  };

  private setState(state: BackgroundMusicState): void {
    if (this.disposed || this.state === state) return;
    this.state = state;
    this.onStateChange(state);
  }
}
