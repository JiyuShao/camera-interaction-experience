import './styles.css';
import { BackgroundMusic, type BackgroundMusicState } from './audio/BackgroundMusic';
import { experienceConfig, type MediaItem } from './config';
import { MediaGallery } from './gallery/MediaGallery';
import { GestureController } from './interaction/GestureController';
import { GestureIntent } from './interaction/GestureIntent';
import { HandInput, type HandInputStatus } from './interaction/HandInput';
import { StarlightScene } from './scene/StarlightScene';
import { populateForegroundLeaves } from './scene/ForegroundLeafLayer';
import { ExperienceStateMachine, type ExperienceState } from './state/ExperienceStateMachine';
import { autoMediaControlState } from './ui/AutoMediaControl';
import { mediaFocusCaptionState } from './ui/MediaFocusCaption';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root was not found.');

document.title = `${experienceConfig.presentation.title} · ${experienceConfig.identity.name} · ${experienceConfig.identity.headline}`;
appRoot.innerHTML = `
  <main class="experience" data-state="loading">
    <div class="scene-stage" id="scene-stage" aria-hidden="true">
      <div class="sky-glow"></div>
      <div class="moon" aria-hidden="true"><span></span></div>
      <div class="cloud cloud-left" aria-hidden="true"></div>
      <div class="cloud cloud-right" aria-hidden="true"></div>
      <div class="scene-host" id="scene-host"></div>
      <div class="media-aim-reticle" aria-hidden="true">
        <span class="media-aim-glow"></span>
        <span class="media-aim-particles">
          ${[4, 18, 31, 47, 66, 92, 123, 146, 162, 177, 201, 228, 254, 276, 301, 323, 338, 350].map((angle, index) => `
            <i style="--particle-angle: ${angle}deg; --particle-size: ${index % 6 === 0 ? 3.2 : 1.25 + (index % 3) * 0.45}px; --particle-offset: ${-3 + (index % 7)}px; --particle-opacity: ${index % 6 === 0 ? 0.86 : 0.34 + (index % 4) * 0.11}; --particle-delay: ${-index * 0.29}s"></i>
          `).join('')}
        </span>
      </div>
      <div class="foreground-leaves" id="foreground-leaves" aria-hidden="true"></div>
      <div class="scene-vignette"></div>
      <div class="grain"></div>
    </div>

    <header class="topbar">
      <div class="brand" id="brand" aria-label="">
        <img src="/assets/leaf/animal-crossing-leaf-veined.svg" alt="" />
        <span id="brand-name"></span>
      </div>
      <div class="topbar-actions">
        <button class="music-toggle" id="music-toggle" type="button" data-playing="false" aria-pressed="false" aria-label="播放背景音乐">
          <span class="music-equalizer" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
        <button class="quiet-button" id="credits-button" type="button">作品信息</button>
      </div>
    </header>

    <section class="loading-panel" aria-live="polite">
      <div class="loading-symbol">
        <img src="/assets/leaf/animal-crossing-leaf-veined.svg" alt="" />
      </div>
      <p id="loading-message"></p>
      <span class="loading-line"><i></i></span>
    </section>

    <section class="welcome-panel" aria-labelledby="welcome-title">
      <p class="eyebrow" id="welcome-eyebrow"></p>
      <h1 id="welcome-title"><span id="welcome-name"></span><br /><em id="welcome-headline"></em></h1>
      <p class="welcome-copy"><span id="welcome-line-one"></span><br class="mobile-break" /><span id="welcome-line-two"></span></p>
      <button class="primary-button" id="start-button" type="button" disabled>
        <span>正在准备叶光</span>
        <i aria-hidden="true">✦</i>
      </button>
      <p class="welcome-meta"><span id="welcome-date"></span><b></b><span id="welcome-detail"></span></p>
    </section>

    <section class="identity-panel" aria-live="polite">
      <p class="eyebrow" id="scene-eyebrow"></p>
      <h2><span id="identity-name"></span> <em>·</em> <span id="identity-headline"></span></h2>
      <p><span id="identity-date"></span> · <span id="identity-detail"></span></p>
    </section>

    <aside class="media-focus-caption" id="media-focus-caption" role="status" aria-live="polite" aria-hidden="true">
      <span aria-hidden="true">✦</span>
      <p id="media-focus-caption-text"></p>
      <span aria-hidden="true">✦</span>
    </aside>

    <aside class="interaction-hint">
      <span class="status-orb" aria-hidden="true"></span>
      <div>
        <strong id="state-label">正在准备</strong>
        <p id="interaction-copy">拖动旋转 · 双指或滚轮缩放 · 点击查看纪念</p>
      </div>
    </aside>

    <nav class="scene-controls" aria-label="粒子宝宝控制">
      <button id="gather-button" type="button">
        <span class="control-icon gather-icon" aria-hidden="true">✦</span>
        <span>聚合</span>
      </button>
      <button id="scatter-button" type="button">
        <span class="control-icon" aria-hidden="true">⁕</span>
        <span>散开</span>
      </button>
      <button id="media-button" type="button">
        <span class="control-icon" aria-hidden="true">◇</span>
        <span>纪念</span>
      </button>
      <button id="reset-button" type="button">
        <span class="control-icon" aria-hidden="true">↺</span>
        <span>复位</span>
      </button>
      <button id="auto-media-button" type="button" aria-pressed="false" title="开启自动回忆">
        <span class="control-icon" aria-hidden="true">🫰</span>
        <span id="auto-media-button-label">自动</span>
      </button>
      <button id="gesture-button" type="button" aria-pressed="false">
        <span class="control-icon" aria-hidden="true">🖐</span>
        <span id="gesture-button-label">手势</span>
      </button>
    </nav>

    <div class="quality-note" id="quality-note"></div>

    <aside class="gesture-preview" id="gesture-preview" data-status="idle" aria-hidden="true">
      <video id="gesture-video" muted playsinline></video>
      <div class="gesture-preview-shade"></div>
      <label class="camera-picker" id="camera-picker" hidden>
        <span>摄像头</span>
        <select id="camera-select" aria-label="选择摄像头"></select>
      </label>
      <div class="gesture-preview-status">
        <span class="gesture-live-dot" aria-hidden="true"></span>
        <strong id="gesture-status">摄像头未启用</strong>
      </div>
    </aside>

    <div class="gesture-toast" id="gesture-toast" role="status" aria-live="polite"></div>

    <dialog class="credits-dialog" id="credits-dialog">
      <button class="dialog-close" id="credits-close" type="button" aria-label="关闭">×</button>
      <p class="eyebrow" id="about-eyebrow"></p>
      <h2 id="about-title"></h2>
      <p id="about-description"></p>
      <div class="credit-block">
        <span id="creator-role"></span>
        <p><a id="creator-link" target="_blank" rel="noreferrer"></a></p>
      </div>
      <div class="credit-block">
        <span>3D MODEL</span>
        <p><a id="model-source" target="_blank" rel="noreferrer"></a> by <span id="model-author"></span></p>
        <a id="model-license" target="_blank" rel="noreferrer"></a>
      </div>
      <div class="credit-block">
        <span>LEAF SILHOUETTE</span>
        <p><a href="https://commons.wikimedia.org/wiki/File:Animal_Crossing_Leaf.svg" target="_blank" rel="noreferrer">Animal Crossing Leaf.svg</a>，并加入自定义发光叶脉。</p>
      </div>
      <div class="credit-block">
        <span>BACKGROUND MUSIC</span>
        <p id="music-credit"></p>
      </div>
    </dialog>
  </main>
`;

