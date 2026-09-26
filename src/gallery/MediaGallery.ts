import type { MediaGalleryConfig, MediaItem } from '../config';
import { MediaGalleryState } from './MediaGalleryState';

export class MediaGallery {
  private readonly dialog: HTMLDialogElement;
  private readonly stage: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly previousButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly rail: HTMLElement;
  private readonly state: MediaGalleryState;
  private previousFocus: HTMLElement | null = null;

  constructor(host: HTMLElement, private readonly config: MediaGalleryConfig) {
    this.state = new MediaGalleryState(config.items.length);
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'media-gallery';
    this.dialog.setAttribute('aria-labelledby', 'media-gallery-title');
    this.dialog.innerHTML = `
      <div class="media-gallery-shell">
        <header class="media-gallery-header">
          <div>
            <p class="eyebrow">MEMORIES IN MOONLIGHT</p>
            <h2 id="media-gallery-title"></h2>
          </div>
          <div class="media-gallery-meta">
            <span class="media-gallery-counter" aria-live="polite"></span>
            <button class="media-gallery-close" type="button" aria-label="关闭纪念影像">×</button>
          </div>
        </header>
        <div class="media-gallery-body">
          <button class="media-gallery-arrow is-previous" type="button" aria-label="上一个纪念影像">‹</button>
          <figure class="media-gallery-figure">
            <div class="media-gallery-stage"></div>
            <figcaption></figcaption>
          </figure>
          <button class="media-gallery-arrow is-next" type="button" aria-label="下一个纪念影像">›</button>
        </div>
        <div class="media-gallery-rail" role="tablist" aria-label="纪念影像列表"></div>
      </div>
    `;
    host.append(this.dialog);

    requiredElement<HTMLElement>(this.dialog, '#media-gallery-title').textContent = config.title;
    this.stage = requiredElement(this.dialog, '.media-gallery-stage');
    this.caption = requiredElement(this.dialog, 'figcaption');
    this.counter = requiredElement(this.dialog, '.media-gallery-counter');
    this.previousButton = requiredElement(this.dialog, '.is-previous');
    this.nextButton = requiredElement(this.dialog, '.is-next');
    this.rail = requiredElement(this.dialog, '.media-gallery-rail');

    requiredElement<HTMLButtonElement>(this.dialog, '.media-gallery-close')
      .addEventListener('click', this.close);
    this.previousButton.addEventListener('click', () => this.showRelative(-1));
    this.nextButton.addEventListener('click', () => this.showRelative(1));
    this.dialog.addEventListener('click', this.onBackdropClick);
    this.dialog.addEventListener('close', this.onClose);
    this.dialog.addEventListener('keydown', this.onKeyDown);
    this.renderRail();
    this.render();
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  open = (index = this.state.index): void => {
    this.state.select(index);
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  };

  close = (): void => {
    if (this.dialog.open) this.dialog.close();
  };

  dispose(): void {
    this.pauseVideo();
    this.dialog.remove();
  }

  private showRelative(offset: number): void {
    this.state.move(offset);
    this.render();
  }

  private render(): void {
    this.pauseVideo();
    this.stage.replaceChildren();

    if (this.config.items.length === 0) {
      this.renderEmptyState();
      this.caption.textContent = '在 experience.config.json 中加入照片或短视频后，它们会自动出现在这里。';
      this.counter.textContent = '待添加';
      this.previousButton.hidden = true;
      this.nextButton.hidden = true;
      this.rail.hidden = true;
      return;
    }

    const item = this.config.items[this.state.index];
    this.stage.append(this.createMediaElement(item));
    this.caption.textContent = item.caption || item.alt;
    this.counter.textContent = `${String(this.state.index + 1).padStart(2, '0')} / ${String(this.state.count).padStart(2, '0')}`;
    const hasMultipleItems = this.state.count > 1;
    this.previousButton.hidden = !hasMultipleItems;
    this.nextButton.hidden = !hasMultipleItems;
    this.rail.hidden = !hasMultipleItems;
    this.updateRailSelection();
  }

  private createMediaElement(item: MediaItem): HTMLImageElement | HTMLVideoElement {
    if (item.kind === 'video') {
      const video = document.createElement('video');
      video.src = item.src;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      if (item.poster) video.poster = item.poster;
      video.setAttribute('aria-label', item.alt);
      return video;
    }

    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt;
    image.decoding = 'async';
    return image;
  }

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'media-gallery-empty';
    empty.innerHTML = `
      <span class="media-gallery-empty-moon" aria-hidden="true"></span>
      <img src="/assets/leaf/animal-crossing-leaf-veined.svg" alt="" />
      <strong>纪念影像将在这里亮起</strong>
      <p>可以放入任意数量的照片与视频</p>
    `;
    this.stage.append(empty);
  }

  private renderRail(): void {
    this.rail.replaceChildren(...this.config.items.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-gallery-thumbnail';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-label', `查看第 ${index + 1} 个纪念影像：${item.alt}`);
      const thumbnail = item.thumbnail ?? (item.kind === 'image' ? item.src : item.poster);
      if (thumbnail) {
        const image = document.createElement('img');
        image.src = thumbnail;
        image.alt = '';
        image.loading = 'lazy';
        button.append(image);
      } else {
        const videoMark = document.createElement('span');
        videoMark.textContent = '▶';
        videoMark.setAttribute('aria-hidden', 'true');
        button.append(videoMark);
      }
      button.addEventListener('click', () => {
        this.state.select(index);
        this.render();
      });
      return button;
    }));
  }

  private updateRailSelection(): void {
    [...this.rail.querySelectorAll<HTMLButtonElement>('.media-gallery-thumbnail')]
      .forEach((button, index) => {
        const selected = index === this.state.index;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected) button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
  }

  private pauseVideo(): void {
    this.stage?.querySelector('video')?.pause();
  }

  private readonly onBackdropClick = (event: MouseEvent): void => {
    if (event.target === this.dialog) this.close();
  };

  private readonly onClose = (): void => {
    this.pauseVideo();
    this.previousFocus?.focus();
    this.previousFocus = null;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') this.showRelative(-1);
    if (event.key === 'ArrowRight') this.showRelative(1);
  };
}

function requiredElement<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required media gallery element is missing: ${selector}`);
  return element;
}
