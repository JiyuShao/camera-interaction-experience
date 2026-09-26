import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { autoMediaControlState } from './AutoMediaControl';

describe('automatic media mode controls', () => {
  it('provides visible inactive and active button states', () => {
    expect(autoMediaControlState(false)).toEqual({
      label: '自动',
      pressed: 'false',
      title: '开启自动回忆',
    });
    expect(autoMediaControlState(true)).toEqual({
      label: '停止',
      pressed: 'true',
      title: '停止自动回忆',
    });
  });

  it('renders a manual automatic-mode toggle in the main control dock', () => {
    const htmlUrl = new URL('../main.ts', import.meta.url);
    const html = readFileSync(fileURLToPath(htmlUrl), 'utf8');

    expect(html).toContain('id="auto-media-button"');
    expect(html).toContain('id="auto-media-button-label"');
  });
});