const experience = requiredElement<HTMLElement>('.experience');
populateForegroundLeaves(requiredElement('#foreground-leaves'), experienceConfig.particles);
const stateMachine = new ExperienceStateMachine();
const startButton = requiredElement<HTMLButtonElement>('#start-button');
const musicToggle = requiredElement<HTMLButtonElement>('#music-toggle');
const gatherButton = requiredElement<HTMLButtonElement>('#gather-button');
const scatterButton = requiredElement<HTMLButtonElement>('#scatter-button');
const mediaButton = requiredElement<HTMLButtonElement>('#media-button');
const resetButton = requiredElement<HTMLButtonElement>('#reset-button');
const autoMediaButton = requiredElement<HTMLButtonElement>('#auto-media-button');
const autoMediaButtonLabel = requiredElement<HTMLElement>('#auto-media-button-label');
const gestureButton = requiredElement<HTMLButtonElement>('#gesture-button');
const gestureButtonLabel = requiredElement<HTMLElement>('#gesture-button-label');
const gesturePreview = requiredElement<HTMLElement>('#gesture-preview');
const gestureVideo = requiredElement<HTMLVideoElement>('#gesture-video');
const gestureStatus = requiredElement<HTMLElement>('#gesture-status');
const cameraPicker = requiredElement<HTMLElement>('#camera-picker');
const cameraSelect = requiredElement<HTMLSelectElement>('#camera-select');
const gestureToast = requiredElement<HTMLElement>('#gesture-toast');
const interactionCopy = requiredElement<HTMLElement>('#interaction-copy');
const stateLabel = requiredElement<HTMLElement>('#state-label');
const mediaFocusCaption = requiredElement<HTMLElement>('#media-focus-caption');
const mediaFocusCaptionText = requiredElement<HTMLElement>('#media-focus-caption-text');
const creditsDialog = requiredElement<HTMLDialogElement>('#credits-dialog');
const backgroundMusic = new BackgroundMusic(
  experienceConfig.audio,
  updateMusicButton,
);
musicToggle.hidden = !backgroundMusic.isEnabled;
const mediaGallery = new MediaGallery(experience, experienceConfig.media);
const stateMessages: Record<ExperienceState, string> = {
  loading: '正在准备',
  welcome: '叶光已就绪',
  forming: '叶光正在相聚',
  baby: '轻轻呼吸着',
  scattering: '叶光缓缓散开',
  scattered: '等待再次相聚',
  error: '场景载入失败',
};

