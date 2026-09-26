import { describe, expect, it, vi } from 'vitest';
import type { AudioConfig } from '../config';
import { BackgroundMusic } from './BackgroundMusic';

function createFixture(overrides: Partial<AudioConfig> = {}) {
  const listeners = new Map<string, Set<() => void>>();
  const audio = {
    src: '',
    preload: '',
    loop: false,
    volume: 1,
    paused: true,
    play: vi.fn(async () => {
      audio.paused = false;
      listeners.get('play')?.forEach((listener) => listener());
    }),
    pause: vi.fn(() => {
      audio.paused = true;
      listeners.get('pause')?.forEach((listener) => listener());
    }),
    load: vi.fn(),
    removeAttribute: vi.fn(),
    addEventListener: vi.fn((type: string, listener: () => void) => {
      const group = listeners.get(type) ?? new Set();
      group.add(listener);
      listeners.set(type, group);
    }),
    removeEventListener: vi.fn((type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    }),
  };
  const config: AudioConfig = {
    enabled: true,
    src: '/music.mp3',
    title: 'Music',
    volume: 0.35,
    loop: true,
    autoplay: true,
    ...overrides,
  };
  const states: string[] = [];
  const music = new BackgroundMusic(config, (state) => states.push(state), () => audio);
  return { audio, music, states };
}

describe('BackgroundMusic', () => {
  it('applies configuration and starts after the welcome interaction', async () => {
    const { audio, music, states } = createFixture();

    await music.playOnStart();

    expect(audio.preload).toBe('metadata');
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(0.35);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(states).toEqual(['paused', 'playing']);
  });

  it('remembers a manual pause instead of restarting on entry', async () => {
    const { audio, music } = createFixture();

    await music.toggle();
    await music.toggle();
    await music.playOnStart();

    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(music.playbackState).toBe('paused');
  });

  it('does not create playback when disabled', async () => {
    const factory = vi.fn();
    const states: string[] = [];
    const music = new BackgroundMusic(
      {
        enabled: false,
        src: '/music.mp3',
        title: 'Music',
        volume: 0.35,
        loop: true,
        autoplay: true,
      },
      (state) => states.push(state),
      factory,
    );

    await music.playOnStart();

    expect(factory).not.toHaveBeenCalled();
    expect(states).toEqual(['disabled']);
  });
});