setText('#welcome-name', experienceConfig.identity.name);
setText('#welcome-headline', experienceConfig.identity.headline);
setText('#welcome-date', experienceConfig.identity.date);
setText('#welcome-detail', experienceConfig.identity.detail);
setText('#brand-name', experienceConfig.presentation.title);
setText('#loading-message', experienceConfig.presentation.loadingMessage);
setText('#welcome-eyebrow', experienceConfig.presentation.welcomeEyebrow);
setText('#welcome-line-one', experienceConfig.presentation.welcomeLines[0]);
setText('#welcome-line-two', experienceConfig.presentation.welcomeLines[1]);
setText('#scene-eyebrow', experienceConfig.presentation.sceneEyebrow);
setText('#about-eyebrow', experienceConfig.presentation.aboutEyebrow);
setText('#about-title', experienceConfig.presentation.title);
setText('#about-description', experienceConfig.presentation.aboutDescription);
setText('#identity-name', experienceConfig.identity.name);
setText('#identity-headline', experienceConfig.identity.headline);
setText('#identity-date', experienceConfig.identity.date);
setText('#identity-detail', experienceConfig.identity.detail);
setText('#model-author', experienceConfig.model.credit.author);
setText('#music-credit', experienceConfig.audio.title);
setText('#creator-role', experienceConfig.creator.role);
const brand = requiredElement<HTMLElement>('#brand');
brand.setAttribute('aria-label', experienceConfig.presentation.title);
const creatorLink = requiredElement<HTMLAnchorElement>('#creator-link');
creatorLink.textContent = experienceConfig.creator.name;
if (experienceConfig.creator.url) {
  creatorLink.href = experienceConfig.creator.url;
} else {
  creatorLink.removeAttribute('href');
  creatorLink.removeAttribute('target');
  creatorLink.removeAttribute('rel');
}

const sourceLink = requiredElement<HTMLAnchorElement>('#model-source');
sourceLink.textContent = experienceConfig.model.credit.title;
sourceLink.href = experienceConfig.model.credit.sourceUrl;
const licenseLink = requiredElement<HTMLAnchorElement>('#model-license');
licenseLink.textContent = `${experienceConfig.model.credit.license} · 已为粒子体验优化修改`;
licenseLink.href = experienceConfig.model.credit.licenseUrl;

let starlightScene: StarlightScene | null = null;
let toastTimer = 0;
let autoMediaModeActive = false;
const gestureIntent = new GestureIntent();

const gestureController = new GestureController(
  {
    confirmationMs: experienceConfig.gestures.confirmationMs,
    heartConfirmationMs: experienceConfig.gestures.heartConfirmationMs,
    evidenceFrames: experienceConfig.gestures.evidenceFrames,
    pinchReleaseMs: experienceConfig.gestures.pinchReleaseMs,
    lossGraceMs: experienceConfig.gestures.lossGraceMs,
    filterMinCutoff: experienceConfig.gestures.filterMinCutoff,
    filterBeta: experienceConfig.gestures.filterBeta,
    filterDerivativeCutoff: experienceConfig.gestures.filterDerivativeCutoff,
  },
  {
    onGesture: (gesture) => {
      const action = gestureIntent.resolve(gesture);
      if (action === 'toggle-auto-media') {
        toggleAutoMediaMode();
      } else if (autoMediaModeActive) {
        clearPinchProgress();
        gestureStatus.textContent = '🫰 自动回忆中 · 再次比心可关闭';
      } else if (action === 'gather') {
        clearPinchProgress();
        gestureStatus.textContent = '握拳 · 叶光聚合';
        requestGather();
      } else if (action === 'scatter') {
        clearPinchProgress();
        gestureStatus.textContent = '张掌 · 叶光散开';
        requestScatter();
      } else if (action === 'focus-media') {
        gesturePreview.dataset.intent = 'pinch';
        gesturePreview.style.setProperty('--pinch-progress', '1');
        const focusedLabel = starlightScene?.setMediaFocus(true);
        gestureStatus.textContent = focusedLabel
          ? `捏合聚焦 · ${focusedLabel}`
          : '将照片转到中央瞄准圈后再捏合';
      } else if (action === 'release-media') {
        clearPinchProgress();
        starlightScene?.setMediaFocus(false);
        gestureStatus.textContent = '松开 · 照片已复位';
      } else if (handInput.status === 'active') {
        clearPinchProgress();
        gestureStatus.textContent = '手掌已识别';
      }
    },
    onCandidate: (gesture, progress) => {
      if (mediaGallery.isOpen) return;
      if (gesture === 'finger-heart') {
        gesturePreview.dataset.intent = 'heart';
        gesturePreview.style.setProperty('--pinch-progress', String(progress));
        gestureStatus.textContent = progress < 1
          ? `朝上交叉比心 · 保持 ${Math.round(progress * 100)}%`
          : '比心已识别 · 正在切换自动回忆';
        return;
      }
      if (autoMediaModeActive) return;
      if (gesture !== 'pinch') {
        if (gesturePreview.dataset.intent === 'pinch' || gesturePreview.dataset.intent === 'heart') {
          clearPinchProgress();
          gestureStatus.textContent = '手掌已识别';
        }
        return;
      }
      gesturePreview.dataset.intent = 'pinch';
      gesturePreview.style.setProperty('--pinch-progress', String(progress));
      gestureStatus.textContent = progress < 1
        ? `其余三指张开捏合 · 保持 ${Math.round(progress * 100)}%`
        : '捏合已识别 · 正在放大最近照片';
    },
    onPalmMove: (x, y, timestamp) => {
      if (mediaGallery.isOpen) return;
      // The preview is mirrored, so mirror landmark X to keep movement intuitive.
      starlightScene?.setGesturePose(1 - x, y, timestamp);
    },
    onTrackingChange: (hasHand) => {
      gesturePreview.classList.toggle('has-hand', hasHand);
      if (!hasHand) {
        clearPinchProgress();
        starlightScene?.endGesturePose();
      }
      if (handInput.status === 'active' && !hasHand && !autoMediaModeActive) {
        gestureStatus.textContent = '请将一只手放入画面';
      }
    },
  },
);

const handInput = new HandInput(
  gestureVideo,
  1000 / experienceConfig.gestures.inferenceFps,
  {
    onStatus: updateGestureUI,
    onFrame: (frame, timestamp) => gestureController.process(frame, timestamp),
    onCameras: (cameras, activeDeviceId) => {
      cameraSelect.replaceChildren(
        ...cameras.map((camera) => new Option(camera.label, camera.deviceId)),
      );
      cameraPicker.hidden = cameras.length < 2;
      if (activeDeviceId && cameras.some((camera) => camera.deviceId === activeDeviceId)) {
        cameraSelect.value = activeDeviceId;
        savePreferredCamera(activeDeviceId);
      }
    },
  },
);

stateMachine.onChange((state) => {
  experience.dataset.state = state;
  stateLabel.textContent = autoMediaModeActive ? '自动回忆中' : stateMessages[state];
  gatherButton.disabled = state === 'baby' || state === 'forming' || state === 'loading' || state === 'welcome';
  scatterButton.disabled = state === 'scattered' || state === 'scattering' || state === 'loading' || state === 'welcome';
  mediaButton.disabled = state === 'loading' || state === 'welcome';
  autoMediaButton.disabled = state === 'loading' || state === 'welcome' || state === 'error';
});

startButton.addEventListener('click', () => {
  if (!starlightScene || stateMachine.state !== 'welcome') return;
  void backgroundMusic.playOnStart();
  stateMachine.transition('forming');
  window.setTimeout(() => {
    starlightScene?.gather(experienceConfig.particles.gatherDurationMs, () => {
      stateMachine.transition('baby');
    });
  }, 180);
});

gatherButton.addEventListener('click', () => {
  requestGather();
});

scatterButton.addEventListener('click', () => {
  requestScatter();
});

resetButton.addEventListener('click', () => starlightScene?.resetView());
musicToggle.addEventListener('click', () => {
  void backgroundMusic.toggle();
});
mediaButton.addEventListener('click', openMediaGallery);
autoMediaButton.addEventListener('click', toggleAutoMediaMode);
gestureButton.addEventListener('click', () => {
  if (['requesting', 'loading', 'active'].includes(handInput.status)) {
    setAutoMediaMode(false);
    handInput.stop();
    gestureController.reset();
    return;
  }
  gestureController.reset();
  void handInput.start(loadPreferredCamera());
});
cameraSelect.addEventListener('change', () => {
  cameraSelect.disabled = true;
  void handInput.selectCamera(cameraSelect.value).finally(() => {
    cameraSelect.disabled = handInput.status !== 'active';
  });
});

requiredElement<HTMLButtonElement>('#credits-button').addEventListener('click', () => {
  creditsDialog.showModal();
});
requiredElement<HTMLButtonElement>('#credits-close').addEventListener('click', () => creditsDialog.close());
creditsDialog.addEventListener('click', (event) => {
  if (event.target === creditsDialog) creditsDialog.close();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['requesting', 'loading', 'active'].includes(handInput.status)) {
    handInput.stop();
    gestureController.reset();
  }
});
window.addEventListener('beforeunload', () => handInput.dispose(), { once: true });
window.addEventListener('beforeunload', () => mediaGallery.dispose(), { once: true });
window.addEventListener('beforeunload', () => backgroundMusic.dispose(), { once: true });

void boot();

async function boot(): Promise<void> {
  try {
    starlightScene = new StarlightScene(
      requiredElement('#scene-host'),
      experienceConfig,
      {
        onTap: openMediaGallery,
        onMediaFocusChange: updateMediaFocusCaption,
      },
    );
    await starlightScene.initialize();
    requiredElement('#quality-note').textContent = `${starlightScene.quality.particleCount.toLocaleString()} 叶光粒子`;
    startButton.disabled = false;
    startButton.querySelector('span')!.textContent = '开启星光';
    stateMachine.transition('welcome');
  } catch (error) {
    console.error(error);
    stateMachine.transition('error');
    startButton.disabled = true;
    startButton.querySelector('span')!.textContent = '当前浏览器无法开启场景';
  }
}

function updateMediaFocusCaption(item: MediaItem | null): void {
  const state = mediaFocusCaptionState(item);
  mediaFocusCaptionText.textContent = state.text;
  mediaFocusCaption.classList.toggle('is-visible', state.visible);
  mediaFocusCaption.setAttribute('aria-hidden', String(!state.visible));
}

function requestGather(): void {
  if (!starlightScene || !['scattered', 'scattering'].includes(stateMachine.state)) return;
  setAutoMediaMode(false);
  starlightScene.setMediaFocus(false);
  stateMachine.transition('forming');
  starlightScene.gather(experienceConfig.particles.gatherDurationMs, () => {
    if (stateMachine.state === 'forming') stateMachine.transition('baby');
  });
}

function requestScatter(keepAutoMediaMode = false): void {
  if (!starlightScene || !['baby', 'forming'].includes(stateMachine.state)) return;
  if (!keepAutoMediaMode) setAutoMediaMode(false);
  stateMachine.transition('scattering');
  starlightScene.scatter(experienceConfig.particles.scatterDurationMs, () => {
    if (stateMachine.state === 'scattering') stateMachine.transition('scattered');
  });
}

function openMediaGallery(): void {
  if (!['forming', 'baby', 'scattering', 'scattered'].includes(stateMachine.state)) return;
  setAutoMediaMode(false);
  starlightScene?.setMediaFocus(false);
  mediaGallery.open();
}

function toggleAutoMediaMode(): void {
  if (autoMediaModeActive) {
    setAutoMediaMode(false);
    gestureStatus.textContent = '自动回忆已关闭 · 已回到手动模式';
    return;
  }
  if (!['forming', 'baby', 'scattering', 'scattered'].includes(stateMachine.state)) {
    gestureStatus.textContent = '请先开启星光';
    return;
  }
  setAutoMediaMode(true);
  requestScatter(true);
  gestureStatus.textContent = '自动回忆已开启 · 再次比心或点击“停止”可关闭';
}

function setAutoMediaMode(active: boolean): void {
  if (autoMediaModeActive === active) return;
  autoMediaModeActive = active;
  experience.dataset.autoMedia = String(active);
  const controlState = autoMediaControlState(active);
  autoMediaButtonLabel.textContent = controlState.label;
  autoMediaButton.setAttribute('aria-pressed', controlState.pressed);
  autoMediaButton.title = controlState.title;
  autoMediaButton.classList.toggle('is-active', active);
  clearPinchProgress();
  starlightScene?.setMediaFocus(false);
  starlightScene?.setAutoMediaTour(active);
  stateLabel.textContent = active ? '自动回忆中' : stateMessages[stateMachine.state];
  refreshInteractionCopy();
}

function updateGestureUI(status: HandInputStatus, message: string): void {
  experience.dataset.gesture = status;
  starlightScene?.setGestureSelectionActive(status === 'active');
  gesturePreview.dataset.status = status;
  gestureStatus.textContent = message;
  gesturePreview.setAttribute('aria-hidden', String(!['loading', 'active'].includes(status)));
  gestureButton.setAttribute('aria-pressed', String(status === 'active'));
  refreshInteractionCopy();

  const buttonLabels: Record<HandInputStatus, string> = {
    idle: '手势',
    requesting: '取消',
    loading: '取消',
    active: '关闭',
    error: '重试',
    unsupported: '不可用',
  };
  gestureButtonLabel.textContent = buttonLabels[status];
  gestureButton.disabled = status === 'unsupported';
  cameraSelect.disabled = status !== 'active';
  if (!['loading', 'active'].includes(status)) cameraPicker.hidden = true;
  if (status === 'error' || status === 'unsupported') showToast(message);
}

function updateMusicButton(state: BackgroundMusicState): void {
  const playing = state === 'playing';
  musicToggle.dataset.playing = String(playing);
  musicToggle.setAttribute('aria-pressed', String(playing));
  musicToggle.setAttribute(
    'aria-label',
    playing ? '关闭背景音乐' : `播放背景音乐：${experienceConfig.audio.title}`,
  );
  musicToggle.title = playing ? '关闭背景音乐' : `播放 ${experienceConfig.audio.title}`;
}

function refreshInteractionCopy(): void {
  if (autoMediaModeActive) {
    interactionCopy.textContent = '自动旋转 · 依次放大全部回忆 · 再次比心或点击“停止”';
  } else if (handInput.status === 'active') {
    interactionCopy.textContent = '✊ 聚合 · 🖐 散开 · 🫰 朝上交叉 · 🤏 三指张开捏合';
  } else {
    interactionCopy.textContent = '拖动旋转 · 双指或滚轮缩放 · 点击查看纪念';
  }
}

function clearPinchProgress(): void {
  delete gesturePreview.dataset.intent;
  gesturePreview.style.removeProperty('--pinch-progress');
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  gestureToast.textContent = message;
  gestureToast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => gestureToast.classList.remove('is-visible'), 3200);
}

const preferredCameraStorageKey = 'moonlit-leaf-baby.preferred-camera';

function loadPreferredCamera(): string | undefined {
  try {
    return window.localStorage.getItem(preferredCameraStorageKey) || undefined;
  } catch {
    return undefined;
  }
}

function savePreferredCamera(deviceId: string): void {
  try {
    window.localStorage.setItem(preferredCameraStorageKey, deviceId);
  } catch {
    // Camera selection still works for this session when storage is unavailable.
  }
}

function setText(selector: string, value: string): void {
  requiredElement<HTMLElement>(selector).textContent = value;
}

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element is missing: ${selector}`);
  return element;
}
